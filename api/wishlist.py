from api.feature_guard import require_feature
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from db import get_db
from db.models import Wishlist, Product
from api.auth import get_current_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"], dependencies=[Depends(require_feature("wishlist"))])


@router.get("/ids")
def get_wishlist_ids(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return list of product IDs in user's wishlist."""
    rows = db.query(Wishlist.product_id).filter(
        Wishlist.user_id == str(user["user_id"])
    ).all()
    return [r[0] for r in rows]


@router.post("/toggle/{product_id}")
def toggle_wishlist(product_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Add or remove product from wishlist. Returns new state."""
    uid = str(user["user_id"])
    existing = db.query(Wishlist).filter(
        Wishlist.user_id == uid, Wishlist.product_id == product_id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"wishlisted": False}
    # Verify product exists
    if not db.query(Product).filter(Product.id == product_id).first():
        raise HTTPException(404, "Sản phẩm không tồn tại")
    db.add(Wishlist(user_id=uid, product_id=product_id))
    db.commit()
    return {"wishlisted": True}


@router.delete("/{product_id}")
def remove_wishlist(product_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = str(user["user_id"])
    w = db.query(Wishlist).filter(
        Wishlist.user_id == uid, Wishlist.product_id == product_id
    ).first()
    if w:
        db.delete(w)
        db.commit()
    return {"ok": True}


@router.get("/")
def list_wishlist(
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    q: str = Query("", max_length=100),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user's wishlist products with pagination and search."""
    uid = str(user["user_id"])
    query = (
        db.query(Product)
        .join(Wishlist, Wishlist.product_id == Product.id)
        .filter(Wishlist.user_id == uid)
    )
    if q.strip():
        query = query.filter(Product.name.ilike(f"%{q.strip()}%"))

    total = query.count()
    items = (
        query.order_by(Wishlist.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": [_product_summary(p) for p in items],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


def _product_summary(p: Product):
    # Find min price from packages
    min_price = None
    if p.packages:
        prices = [pkg.price for pkg in p.packages if pkg.price]
        if prices:
            min_price = float(min(prices))
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "image_url": p.image_url,
        "min_price": min_price,
        "category_name": p.category.name if p.category else None,
        "sold_count": p.sold_count or 0,
    }
