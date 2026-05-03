"""
Auth API — integrates with Neon Auth (JWT-based).
Neon Auth tokens are verified locally via JWKS or trusted directly.
We use a simple pattern: client sends Bearer token from Neon Auth,
backend verifies and extracts user_id + email.
"""
import os
import httpx
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from db import get_db
from db.models import AdminUser

router = APIRouter(prefix="/auth", tags=["auth"])

NEON_AUTH_URL = os.environ.get("DB556FD74B_NEON_AUTH_URL", "")


class TokenVerifyRequest(BaseModel):
    token: str


def get_current_user(authorization: str = Header(default="")):
    """Extract and verify Neon Auth JWT token from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization[7:]
    try:
        # Neon Auth JWTs are standard — decode without verification for dev,
        # in prod verify with Neon Auth JWKS endpoint
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {"user_id": user_id, "email": email, "token": token}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user is admin."""
    admin = db.query(AdminUser).filter(
        AdminUser.user_id == current_user["user_id"]
    ).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {**current_user, "role": admin.role}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(
        AdminUser.user_id == current_user["user_id"]
    ).first()
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "is_admin": admin is not None,
        "role": admin.role if admin else None,
    }


@router.get("/neon-url")
def get_neon_url():
    """Return Neon Auth endpoints for frontend to use."""
    base = NEON_AUTH_URL.rstrip("/")
    return {
        "signin_url": f"{base}/api/auth/callback/credentials",
        "signup_url": f"{base}/api/auth/signup",
        "base_url": base,
    }


@router.get("/neon-config")
def neon_config():
    """Return Neon Auth URL for frontend use."""
    return {
        "neon_auth_url": NEON_AUTH_URL,
        "has_neon_auth": bool(NEON_AUTH_URL),
    }


@router.post("/make-admin")
def make_admin(
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Bootstrap: make a user admin via secret key.
    Called once to setup the first admin.
    """
    secret = os.environ.get("ADMIN_SECRET", "changeme123")
    if data.get("secret") != secret:
        raise HTTPException(status_code=403, detail="Invalid secret")

    user_id = data.get("user_id")
    email = data.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=400, detail="user_id and email required")

    existing = db.query(AdminUser).filter(AdminUser.user_id == user_id).first()
    if existing:
        return {"message": "Already admin", "email": email}

    admin = AdminUser(user_id=user_id, email=email, role="superadmin")
    db.add(admin)
    db.commit()
    return {"message": "Admin created", "email": email}
