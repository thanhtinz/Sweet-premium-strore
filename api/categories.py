from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List
from db import get_db
from db.models import Category
from api.auth import get_current_admin
import re

router = APIRouter(prefix="/categories", tags=["categories"])


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[int] = None
    product_type: str = "premium"  # premium | game
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[int] = None
    product_type: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class BulkIdsRequest(BaseModel):
    ids: List[int] = Field(default_factory=list)

    icon_url: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


def cat_to_dict(cat: Category, include_children=False) -> dict:
    d = {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "icon_url": cat.icon_url,
        "image_url": cat.image_url,
        "parent_id": cat.parent_id,
        "product_type": cat.product_type or "premium",
        "sort_order": cat.sort_order,
        "is_active": cat.is_active,
        "created_at": cat.created_at.isoformat() if cat.created_at else None,
    }
    if include_children:
        d["children"] = [cat_to_dict(c) for c in cat.children]
    return d


@router.get("/")
def list_categories(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    q = db.query(Category).filter(Category.parent_id == None)
    if active_only:
        q = q.filter(Category.is_active == True)
    cats = q.order_by(Category.sort_order).all()
    return [cat_to_dict(c, include_children=True) for c in cats]


@router.get("/all")
def list_all_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order).all()
    return [cat_to_dict(c) for c in cats]


@router.get("/{slug}")
def get_category(slug: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.slug == slug).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat_to_dict(cat, include_children=True)


@router.post("/", dependencies=[Depends(get_current_admin)])
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    slug = data.slug or slugify(data.name)
    existing = db.query(Category).filter(Category.slug == slug).first()
    if existing:
        slug = f"{slug}-{db.query(Category).count()}"
    cat = Category(
        name=data.name,
        slug=slug,
        icon_url=data.icon_url,
        image_url=data.image_url,
        parent_id=data.parent_id,
        product_type=data.product_type,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat_to_dict(cat)


@router.put("/{cat_id}", dependencies=[Depends(get_current_admin)])
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    updates = data.model_dump(exclude_none=True)
    # Validate slug uniqueness
    if "slug" in updates and updates["slug"] != cat.slug:
        slug = updates["slug"]
        existing = db.query(Category).filter(Category.slug == slug, Category.id != cat_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Slug đã tồn tại")
    # Validate parent_id
    if "parent_id" in updates:
        pid = updates["parent_id"]
        if pid is not None:
            if pid == cat_id:
                raise HTTPException(status_code=400, detail="Không thể đặt chính mình làm danh mục cha")
            parent = db.query(Category).filter(Category.id == pid).first()
            if not parent:
                raise HTTPException(status_code=400, detail="Danh mục cha không tồn tại")
            if parent.parent_id == cat_id:
                raise HTTPException(status_code=400, detail="Tham chiếu vòng: danh mục cha đang là con của danh mục này")
    for field, val in updates.items():
        setattr(cat, field, val)
    db.commit()
    db.refresh(cat)
    return cat_to_dict(cat)


@router.delete("/{cat_id}", dependencies=[Depends(get_current_admin)])
@router.post("/{cat_id}/delete", dependencies=[Depends(get_current_admin)])
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Detach products
    from db.models import Product
    db.query(Product).filter(Product.category_id == cat_id).update({"category_id": None})
    
    # Detach or delete children categories
    for child in cat.children:
        child.parent_id = None
        
    db.delete(cat)
    db.commit()
    return {"ok": True}


@router.post("/bulk-delete", dependencies=[Depends(get_current_admin)])
def bulk_delete_categories(body: BulkIdsRequest, db: Session = Depends(get_db)):
    ids = sorted(set(int(i) for i in (body.ids or []) if int(i) > 0))
    if not ids:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một danh mục")
    cats = db.query(Category).filter(Category.id.in_(ids)).all()
    from db.models import Product
    db.query(Product).filter(Product.category_id.in_(ids)).update({"category_id": None}, synchronize_session=False)
    for child in db.query(Category).filter(Category.parent_id.in_(ids)).all():
        child.parent_id = None
    for cat in cats:
        db.delete(cat)
    db.commit()
    return {"ok": True, "requested": len(ids), "deleted": len(cats)}
