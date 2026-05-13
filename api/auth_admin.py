import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.auth_shared import (
    _generate_temp_password,
    _hash_password,
    _normalize_admin_role,
    _send_password_email,
    get_current_admin,
)
from api.rate_limit import rate_limit
from db import get_db
from db.models import AdminUser, User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


@router.post("/make-admin", dependencies=[Depends(rate_limit("make_admin", 5, 3600))])
def make_admin(data: dict, request: Request, db: Session = Depends(get_db)):
    # Production gate: refuse unless explicitly allowed via env flag
    if os.environ.get("ENV", "").lower() == "production" and os.environ.get("ALLOW_MAKE_ADMIN") != "1":
        raise HTTPException(status_code=404, detail="Not found")
    secret = os.environ.get("ADMIN_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="ADMIN_SECRET not configured. Set it as an environment variable.")
    if len(secret) < 16 or secret in ("changeme123", "admin", "secret", "password"):
        raise HTTPException(status_code=503, detail="ADMIN_SECRET is too weak. Use a strong random string.")
    if data.get("secret") != secret:
        raise HTTPException(status_code=403, detail="Invalid secret")
    user_id = data.get("user_id")
    email = data.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="user_id and email required")
    existing = db.query(AdminUser).filter(AdminUser.user_id == str(user_id)).first()
    client_host = (request.client.host if request.client else "?")
    if existing:
        existing.role = "admin"
        db.commit()
        logger.warning("make-admin granted to existing user_id=%s email=%s from %s", user_id, email, client_host)
        return {"message": "Already admin", "email": email}
    admin = AdminUser(user_id=str(user_id), email=email, role="admin")
    db.add(admin)
    db.commit()
    logger.warning("make-admin created new admin user_id=%s email=%s from %s", user_id, email, client_host)
    return {"message": "Admin created", "email": email}


@router.get("/admin/users", dependencies=[Depends(get_current_admin)])
def admin_list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    admin_rows = {row.user_id: _normalize_admin_role(row.role) for row in db.query(AdminUser).all()}
    return {
        "items": [
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "provider": user.provider,
                "balance": float(user.balance or 0),
                "is_active": user.is_active,
                "role": admin_rows.get(str(user.id)),
                "created_at": user.created_at.isoformat() if user.created_at else None,
            }
            for user in users
        ]
    }


@router.post("/admin/users", dependencies=[Depends(get_current_admin)])
def admin_create_user(data: dict, db: Session = Depends(get_db)):
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email đã được sử dụng")
    password = data.get("password") or _generate_temp_password()
    user = User(
        email=email,
        password_hash=_hash_password(password),
        display_name=(data.get("display_name") or email.split("@")[0]).strip(),
        avatar_url=(data.get("avatar_url") or "").strip() or None,
        provider="local",
        is_active=bool(data.get("is_active", True)),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    role = _normalize_admin_role(data.get("role"))
    if role:
        db.add(AdminUser(user_id=str(user.id), email=user.email, role=role))
        db.commit()
    return {"id": user.id, "email": user.email}


@router.put("/admin/users/{user_id}", dependencies=[Depends(get_current_admin)])
def admin_update_user(user_id: int, data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    new_email = (data.get("email") or user.email).strip().lower()
    existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
    if existing:
        raise HTTPException(409, "Email đã được sử dụng")
    user.email = new_email
    user.display_name = data.get("display_name", user.display_name)
    user.avatar_url = data.get("avatar_url", user.avatar_url)
    if "is_active" in data:
        user.is_active = bool(data.get("is_active"))
    admin_row = db.query(AdminUser).filter(AdminUser.user_id == str(user.id)).first()
    role = _normalize_admin_role(data.get("role")) if "role" in data else _normalize_admin_role(admin_row.role if admin_row else None)
    if role:
        if not admin_row:
            admin_row = AdminUser(user_id=str(user.id), email=user.email, role=role)
            db.add(admin_row)
        admin_row.email = user.email
        admin_row.role = role
    elif admin_row:
        db.delete(admin_row)
    db.commit()
    return {"ok": True}


@router.delete("/admin/users/{user_id}", dependencies=[Depends(get_current_admin)])
def admin_delete_user(user_id: int, current_admin: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    if str(user_id) == current_admin["user_id"]:
        raise HTTPException(400, "Không thể xóa chính tài khoản admin hiện tại")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    admin_row = db.query(AdminUser).filter(AdminUser.user_id == str(user.id)).first()
    if admin_row:
        db.delete(admin_row)
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.post("/admin/users/{user_id}/reset-password", dependencies=[Depends(get_current_admin)])
def admin_reset_user_password(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    new_password = _generate_temp_password()
    user.password_hash = _hash_password(new_password)
    sent = _send_password_email(user.email, new_password, subject_prefix="[Admin reset] ")
    if not sent:
        db.rollback()
        raise HTTPException(500, "Không thể gửi email mật khẩu mới")
    db.commit()
    return {"ok": True, "message": "Đã reset mật khẩu và gửi email cho người dùng"}
