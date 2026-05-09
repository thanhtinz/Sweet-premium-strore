"""
Announcements API — public read + admin CRUD.
"""
from datetime import datetime, timezone
from typing import Optional

from api.feature_guard import require_feature
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from api.sanitize import sanitize_html, sanitize_text

from db import get_db
from db.models import Announcement
from api.auth import get_current_admin, get_current_staff_or_admin

router = APIRouter(prefix="/announcements", tags=["announcements"])


# ── Schemas ──────────────────────────────────────────────
class AnnouncementIn(BaseModel):
    title: str
    content: str
    type: str = "info"  # info | warning | promo | update
    is_active: bool = True
    sort_order: int = 0


# ── Serializer ───────────────────────────────────────────
def _ann_to_dict(a: Announcement):
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "type": a.type,
        "is_active": a.is_active,
        "sort_order": a.sort_order,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ══════════════════════════════════════════════════════════
# PUBLIC ENDPOINT
# ══════════════════════════════════════════════════════════

@router.get("/", dependencies=[Depends(require_feature("announcements"))])
def list_announcements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Public: list active announcements (paginated)."""
    query = db.query(Announcement).filter(Announcement.is_active == True)
    total = query.count()
    items = (
        query.order_by(Announcement.sort_order, Announcement.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [_ann_to_dict(a) for a in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ══════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════

@router.get("/admin/all")
def admin_list_announcements(
    _admin=Depends(get_current_staff_or_admin),
    db: Session = Depends(get_db),
):
    """Admin: list all announcements (including inactive)."""
    items = (
        db.query(Announcement)
        .order_by(Announcement.sort_order, Announcement.created_at.desc())
        .all()
    )
    return [_ann_to_dict(a) for a in items]


@router.post("/admin/", status_code=201)
def admin_create_announcement(
    data: AnnouncementIn,
    _admin=Depends(get_current_staff_or_admin),
    db: Session = Depends(get_db),
):
    ann = Announcement(
        title=sanitize_text(data.title),
        content=sanitize_html(data.content),
        type=data.type,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return _ann_to_dict(ann)


@router.put("/admin/{ann_id}")
def admin_update_announcement(
    ann_id: int,
    data: AnnouncementIn,
    _admin=Depends(get_current_staff_or_admin),
    db: Session = Depends(get_db),
):
    ann = db.query(Announcement).get(ann_id)
    if not ann:
        raise HTTPException(404, "Announcement not found")
    ann.title = sanitize_text(data.title)
    ann.content = sanitize_html(data.content)
    ann.type = data.type
    ann.is_active = data.is_active
    ann.sort_order = data.sort_order
    ann.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _ann_to_dict(ann)


@router.delete("/admin/{ann_id}")
@router.post("/admin/{ann_id}/delete", dependencies=[Depends(get_current_staff_or_admin)])
def admin_delete_announcement(
    ann_id: int,
    _admin=Depends(get_current_staff_or_admin),
    db: Session = Depends(get_db),
):
    ann = db.query(Announcement).get(ann_id)
    if not ann:
        raise HTTPException(404, "Announcement not found")
    db.delete(ann)
    db.commit()
    return {"ok": True}
