import base64
import hashlib
import io
import os
import random
import secrets
import string
from datetime import datetime, timedelta, timezone

import bcrypt
import pyotp
import qrcode
from fastapi import Depends, Header, HTTPException, Request
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

OAUTH_PROVIDERS = ["google", "facebook", "github", "discord", "tiktok"]
OAUTH_FIELDS = ["client_id", "client_secret", "redirect_uri"]

# Env var fallbacks
_ENV_DEFAULTS = {}
for _p in OAUTH_PROVIDERS:
    for _f in OAUTH_FIELDS:
        _env_key = f"{_p.upper()}_{_f.upper()}"
        _cfg_key = f"{_p}_{_f}"
        _ENV_DEFAULTS[_cfg_key] = os.environ.get(_env_key, "")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _get_oauth_config(db: Session = None):
    cfg = dict(_ENV_DEFAULTS)
    if db:
        repo = SiteConfigRepository(db)
        for provider in OAUTH_PROVIDERS:
            for field in OAUTH_FIELDS:
                cfg_key = f"{provider}_{field}"
                if cfg.get(cfg_key):
                    continue
                # Admin panel saves with oauth_ prefix, try both
                for db_key in [f"oauth_{cfg_key}", cfg_key]:
                    value = repo.get_value(db_key)
                    if value:
                        cfg[cfg_key] = value
                        break
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


# ── L2: Password reset link (stateless signed token) ────────────────
import hmac as _hmac_mod

RESET_TOKEN_TTL_SECONDS = 30 * 60  # 30 minutes


def _reset_token_sig(user_id: int, exp_ts: int, pwd_hash: str) -> str:
    payload = f"{user_id}.{exp_ts}.{pwd_hash}".encode("utf-8")
    return _hmac_mod.new(JWT_SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _make_reset_token(user: User) -> str:
    exp_ts = int((datetime.now(timezone.utc) + timedelta(seconds=RESET_TOKEN_TTL_SECONDS)).timestamp())
    sig = _reset_token_sig(int(user.id), exp_ts, user.password_hash or "")
    raw = f"{user.id}.{exp_ts}.{sig}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8").rstrip("=")


def _verify_reset_token(token: str, db: Session):
    try:
        pad = "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(token + pad).decode("utf-8")
        uid_s, exp_s, sig = raw.split(".", 2)
        uid, exp_ts = int(uid_s), int(exp_s)
    except Exception:
        return None
    if exp_ts < int(datetime.now(timezone.utc).timestamp()):
        return None
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        return None
    expected = _reset_token_sig(uid, exp_ts, user.password_hash or "")
    if not _hmac_mod.compare_digest(expected, sig):
        return None
    return user


def _send_reset_link_email(to_email: str, link: str) -> bool:
    try:
        from bot.mail import send_email
    except Exception:
        send_email = None
    if not send_email:
        return False
    subject = "Đặt lại mật khẩu"
    body = (
        f"<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>"
        f"<p>Bấm vào liên kết bên dưới để tạo mật khẩu mới (hết hạn sau 30 phút):</p>"
        f"<p><a href=\"{link}\">{link}</a></p>"
        f"<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>"
    )
    return bool(send_email(to_email, subject, body, is_html=True))


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    # Verify user still exists and is active
    try:
        uid_int = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token subject")
    user = db.query(User).filter(User.id == uid_int).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hoá")
    return {"user_id": user_id, "email": email, "token": token}


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


class ResetPasswordBody(BaseModel):
    token: str
    new_password: str


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
