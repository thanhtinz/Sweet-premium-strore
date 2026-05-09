import base64
import io
import os
import random
import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
import pyotp
import qrcode
from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from db import get_db
from db.models import AdminUser, User
from db.repositories import SiteConfigRepository

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    import warnings
    JWT_SECRET = secrets.token_hex(32)
    warnings.warn("JWT_SECRET not set! Using random key — tokens will invalidate on restart. Set JWT_SECRET env var for production.", stacklevel=1)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _get_oauth_config(db: Session = None):
    cfg = {
        "google_client_id": GOOGLE_CLIENT_ID,
        "google_client_secret": GOOGLE_CLIENT_SECRET,
        "google_redirect_uri": GOOGLE_REDIRECT_URI,
        "discord_client_id": DISCORD_CLIENT_ID,
        "discord_client_secret": DISCORD_CLIENT_SECRET,
        "discord_redirect_uri": DISCORD_REDIRECT_URI,
    }
    if db:
        repo = SiteConfigRepository(db)
        keys = [
            "google_client_id",
            "google_client_secret",
            "google_redirect_uri",
            "discord_client_id",
            "discord_client_secret",
            "discord_redirect_uri",
        ]
        for key in keys:
            value = repo.get_value(key)
            if value and not cfg.get(key):
                cfg[key] = value
    return cfg


def _create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _user_dict(user: User, is_admin: bool = False, role: str = None) -> dict:
    normalized_role = "admin" if role in ("admin", "superadmin") else role
    return {
        "user_id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "provider": user.provider,
        "is_admin": is_admin,
        "role": normalized_role,
        "2fa_enabled": bool(user.two_factor_secret),
        "balance": float(user.balance or 0),
    }


def _normalize_admin_role(role: str | None) -> str | None:
    if role in ("superadmin", "admin"):
        return "admin"
    if role == "staff":
        return "staff"
    return None


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def _send_password_email(to_email: str, password: str, *, subject_prefix: str = "") -> bool:
    try:
        from bot.mail import send_email
    except Exception:
        send_email = None
    if not send_email:
        return False
    subject = f"{subject_prefix}Mật khẩu mới cho tài khoản của bạn".strip()
    body = (
        f"<p>Mật khẩu mới của bạn là: <strong>{password}</strong></p>"
        f"<p>Hãy đăng nhập và đổi lại mật khẩu ngay sau khi vào hệ thống.</p>"
    )
    return bool(send_email(to_email, subject, body, is_html=True))


def get_current_user(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {"user_id": user_id, "email": email, "token": token}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.user_id == current_user["user_id"]).first()
    if not admin or _normalize_admin_role(admin.role) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {**current_user, "role": "admin"}


def get_current_staff_or_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.user_id == current_user["user_id"]).first()
    role = _normalize_admin_role(admin.role if admin else None)
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Staff or admin access required")
    return {**current_user, "role": role}


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str
    totp_code: str = None


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ProfileUpdate(BaseModel):
    display_name: str = None
    avatar_url: str = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class Verify2FA(BaseModel):
    secret: str
    code: str


def build_2fa_setup_payload(user: User) -> dict:
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="Digital Product Shop")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return {"secret": secret, "qr_code": f"data:image/png;base64,{qr_b64}"}
