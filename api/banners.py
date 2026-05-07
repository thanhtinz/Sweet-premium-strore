from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from db import get_db
from db.models import Banner
from api.auth import get_current_admin
import os, uuid, aiofiles

router = APIRouter(prefix="/banners", tags=["banners"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Public ──────────────────────────────────────────────────
@router.get("/")
def list_banners(db: Session = Depends(get_db)):
    rows = db.query(Banner).filter(Banner.is_active == True).order_by(Banner.sort_order, Banner.id).all()
    return [_to_dict(b) for b in rows]


# ── Admin ───────────────────────────────────────────────────
@router.get("/admin/list", dependencies=[Depends(get_current_admin)])
def admin_list(db: Session = Depends(get_db)):
    rows = db.query(Banner).order_by(Banner.sort_order, Banner.id).all()
    return [_to_dict(b) for b in rows]


@router.post("/admin/upload-image", dependencies=[Depends(get_current_admin)])
async def upload_image(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "img.png")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
        raise HTTPException(400, "Unsupported image type")
    name = f"{uuid.uuid4().hex[:12]}{ext}"
    path = os.path.join(UPLOAD_DIR, name)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return {"url": f"/static/uploads/{name}"}


class BannerCreate(BaseModel):
    title: str
    image_url: str
    link: Optional[str] = ""
    banner_type: str = "hero"  # hero | category
    sort_order: int = 0
    is_active: bool = True


@router.post("/admin", dependencies=[Depends(get_current_admin)])
def create_banner(body: BannerCreate, db: Session = Depends(get_db)):
    b = Banner(**body.dict())
    db.add(b)
    db.commit()
    db.refresh(b)
    return _to_dict(b)


@router.put("/admin/{bid}", dependencies=[Depends(get_current_admin)])
def update_banner(bid: int, body: BannerCreate, db: Session = Depends(get_db)):
    b = db.query(Banner).get(bid)
    if not b:
        raise HTTPException(404, "Banner not found")
    for k, v in body.dict().items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return _to_dict(b)


@router.delete("/admin/{bid}", dependencies=[Depends(get_current_admin)])
@router.post("/admin/{bid}/delete", dependencies=[Depends(get_current_admin)])
def delete_banner(bid: int, db: Session = Depends(get_db)):
    b = db.query(Banner).get(bid)
    if not b:
        raise HTTPException(404, "Banner not found")
    db.delete(b)
    db.commit()
    return {"ok": True}


def _to_dict(b: Banner):
    return {
        "id": b.id,
        "title": b.title,
        "image_url": b.image_url,
        "link": b.link,
        "banner_type": b.banner_type,
        "sort_order": b.sort_order,
        "is_active": b.is_active,
    }
