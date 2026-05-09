from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.auth_shared import (
    ChangePassword,
    ForgotPasswordBody,
    LoginBody,
    ProfileUpdate,
    RegisterBody,
    Verify2FA,
    _create_token,
    _generate_temp_password,
    _hash_password,
    _send_password_email,
    _user_dict,
    _verify_password,
    build_2fa_setup_payload,
    get_current_user,
)
from db import get_db
from db.models import AdminUser, User

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active:
        return {"ok": True, "message": "Nếu email tồn tại, mật khẩu mới sẽ được gửi qua email."}
    new_password = _generate_temp_password()
    user.password_hash = _hash_password(new_password)
    sent = _send_password_email(user.email, new_password)
    if not sent:
        db.rollback()
        raise HTTPException(500, "Không thể gửi email đặt lại mật khẩu")
    db.commit()
    return {"ok": True, "message": "Nếu email tồn tại, mật khẩu mới sẽ được gửi qua email."}


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
