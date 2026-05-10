from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.auth import get_current_user
from api.bot_links import (
    create_link_code,
    get_platform_link_status,
    get_user_bot_links_summary,
    manual_link_platform_user_id,
    unlink_platform_account,
)
from db import get_db


router = APIRouter(prefix="/bot-links", tags=["bot-links"])


def _current_user_id(current_user) -> str:
    return str(current_user["user_id"])


@router.get("")
def get_bot_links(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_user_bot_links_summary(db, _current_user_id(current_user))


@router.post("/{platform}/code")
def create_platform_link_code(platform: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        item = create_link_code(db, _current_user_id(current_user), platform)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "platform": platform,
        "link_code": item.link_code,
        "expires_at": item.link_code_expires_at.isoformat() if item.link_code_expires_at else None,
    }


@router.post("/{platform}/manual")
def manual_link_platform(platform: str, data: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    platform_user_id = str(data.get("platform_user_id") or data.get("discord_user_id") or "").strip()
    if not platform_user_id:
        raise HTTPException(status_code=400, detail="platform_user_id required")
    try:
        item = manual_link_platform_user_id(db, _current_user_id(current_user), platform, platform_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "platform": item.platform,
        "platform_user_id": item.platform_user_id,
        "linked": bool(item.is_verified),
    }


@router.get("/{platform}/status")
def get_platform_status(platform: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        return get_platform_link_status(db, _current_user_id(current_user), platform)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{platform}")
def unlink_platform(platform: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        removed = unlink_platform_account(db, _current_user_id(current_user), platform)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not removed:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"platform": platform, "unlinked": True}
