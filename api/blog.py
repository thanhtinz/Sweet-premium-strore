"""
Blog API — public read + admin CRUD for blog categories and posts.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from api.feature_guard import require_feature
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from api.sanitize import sanitize_html, sanitize_text
from sqlalchemy.orm import Session

from db import get_db
from db.models import BlogCategory, BlogPost
from api.auth import get_current_admin

router = APIRouter(prefix="/blog", tags=["blog"])


# ── Helpers ──────────────────────────────────────────────
def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[-\s]+", "-", text).strip("-")


# ── Schemas ──────────────────────────────────────────────
class BlogCategoryIn(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class BlogPostIn(BaseModel):
    category_id: Optional[int] = None
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: str
    thumbnail_url: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_published: bool = False


# ══════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS
# ══════════════════════════════════════════════════════════

@router.get("/categories", dependencies=[Depends(require_feature("blog"))])
def list_blog_categories(db: Session = Depends(get_db)):
    """Public: list active blog categories with post counts."""
    cats = (
        db.query(BlogCategory)
        .filter(BlogCategory.is_active == True)
        .order_by(BlogCategory.sort_order, BlogCategory.name)
        .all()
    )
    result = []
    for c in cats:
        count = db.query(func.count(BlogPost.id)).filter(
            BlogPost.category_id == c.id,
            BlogPost.is_published == True,
        ).scalar()
        result.append({
            "id": c.id, "name": c.name, "slug": c.slug,
            "description": c.description, "post_count": count,
        })
    return result


@router.get("/posts", dependencies=[Depends(require_feature("blog"))])
def list_blog_posts(
    category: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Public: list published blog posts (paginated)."""
    query = db.query(BlogPost).filter(BlogPost.is_published == True)

    if category:
        cat = db.query(BlogCategory).filter(BlogCategory.slug == category).first()
        if cat:
            query = query.filter(BlogPost.category_id == cat.id)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (BlogPost.title.ilike(search)) | (BlogPost.excerpt.ilike(search))
        )

    total = query.count()
    posts = (
        query.order_by(BlogPost.published_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": [_post_to_dict(p, summary=True) for p in posts],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/posts/{slug}", dependencies=[Depends(require_feature("blog"))])
def get_blog_post(slug: str, db: Session = Depends(get_db)):
    """Public: get single published post by slug; increment view count."""
    post = db.query(BlogPost).filter(
        BlogPost.slug == slug, BlogPost.is_published == True
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.view_count = (post.view_count or 0) + 1
    db.commit()
    db.refresh(post)
    return _post_to_dict(post, summary=False)


# ══════════════════════════════════════════════════════════
# ADMIN ENDPOINTS — Blog Categories
# ══════════════════════════════════════════════════════════

@router.get("/admin/categories")
def admin_list_blog_categories(
    _admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    cats = db.query(BlogCategory).order_by(BlogCategory.sort_order, BlogCategory.id).all()
    return [
        {
            "id": c.id, "name": c.name, "slug": c.slug,
            "description": c.description, "sort_order": c.sort_order,
            "is_active": c.is_active,
        }
        for c in cats
    ]


@router.post("/admin/categories")
def admin_create_blog_category(
    data: BlogCategoryIn,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    slug = data.slug or _slugify(data.name)
    if db.query(BlogCategory).filter(BlogCategory.slug == slug).first():
        raise HTTPException(400, "Slug already exists")
    cat = BlogCategory(
        name=data.name, slug=slug, description=data.description,
        sort_order=data.sort_order, is_active=data.is_active,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "slug": cat.slug}


@router.put("/admin/categories/{cat_id}")
def admin_update_blog_category(
    cat_id: int, data: BlogCategoryIn,
    _admin=Depends(get_current_admin), db: Session = Depends(get_db),
):
    cat = db.query(BlogCategory).get(cat_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.name = data.name
    cat.slug = data.slug or _slugify(data.name)
    cat.description = data.description
    cat.sort_order = data.sort_order
    cat.is_active = data.is_active
    db.commit()
    return {"ok": True}


@router.delete("/admin/categories/{cat_id}")
@router.post("/admin/categories/{cat_id}/delete", dependencies=[Depends(get_current_admin)])
def admin_delete_blog_category(
    cat_id: int, _admin=Depends(get_current_admin), db: Session = Depends(get_db),
):
    cat = db.query(BlogCategory).get(cat_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════
# ADMIN ENDPOINTS — Blog Posts
# ══════════════════════════════════════════════════════════

@router.get("/admin/posts")
def admin_list_blog_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(BlogPost.id)).scalar()
    posts = (
        db.query(BlogPost)
        .order_by(BlogPost.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [_post_to_dict(p, summary=True, admin=True) for p in posts],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


@router.get("/admin/posts/{post_id}")
def admin_get_blog_post(
    post_id: int, _admin=Depends(get_current_admin), db: Session = Depends(get_db),
):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return _post_to_dict(post, summary=False, admin=True)


@router.post("/admin/posts")
def admin_create_blog_post(
    data: BlogPostIn,
    admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    slug = data.slug or _slugify(data.title)
    # ensure unique slug
    base_slug = slug
    counter = 1
    while db.query(BlogPost).filter(BlogPost.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    now = datetime.now(timezone.utc) if data.is_published else None

    post = BlogPost(
        category_id=data.category_id,
        title=sanitize_text(data.title),
        slug=slug,
        excerpt=sanitize_text(data.excerpt) if data.excerpt else None,
        content=sanitize_html(data.content),
        thumbnail_url=data.thumbnail_url,
        meta_title=sanitize_text(data.meta_title or data.title),
        meta_description=sanitize_text(data.meta_description or (data.excerpt or "")[:160]),
        is_published=data.is_published,
        published_at=now,
        author_id=admin.get("user_id") if isinstance(admin, dict) else None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"id": post.id, "slug": post.slug}


@router.put("/admin/posts/{post_id}")
def admin_update_blog_post(
    post_id: int, data: BlogPostIn,
    _admin=Depends(get_current_admin), db: Session = Depends(get_db),
):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    post.category_id = data.category_id
    post.title = sanitize_text(data.title)
    if data.slug and data.slug != post.slug:
        if db.query(BlogPost).filter(BlogPost.slug == data.slug, BlogPost.id != post_id).first():
            raise HTTPException(400, "Slug already taken")
        post.slug = data.slug
    post.excerpt = sanitize_text(data.excerpt) if data.excerpt else None
    post.content = sanitize_html(data.content)
    post.thumbnail_url = data.thumbnail_url
    post.meta_title = sanitize_text(data.meta_title or data.title)
    post.meta_description = sanitize_text(data.meta_description or (data.excerpt or "")[:160])

    # Handle publish state change
    if data.is_published and not post.is_published:
        post.published_at = datetime.now(timezone.utc)
    post.is_published = data.is_published

    db.commit()
    return {"ok": True}


@router.delete("/admin/posts/{post_id}")
@router.post("/admin/posts/{post_id}/delete", dependencies=[Depends(get_current_admin)])
def admin_delete_blog_post(
    post_id: int, _admin=Depends(get_current_admin), db: Session = Depends(get_db),
):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    db.delete(post)
    db.commit()
    return {"ok": True}


# ── Serializer ───────────────────────────────────────────
def _post_to_dict(post: BlogPost, summary: bool = False, admin: bool = False):
    d = {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "excerpt": post.excerpt,
        "thumbnail_url": post.thumbnail_url,
        "category_id": post.category_id,
        "category_name": post.category.name if post.category else None,
        "published_at": post.published_at.isoformat() if post.published_at else None,
        "view_count": post.view_count,
    }
    if admin:
        d["is_published"] = post.is_published
        d["meta_title"] = post.meta_title
        d["meta_description"] = post.meta_description
        d["created_at"] = post.created_at.isoformat() if post.created_at else None
    if not summary:
        d["content"] = post.content
        d["meta_title"] = post.meta_title
        d["meta_description"] = post.meta_description
    return d
