from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from db import get_db
from db.models import AffiliateUser, AffiliateReferral
from api.auth import get_current_user, get_current_admin
import uuid

router = APIRouter(prefix="/affiliate", tags=["affiliate"])


# ── User endpoints ──────────────────────────────────────────
@router.get("/me")
def my_affiliate(user=Depends(get_current_user), db: Session = Depends(get_db)):
    aff = db.query(AffiliateUser).filter(AffiliateUser.user_id == str(user["user_id"])).first()
    if not aff:
        return {"registered": False}
    refs = db.query(AffiliateReferral).filter(AffiliateReferral.affiliate_id == aff.id).order_by(AffiliateReferral.id.desc()).limit(50).all()
    return {
        "registered": True,
        **_aff_to_dict(aff),
        "referrals": [_ref_to_dict(r) for r in refs],
    }


@router.post("/register")
def register_affiliate(user=Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(AffiliateUser).filter(AffiliateUser.user_id == str(user["user_id"])).first()
    if existing:
        return _aff_to_dict(existing)
    ref_code = uuid.uuid4().hex[:8].upper()
    while db.query(AffiliateUser).filter(AffiliateUser.ref_code == ref_code).first():
        ref_code = uuid.uuid4().hex[:8].upper()
    aff = AffiliateUser(
        user_id=str(user["user_id"]),
        email=user.get("email"),
        ref_code=ref_code,
    )
    db.add(aff)
    db.commit()
    db.refresh(aff)
    return _aff_to_dict(aff)


# ── Admin ───────────────────────────────────────────────────
@router.get("/admin/list", dependencies=[Depends(get_current_admin)])
def admin_list(db: Session = Depends(get_db)):
    affs = db.query(AffiliateUser).order_by(AffiliateUser.id.desc()).all()
    return [_aff_to_dict(a) for a in affs]


@router.get("/admin/{aid}/referrals", dependencies=[Depends(get_current_admin)])
def admin_referrals(aid: int, db: Session = Depends(get_db)):
    refs = db.query(AffiliateReferral).filter(AffiliateReferral.affiliate_id == aid).order_by(AffiliateReferral.id.desc()).all()
    return [_ref_to_dict(r) for r in refs]


class AffUpdate(BaseModel):
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None


@router.put("/admin/{aid}", dependencies=[Depends(get_current_admin)])
def admin_update(aid: int, body: AffUpdate, db: Session = Depends(get_db)):
    aff = db.query(AffiliateUser).get(aid)
    if not aff:
        raise HTTPException(404)
    if body.commission_rate is not None:
        aff.commission_rate = body.commission_rate
    if body.is_active is not None:
        aff.is_active = body.is_active
    db.commit()
    db.refresh(aff)
    return _aff_to_dict(aff)


@router.put("/admin/referral/{rid}/approve", dependencies=[Depends(get_current_admin)])
def approve_referral(rid: int, db: Session = Depends(get_db)):
    ref = db.query(AffiliateReferral).get(rid)
    if not ref:
        raise HTTPException(404)
    if ref.status != "pending":
        raise HTTPException(400, "Already processed")
    ref.status = "approved"
    aff = db.query(AffiliateUser).get(ref.affiliate_id)
    if aff:
        aff.total_earnings = float(aff.total_earnings or 0) + float(ref.commission)
    db.commit()
    return {"ok": True}


def track_referral(ref_code: str, order_id: int, order_amount: float, db: Session):
    """Called after successful order to create referral record."""
    aff = db.query(AffiliateUser).filter(
        AffiliateUser.ref_code == ref_code, AffiliateUser.is_active == True
    ).first()
    if not aff:
        return
    commission = float(order_amount) * float(aff.commission_rate) / 100
    ref = AffiliateReferral(
        affiliate_id=aff.id,
        order_id=order_id,
        order_amount=order_amount,
        commission=commission,
    )
    db.add(ref)
    db.flush()


def _aff_to_dict(a: AffiliateUser):
    return {
        "id": a.id,
        "user_id": a.user_id,
        "email": a.email,
        "ref_code": a.ref_code,
        "commission_rate": float(a.commission_rate),
        "total_earnings": float(a.total_earnings or 0),
        "total_paid": float(a.total_paid or 0),
        "is_active": a.is_active,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _ref_to_dict(r: AffiliateReferral):
    return {
        "id": r.id,
        "order_id": r.order_id,
        "order_amount": float(r.order_amount),
        "commission": float(r.commission),
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
