from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from api.auth import get_current_admin
from api.products_shared import (
    BulkIdsRequest,
    FieldCreate,
    FieldUpdate,
    PackageCreate,
    PackageUpdate,
    ProductCreate,
    ProductUpdate,
    pkg_to_dict,
    product_to_dict,
    slugify,
)
from db import get_db
from db.models import PackageField, Product, ProductPackage, Review

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/")
def list_products(
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    sort_by: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    q = db.query(Product).options(joinedload(Product.category), joinedload(Product.packages)).filter(Product.is_active == True)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if category_slug:
        from db.models import Category
        cat = db.query(Category).filter(Category.slug == category_slug).first()
        if cat:
            child_ids = [c.id for c in db.query(Category).filter(Category.parent_id == cat.id).all()]
            all_ids = [cat.id] + child_ids
            q = q.filter(Product.category_id.in_(all_ids))
    if featured is not None:
        q = q.filter(Product.is_featured == featured)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    if price_min is not None or price_max is not None:
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
        pkg_sub2 = db.query(
            ProductPackage.product_id,
            func.min(ProductPackage.price).label("min_p")
        ).filter(ProductPackage.is_active == True).group_by(ProductPackage.product_id).subquery()
        q = q.outerjoin(pkg_sub2, Product.id == pkg_sub2.c.product_id).order_by(pkg_sub2.c.min_p.asc())
    elif sort_by == "price_desc":
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
    return {"total": total, "page": page, "limit": limit, "items": [product_to_dict(p, db=db) for p in products]}


@router.get("/featured")
def list_featured(limit: int = 12, db: Session = Depends(get_db)):
    products = db.query(Product).options(joinedload(Product.category), joinedload(Product.packages)).filter(
        Product.is_active == True,
        Product.is_featured == True
    ).order_by(Product.sort_order).limit(limit).all()
    return [product_to_dict(p, db=db) for p in products]


@router.get("/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    d = product_to_dict(p, db=db)
    stats = db.query(func.avg(Review.rating), func.count(Review.id)).filter(Review.product_id == p.id, Review.is_visible == True).first()
    d["review_avg"] = round(float(stats[0]), 1) if stats[0] else 0
    d["review_count"] = stats[1] or 0
    from db.models import Order
    sold = db.query(func.sum(Order.quantity)).join(ProductPackage, Order.package_id == ProductPackage.id).filter(
        ProductPackage.product_id == p.id,
        Order.status.in_(["paid", "completed"]),
    ).scalar()
    d["sold_count"] = sold or 0
    related = []
    if p.category_id:
        from db.models import Category
        cat = db.query(Category).filter(Category.id == p.category_id).first()
        if cat and cat.parent_id:
            sibling_ids = [c.id for c in db.query(Category).filter(Category.parent_id == cat.parent_id).all()]
        elif cat:
            sibling_ids = [c.id for c in db.query(Category).filter(Category.parent_id == cat.id).all()]
            sibling_ids.append(cat.id)
        else:
            sibling_ids = [p.category_id]
        rels = db.query(Product).filter(
            Product.category_id.in_(sibling_ids),
            Product.id != p.id,
            Product.is_active == True,
        ).order_by(Product.sort_order).limit(6).all()
        related = [product_to_dict(r, include_packages=True, db=db) for r in rels]
    d["related"] = related
    return d


@router.get("/admin/all", dependencies=[Depends(get_current_admin)])
def admin_list_products(db: Session = Depends(get_db)):
    products = db.query(Product).options(joinedload(Product.category), joinedload(Product.packages)).order_by(Product.sort_order, Product.id).all()
    return [product_to_dict(p, db=db) for p in products]


@router.post("/", dependencies=[Depends(get_current_admin)])
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    slug = data.slug or slugify(data.name)
    existing = db.query(Product).filter(Product.slug == slug).first()
    if existing:
        slug = f"{slug}-{db.query(Product).count()}"
    p = Product(
        name=data.name, slug=slug, category_id=data.category_id,
        description=data.description, notes=data.notes, image_url=data.image_url,
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
@router.post("/{product_id}/delete", dependencies=[Depends(get_current_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    from db.models import Order
    pkg_ids = [pkg.id for pkg in p.packages]
    has_orders = False
    if pkg_ids:
        has_orders = db.query(Order).filter(Order.package_id.in_(pkg_ids)).first() is not None
    if has_orders:
        p.is_active = False
        p.name = f"[Đã xóa] {p.name}"
        p.slug = f"deleted-{p.slug}-{int(datetime.now().timestamp())}"
        for pkg in p.packages:
            pkg.is_active = False
        db.commit()
    else:
        db.delete(p)
        db.commit()
    return {"ok": True}


@router.post("/bulk-delete", dependencies=[Depends(get_current_admin)])
def bulk_delete_products(body: BulkIdsRequest, db: Session = Depends(get_db)):
    ids = sorted(set(int(i) for i in (body.ids or []) if int(i) > 0))
    if not ids:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một sản phẩm")
    products = db.query(Product).options(joinedload(Product.packages)).filter(Product.id.in_(ids)).all()
    deleted = 0
    archived = 0
    from db.models import Order
    for p in products:
        pkg_ids = [pkg.id for pkg in p.packages]
        has_orders = bool(pkg_ids and db.query(Order).filter(Order.package_id.in_(pkg_ids)).first())
        if has_orders:
            p.is_active = False
            if not p.name.startswith("[Đã xóa]"):
                p.name = f"[Đã xóa] {p.name}"
            p.slug = f"deleted-{p.slug}-{int(datetime.now().timestamp())}"
            for pkg in p.packages:
                pkg.is_active = False
            archived += 1
        else:
            db.delete(p)
            deleted += 1
    db.commit()
    return {"ok": True, "requested": len(ids), "deleted": deleted, "archived": archived}


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
@router.post("/packages/{pkg_id}/delete", dependencies=[Depends(get_current_admin)])
def delete_package(pkg_id: int, db: Session = Depends(get_db)):
    pkg = db.query(ProductPackage).filter(ProductPackage.id == pkg_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    db.delete(pkg)
    db.commit()
    return {"ok": True}


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


@router.put("/fields/{field_id}", dependencies=[Depends(get_current_admin)])
def update_field(field_id: int, data: FieldUpdate, db: Session = Depends(get_db)):
    field = db.query(PackageField).filter(PackageField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    for attr, val in data.model_dump(exclude_none=True).items():
        setattr(field, attr, val)
    db.commit()
    db.refresh(field)
    return {
        "id": field.id,
        "field_name": field.field_name,
        "field_type": field.field_type,
        "is_required": field.is_required,
        "options": field.options,
        "sort_order": field.sort_order,
    }


@router.delete("/fields/{field_id}", dependencies=[Depends(get_current_admin)])
@router.post("/fields/{field_id}/delete", dependencies=[Depends(get_current_admin)])
def delete_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(PackageField).filter(PackageField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()
    return {"ok": True}


__all__ = ["router", "slugify", "pkg_to_dict", "product_to_dict"]
