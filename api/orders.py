import os
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from db import get_db
from db.models import Order, ProductPackage, StockItem
from api.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/orders", tags=["orders"])


def gen_order_code():
    chars = string.ascii_uppercase + string.digits
    return "ORD" + "".join(random.choices(chars, k=9))


def order_to_dict(o: Order) -> dict:
    pkg_name = None
    product_name = None
    if o.package:
        pkg_name = o.package.name
        if o.package.product:
            product_name = o.package.product.name
    return {
        "id": o.id,
        "order_code": o.order_code,
        "user_id": o.user_id,
        "user_email": o.user_email,
        "package_id": o.package_id,
        "package_name": pkg_name,
        "product_name": product_name,
        "quantity": o.quantity,
        "total_amount": float(o.total_amount),
        "status": o.status,
        "payment_method": o.payment_method,
        "payment_link_id": o.payment_link_id,
        "custom_fields_data": o.custom_fields_data,
        "delivery_data": o.delivery_data,
        "notes": o.notes,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


class OrderCreate(BaseModel):
    package_id: int
    quantity: int = 1
    custom_fields_data: Optional[dict] = None
    payment_method: str = "payos"  # payos | balance


class OrderDelivery(BaseModel):
    delivery_data: str
    notes: Optional[str] = None


# ── Customer endpoints ─────────────────────────────────────────────────────────

@router.get("/my")
def my_orders(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = db.query(Order).filter(Order.user_id == current_user["user_id"])
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "items": [order_to_dict(o) for o in orders]
    }


@router.get("/my/{order_code}")
def get_my_order(
    order_code: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    o = db.query(Order).filter(
        Order.order_code == order_code,
        Order.user_id == current_user["user_id"]
    ).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return order_to_dict(o)


@router.post("/create")
def create_order(
    data: OrderCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pkg = db.query(ProductPackage).filter(
        ProductPackage.id == data.package_id,
        ProductPackage.is_active == True
    ).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    # Check stock for auto delivery
    if pkg.delivery_type == "auto":
        available = db.query(StockItem).filter(
            StockItem.package_id == pkg.id,
            StockItem.is_sold == False
        ).count()
        if available < data.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")

    # Check stock for stock-managed manual packages
    if pkg.is_stock_managed and pkg.stock_quantity < data.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    from db.models import SiteSetting
    
    total = float(pkg.price) * data.quantity
    
    # Calculate tax
    tax_setting = db.query(SiteSetting).filter(SiteSetting.key == "tax_rate").first()
    tax_rate = float(tax_setting.value) if tax_setting and tax_setting.value else 0.0
    tax_amount = (total * tax_rate) / 100
    total = round(total + tax_amount)

    order = Order(
        order_code=gen_order_code(),
        user_id=current_user["user_id"],
        user_email=current_user["email"],
        package_id=pkg.id,
        quantity=data.quantity,
        total_amount=total,
        status="pending",
        payment_method=data.payment_method if data.payment_method in ("payos", "balance") else "payos",
        custom_fields_data=data.custom_fields_data,
    )
    db.add(order)
    db.flush()  # get order.id before balance deduction

    # If paying with balance, deduct immediately
    if data.payment_method == "balance":
        from decimal import Decimal
        from api.balance import deduct_balance
        deduct_balance(db, int(current_user["user_id"]), Decimal(total), order.order_code)
        order.status = "paid"
        # Auto-deliver if applicable
        auto_deliver(order, db)

    db.commit()
    db.refresh(order)
    return order_to_dict(order)


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/all", dependencies=[Depends(get_current_admin)])
def admin_list_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "items": [order_to_dict(o) for o in orders]
    }


@router.put("/admin/{order_id}/deliver", dependencies=[Depends(get_current_admin)])
def deliver_order(order_id: int, data: OrderDelivery, db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    # Decrement stock for stock-managed manual packages
    if o.package and o.package.is_stock_managed and o.status != "completed":
        o.package.stock_quantity = max(0, (o.package.stock_quantity or 0) - o.quantity)
    o.delivery_data = data.delivery_data
    o.notes = data.notes
    o.status = "completed"
    o.updated_at = datetime.now(timezone.utc)
    db.commit()
    return order_to_dict(o)


@router.put("/admin/{order_id}/status", dependencies=[Depends(get_current_admin)])
def update_order_status(order_id: int, body: dict, db: Session = Depends(get_db)):
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    new_status = body.get("status")
    valid = ["pending", "paid", "processing", "completed", "cancelled"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")
    # Decrement stock for stock-managed manual packages when completing
    if new_status == "completed" and o.status != "completed" and o.package and o.package.is_stock_managed:
        o.package.stock_quantity = max(0, (o.package.stock_quantity or 0) - o.quantity)
    o.status = new_status
    o.updated_at = datetime.now(timezone.utc)
    db.commit()
    return order_to_dict(o)


def auto_deliver(order: Order, db: Session):
    """Auto-deliver stock items for auto-delivery packages."""
    if not order.package or order.package.delivery_type != "auto":
        # For stock-managed manual packages, decrement stock on completion
        if order.package and order.package.is_stock_managed and order.status != "completed":
            order.package.stock_quantity = max(0, (order.package.stock_quantity or 0) - order.quantity)
        return
    items = db.query(StockItem).filter(
        StockItem.package_id == order.package_id,
        StockItem.is_sold == False
    ).limit(order.quantity).all()

    if len(items) < order.quantity:
        order.status = "processing"
        return

    now = datetime.now(timezone.utc)
    delivered = []
    for item in items:
        item.is_sold = True
        item.sold_at = now
        item.order_id = order.id
        delivered.append(item.data)

    order.delivery_data = "\n---\n".join(delivered)
    order.status = "completed"
    order.updated_at = now
