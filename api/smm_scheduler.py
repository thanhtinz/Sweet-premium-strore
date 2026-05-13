"""
Background scheduler for SMM scheduled & repeat orders.
Runs every 60s, picks up orders with status='scheduled' whose scheduled_at <= now,
submits them to the provider, and handles repeat logic.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("smm-scheduler")


async def smm_scheduler_loop():
    """Main loop — runs forever, checks every 60 seconds."""
    logger.info("SMM scheduler started")
    while True:
        try:
            await _process_scheduled_orders()
            await _process_repeat_orders()
        except Exception as e:
            logger.error(f"SMM scheduler error: {e}", exc_info=True)
        await asyncio.sleep(60)


async def _process_scheduled_orders():
    """Find scheduled orders whose time has come and submit them."""
    from db import SessionLocal
    from db.models import SmmOrder, SmmService, ApiProvider, User

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Cleanup orphan claims (status="submitting" stuck after crash) — older than 5 min revert to scheduled
        stuck_cutoff = now - timedelta(minutes=5)
        db.query(SmmOrder).filter(
            SmmOrder.status == "submitting",
            SmmOrder.updated_at < stuck_cutoff,
        ).update({SmmOrder.status: "scheduled"}, synchronize_session=False)
        db.commit()
        # M6: atomically claim due orders by flipping status to "submitting".
        # This prevents double-submission if the worker restarts mid-iteration.
        claimed_ids = [
            row.id for row in (
                db.query(SmmOrder.id)
                .filter(
                    SmmOrder.status == "scheduled",
                    SmmOrder.scheduled_at.isnot(None),
                    SmmOrder.scheduled_at <= now,
                )
                .with_for_update(skip_locked=True)
                .all()
            )
        ]
        if not claimed_ids:
            return
        db.query(SmmOrder).filter(SmmOrder.id.in_(claimed_ids)).update(
            {SmmOrder.status: "submitting"}, synchronize_session=False
        )
        db.commit()
        orders = db.query(SmmOrder).filter(SmmOrder.id.in_(claimed_ids)).all()

        logger.info(f"Processing {len(orders)} scheduled orders")
        for order in orders:
            try:
                await _submit_order(order, db)
            except Exception as e:
                logger.error(f"Failed to submit scheduled order {order.id}: {e}")
                order.status = "failed"
                order.admin_notes = f"Schedule error: {str(e)[:200]}"
        db.commit()
    finally:
        db.close()


async def _process_repeat_orders():
    """Find completed orders with repeat_remaining > 0 and create next repeat."""
    from db import SessionLocal
    from db.models import SmmOrder, SmmService, User

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Find orders that are completed/partial AND have repeats remaining
        orders = (
            db.query(SmmOrder)
            .filter(
                SmmOrder.status.in_(["completed", "partial"]),
                SmmOrder.repeat_remaining > 0,
                SmmOrder.repeat_interval > 0,
            )
            .all()
        )
        if not orders:
            return

        for order in orders:
            # Check if enough time has passed since last update
            last_time = order.updated_at or order.created_at
            next_time = last_time + timedelta(minutes=order.repeat_interval)
            if now < next_time:
                continue

            logger.info(f"Creating repeat for order {order.id} ({order.repeat_remaining} remaining)")
            try:
                child = await _create_repeat_child(order, db)
                order.repeat_remaining -= 1
                if child:
                    logger.info(f"Repeat child order {child.id} created for parent {order.id}")
            except Exception as e:
                logger.error(f"Failed to create repeat for order {order.id}: {e}")

        db.commit()
    finally:
        db.close()


async def _submit_order(order, db):
    """Submit an order to its SMM provider (same logic as user_place_order API call)."""
    from db.models import SmmService, ApiProvider
    from api.providers import get_provider

    svc = db.query(SmmService).get(order.smm_service_id) if order.smm_service_id else None

    if svc and svc.delivery_type == "api" and svc.api_provider_id and svc.external_service_id:
        provider = db.query(ApiProvider).get(svc.api_provider_id)
        if provider:
            adapter = get_provider(provider)
            result = await adapter.create_order(
                product_id="",
                plan_id=str(svc.external_service_id),
                quantity=order.quantity,
                fields_data={"link": order.link, "quantity": order.quantity},
            )
            order.external_order_id = result.order_id
            order.status = result.status if result.order_id else "failed"
            if result.status == "failed":
                # Refund
                from db.models import User
                user = db.query(User).filter(User.id == order.user_id).with_for_update().first()
                if user:
                    user.balance = (user.balance or 0) + order.charge
                order.admin_notes = f"API error: {result.message}"
            return
    # Manual or no-api — just set to pending
    order.status = "pending"


async def _create_repeat_child(parent, db):
    """Clone an order for repeat execution."""
    from db.models import SmmOrder
    import random, string

    code = "SMM" + "".join(random.choices(string.digits, k=8))

    child = SmmOrder(
        order_code=code,
        user_id=parent.user_id,
        smm_service_id=parent.smm_service_id,
        platform_name=parent.platform_name,
        category_name=parent.category_name,
        service_name=parent.service_name,
        link=parent.link,
        quantity=parent.quantity,
        charge=parent.charge,
        service_type=parent.service_type,
        delivery_type=parent.delivery_type,
        api_provider_id=parent.api_provider_id,
        parent_order_id=parent.id,
        repeat_count=0,
        repeat_remaining=0,
        repeat_interval=0,
    )

    # Check balance (lock user row)
    from db.models import User
    user = db.query(User).filter(User.id == parent.user_id).with_for_update().first()
    if not user or (user.balance or 0) < parent.charge:
        parent.repeat_remaining = 0
        parent.admin_notes = (parent.admin_notes or "") + "\nRepeat stopped: insufficient balance"
        return None

    user.balance = (user.balance or 0) - parent.charge
    db.add(child)
    db.flush()

    # Submit immediately
    await _submit_order(child, db)
    return child
