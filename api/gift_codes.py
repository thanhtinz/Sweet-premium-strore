from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from db import get_db
from db.models import GiftCode
from api.auth import get_current_admin

router = APIRouter(prefix="/gift-codes", tags=["gift-codes"])


# ── Public: get public codes ───────────────────────────────────
@router.get("/public")
def get_public_codes(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    codes = db.query(GiftCode).filter(
        GiftCode.is_active == True,
        GiftCode.is_public == True,
    ).all()
    
    valid_codes = []
    for gc in codes:
        if gc.starts_at and gc.starts_at > now:
            continue
        if gc.expires_at and gc.expires_at < now:
            continue
        if gc.usage_limit > 0 and gc.usage_count >= gc.usage_limit:
            continue
            
        valid_codes.append({
            "id": gc.id,
            "code": gc.code,
            "discount_type": gc.discount_type,
            "discount_value": float(gc.discount_value),
            "min_order": float(gc.min_order) if gc.min_order else 0,
            "max_discount": float(gc.max_discount) if gc.max_discount else None,
            "expires_at": gc.expires_at.isoformat() if gc.expires_at else None,
            "usage_limit": gc.usage_limit,
            "usage_count": gc.usage_count,
        })
    return valid_codes


# ── Public: validate code ───────────────────────────────────
@router.get("/check/{code}")
def check_code(code: str, db: Session = Depends(get_db)):
    gc = db.query(GiftCode).filter(GiftCode.code == code.upper().strip()).first()
    if not gc or not gc.is_active:
        raise HTTPException(404, "Mã không hợp lệ")
    now = datetime.now(timezone.utc)
    if gc.starts_at and gc.starts_at > now:
        raise HTTPException(400, "Mã chưa có hiệu lực")
    if gc.expires_at and gc.expires_at < now:
        raise HTTPException(400, "Mã đã hết hạn")
    if gc.usage_limit > 0 and gc.usage_count >= gc.usage_limit:
        raise HTTPException(400, "Mã đã hết lượt sử dụng")
    return {
        "code": gc.code,
        "discount_type": gc.discount_type,
        "discount_value": float(gc.discount_value),
        "min_order": float(gc.min_order) if gc.min_order else 0,
        "max_discount": float(gc.max_discount) if gc.max_discount else None,
    }


def apply_gift_code(code: str, order_amount: float, db: Session) -> dict:
    """Apply gift code and return discount info. Called from orders/checkout."""
    gc = db.query(GiftCode).filter(GiftCode.code == code.upper().strip()).first()
    if not gc or not gc.is_active:
        return {"discount": 0, "error": "Mã không hợp lệ"}
    now = datetime.now(timezone.utc)
    if gc.starts_at and gc.starts_at > now:
        return {"discount": 0, "error": "Mã chưa có hiệu lực"}
    if gc.expires_at and gc.expires_at < now:
        return {"discount": 0, "error": "Mã đã hết hạn"}
    if gc.usage_limit > 0 and gc.usage_count >= gc.usage_limit:
        return {"discount": 0, "error": "Mã đã hết lượt sử dụng"}
    if gc.min_order and order_amount < float(gc.min_order):
        return {"discount": 0, "error": f"Đơn tối thiểu {int(gc.min_order)}đ"}

    if gc.discount_type == "percent":
        discount = order_amount * float(gc.discount_value) / 100
        if gc.max_discount:
            discount = min(discount, float(gc.max_discount))
    else:
        discount = float(gc.discount_value)

    discount = min(discount, order_amount)  # can't exceed order
    gc.usage_count += 1
    db.flush()
    return {"discount": discount, "error": None, "code_id": gc.id}


# ── Admin ───────────────────────────────────────────────────
class GiftCodeCreate(BaseModel):
    code: str
    discount_type: str = "percent"
    discount_value: float
    min_order: float = 0
    max_discount: Optional[float] = None
    usage_limit: int = 0
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool = True


@router.get("/admin/list", dependencies=[Depends(get_current_admin)])
def admin_list(db: Session = Depends(get_db)):
    rows = db.query(GiftCode).order_by(GiftCode.id.desc()).all()
    return [_to_dict(gc) for gc in rows]


@router.post("/admin", dependencies=[Depends(get_current_admin)])
def create_gift_code(body: GiftCodeCreate, db: Session = Depends(get_db)):
    code = body.code.upper().strip()
    if db.query(GiftCode).filter(GiftCode.code == code).first():
        raise HTTPException(400, "Mã đã tồn tại")
    gc = GiftCode(
        code=code,
        discount_type=body.discount_type,
        discount_value=body.discount_value,
        min_order=body.min_order,
        max_discount=body.max_discount,
        usage_limit=body.usage_limit,
        starts_at=datetime.fromisoformat(body.starts_at) if body.starts_at else None,
        expires_at=datetime.fromisoformat(body.expires_at) if body.expires_at else None,
        is_active=body.is_active,
    )
    db.add(gc)
    db.commit()
    db.refresh(gc)
    return _to_dict(gc)


@router.put("/admin/{gid}", dependencies=[Depends(get_current_admin)])
def update_gift_code(gid: int, body: GiftCodeCreate, db: Session = Depends(get_db)):
    gc = db.query(GiftCode).get(gid)
    if not gc:
        raise HTTPException(404)
    gc.code = body.code.upper().strip()
    gc.discount_type = body.discount_type
    gc.discount_value = body.discount_value
    gc.min_order = body.min_order
    gc.max_discount = body.max_discount
    gc.usage_limit = body.usage_limit
    gc.starts_at = datetime.fromisoformat(body.starts_at) if body.starts_at else None
    gc.expires_at = datetime.fromisoformat(body.expires_at) if body.expires_at else None
    gc.is_active = body.is_active
    db.commit()
    db.refresh(gc)
    return _to_dict(gc)


@router.delete("/admin/{gid}", dependencies=[Depends(get_current_admin)])
def delete_gift_code(gid: int, db: Session = Depends(get_db)):
    gc = db.query(GiftCode).get(gid)
    if not gc:
        raise HTTPException(404)
    db.delete(gc)
    db.commit()
    return {"ok": True}


def _to_dict(gc: GiftCode):
    return {
        "id": gc.id,
        "code": gc.code,
        "discount_type": gc.discount_type,
        "discount_value": float(gc.discount_value),
        "min_order": float(gc.min_order) if gc.min_order else 0,
        "max_discount": float(gc.max_discount) if gc.max_discount else None,
        "usage_limit": gc.usage_limit,
        "usage_count": gc.usage_count,
        "starts_at": gc.starts_at.isoformat() if gc.starts_at else None,
        "expires_at": gc.expires_at.isoformat() if gc.expires_at else None,
        "is_active": gc.is_active,
    }
