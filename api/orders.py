import random
import string
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from api.auth import get_current_admin, get_current_user
from api.order_notifications import notify_order_status_change
from db import get_db
from db.models import BalanceTransaction, Order, OrderItem, ProductPackage, StockItem, User

router = APIRouter(prefix="/orders", tags=["orders"])

MONEY_QUANT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def gen_order_code():
    chars = string.ascii_uppercase + string.digits
    return "ORD" + "".join(random.choices(chars, k=9))


class OrderItemCreate(BaseModel):
    package_id: int
    quantity: int = Field(default=1, ge=1)
    custom_fields_data: Optional[dict] = None


class OrderCreate(BaseModel):
    package_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)
    custom_fields_data: Optional[dict] = None
    items: Optional[list[OrderItemCreate]] = None
    payment_method: str = "payos"  # payos | balance
    coupon_code: Optional[str] = None


class OrderDelivery(BaseModel):
    delivery_data: str
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class OrderCancelRequest(BaseModel):
    notes: Optional[str] = None


class NormalizedOrderItem:
    def __init__(self, package: ProductPackage, quantity: int, custom_fields_data: Optional[dict] = None):
        self.package = package
        self.quantity = quantity
        self.custom_fields_data = custom_fields_data or {}
        self.unit_price = money(package.price)
        self.line_total = money(self.unit_price * quantity)



def serialize_order_item(item: OrderItem) -> dict:
    package = item.package
    product = package.product if package and package.product else None
    product_name = item.product_name_snapshot or (product.name if product else None)
    package_name = item.package_name_snapshot or (package.name if package else None)
    product_slug = product.slug if product else None
    product_img = product.image_url if product else None
    return {
        "id": item.id,
        "order_id": item.order_id,
        "package_id": item.package_id,
        "product_name": product_name,
        "package_name": package_name,
        "product_slug": product_slug,
        "product_img": product_img,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price or 0),
        "line_total": float(item.line_total or 0),
        "custom_fields_data": item.custom_fields_data,
        "delivery_data": item.delivery_data,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }



def order_to_dict(o: Order) -> dict:
    items = [serialize_order_item(item) for item in (o.items or [])]
    primary_item = items[0] if items else None

    pkg_name = primary_item["package_name"] if primary_item else None
    product_name = primary_item["product_name"] if primary_item else None
    product_slug = primary_item["product_slug"] if primary_item else None
    product_img = primary_item["product_img"] if primary_item else None

    if not primary_item and o.package:
        pkg_name = o.package.name
        if o.package.product:
            product_name = o.package.product.name
            product_slug = o.package.product.slug
            product_img = o.package.product.image_url

    quantity = sum((item["quantity"] or 0) for item in items) if items else o.quantity
    subtotal_amount = money(o.subtotal_amount if o.subtotal_amount is not None else o.total_amount)
    discount_amount = money(o.discount_amount)
    tax_amount = money(o.tax_amount)

    return {
        "id": o.id,
        "order_code": o.order_code,
        "user_id": o.user_id,
        "user_email": o.user_email,
        "package_id": o.package_id,
        "package_name": pkg_name,
        "product_name": product_name,
        "product_slug": product_slug,
        "product_img": product_img,
        "quantity": quantity,
        "subtotal_amount": float(subtotal_amount),
        "discount_amount": float(discount_amount),
        "tax_amount": float(tax_amount),
        "coupon_code": o.coupon_code,
        "total_amount": float(o.total_amount or 0),
        "status": o.status,
        "payment_method": o.payment_method,
        "payment_link_id": o.payment_link_id,
        "custom_fields_data": o.custom_fields_data,
        "delivery_data": o.delivery_data,
        "notes": o.notes,
        "items": items,
        "item_count": len(items),
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }



def normalize_order_items(data: OrderCreate, db: Session) -> list[NormalizedOrderItem]:
    raw_items = data.items or []
    if not raw_items:
        if not data.package_id:
            raise HTTPException(status_code=400, detail="Thiếu sản phẩm để tạo đơn")
        raw_items = [OrderItemCreate(package_id=data.package_id, quantity=data.quantity, custom_fields_data=data.custom_fields_data)]

    normalized = []
    for raw in raw_items:
        pkg = db.query(ProductPackage).options(joinedload(ProductPackage.product)).filter(
            ProductPackage.id == raw.package_id,
            ProductPackage.is_active == True,
        ).first()
        if not pkg:
            raise HTTPException(status_code=404, detail=f"Package {raw.package_id} not found")

        if pkg.delivery_type == "auto":
            available = db.query(StockItem).filter(
                StockItem.package_id == pkg.id,
                StockItem.is_sold == False,
            ).count()
            if available < raw.quantity:
                raise HTTPException(status_code=400, detail=f"Không đủ tồn kho cho gói {pkg.name}")

        if pkg.is_stock_managed and (pkg.stock_quantity or 0) < raw.quantity:
            raise HTTPException(status_code=400, detail=f"Không đủ tồn kho cho gói {pkg.name}")

        normalized.append(NormalizedOrderItem(pkg=pkg, quantity=raw.quantity, custom_fields_data=raw.custom_fields_data))
    return normalized



def build_order_items(order: Order, normalized_items: list[NormalizedOrderItem]):
    order_items = []
    for normalized in normalized_items:
        product = normalized.package.product
        order_items.append(OrderItem(
            order=order,
            package_id=normalized.package.id,
            product_name_snapshot=product.name if product else None,
            package_name_snapshot=normalized.package.name,
            quantity=normalized.quantity,
            unit_price=normalized.unit_price,
            line_total=normalized.line_total,
            custom_fields_data=normalized.custom_fields_data,
            status="pending",
        ))
    return order_items



def apply_coupon(coupon_code: Optional[str], subtotal: Decimal, db: Session) -> tuple[Optional[str], Decimal, Optional[str]]:
    if not coupon_code:
        return None, money(0), None

    from api.gift_codes import quote_gift_code

    quoted = quote_gift_code(coupon_code, float(subtotal), db, consume=False)
    discount = money(quoted.get("discount", 0))
    note = None
    if discount > 0:
        note = f"Mã giảm giá: {quoted['code']} (-{int(discount)}đ)"
    return quoted["code"], discount, note



def consume_coupon(coupon_code: Optional[str], db: Session):
    if not coupon_code:
        return
    from api.gift_codes import quote_gift_code
    quote_gift_code(coupon_code, 1, db, consume=True)



def set_order_items_status(order: Order, status: str):
    for item in order.items or []:
        item.status = status
        item.updated_at = datetime.now(timezone.utc)



def deliver_manual_order(order: Order, delivery_data: str, notes: Optional[str]):
    now = datetime.now(timezone.utc)
    order.delivery_data = delivery_data
    order.notes = notes
    order.status = "completed"
    order.updated_at = now
    set_order_items_status(order, "completed")
    if order.items:
        first_item = order.items[0]
        first_item.delivery_data = delivery_data


# ── Customer endpoints ─────────────────────────────────────────────────────────

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
    o = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(
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
    normalized_items = normalize_order_items(data, db)

    from db.models import SiteSetting

    subtotal = money(sum(item.line_total for item in normalized_items))
    tax_setting = db.query(SiteSetting).filter(SiteSetting.key == "tax_rate").first()
    tax_rate = Decimal(str(tax_setting.value or 0)) if tax_setting and tax_setting.value else Decimal("0")
    discount_code, discount_amount, coupon_note = apply_coupon(data.coupon_code, subtotal, db)
    taxable_amount = max(subtotal - discount_amount, money(0))
    tax_amount = money((taxable_amount * tax_rate) / Decimal("100")) if tax_rate > 0 else money(0)
    total = money(taxable_amount + tax_amount)

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


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/all", dependencies=[Depends(get_current_admin)])
def admin_list_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    q = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    )
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
    valid = ["pending", "paid", "processing", "completed", "cancelled"]
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")

    allowed_transitions = {
        "pending": {"paid", "cancelled"},
        "paid": {"processing", "completed", "cancelled"},
        "processing": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    }
    if new_status != o.status and new_status not in allowed_transitions.get(o.status, set()):
        raise HTTPException(status_code=400, detail=f"Không thể chuyển từ {o.status} sang {new_status}")

    previous_status = o.status
    o.status = new_status
    set_order_items_status(o, new_status)
    if body.notes:
        o.notes = body.notes
    o.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    notify_order_status_change(db, o, previous_status=previous_status, note=body.notes)
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
        existing_refund = db.query(BalanceTransaction).filter(
            BalanceTransaction.reference == o.order_code,
            BalanceTransaction.type == "refund",
            BalanceTransaction.status == "completed",
        ).first()
        if existing_refund:
            raise HTTPException(status_code=400, detail="Đơn này đã được hoàn tiền trước đó")

        user = db.query(User).filter(User.id == int(o.user_id)).with_for_update().first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        refund_amount = Decimal(o.total_amount or 0)
        user.balance = Decimal(user.balance or 0) + refund_amount
        db.add(BalanceTransaction(
            user_id=user.id,
            amount=refund_amount,
            balance_after=user.balance,
            type="refund",
            status="completed",
            reference=o.order_code,
            description=f"Hoàn tiền đơn {o.order_code}",
        ))

    o.status = "cancelled"
    set_order_items_status(o, "cancelled")
    if body.notes:
        o.notes = body.notes
    o.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(o)
    notify_order_status_change(db, o, previous_status=previous_status, note=body.notes, refund_amount=refund_amount)
    return order_to_dict(o)



def auto_deliver(order: Order, db: Session):
    """Auto-deliver stock items for auto-delivery packages."""
    now = datetime.now(timezone.utc)
    order_items = order.items or []
    if not order_items and order.package_id:
        legacy_item = OrderItem(
            order_id=order.id,
            package_id=order.package_id,
            product_name_snapshot=order.package.product.name if order.package and order.package.product else None,
            package_name_snapshot=order.package.name if order.package else None,
            quantity=order.quantity or 1,
            unit_price=money((order.total_amount or 0) / max(order.quantity or 1, 1)),
            line_total=money(order.total_amount or 0),
            custom_fields_data=order.custom_fields_data,
            delivery_data=order.delivery_data,
            status=order.status,
        )
        db.add(legacy_item)
        db.flush()
        order_items = [legacy_item]

    delivered_chunks = []
    all_completed = True
    for order_item in order_items:
        package = order_item.package
        if not package:
            all_completed = False
            continue

        if package.delivery_type != "auto":
            if package.is_stock_managed and order_item.status != "completed":
                package.stock_quantity = max(0, (package.stock_quantity or 0) - order_item.quantity)
            order_item.status = "processing"
            order_item.updated_at = now
            all_completed = False
            continue

        items = db.query(StockItem).filter(
            StockItem.package_id == order_item.package_id,
            StockItem.is_sold == False,
        ).with_for_update(skip_locked=True).limit(order_item.quantity).all()

        if len(items) < order_item.quantity:
            order_item.status = "processing"
            order_item.updated_at = now
            all_completed = False
            continue

        delivered = []
        for stock_item in items:
            stock_item.is_sold = True
            stock_item.sold_at = now
            stock_item.order_id = order.id
            delivered.append(stock_item.data)

        order_item.delivery_data = "\n---\n".join(delivered)
        order_item.status = "completed"
        order_item.updated_at = now
        delivered_chunks.append(f"[{order_item.product_name_snapshot or package.name} - {order_item.package_name_snapshot or package.name}]\n{order_item.delivery_data}")

    if delivered_chunks:
        order.delivery_data = "\n\n".join(delivered_chunks)
    order.status = "completed" if all_completed else "processing"
    order.updated_at = now
