"""Admin CRUD + proxy routes for external API providers."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_admin
from api.providers import get_provider
from db import get_db
from db.models import ApiProvider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api-providers", tags=["api-providers"])


# ── Pydantic models ──────────────────────────────────

class ProviderCreate(BaseModel):
    name: str
    provider_type: str  # account_premium | topup_game | giftcard
    base_url: str
    api_key: str
    api_secret: Optional[str] = None
    partner_id: Optional[str] = None
    card_rates: Optional[dict] = None
    is_active: bool = True


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    partner_id: Optional[str] = None
    card_rates: Optional[dict] = None
    is_active: Optional[bool] = None


def _provider_to_dict(p: ApiProvider) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "provider_type": p.provider_type,
        "base_url": p.base_url,
        "has_secret": bool(p.api_secret),
        "partner_id": p.partner_id or "",
        "card_rates": p.card_rates or {},
        "is_active": p.is_active,
        "settings": p.settings or {},
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ── CRUD ──────────────────────────────────────────────

@router.get("/")
def list_providers(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    providers = db.query(ApiProvider).order_by(ApiProvider.id).all()
    return [_provider_to_dict(p) for p in providers]


@router.post("/")
def create_provider(data: ProviderCreate, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    if data.provider_type not in ("account_premium", "topup_game", "giftcard"):
        raise HTTPException(status_code=400, detail="provider_type must be account_premium, topup_game, or giftcard")
    p = ApiProvider(
        name=data.name,
        provider_type=data.provider_type,
        base_url=data.base_url.rstrip("/"),
        api_key=data.api_key,
        api_secret=data.api_secret,
        partner_id=data.partner_id,
        card_rates=data.card_rates,
        is_active=data.is_active,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _provider_to_dict(p)


@router.put("/{provider_id}")
def update_provider(provider_id: int, data: ProviderUpdate, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    updates = data.model_dump(exclude_unset=True)
    if "base_url" in updates:
        updates["base_url"] = updates["base_url"].rstrip("/")
    for k, v in updates.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _provider_to_dict(p)


@router.delete("/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ── Test connection ───────────────────────────────────

@router.post("/{provider_id}/test")
async def test_provider(provider_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        adapter = get_provider(p)
        result = await adapter.test_connection()
        return {"ok": True, "data": result}
    except Exception as e:
        logger.error(f"Provider test failed: {e}")
        return {"ok": False, "error": str(e)}


# ── Remote products/plans (for admin dropdown mapping) ─

@router.get("/{provider_id}/remote-products")
async def list_remote_products(
    provider_id: int,
    category_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        adapter = get_provider(p)
        products = await adapter.get_products(category_id)
        return [
            {
                "id": prod.id,
                "name": prod.name,
                "slug": prod.slug,
                "image": prod.image,
                "plans": [
                    {
                        "id": pl.id,
                        "name": pl.name,
                        "price": pl.price,
                        "sale_price": pl.sale_price,
                        "in_stock": pl.in_stock,
                        "fields": pl.fields,
                    }
                    for pl in prod.plans
                ],
            }
            for prod in products
        ]
    except Exception as e:
        logger.error(f"List remote products failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/{provider_id}/remote-products/{product_id}/form-fields")
async def list_remote_form_fields(
    provider_id: int,
    product_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        adapter = get_provider(p)
        fields = await adapter.get_form_fields(product_id)
        return fields
    except Exception as e:
        logger.error(f"List remote form fields failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/{provider_id}/remote-products/{product_id}/plans")
async def list_remote_plans(
    provider_id: int,
    product_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    p = db.query(ApiProvider).filter(ApiProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    try:
        adapter = get_provider(p)
        plans = await adapter.get_plans(product_id)
        return [
            {
                "id": pl.id,
                "name": pl.name,
                "price": pl.price,
                "sale_price": pl.sale_price,
                "in_stock": pl.in_stock,
                "fields": pl.fields,
            }
            for pl in plans
        ]
    except Exception as e:
        logger.error(f"List remote plans failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
