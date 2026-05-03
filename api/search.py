"""
Search API — unified search across products and blog posts.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import get_db
from db.models import Product, ProductPackage, BlogPost

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,  # "products" | "blog" | None (all)
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search products and/or blog posts."""
    search_term = f"%{q}%"
    results = {"products": [], "blog": [], "query": q}

    if type in (None, "products"):
        prods = (
            db.query(Product)
            .filter(
                Product.is_active == True,
                (Product.name.ilike(search_term)) | (Product.description.ilike(search_term)),
            )
            .order_by(Product.sort_order, Product.name)
            .limit(limit)
            .all()
        )
        for p in prods:
            # get min price from packages
            min_pkg = (
                db.query(ProductPackage)
                .filter(ProductPackage.product_id == p.id, ProductPackage.is_active == True)
                .order_by(ProductPackage.price)
                .first()
            )
            results["products"].append({
                "id": p.id,
                "name": p.name,
                "slug": p.slug,
                "image_url": p.image_url,
                "description": (p.description or "")[:150],
                "min_price": float(min_pkg.price) if min_pkg else None,
            })

    if type in (None, "blog"):
        posts = (
            db.query(BlogPost)
            .filter(
                BlogPost.is_published == True,
                (BlogPost.title.ilike(search_term)) | (BlogPost.excerpt.ilike(search_term)),
            )
            .order_by(BlogPost.published_at.desc())
            .limit(limit)
            .all()
        )
        for bp in posts:
            results["blog"].append({
                "id": bp.id,
                "title": bp.title,
                "slug": bp.slug,
                "excerpt": (bp.excerpt or "")[:150],
                "thumbnail_url": bp.thumbnail_url,
                "published_at": bp.published_at.isoformat() if bp.published_at else None,
            })

    return results
