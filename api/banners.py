from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from db import get_db
from db.models import Banner, UploadedImage, Category, Product, ProductPackage, SiteConfig, BlogPost, User
from api.auth import get_current_admin

router = APIRouter(prefix="/banners", tags=["banners"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
INLINE_SAFE_IMAGE_MIME = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"}
IMAGE_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
}


def _normalize_image_mime(mime: str) -> str:
    mime = (mime or "").split(";")[0].lower().strip()
    if mime not in INLINE_SAFE_IMAGE_MIME:
        raise HTTPException(400, "Chỉ hỗ trợ ảnh PNG, JPG, GIF, WEBP hoặc AVIF")
    return mime


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


def _image_url(image_id: int) -> str:
    return f"/api/banners/images/{image_id}"


def _image_usage_groups(db: Session, url: str) -> list[str]:
    groups = []
    if db.query(Banner.id).filter(Banner.image_url == url).first():
        groups.append("banner")
    if db.query(Category.id).filter((Category.icon_url == url) | (Category.image_url == url)).first():
        groups.append("category")
    if db.query(Product.id).filter(Product.image_url == url).first():
        groups.append("product")
    if db.query(ProductPackage.id).filter(ProductPackage.image_url == url).first():
        groups.append("package")
    if db.query(BlogPost.id).filter(BlogPost.thumbnail_url == url).first():
        groups.append("blog")
    if db.query(User.id).filter(User.avatar_url == url).first():
        groups.append("user")

    import json as _json
    setting_labels = {
        "logo_url": "Logo",
        "favicon_url": "Favicon",
        "currency_icon": "Icon tiền tệ",
        "default_image_url": "Ảnh mặc định",
        "seo_image_url": "Ảnh SEO",
        "default_avatar_url": "Avatar mặc định",
    }
    for key in ("settings_general", "settings_images"):
        cfg = db.query(SiteConfig).filter(SiteConfig.key == key).first()
        if not cfg or not cfg.value:
            continue
        settings = cfg.value
        if isinstance(settings, str):
            try:
                settings = _json.loads(settings)
            except Exception:
                continue
        if not isinstance(settings, dict):
            continue
        for field, label in setting_labels.items():
            if settings.get(field) == url:
                groups.append(f"settings:{label}")

    if not groups:
        groups.append("unused")
    return groups


@router.get("/admin/images", dependencies=[Depends(get_current_admin)])
def admin_images(db: Session = Depends(get_db)):
    rows = db.query(UploadedImage).order_by(UploadedImage.created_at.desc(), UploadedImage.id.desc()).all()
    items = []
    for img in rows:
        url = _image_url(img.id)
        items.append({
            "id": img.id,
            "url": url,
            "filename": img.filename,
            "mime_type": img.mime_type,
            "size": len(img.data or b""),
            "created_at": img.created_at.isoformat() if img.created_at else None,
            "groups": _image_usage_groups(db, url),
        })
    return {"items": items}


@router.delete("/admin/images/{image_id}", dependencies=[Depends(get_current_admin)])
@router.post("/admin/images/{image_id}/delete", dependencies=[Depends(get_current_admin)])
def delete_uploaded_image(image_id: int, db: Session = Depends(get_db)):
    img = db.query(UploadedImage).filter(UploadedImage.id == image_id).first()
    if not img:
        raise HTTPException(404, "Không tìm thấy ảnh")
    url = _image_url(img.id)
    groups = [g for g in _image_usage_groups(db, url) if g != "unused"]
    if groups:
        raise HTTPException(400, "Ảnh đang được dùng, hãy gỡ khỏi nơi sử dụng trước khi xoá")
    db.delete(img)
    db.commit()
    return {"ok": True}

    return [_to_dict(b) for b in rows]


@router.post("/admin/upload-image", dependencies=[Depends(get_current_admin)])
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(400, "File rỗng")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Ảnh quá lớn, tối đa 5MB")
    mime = _normalize_image_mime(file.content_type or "")
    # M2: verify magic bytes — make sure content is a real image, not just renamed
    try:
        from PIL import Image
        import io
        with Image.open(io.BytesIO(contents)) as im:
            im.verify()
            real_fmt = (im.format or "").lower()
    except Exception:
        raise HTTPException(400, "File không phải ảnh hợp lệ")
    fmt_to_mime = {"jpeg": "image/jpeg", "jpg": "image/jpeg", "png": "image/png",
                   "gif": "image/gif", "webp": "image/webp"}
    real_mime = fmt_to_mime.get(real_fmt)
    if not real_mime:
        raise HTTPException(400, "Định dạng ảnh không được hỗ trợ")
    # trust the magic-bytes mime over the client-provided header
    mime = real_mime
    ext = IMAGE_EXTENSIONS.get(mime, ".img")
    filename = (file.filename or f"image{ext}")[:240]
    img = UploadedImage(filename=filename, data=contents, mime_type=mime)
    db.add(img)
    db.commit()
    db.refresh(img)
    return {"url": f"/api/banners/images/{img.id}", "id": img.id}


@router.get("/images/{image_id}")
def get_uploaded_image(image_id: int, db: Session = Depends(get_db)):
    row = db.query(UploadedImage).filter(UploadedImage.id == image_id).first()
    if not row or row.data is None:
        raise HTTPException(404, "Image not found")
    mime = (row.mime_type or "application/octet-stream").lower()
    if mime not in INLINE_SAFE_IMAGE_MIME:
        return Response(
            content=bytes(row.data),
            media_type="application/octet-stream",
            headers={"X-Content-Type-Options": "nosniff", "Content-Disposition": "attachment"},
        )
    return Response(
        content=bytes(row.data),
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'inline; filename="{row.filename or f"image-{image_id}"}"',
            "Content-Length": str(len(row.data)),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
        },
    )


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
