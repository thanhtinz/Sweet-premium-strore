from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import datetime, timezone
from db import get_db
from db.models import FlashSale, ProductPackage, Product
from api.auth import get_current_admin

router = APIRouter(prefix="/flash-sales", tags=["flash-sales"])


# ── Public ──────────────────────────────────────────────────
@router.get("/active")
def list_active(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(FlashSale)
        .options(joinedload(FlashSale.package).joinedload(ProductPackage.product))
        .filter(
            FlashSale.is_active == True,
            FlashSale.starts_at <= now,
            FlashSale.ends_at > now,
        )
        .order_by(FlashSale.ends_at)
        .all()
    )
    return [_to_dict(fs) for fs in rows if _is_available(fs)]


@router.get("/upcoming")
def list_upcoming(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(FlashSale)
        .options(joinedload(FlashSale.package).joinedload(ProductPackage.product))
        .filter(FlashSale.is_active == True, FlashSale.starts_at > now)
        .order_by(FlashSale.starts_at)
        .limit(10)
        .all()
    )
    return [_to_dict(fs) for fs in rows]


# ── Admin ───────────────────────────────────────────────────
class FlashSaleCreate(BaseModel):
    package_id: int
    sale_price: float
    quantity_limit: int = 0
    starts_at: str  # ISO datetime
    ends_at: str
    is_active: bool = True


@router.get("/admin/list", dependencies=[Depends(get_current_admin)])
def admin_list(db: Session = Depends(get_db)):
    rows = (
        db.query(FlashSale)
        .options(joinedload(FlashSale.package).joinedload(ProductPackage.product))
        .order_by(FlashSale.id.desc())
        .all()
    )
    return [_to_dict(fs) for fs in rows]


@router.post("/admin", dependencies=[Depends(get_current_admin)])
def create_flash_sale(body: FlashSaleCreate, db: Session = Depends(get_db)):
    pkg = db.query(ProductPackage).get(body.package_id)
    if not pkg:
        raise HTTPException(404, "Package not found")
    fs = FlashSale(
        package_id=body.package_id,
        sale_price=body.sale_price,
        quantity_limit=body.quantity_limit,
        starts_at=datetime.fromisoformat(body.starts_at),
        ends_at=datetime.fromisoformat(body.ends_at),
        is_active=body.is_active,
    )
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return _to_dict(fs, db=db)


@router.put("/admin/{fid}", dependencies=[Depends(get_current_admin)])
def update_flash_sale(fid: int, body: FlashSaleCreate, db: Session = Depends(get_db)):
    fs = db.query(FlashSale).get(fid)
    if not fs:
        raise HTTPException(404, "Flash sale not found")
    fs.package_id = body.package_id
    fs.sale_price = body.sale_price
    fs.quantity_limit = body.quantity_limit
    fs.starts_at = datetime.fromisoformat(body.starts_at)
    fs.ends_at = datetime.fromisoformat(body.ends_at)
    fs.is_active = body.is_active
    db.commit()
    db.refresh(fs)
    return _to_dict(fs, db=db)


@router.delete("/admin/{fid}", dependencies=[Depends(get_current_admin)])
@router.post("/admin/{fid}/delete", dependencies=[Depends(get_current_admin)])
def delete_flash_sale(fid: int, db: Session = Depends(get_db)):
    fs = db.query(FlashSale).get(fid)
    if not fs:
        raise HTTPException(404, "Flash sale not found")
    db.delete(fs)
    db.commit()
    return {"ok": True}


def _is_available(fs: FlashSale) -> bool:
    if fs.quantity_limit > 0 and fs.quantity_sold >= fs.quantity_limit:
        return False
    return True


def _to_dict(fs: FlashSale, db=None):
    pkg = fs.package
    product = pkg.product if pkg else None
    d = {
        "id": fs.id,
        "package_id": fs.package_id,
        "package_name": pkg.name if pkg else None,
        "product_name": product.name if product else None,
        "product_slug": product.slug if product else None,
        "product_image": product.image_url if product else None,
        "original_price": float(pkg.price) if pkg else 0,
        "sale_price": float(fs.sale_price),
        "discount_pct": round((1 - float(fs.sale_price) / float(pkg.price)) * 100) if pkg and float(pkg.price) > 0 else 0,
        "quantity_limit": fs.quantity_limit,
        "quantity_sold": fs.quantity_sold,
        "starts_at": fs.starts_at.isoformat() if fs.starts_at else None,
        "ends_at": fs.ends_at.isoformat() if fs.ends_at else None,
        "is_active": fs.is_active,
    }
    return d
