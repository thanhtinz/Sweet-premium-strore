import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import FlashSale, Product, ProductPackage, StockItem


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    is_active: bool = True
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PackageCreate(BaseModel):
    name: str
    price: float
    original_price: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    delivery_type: str = "manual"
    is_stock_managed: bool = False
    stock_quantity: int = 0
    sort_order: int = 0
    is_active: bool = True

    @field_validator("price")
    @classmethod
    def price_positive(cls, v):
        if v < 0:
            raise ValueError("Price must be >= 0")
        return v

    @field_validator("delivery_type")
    @classmethod
    def valid_delivery(cls, v):
        if v not in ("manual", "auto"):
            raise ValueError("delivery_type must be 'manual' or 'auto'")
        return v

    @field_validator("stock_quantity")
    @classmethod
    def stock_non_negative(cls, v):
        if v < 0:
            raise ValueError("stock_quantity must be >= 0")
        return v


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    delivery_type: Optional[str] = None
    is_stock_managed: Optional[bool] = None
    stock_quantity: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class FieldCreate(BaseModel):
    field_name: str
    field_type: str = "text"
    is_required: bool = True
    options: Optional[str] = None
    sort_order: int = 0


class FieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[bool] = None
    options: Optional[str] = None
    sort_order: Optional[int] = None


def pkg_to_dict(pkg: ProductPackage, db: Session = None) -> dict:
    stock_count = 0
    flash_sale = None
    if db:
        stock_count = db.query(StockItem).filter(StockItem.package_id == pkg.id, StockItem.is_sold == False).count()
        now = datetime.now(timezone.utc)
        fs = db.query(FlashSale).filter(
            FlashSale.package_id == pkg.id,
            FlashSale.is_active == True,
            FlashSale.starts_at <= now,
            FlashSale.ends_at > now,
        ).first()
        if fs and (fs.quantity_limit == 0 or fs.quantity_sold < fs.quantity_limit):
            flash_sale = {
                "id": fs.id,
                "sale_price": float(fs.sale_price),
                "ends_at": fs.ends_at.isoformat() if fs.ends_at else None,
                "quantity_limit": fs.quantity_limit,
                "quantity_sold": fs.quantity_sold,
            }
    return {
        "id": pkg.id,
        "product_id": pkg.product_id,
        "name": pkg.name,
        "price": float(pkg.price),
        "original_price": float(pkg.original_price) if pkg.original_price else None,
        "description": pkg.description,
        "notes": pkg.notes,
        "delivery_type": pkg.delivery_type,
        "is_stock_managed": pkg.is_stock_managed if pkg.is_stock_managed else False,
        "stock_quantity": pkg.stock_quantity if pkg.stock_quantity else 0,
        "sort_order": pkg.sort_order,
        "is_active": pkg.is_active,
        "stock_count": stock_count,
        "flash_sale": flash_sale,
        "fields": [
            {
                "id": f.id,
                "field_name": f.field_name,
                "field_type": f.field_type,
                "is_required": f.is_required,
                "options": f.options,
                "sort_order": f.sort_order,
            }
            for f in sorted(pkg.fields, key=lambda x: x.sort_order)
        ],
    }


def product_to_dict(p: Product, include_packages=True, db=None) -> dict:
    visible_reviews = [r for r in p.reviews if r.is_visible] if p.reviews else []
    review_count = len(visible_reviews)
    avg_rating = round(sum(r.rating for r in visible_reviews) / review_count, 1) if review_count else 0
    sold_count = 0
    if db:
        from db.models import Order
        sold = db.query(func.sum(Order.quantity)).join(
            ProductPackage, Order.package_id == ProductPackage.id
        ).filter(
            ProductPackage.product_id == p.id,
            Order.status.in_(["paid", "completed"]),
        ).scalar()
        sold_count = sold or 0
    d = {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "category_slug": p.category.slug if p.category else None,
        "category_icon": p.category.icon_url if p.category else None,
        "description": p.description,
        "notes": p.notes,
        "image_url": p.image_url,
        "is_featured": p.is_featured,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "avg_rating": avg_rating,
        "review_count": review_count,
        "sold_count": sold_count,
    }
    if include_packages:
        active_pkgs = [pkg for pkg in p.packages if pkg.is_active]
        d["packages"] = [pkg_to_dict(pkg, db=db) for pkg in sorted(active_pkgs, key=lambda x: x.sort_order)]
        d["min_price"] = min((float(pkg.price) for pkg in active_pkgs), default=None)
        d["max_price"] = max((float(pkg.price) for pkg in active_pkgs), default=None)
    return d
