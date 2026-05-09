"""
OAuth Configuration APIs
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.repositories import SiteConfigRepository
from api.auth import get_current_admin

router = APIRouter(prefix="/admin/oauth", tags=["oauth"])

OAUTH_PROVIDERS = ['google', 'facebook', 'github', 'discord', 'tiktok']


def _mask_secret(s: str) -> str:
    if not s or len(s) < 8:
        return "****" if s else ""
    return s[:4] + "****" + s[-4:]


@router.get("/public-config")
async def get_oauth_public_config(db: Session = Depends(get_db)):
    """Public: Get which OAuth providers are enabled (no secrets)"""
    repo = SiteConfigRepository(db)
    config = {}
    for provider in OAUTH_PROVIDERS:
        enabled_key = f"oauth_{provider}_enabled"
        enabled = repo.get_value(enabled_key, "false")
        config[provider] = {"enabled": enabled == "true"}
    return config


@router.get("/config", dependencies=[Depends(get_current_admin)])
async def get_oauth_config(db: Session = Depends(get_db)):
    """Admin: Get all OAuth configurations (secrets masked)"""
    repo = SiteConfigRepository(db)
    config = {}

    for provider in OAUTH_PROVIDERS:
        client_id_key = f"oauth_{provider}_client_id"
        client_secret_key = f"oauth_{provider}_client_secret"
        enabled_key = f"oauth_{provider}_enabled"

        client_id = repo.get_value(client_id_key, "") or ""
        client_secret = repo.get_value(client_secret_key, "") or ""
        enabled = repo.get_value(enabled_key, "false")

        config[provider] = {
            "clientId": client_id,
            "clientSecret": _mask_secret(client_secret) if client_secret else "",
            "hasSecret": bool(client_secret),
            "enabled": enabled == "true"
        }

    return config


@router.put("/config/{provider}", dependencies=[Depends(get_current_admin)])
async def update_oauth_config(
    provider: str,
    data: dict,
    db: Session = Depends(get_db)
):
    """Admin: Update OAuth configuration for a provider"""
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")

    client_id = data.get("clientId", "")
    client_secret = data.get("clientSecret", "")
    enabled = data.get("enabled", False)
    repo = SiteConfigRepository(db)

    update_pairs = [
        (f"oauth_{provider}_client_id", client_id),
        (f"oauth_{provider}_enabled", "true" if enabled else "false")
    ]
    if client_secret and "****" not in client_secret:
        update_pairs.append((f"oauth_{provider}_client_secret", client_secret))

    for key, value in update_pairs:
        repo.set_value(key, value)

    db.commit()
    return {"success": True, "provider": provider}
