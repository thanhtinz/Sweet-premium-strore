"""
Auth API — self-managed JWT auth with social login (Google, Discord).
"""
import os
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Depends, Header, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
import bcrypt
import pyotp
import qrcode
import qrcode.image.svg
import io
import base64
from sqlalchemy.orm import Session

from db import get_db
from db.models import User, AdminUser

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Config ──────────────────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

# Discord OAuth
DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
DISCORD_REDIRECT_URI = os.environ.get("DISCORD_REDIRECT_URI", "")


def _get_oauth_config(db: Session = None):
    """Get OAuth config from env vars, fallback to DB SiteSettings."""
    cfg = {
        "google_client_id": GOOGLE_CLIENT_ID,
        "google_client_secret": GOOGLE_CLIENT_SECRET,
        "google_redirect_uri": GOOGLE_REDIRECT_URI,
        "discord_client_id": DISCORD_CLIENT_ID,
        "discord_client_secret": DISCORD_CLIENT_SECRET,
        "discord_redirect_uri": DISCORD_REDIRECT_URI,
    }
    if db:
        from db.models import SiteSetting
        keys = ["google_client_id", "google_client_secret", "discord_client_id", "discord_client_secret"]
        settings = db.query(SiteSetting).filter(SiteSetting.key.in_(keys)).all()
        for s in settings:
            if s.value and not cfg.get(s.key):
                cfg[s.key] = s.value
    return cfg


# ── Helpers ─────────────────────────────────────────────────
def _create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _user_dict(user: User, is_admin: bool = False, role: str = None) -> dict:
    return {
        "user_id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "provider": user.provider,
        "is_admin": is_admin,
        "role": role,
        "2fa_enabled": bool(user.two_factor_secret)
    }


# ── Dependencies ────────────────────────────────────────────
def get_current_user(authorization: str = Header(default="")):
    """Verify JWT from Authorization header."""
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
    admin = db.query(AdminUser).filter(
        AdminUser.user_id == current_user["user_id"]
    ).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {**current_user, "role": admin.role}


# ── Schemas ─────────────────────────────────────────────────
class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str
    totp_code: str = None


# ── Register / Login ────────────────────────────────────────
@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(400, "Mật khẩu tối thiểu 8 ký tự")
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(409, "Email đã được sử dụng")
    user = User(
        email=body.email,
        password_hash=_hash_password(body.password),
        display_name=body.display_name or body.email.split("@")[0],
        provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = _create_token(user)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not _verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(403, "Tài khoản đã bị khóa")
        
    # Verify 2FA if enabled
    if user.two_factor_secret:
        if not body.totp_code:
            return {"requires_2fa": True, "message": "Vui lòng nhập mã xác thực 2 bước"}
        totp = pyotp.TOTP(user.two_factor_secret)
        if not totp.verify(body.totp_code):
            raise HTTPException(401, "Mã xác thực 2 bước không chính xác")
            
    token = _create_token(user)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    admin = db.query(AdminUser).filter(AdminUser.user_id == current_user["user_id"]).first()
    return _user_dict(user, is_admin=admin is not None, role=admin.role if admin else None)


class ProfileUpdate(BaseModel):
    display_name: str = None
    avatar_url: str = None


@router.put("/me")
def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(user)
    return _user_dict(user)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
@router.get("/2fa/setup")
def setup_2fa(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
        
    if user.two_factor_secret:
        raise HTTPException(400, "2FA is already enabled")
        
    # Generate new secret
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    
    # Store temporarily in memory or generate new each time until verified
    # For simplicity, we'll return the secret and require it back for verification
    
    # Generate QR code
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
    
    # Convert image to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_b64}"
    }

class Verify2FA(BaseModel):
    secret: str
    code: str

@router.post("/2fa/verify")
def verify_2fa(data: Verify2FA, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
        
    totp = pyotp.TOTP(data.secret)
    if not totp.verify(data.code):
        raise HTTPException(400, "Mã xác thực không chính xác")
        
    # Save secret to enable 2FA
    user.two_factor_secret = data.secret
    db.commit()
    
    return {"ok": True, "message": "Xác thực 2 bước đã được bật"}

@router.post("/2fa/disable")
def disable_2fa(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
        
    user.two_factor_secret = None
    db.commit()
    
    return {"ok": True, "message": "Xác thực 2 bước đã bị tắt"}



@router.post("/change-password")
def change_password(data: ChangePassword, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    if not user.password_hash:
        raise HTTPException(400, "Tài khoản liên kết MXH, không có mật khẩu để đổi")
    if not _verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    user.password_hash = _hash_password(data.new_password)
    db.commit()
    return {"ok": True, "message": "Đổi mật khẩu thành công"}


# ── Google OAuth ────────────────────────────────────────────
@router.get("/google")
def google_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg["google_client_id"]:
        raise HTTPException(501, "Google OAuth chưa được cấu hình")
    redirect_uri = cfg["google_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/google/callback"
    params = {
        "client_id": cfg["google_client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg["google_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/google/callback"
    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": cfg["google_client_id"],
            "client_secret": cfg["google_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/#/login?error=google_failed")
        tokens = token_res.json()

        # Get user info
        info_res = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/#/login?error=google_failed")
        info = info_res.json()

    return _social_login_finish(
        db=db,
        provider="google",
        provider_id=info["id"],
        email=info.get("email", ""),
        display_name=info.get("name", ""),
        avatar_url=info.get("picture", ""),
    )


# ── Discord OAuth ───────────────────────────────────────────
@router.get("/discord")
def discord_redirect(request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    if not cfg["discord_client_id"]:
        raise HTTPException(501, "Discord OAuth chưa được cấu hình")
    redirect_uri = cfg["discord_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/discord/callback"
    params = {
        "client_id": cfg["discord_client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "identify email",
        "prompt": "consent",
    }
    return RedirectResponse(f"https://discord.com/api/oauth2/authorize?{urlencode(params)}")


@router.get("/discord/callback")
async def discord_callback(code: str, request: Request, db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    redirect_uri = cfg["discord_redirect_uri"] or str(request.base_url).rstrip("/") + "/api/auth/discord/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://discord.com/api/oauth2/token", data={
            "code": code,
            "client_id": cfg["discord_client_id"],
            "client_secret": cfg["discord_client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return RedirectResponse("/#/login?error=discord_failed")
        tokens = token_res.json()

        info_res = await client.get("https://discord.com/api/users/@me", headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if info_res.status_code != 200:
            return RedirectResponse("/#/login?error=discord_failed")
        info = info_res.json()

    avatar_url = ""
    if info.get("avatar"):
        avatar_url = f"https://cdn.discordapp.com/avatars/{info['id']}/{info['avatar']}.png"

    return _social_login_finish(
        db=db,
        provider="discord",
        provider_id=info["id"],
        email=info.get("email", ""),
        display_name=info.get("global_name") or info.get("username", ""),
        avatar_url=avatar_url,
    )


# ── Social login shared logic ──────────────────────────────
def _social_login_finish(db: Session, provider: str, provider_id: str,
                         email: str, display_name: str, avatar_url: str):
    # Find existing user by provider+provider_id
    user = db.query(User).filter(
        User.provider == provider, User.provider_id == provider_id
    ).first()

    if not user and email:
        # Check if email exists (link account)
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link social to existing account (don't overwrite if already set)
            if not user.provider_id:
                user.provider = provider
                user.provider_id = provider_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
            if not user.display_name and display_name:
                user.display_name = display_name
            db.commit()

    if not user:
        # Create new user
        user = User(
            email=email or f"{provider}_{provider_id}@social.local",
            display_name=display_name,
            avatar_url=avatar_url,
            provider=provider,
            provider_id=provider_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        return RedirectResponse("/#/login?error=account_disabled")

    token = _create_token(user)
    # Redirect to frontend with token in hash
    return RedirectResponse(f"/#/auth-callback?token={token}")


# ── Admin bootstrap ─────────────────────────────────────────
@router.post("/make-admin")
def make_admin(data: dict, db: Session = Depends(get_db)):
    secret = os.environ.get("ADMIN_SECRET", "changeme123")
    if data.get("secret") != secret:
        raise HTTPException(status_code=403, detail="Invalid secret")
    user_id = data.get("user_id")
    email = data.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="user_id and email required")
    existing = db.query(AdminUser).filter(AdminUser.user_id == str(user_id)).first()
    if existing:
        return {"message": "Already admin", "email": email}
    admin = AdminUser(user_id=str(user_id), email=email, role="superadmin")
    db.add(admin)
    db.commit()
    return {"message": "Admin created", "email": email}


# ── Auth config (for frontend) ─────────────────────────────
@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    return {
        "google_enabled": bool(cfg["google_client_id"]),
        "discord_enabled": bool(cfg["discord_client_id"]),
    }
