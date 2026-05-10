from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from api.orders_shared import NormalizedOrderItem, OrderCreate, OrderItemCreate, money
from db.models import Order, OrderItem, ProductPackage, StockItem
from db.repositories import SiteConfigRepository


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

        normalized.append(NormalizedOrderItem(package=pkg, quantity=raw.quantity, custom_fields_data=raw.custom_fields_data))
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


def calculate_order_totals(normalized_items: list[NormalizedOrderItem], coupon_code: Optional[str], db: Session):
    subtotal = money(sum(item.line_total for item in normalized_items))
    tax_rate_raw = SiteConfigRepository(db).get_value("tax_rate")
    tax_rate = Decimal(str(tax_rate_raw or 0)) if tax_rate_raw else Decimal("0")
    discount_code, discount_amount, coupon_note = apply_coupon(coupon_code, subtotal, db)
    taxable_amount = max(subtotal - discount_amount, money(0))
    tax_amount = money((taxable_amount * tax_rate) / Decimal("100")) if tax_rate > 0 else money(0)
    total = money(taxable_amount + tax_amount)
    return subtotal, tax_rate, discount_code, discount_amount, coupon_note, tax_amount, total


def auto_deliver(order: Order, db: Session):
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
