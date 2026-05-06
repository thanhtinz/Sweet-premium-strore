"""
OAuth Configuration APIs
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import SessionLocal
from db.models import SiteConfig
import json

router = APIRouter(prefix="/admin/oauth", tags=["oauth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

OAUTH_PROVIDERS = ['google', 'facebook', 'github', 'discord', 'tiktok']

@router.get("/config")
async def get_oauth_config(db: Session = Depends(get_db)):
    """Get all OAuth configurations"""
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
            "clientSecret": client_secret.value if client_secret else "",
            "enabled": enabled.value == "true" if enabled else False
        }
    
    return config

@router.put("/config/{provider}")
async def update_oauth_config(
    provider: str,
    data: dict,
    db: Session = Depends(get_db)
):
    """Update OAuth configuration for a provider"""
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    client_id = data.get("clientId", "")
    client_secret = data.get("clientSecret", "")
    enabled = data.get("enabled", False)
    
    # Update or create config entries
    for key, value in [
        (f"oauth_{provider}_client_id", client_id),
        (f"oauth_{provider}_client_secret", client_secret),
        (f"oauth_{provider}_enabled", "true" if enabled else "false")
    ]:
        cfg = db.query(SiteConfig).filter_by(key=key).first()
        if cfg:
            cfg.value = value
        else:
            cfg = SiteConfig(key=key, value=value)
            db.add(cfg)
    
    db.commit()
    return {"success": True, "provider": provider}
