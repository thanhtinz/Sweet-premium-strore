"""
Reviews API — public read + authenticated write for product reviews.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import get_db
from api.sanitize import sanitize_text
from db.models import Review, Product, Order, ProductPackage
from api.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    product_id: int
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def check_rating(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be 1-5")
        return v


# ── Public ──────────────────────────────────────────────

@router.get("/product/{product_id}")
def get_product_reviews(
    product_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Public: get reviews for a product with stats."""
    base = db.query(Review).filter(
        Review.product_id == product_id,
        Review.is_visible == True,
    )
    total = base.count()

    # Stats
    stats = db.query(
        func.avg(Review.rating),
        func.count(Review.id),
    ).filter(
        Review.product_id == product_id,
        Review.is_visible == True,
    ).first()
    avg_rating = round(float(stats[0]), 1) if stats[0] else 0
    total_reviews = stats[1] or 0

    # Rating distribution
    dist = {}
    for i in range(1, 6):
        dist[str(i)] = db.query(func.count(Review.id)).filter(
            Review.product_id == product_id,
            Review.is_visible == True,
            Review.rating == i,
        ).scalar() or 0

    reviews = (
        base.order_by(Review.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "avg_rating": avg_rating,
        "total_reviews": total_reviews,
        "distribution": dist,
        "items": [
            {
                "id": r.id,
                "user_name": r.user_name or "Ẩn danh",
                "rating": r.rating,
                "comment": r.comment,
                "is_verified": r.is_verified,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/stats/{product_id}")
def get_review_stats(product_id: int, db: Session = Depends(get_db)):
    """Quick stats (avg + count) for product cards."""
    stats = db.query(
        func.avg(Review.rating),
        func.count(Review.id),
    ).filter(
        Review.product_id == product_id,
        Review.is_visible == True,
    ).first()
    return {
        "avg_rating": round(float(stats[0]), 1) if stats[0] else 0,
        "total_reviews": stats[1] or 0,
    }


# ── Authenticated ──────────────────────────────────────────

@router.post("/")
def create_review(
    data: ReviewCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).get(data.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    # Check duplicate
    existing = db.query(Review).filter(
        Review.product_id == data.product_id,
        Review.user_id == user["user_id"],
    ).first()
    if existing:
        raise HTTPException(400, "Bạn đã đánh giá sản phẩm này rồi")

    # Check if user bought this product (verified purchase)
    product_package_ids = db.query(ProductPackage.id).filter(
        ProductPackage.product_id == data.product_id
    ).subquery()
    is_verified = db.query(Order).filter(
        Order.user_id == user["user_id"],
        Order.status == "completed",
        Order.package_id.in_(product_package_ids),
    ).first() is not None

    review = Review(
        product_id=data.product_id,
        user_id=user["user_id"],
        user_name=user.get("email", "").split("@")[0],
        rating=data.rating,
        comment=sanitize_text(data.comment) if data.comment else None,
        is_verified=is_verified,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return {
        "id": review.id,
        "rating": review.rating,
        "comment": review.comment,
        "is_verified": review.is_verified,
    }
