"""SMM Panel — API routes for platforms, categories, services, orders."""

import logging
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from db import get_db
from db.models import (
    ApiProvider,
    SmmCategory,
    SmmOrder,
    SmmPlatform,
    SmmService,
    User,
)
from api.auth_shared import get_current_admin, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/smm", tags=["smm"])


# ── Helpers ───────────────────────────────────────────────────

def _gen_order_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "SMM" + "".join(secrets.choice(chars) for _ in range(8))


def _slugify(text: str) -> str:
    import re
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


# ── Pydantic schemas ─────────────────────────────────────────

class PlatformCreate(BaseModel):
    name: str
    icon_url: str | None = None
    sort_order: int = 0
    is_active: bool = True

class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True

class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    rate: float = 0
    min_quantity: int = 1
    max_quantity: int = 10000
    delivery_type: str = "manual"
    api_provider_id: int | None = None
    external_service_id: int | None = None
    can_refill: bool = False
    can_cancel: bool = False
    is_active: bool = True
    sort_order: int = 0

class OrderPlace(BaseModel):
    service_id: int
    link: str
    quantity: int

class OrderStatusUpdate(BaseModel):
    status: str
    admin_notes: str | None = None

class SyncRequest(BaseModel):
    provider_id: int
    platform_id: int


# ══════════════════════════════════════════════════════════════
#  ADMIN — Platforms
# ══════════════════════════════════════════════════════════════

@router.get("/platforms", dependencies=[Depends(get_current_admin)])
def list_platforms(db: Session = Depends(get_db)):
    platforms = db.query(SmmPlatform).order_by(SmmPlatform.sort_order, SmmPlatform.id).all()
    result = []
    for p in platforms:
        cat_count = db.query(func.count(SmmCategory.id)).filter(SmmCategory.platform_id == p.id).scalar()
        svc_count = (
            db.query(func.count(SmmService.id))
            .join(SmmCategory, SmmService.category_id == SmmCategory.id)
            .filter(SmmCategory.platform_id == p.id)
            .scalar()
        )
        result.append({
            "id": p.id, "name": p.name, "slug": p.slug,
            "icon_url": p.icon_url, "sort_order": p.sort_order,
            "is_active": p.is_active,
            "category_count": cat_count, "service_count": svc_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return result


@router.post("/platforms", dependencies=[Depends(get_current_admin)])
def create_platform(body: PlatformCreate, db: Session = Depends(get_db)):
    slug = _slugify(body.name)
    if db.query(SmmPlatform).filter(SmmPlatform.slug == slug).first():
        raise HTTPException(400, "Platform slug already exists")
    p = SmmPlatform(name=body.name, slug=slug, icon_url=body.icon_url,
                    sort_order=body.sort_order, is_active=body.is_active)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "slug": p.slug}


@router.put("/platforms/{pid}", dependencies=[Depends(get_current_admin)])
def update_platform(pid: int, body: PlatformCreate, db: Session = Depends(get_db)):
    p = db.query(SmmPlatform).get(pid)
    if not p:
        raise HTTPException(404, "Platform not found")
    p.name = body.name
    p.icon_url = body.icon_url
    p.sort_order = body.sort_order
    p.is_active = body.is_active
    db.commit()
    return {"ok": True}


@router.delete("/platforms/{pid}", dependencies=[Depends(get_current_admin)])
def delete_platform(pid: int, db: Session = Depends(get_db)):
    p = db.query(SmmPlatform).get(pid)
    if not p:
        raise HTTPException(404, "Platform not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Categories
# ══════════════════════════════════════════════════════════════

@router.get("/platforms/{pid}/categories", dependencies=[Depends(get_current_admin)])
def list_categories(pid: int, db: Session = Depends(get_db)):
    cats = (
        db.query(SmmCategory)
        .filter(SmmCategory.platform_id == pid)
        .order_by(SmmCategory.sort_order, SmmCategory.id)
        .all()
    )
    result = []
    for c in cats:
        svc_count = db.query(func.count(SmmService.id)).filter(SmmService.category_id == c.id).scalar()
        result.append({
            "id": c.id, "platform_id": c.platform_id,
            "name": c.name, "slug": c.slug,
            "sort_order": c.sort_order, "is_active": c.is_active,
            "service_count": svc_count,
        })
    return result


@router.post("/platforms/{pid}/categories", dependencies=[Depends(get_current_admin)])
def create_category(pid: int, body: CategoryCreate, db: Session = Depends(get_db)):
    if not db.query(SmmPlatform).get(pid):
        raise HTTPException(404, "Platform not found")
    slug = _slugify(body.name)
    existing = db.query(SmmCategory).filter(
        SmmCategory.platform_id == pid, SmmCategory.slug == slug
    ).first()
    if existing:
        raise HTTPException(400, "Category slug already exists in this platform")
    c = SmmCategory(platform_id=pid, name=body.name, slug=slug,
                    sort_order=body.sort_order, is_active=body.is_active)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "slug": c.slug}


@router.put("/categories/{cid}", dependencies=[Depends(get_current_admin)])
def update_category(cid: int, body: CategoryCreate, db: Session = Depends(get_db)):
    c = db.query(SmmCategory).get(cid)
    if not c:
        raise HTTPException(404, "Category not found")
    c.name = body.name
    c.sort_order = body.sort_order
    c.is_active = body.is_active
    db.commit()
    return {"ok": True}


@router.delete("/categories/{cid}", dependencies=[Depends(get_current_admin)])
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.query(SmmCategory).get(cid)
    if not c:
        raise HTTPException(404, "Category not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Services
# ══════════════════════════════════════════════════════════════

@router.get("/categories/{cid}/services", dependencies=[Depends(get_current_admin)])
def list_services(cid: int, db: Session = Depends(get_db)):
    svcs = (
        db.query(SmmService)
        .filter(SmmService.category_id == cid)
        .order_by(SmmService.sort_order, SmmService.id)
        .all()
    )
    return [
        {
            "id": s.id, "category_id": s.category_id,
            "name": s.name, "description": s.description,
            "rate": s.rate, "min_quantity": s.min_quantity, "max_quantity": s.max_quantity,
            "delivery_type": s.delivery_type,
            "api_provider_id": s.api_provider_id,
            "external_service_id": s.external_service_id,
            "can_refill": s.can_refill, "can_cancel": s.can_cancel,
            "is_active": s.is_active, "sort_order": s.sort_order,
        }
        for s in svcs
    ]


@router.get("/services/all", dependencies=[Depends(get_current_admin)])
def list_all_services(db: Session = Depends(get_db)):
    """All services with platform/category info for admin."""
    svcs = (
        db.query(SmmService)
        .join(SmmCategory, SmmService.category_id == SmmCategory.id)
        .join(SmmPlatform, SmmCategory.platform_id == SmmPlatform.id)
        .order_by(SmmPlatform.sort_order, SmmCategory.sort_order, SmmService.sort_order)
        .all()
    )
    result = []
    for s in svcs:
        cat = s.category
        plat = cat.platform if cat else None
        result.append({
            "id": s.id, "name": s.name, "rate": s.rate,
            "min_quantity": s.min_quantity, "max_quantity": s.max_quantity,
            "delivery_type": s.delivery_type,
            "can_refill": s.can_refill, "is_active": s.is_active,
            "category_name": cat.name if cat else "",
            "platform_name": plat.name if plat else "",
            "platform_icon": plat.icon_url if plat else "",
        })
    return result


@router.post("/categories/{cid}/services", dependencies=[Depends(get_current_admin)])
def create_service(cid: int, body: ServiceCreate, db: Session = Depends(get_db)):
    if not db.query(SmmCategory).get(cid):
        raise HTTPException(404, "Category not found")
    s = SmmService(
        category_id=cid, name=body.name, description=body.description,
        rate=body.rate, min_quantity=body.min_quantity, max_quantity=body.max_quantity,
        delivery_type=body.delivery_type,
        api_provider_id=body.api_provider_id, external_service_id=body.external_service_id,
        can_refill=body.can_refill, can_cancel=body.can_cancel,
        is_active=body.is_active, sort_order=body.sort_order,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}


@router.put("/services/{sid}", dependencies=[Depends(get_current_admin)])
def update_service(sid: int, body: ServiceCreate, db: Session = Depends(get_db)):
    s = db.query(SmmService).get(sid)
    if not s:
        raise HTTPException(404, "Service not found")
    for field in ["name", "description", "rate", "min_quantity", "max_quantity",
                  "delivery_type", "api_provider_id", "external_service_id",
                  "can_refill", "can_cancel", "is_active", "sort_order"]:
        setattr(s, field, getattr(body, field))
    db.commit()
    return {"ok": True}


@router.delete("/services/{sid}", dependencies=[Depends(get_current_admin)])
def delete_service(sid: int, db: Session = Depends(get_db)):
    s = db.query(SmmService).get(sid)
    if not s:
        raise HTTPException(404, "Service not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── Sync from API provider ───────────────────────────────────

@router.post("/services/sync", dependencies=[Depends(get_current_admin)])
async def sync_services(body: SyncRequest, db: Session = Depends(get_db)):
    """Sync services from SMM panel API provider into a platform."""
    provider = db.query(ApiProvider).filter(
        ApiProvider.id == body.provider_id,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(404, "SMM provider not found or inactive")

    platform = db.query(SmmPlatform).get(body.platform_id)
    if not platform:
        raise HTTPException(404, "Platform not found")

    from api.providers import get_provider
    adapter = get_provider(provider)
    raw_services = await adapter.get_services_raw()

    created, updated = 0, 0
    # Group by category
    by_cat: dict[str, list] = {}
    for svc in raw_services:
        cat_name = svc.get("category", "Other")
        by_cat.setdefault(cat_name, []).append(svc)

    for cat_name, svcs in by_cat.items():
        slug = _slugify(cat_name)
        cat = db.query(SmmCategory).filter(
            SmmCategory.platform_id == platform.id,
            SmmCategory.slug == slug,
        ).first()
        if not cat:
            cat = SmmCategory(platform_id=platform.id, name=cat_name, slug=slug)
            db.add(cat)
            db.flush()

        for svc in svcs:
            ext_id = int(svc.get("service", 0))
            existing = db.query(SmmService).filter(
                SmmService.category_id == cat.id,
                SmmService.api_provider_id == provider.id,
                SmmService.external_service_id == ext_id,
            ).first()

            svc_type = svc.get("type", "Default")
            if existing:
                existing.name = svc.get("name", existing.name)
                existing.rate = float(svc.get("rate", existing.rate))
                existing.min_quantity = int(svc.get("min", existing.min_quantity))
                existing.max_quantity = int(svc.get("max", existing.max_quantity))
                existing.can_refill = bool(svc.get("refill", False))
                existing.can_cancel = bool(svc.get("cancel", False))
                updated += 1
            else:
                new_svc = SmmService(
                    category_id=cat.id,
                    name=svc.get("name", f"Service {ext_id}"),
                    rate=float(svc.get("rate", 0)),
                    min_quantity=int(svc.get("min", 1)),
                    max_quantity=int(svc.get("max", 10000)),
                    delivery_type="api",
                    api_provider_id=provider.id,
                    external_service_id=ext_id,
                    can_refill=bool(svc.get("refill", False)),
                    can_cancel=bool(svc.get("cancel", False)),
                )
                db.add(new_svc)
                created += 1

    db.commit()
    return {"ok": True, "created": created, "updated": updated, "total_raw": len(raw_services)}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Orders
# ══════════════════════════════════════════════════════════════

@router.get("/admin/orders", dependencies=[Depends(get_current_admin)])
def admin_list_orders(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(SmmOrder).order_by(SmmOrder.id.desc())
    if status:
        q = q.filter(SmmOrder.status == status)
    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "orders": [
            {
                "id": o.id, "order_code": o.order_code,
                "user_id": o.user_id,
                "user_email": o.user.email if o.user else None,
                "platform_name": o.platform_name,
                "category_name": o.category_name,
                "service_name": o.service_name,
                "link": o.link, "quantity": o.quantity, "charge": o.charge,
                "status": o.status, "delivery_type": o.delivery_type,
                "external_order_id": o.external_order_id,
                "admin_notes": o.admin_notes,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.put("/admin/orders/{oid}/status", dependencies=[Depends(get_current_admin)])
def admin_update_order_status(oid: int, body: OrderStatusUpdate, db: Session = Depends(get_db)):
    o = db.query(SmmOrder).get(oid)
    if not o:
        raise HTTPException(404, "Order not found")
    o.status = body.status
    if body.admin_notes is not None:
        o.admin_notes = body.admin_notes
    db.commit()
    return {"ok": True}


@router.post("/admin/orders/{oid}/check", dependencies=[Depends(get_current_admin)])
async def admin_check_order(oid: int, db: Session = Depends(get_db)):
    o = db.query(SmmOrder).get(oid)
    if not o or o.delivery_type != "api" or not o.external_order_id or not o.api_provider_id:
        raise HTTPException(400, "Not an API order or missing external ID")
    provider = db.query(ApiProvider).get(o.api_provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")

    from api.providers import get_provider
    adapter = get_provider(provider)
    result = await adapter.get_order_status(o.external_order_id)
    o.status = result.status
    db.commit()
    return {"ok": True, "status": result.status, "message": result.message}


@router.post("/admin/orders/check-all", dependencies=[Depends(get_current_admin)])
async def admin_check_all_orders(db: Session = Depends(get_db)):
    """Batch check status for all pending/processing API orders."""
    orders = (
        db.query(SmmOrder)
        .filter(
            SmmOrder.delivery_type == "api",
            SmmOrder.external_order_id.isnot(None),
            SmmOrder.status.in_(["pending", "processing", "in_progress"]),
        )
        .all()
    )
    if not orders:
        return {"ok": True, "checked": 0}

    # Group by provider
    by_provider: dict[int, list] = {}
    for o in orders:
        if o.api_provider_id:
            by_provider.setdefault(o.api_provider_id, []).append(o)

    checked = 0
    from api.providers import get_provider
    for pid, provider_orders in by_provider.items():
        provider = db.query(ApiProvider).get(pid)
        if not provider:
            continue
        adapter = get_provider(provider)
        # Use batch status if available
        order_ids = [o.external_order_id for o in provider_orders if o.external_order_id]
        if hasattr(adapter, "get_multiple_status") and len(order_ids) > 1:
            try:
                statuses = await adapter.get_multiple_status(order_ids)
                status_map = {
                    "Completed": "completed", "Processing": "processing",
                    "In progress": "in_progress", "Partial": "partial",
                    "Canceled": "canceled", "Pending": "pending",
                }
                for o in provider_orders:
                    data = statuses.get(o.external_order_id, {})
                    if isinstance(data, dict) and not data.get("error"):
                        raw = data.get("status", "")
                        o.status = status_map.get(raw, raw.lower()) if raw else o.status
                        checked += 1
            except Exception as e:
                logger.error(f"Batch status check failed for provider {pid}: {e}")
        else:
            for o in provider_orders:
                try:
                    result = await adapter.get_order_status(o.external_order_id)
                    o.status = result.status
                    checked += 1
                except Exception as e:
                    logger.error(f"Status check failed for order {o.id}: {e}")

    db.commit()
    return {"ok": True, "checked": checked}


# ══════════════════════════════════════════════════════════════
#  USER — Catalog & Orders
# ══════════════════════════════════════════════════════════════

@router.get("/catalog")
def user_catalog(db: Session = Depends(get_db)):
    """Public catalog: platforms → categories → services (active only)."""
    platforms = (
        db.query(SmmPlatform)
        .filter(SmmPlatform.is_active == True)
        .order_by(SmmPlatform.sort_order, SmmPlatform.id)
        .all()
    )
    result = []
    for p in platforms:
        cats = (
            db.query(SmmCategory)
            .filter(SmmCategory.platform_id == p.id, SmmCategory.is_active == True)
            .order_by(SmmCategory.sort_order, SmmCategory.id)
            .all()
        )
        cat_list = []
        for c in cats:
            svcs = (
                db.query(SmmService)
                .filter(SmmService.category_id == c.id, SmmService.is_active == True)
                .order_by(SmmService.sort_order, SmmService.id)
                .all()
            )
            if not svcs:
                continue
            cat_list.append({
                "id": c.id, "name": c.name, "slug": c.slug,
                "services": [
                    {
                        "id": s.id, "name": s.name, "description": s.description,
                        "rate": s.rate, "min_quantity": s.min_quantity,
                        "max_quantity": s.max_quantity,
                        "can_refill": s.can_refill,
                    }
                    for s in svcs
                ],
            })
        if not cat_list:
            continue
        result.append({
            "id": p.id, "name": p.name, "slug": p.slug,
            "icon_url": p.icon_url,
            "categories": cat_list,
        })
    return result


@router.post("/orders")
def user_place_order(
    body: OrderPlace,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = db.query(SmmService).get(body.service_id)
    if not svc or not svc.is_active:
        raise HTTPException(404, "Service not found or inactive")
    if body.quantity < svc.min_quantity or body.quantity > svc.max_quantity:
        raise HTTPException(400, f"Quantity must be between {svc.min_quantity} and {svc.max_quantity}")

    cat = svc.category
    plat = cat.platform if cat else None

    # Calculate charge
    charge = round(svc.rate * body.quantity / 1000, 2)

    # Check user balance
    user = db.query(User).get(int(current_user["user_id"]))
    if not user:
        raise HTTPException(404, "User not found")
    if (user.balance or 0) < charge:
        raise HTTPException(400, f"Số dư không đủ. Cần {charge:,.0f}, hiện có {(user.balance or 0):,.0f}")

    # Deduct balance
    user.balance = (user.balance or 0) - charge

    # Create order
    order = SmmOrder(
        order_code=_gen_order_code(),
        user_id=user.id,
        smm_service_id=svc.id,
        platform_name=plat.name if plat else "",
        category_name=cat.name if cat else "",
        service_name=svc.name,
        link=body.link,
        quantity=body.quantity,
        charge=charge,
        delivery_type=svc.delivery_type,
        api_provider_id=svc.api_provider_id,
    )
    db.add(order)
    db.flush()

    # If API delivery, try to place order with provider
    if svc.delivery_type == "api" and svc.api_provider_id and svc.external_service_id:
        try:
            from api.providers import get_provider
            provider = db.query(ApiProvider).get(svc.api_provider_id)
            if provider:
                import asyncio
                adapter = get_provider(provider)
                loop = asyncio.get_event_loop()
                result = loop.run_until_complete(
                    adapter.create_order(
                        product_id="",
                        plan_id=str(svc.external_service_id),
                        quantity=body.quantity,
                        fields_data={"link": body.link, "quantity": body.quantity},
                    )
                )
                order.external_order_id = result.order_id
                order.status = result.status if result.order_id else "failed"
                if result.status == "failed":
                    # Refund on failure
                    user.balance = (user.balance or 0) + charge
                    order.admin_notes = f"API error: {result.message}"
        except Exception as e:
            logger.error(f"SMM API order failed: {e}")
            order.status = "failed"
            user.balance = (user.balance or 0) + charge
            order.admin_notes = f"API error: {str(e)}"

    db.commit()
    return {
        "id": order.id, "order_code": order.order_code,
        "status": order.status, "charge": order.charge,
        "external_order_id": order.external_order_id,
    }


@router.get("/orders")
def user_list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    q = db.query(SmmOrder).filter(SmmOrder.user_id == uid).order_by(SmmOrder.id.desc())
    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "orders": [
            {
                "id": o.id, "order_code": o.order_code,
                "platform_name": o.platform_name,
                "category_name": o.category_name,
                "service_name": o.service_name,
                "link": o.link, "quantity": o.quantity, "charge": o.charge,
                "status": o.status, "delivery_type": o.delivery_type,
                "external_order_id": o.external_order_id,
                "can_refill": o.smm_service.can_refill if o.smm_service else False,
                "refill_id": o.refill_id,
                "refill_status": o.refill_status,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.post("/orders/{oid}/refill")
async def user_request_refill(
    oid: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    o = db.query(SmmOrder).filter(SmmOrder.id == oid, SmmOrder.user_id == uid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if o.status != "completed":
        raise HTTPException(400, "Chỉ có thể bảo hành đơn đã hoàn thành")
    if not (o.smm_service and o.smm_service.can_refill):
        raise HTTPException(400, "Dịch vụ này không hỗ trợ bảo hành")
    if o.refill_id:
        raise HTTPException(400, "Đơn này đã yêu cầu bảo hành rồi")

    if o.delivery_type == "api" and o.external_order_id and o.api_provider_id:
        provider = db.query(ApiProvider).get(o.api_provider_id)
        if provider:
            from api.providers import get_provider
            adapter = get_provider(provider)
            result = await adapter.create_refill(o.external_order_id)
            refill_id = str(result.get("refill", ""))
            if refill_id and refill_id != "0":
                o.refill_id = refill_id
                o.refill_status = "pending"
                db.commit()
                return {"ok": True, "refill_id": refill_id}
            else:
                raise HTTPException(400, f"Bảo hành thất bại: {result}")
    else:
        # Manual refill — mark as pending for admin
        o.refill_status = "pending"
        db.commit()
        return {"ok": True, "refill_status": "pending"}


@router.get("/orders/{oid}/refill-status")
async def user_refill_status(
    oid: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    o = db.query(SmmOrder).filter(SmmOrder.id == oid, SmmOrder.user_id == uid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if not o.refill_id and not o.refill_status:
        return {"refill_status": None}

    # If API and has refill_id, check with provider
    if o.delivery_type == "api" and o.refill_id and o.api_provider_id:
        provider = db.query(ApiProvider).get(o.api_provider_id)
        if provider:
            from api.providers import get_provider
            adapter = get_provider(provider)
            try:
                result = await adapter.get_refill_status(o.refill_id)
                o.refill_status = result.get("status", o.refill_status)
                db.commit()
            except Exception as e:
                logger.error(f"Refill status check failed: {e}")

    return {"refill_id": o.refill_id, "refill_status": o.refill_status}
