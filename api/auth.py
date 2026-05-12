"""
Auth API — self-managed JWT auth with social login (Google, Discord).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.auth_account import router as account_router
from api.auth_admin import router as admin_router
from api.auth_oauth import router as oauth_router
from api.auth_shared import get_current_admin, get_current_staff_or_admin, get_current_user, _get_oauth_config
from db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
router.include_router(account_router)
router.include_router(oauth_router)
router.include_router(admin_router)


@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    cfg = _get_oauth_config(db)
    return {
        "google_enabled": bool(cfg.get("google_client_id")),
        "facebook_enabled": bool(cfg.get("facebook_client_id")),
        "github_enabled": bool(cfg.get("github_client_id")),
        "discord_enabled": bool(cfg.get("discord_client_id")),
        "tiktok_enabled": bool(cfg.get("tiktok_client_id")),
    }


__all__ = [
    "router",
    "get_current_user",
    "get_current_admin",
    "get_current_staff_or_admin",
]
