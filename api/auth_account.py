from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.auth_shared import (
    ChangePassword,
    ForgotPasswordBody,
    LoginBody,
    ProfileUpdate,
    RegisterBody,
    ResetPasswordBody,
    Verify2FA,
    _create_token,
    _generate_temp_password,
    _hash_password,
    _make_reset_token,
    _send_password_email,
    _send_reset_link_email,
    _user_dict,
    _verify_password,
    _verify_reset_token,
    build_2fa_setup_payload,
    get_current_user,
)
from api.rate_limit import rate_limit, rate_limit_by_value
from db import get_db
from db.models import AdminUser, User
from db.repositories import SiteConfigRepository

router = APIRouter(tags=["auth"])


@router.post("/register", dependencies=[Depends(rate_limit("register", 3, 60))])
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


@router.post("/login", dependencies=[Depends(rate_limit("login_ip", 10, 60))])
def login(body: LoginBody, db: Session = Depends(get_db)):
    # Per-email lock-out: max 5 failed attempts / 5 minutes
    rate_limit_by_value("login_email", body.email.lower(), 8, 300)
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not _verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(403, "Tài khoản đã bị khóa")
    if user.two_factor_secret:
        if not body.totp_code:
            return {"requires_2fa": True, "message": "Vui lòng nhập mã xác thực 2 bước"}
        import pyotp
        totp = pyotp.TOTP(user.two_factor_secret)
        if not totp.verify(body.totp_code):
            raise HTTPException(401, "Mã xác thực 2 bước không chính xác")
    token = _create_token(user)
    admin = db.query(AdminUser).filter(AdminUser.user_id == str(user.id)).first()
    return {"token": token, "user": _user_dict(user, is_admin=admin is not None, role=admin.role if admin else None)}


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot_ip", 3, 900))])
def forgot_password(body: ForgotPasswordBody, request: Request, db: Session = Depends(get_db)):
    # Hard cap per-email: 1 reset / 15 minutes — chặn attacker spam email victim
    rate_limit_by_value("forgot_email", body.email.lower(), 1, 900)
    user = db.query(User).filter(User.email == body.email).first()
    # Generic response regardless of email existence (no enumeration)
    generic = {"ok": True, "message": "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi."}
    if not user or not user.is_active or not user.password_hash:
        return generic

    # Build reset link using site_url > X-Forwarded-Host > Host
    repo = SiteConfigRepository(db)
    site_url = (repo.get_value("site_url") or "").rstrip("/")
    if not site_url:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
        site_url = f"{proto}://{host}"
    token = _make_reset_token(user)
    link = f"{site_url}/reset-password?token={token}"
    sent = _send_reset_link_email(user.email, link)
    if not sent:
        raise HTTPException(500, "Không thể gửi email đặt lại mật khẩu")
    return generic


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset_pw_ip", 10, 900))])
def reset_password(body: ResetPasswordBody, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Mật khẩu tối thiểu 8 ký tự")
    user = _verify_reset_token(body.token, db)
    if not user:
        raise HTTPException(400, "Link không hợp lệ hoặc đã hết hạn")
    user.password_hash = _hash_password(body.new_password)
    db.commit()
    return {"ok": True, "message": "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại."}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    admin = db.query(AdminUser).filter(AdminUser.user_id == current_user["user_id"]).first()
    return _user_dict(user, is_admin=admin is not None, role=admin.role if admin else None)


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


@router.get("/2fa/setup")
def setup_2fa(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.two_factor_secret:
        raise HTTPException(400, "2FA is already enabled")
    return build_2fa_setup_payload(user)


@router.post("/2fa/verify")
def verify_2fa(data: Verify2FA, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    import pyotp
    totp = pyotp.TOTP(data.secret)
    if not totp.verify(data.code):
        raise HTTPException(400, "Mã xác thực không chính xác")
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
