"""
OAuth Configuration APIs
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import SessionLocal
from db.models import SiteConfig
from api.auth import get_current_admin
import json

router = APIRouter(prefix="/admin/oauth", tags=["oauth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

OAUTH_PROVIDERS = ['google', 'facebook', 'github', 'discord', 'tiktok']

def _mask_secret(s: str) -> str:
    if not s or len(s) < 8:
        return "****" if s else ""
    return s[:4] + "****" + s[-4:]

@router.get("/public-config")
async def get_oauth_public_config(db: Session = Depends(get_db)):
    """Public: Get which OAuth providers are enabled (no secrets)"""
    config = {}
    for provider in OAUTH_PROVIDERS:
        enabled_key = f"oauth_{provider}_enabled"
        enabled = db.query(SiteConfig).filter_by(key=enabled_key).first()
        config[provider] = {"enabled": enabled.value == "true" if enabled else False}
    return config

@router.get("/config", dependencies=[Depends(get_current_admin)])
async def get_oauth_config(db: Session = Depends(get_db)):
    """Admin: Get all OAuth configurations (secrets masked)"""
    config = {}
    
    for provider in OAUTH_PROVIDERS:
        client_id_key = f"oauth_{provider}_client_id"
        client_secret_key = f"oauth_{provider}_client_secret"
        enabled_key = f"oauth_{provider}_enabled"
        
        client_id = db.query(SiteConfig).filter_by(key=client_id_key).first()
        client_secret = db.query(SiteConfig).filter_by(key=client_secret_key).first()
        enabled = db.query(SiteConfig).filter_by(key=enabled_key).first()
        
        config[provider] = {
            "clientId": client_id.value if client_id else "",
            "clientSecret": _mask_secret(client_secret.value) if client_secret else "",
            "hasSecret": bool(client_secret and client_secret.value),
            "enabled": enabled.value == "true" if enabled else False
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
    
    # Only update secret if a new value is provided (not masked)
    update_pairs = [
        (f"oauth_{provider}_client_id", client_id),
        (f"oauth_{provider}_enabled", "true" if enabled else "false")
    ]
    # Skip secret update if it looks like a masked value
    if client_secret and "****" not in client_secret:
        update_pairs.append((f"oauth_{provider}_client_secret", client_secret))
    
    for key, value in update_pairs:
        cfg = db.query(SiteConfig).filter_by(key=key).first()
        if cfg:
            cfg.value = value
        else:
            cfg = SiteConfig(key=key, value=value)
            db.add(cfg)
    
    db.commit()
    return {"success": True, "provider": provider}
