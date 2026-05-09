import random
import string
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from pydantic import BaseModel, Field

from db.models import Order, OrderItem, ProductPackage

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
    payment_method: str = "payos"
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
