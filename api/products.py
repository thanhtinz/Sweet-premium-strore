from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from db import get_db
from db.models import Product, ProductPackage, PackageField, StockItem, FlashSale
from datetime import datetime, timezone
from api.auth import get_current_admin
import re

router = APIRouter(prefix="/products", tags=["products"])


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    is_active: bool = True
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PackageCreate(BaseModel):
    name: str
    price: float
    original_price: Optional[float] = None
    description: Optional[str] = None
    delivery_type: str = "manual"
    sort_order: int = 0
    is_active: bool = True


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    description: Optional[str] = None
    delivery_type: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class FieldCreate(BaseModel):
    field_name: str
    field_type: str = "text"
    is_required: bool = True
    options: Optional[str] = None
    sort_order: int = 0


def pkg_to_dict(pkg: ProductPackage, db: Session = None) -> dict:
    stock_count = 0
    flash_sale = None
    if db:
        stock_count = db.query(StockItem).filter(
            StockItem.package_id == pkg.id,
            StockItem.is_sold == False
        ).count()
        now = datetime.now(timezone.utc)
        fs = (
            db.query(FlashSale)
            .filter(
                FlashSale.package_id == pkg.id,
                FlashSale.is_active == True,
                FlashSale.starts_at <= now,
                FlashSale.ends_at > now,
            )
            .first()
        )
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
        "delivery_type": pkg.delivery_type,
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
    d = {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else None,
        "description": p.description,
        "image_url": p.image_url,
        "is_featured": p.is_featured,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
    if include_packages:
        active_pkgs = [pkg for pkg in p.packages if pkg.is_active]
        d["packages"] = [pkg_to_dict(pkg, db=db) for pkg in sorted(active_pkgs, key=lambda x: x.sort_order)]
        d["min_price"] = min((float(pkg.price) for pkg in active_pkgs), default=None)
    return d


# ── Public endpoints ───────────────────────────────────────────────────────────

@router.get("/")
def list_products(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    sort_by: Optional[str] = None,  # price_asc, price_desc, newest, name
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    q = db.query(Product).filter(Product.is_active == True)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if category_slug:
        from db.models import Category
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            # Include children category IDs
            child_ids = [c.id for c in db.query(Category).filter(Category.parent_id == cat.id).all()]
            all_ids = [cat.id] + child_ids
            q = q.filter(Product.category_id.in_(all_ids))
    if featured is not None:
        q = q.filter(Product.is_featured == featured)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    if price_min is not None or price_max is not None:
        from sqlalchemy import func
        pkg_sub = db.query(
            ProductPackage.product_id,
            func.min(ProductPackage.price).label("min_price")
        ).filter(ProductPackage.is_active == True).group_by(ProductPackage.product_id).subquery()
        q = q.join(pkg_sub, Product.id == pkg_sub.c.product_id)
        if price_min is not None:
            q = q.filter(pkg_sub.c.min_price >= price_min)
        if price_max is not None:
            q = q.filter(pkg_sub.c.min_price <= price_max)
    total = q.count()
    if sort_by == "price_asc":
        from sqlalchemy import func
        pkg_sub2 = db.query(
            ProductPackage.product_id,
            func.min(ProductPackage.price).label("min_p")
        ).filter(ProductPackage.is_active == True).group_by(ProductPackage.product_id).subquery()
        q = q.outerjoin(pkg_sub2, Product.id == pkg_sub2.c.product_id).order_by(pkg_sub2.c.min_p.asc())
    elif sort_by == "price_desc":
        from sqlalchemy import func
        pkg_sub2 = db.query(
            ProductPackage.product_id,
            func.min(ProductPackage.price).label("min_p")
        ).filter(ProductPackage.is_active == True).group_by(ProductPackage.product_id).subquery()
        q = q.outerjoin(pkg_sub2, Product.id == pkg_sub2.c.product_id).order_by(pkg_sub2.c.min_p.desc())
    elif sort_by == "newest":
        q = q.order_by(Product.created_at.desc())
    elif sort_by == "name":
        q = q.order_by(Product.name.asc())
    else:
        q = q.order_by(Product.sort_order, Product.id)
    products = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [product_to_dict(p) for p in products]
    }


@router.get("/featured")
def list_featured(limit: int = 12, db: Session = Depends(get_db)):
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.is_featured == True
    ).order_by(Product.sort_order).limit(limit).all()
    return [product_to_dict(p) for p in products]


@router.get("/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_dict(p, db=db)


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/admin/all", dependencies=[Depends(get_current_admin)])
def admin_list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.sort_order, Product.id).all()
    return [product_to_dict(p) for p in products]


@router.post("/", dependencies=[Depends(get_current_admin)])
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    slug = data.slug or slugify(data.name)
    existing = db.query(Product).filter(Product.slug == slug).first()
    if existing:
        slug = f"{slug}-{db.query(Product).count()}"
    p = Product(
        name=data.name, slug=slug, category_id=data.category_id,
        description=data.description, image_url=data.image_url,
        is_featured=data.is_featured, is_active=data.is_active,
        sort_order=data.sort_order,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return product_to_dict(p)


@router.put("/{product_id}", dependencies=[Depends(get_current_admin)])
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return product_to_dict(p)


@router.delete("/{product_id}", dependencies=[Depends(get_current_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ── Packages ───────────────────────────────────────────────────────────────────

@router.post("/{product_id}/packages", dependencies=[Depends(get_current_admin)])
def add_package(product_id: int, data: PackageCreate, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    pkg = ProductPackage(product_id=product_id, **data.model_dump())
    db.add(pkg)
    db.commit()
    db.refresh(pkg)
    return pkg_to_dict(pkg, db=db)


@router.put("/packages/{pkg_id}", dependencies=[Depends(get_current_admin)])
def update_package(pkg_id: int, data: PackageUpdate, db: Session = Depends(get_db)):
    pkg = db.query(ProductPackage).filter(ProductPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(pkg, field, val)
    db.commit()
    db.refresh(pkg)
    return pkg_to_dict(pkg, db=db)


@router.delete("/packages/{pkg_id}", dependencies=[Depends(get_current_admin)])
def delete_package(pkg_id: int, db: Session = Depends(get_db)):
    pkg = db.query(ProductPackage).filter(ProductPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    db.delete(pkg)
    db.commit()
    return {"ok": True}


# ── Package fields ─────────────────────────────────────────────────────────────

@router.post("/packages/{pkg_id}/fields", dependencies=[Depends(get_current_admin)])
def add_field(pkg_id: int, data: FieldCreate, db: Session = Depends(get_db)):
    pkg = db.query(ProductPackage).filter(ProductPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    field = PackageField(package_id=pkg_id, **data.model_dump())
    db.add(field)
    db.commit()
    db.refresh(field)
    return {"id": field.id, **data.model_dump()}


@router.delete("/fields/{field_id}", dependencies=[Depends(get_current_admin)])
def delete_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(PackageField).filter(PackageField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()
    return {"ok": True}
