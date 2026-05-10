from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from api.auth import get_current_admin, get_current_staff_or_admin, get_current_user
from api.order_notifications import notify_order_status_change
from api.orders_service import (
    apply_coupon,
    auto_deliver,
    build_order_items,
    calculate_order_totals,
    consume_coupon,
    deliver_manual_order,
    fail_order_with_refund,
    normalize_order_items,
    refund_order_to_balance,
    set_order_items_status,
)
from api.orders_shared import (
    BulkIdsRequest,
    OrderCancelRequest,
    OrderCreate,
    OrderDelivery,
    OrderStatusUpdate,
    gen_order_code,
    money,
    order_to_dict,
)
from db import get_db
from db.models import Order, OrderItem, ProductPackage

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/my")
def my_orders(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(Order.user_id == current_user["user_id"])
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "items": [order_to_dict(o) for o in orders]}


@router.get("/my/{order_code}")
def get_my_order(order_code: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(Order.order_code == order_code, Order.user_id == current_user["user_id"]).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_to_dict(o)


@router.post("/create")
def create_order(data: OrderCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized_items = normalize_order_items(data, db)
    subtotal, _tax_rate, discount_code, discount_amount, coupon_note, tax_amount, total = calculate_order_totals(
        normalized_items,
        data.coupon_code,
        db,
    )
    payment_method = data.payment_method if data.payment_method in ("payos", "balance") else "payos"
    primary_item = normalized_items[0]
    order = Order(
        order_code=gen_order_code(),
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        package_id=primary_item.package.id,
        quantity=sum(item.quantity for item in normalized_items),
        subtotal_amount=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total_amount=total,
        coupon_code=discount_code,
        status="pending",
        payment_method=payment_method,
        custom_fields_data=primary_item.custom_fields_data,
        notes=coupon_note,
    )
    db.add(order)
    db.flush()
    order_items = build_order_items(order, normalized_items)
    db.add_all(order_items)
    db.flush()
    if discount_code:
        consume_coupon(discount_code, db)
    if payment_method == "balance":
        from api.balance import deduct_balance
        deduct_balance(db, int(current_user["user_id"]), Decimal(total), order.order_code)
        order.status = "paid"
        set_order_items_status(order, "paid")
        auto_deliver(order, db)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@router.get("/admin/all", dependencies=[Depends(get_current_staff_or_admin)])
def admin_list_orders(status: Optional[str] = None, page: int = 1, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    )
    if status:
        q = q.filter(Order.status == status)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "items": [order_to_dict(o) for o in orders]}


@router.post("/admin/bulk-delete", dependencies=[Depends(get_current_admin)])
def bulk_delete_orders(body: BulkIdsRequest, db: Session = Depends(get_db)):
    ids = sorted(set(int(i) for i in (body.ids or []) if int(i) > 0))
    if not ids:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một đơn hàng")
    orders = db.query(Order).options(joinedload(Order.items)).filter(Order.id.in_(ids)).all()
    for order in orders:
        db.delete(order)
    db.commit()
    return {"ok": True, "requested": len(ids), "deleted": len(orders)}



@router.put("/admin/{order_id}/deliver", dependencies=[Depends(get_current_admin)])
def deliver_order(order_id: int, data: OrderDelivery, db: Session = Depends(get_db)):
    o = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    previous_status = o.status
    deliver_manual_order(o, data.delivery_data, data.notes)
    db.commit()
    db.refresh(o)
    notify_order_status_change(db, o, previous_status=previous_status, note=data.notes)
    return order_to_dict(o)


@router.put("/admin/{order_id}/status", dependencies=[Depends(get_current_admin)])
def update_order_status(order_id: int, body: OrderStatusUpdate, db: Session = Depends(get_db)):
    o = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    new_status = body.status
    valid = ["pending", "paid", "completed", "cancelled", "failed"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")
    previous_status = o.status
    refund_amount = None
    if new_status == "failed":
        refund_amount = fail_order_with_refund(o, db, body.notes or "Lỗi hệ thống")
    else:
        allowed_transitions = {
            "pending": {"paid", "cancelled"},
            "paid": {"completed", "cancelled", "failed"},
            "processing": {"completed", "cancelled", "failed"},
            "completed": {"failed"},
            "cancelled": set(),
            "failed": set(),
        }
        if new_status != o.status and new_status not in allowed_transitions.get(o.status, set()):
            raise HTTPException(status_code=400, detail=f"Không thể chuyển từ {o.status} sang {new_status}")
        o.status = new_status
        set_order_items_status(o, new_status)
        if body.notes:
            o.notes = body.notes
        from datetime import datetime, timezone
        o.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    notify_order_status_change(db, o, previous_status=previous_status, note=body.notes, refund_amount=refund_amount)
    return order_to_dict(o)


@router.post("/admin/{order_id}/cancel", dependencies=[Depends(get_current_admin)])
def cancel_order(order_id: int, body: OrderCancelRequest, db: Session = Depends(get_db)):
    o = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.status == "completed":
        raise HTTPException(status_code=400, detail="Đơn đã hoàn thành, không thể hủy")
    if o.status == "cancelled":
        raise HTTPException(status_code=400, detail="Đơn đã bị hủy trước đó")
    previous_status = o.status
    refund_amount = None
    if o.status in {"paid", "processing"}:
        refund_amount = refund_order_to_balance(o, db, "Hoàn tiền đơn bị hủy bởi admin")
    o.status = "cancelled"
    set_order_items_status(o, "cancelled")
    if body.notes:
        o.notes = body.notes
    from datetime import datetime, timezone
    o.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    notify_order_status_change(db, o, previous_status=previous_status, note=body.notes, refund_amount=refund_amount)
    return order_to_dict(o)


@router.delete("/admin/{order_id}", dependencies=[Depends(get_current_admin)])
def delete_order(order_id: int, db: Session = Depends(get_db)):
    o = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(o)
    db.commit()
    return {"ok": True, "deleted": 1}


__all__ = [
    "router",
    "auto_deliver",
    "apply_coupon",
    "build_order_items",
    "consume_coupon",
    "deliver_manual_order",
    "gen_order_code",
    "money",
    "normalize_order_items",
    "order_to_dict",
    "set_order_items_status",
]
