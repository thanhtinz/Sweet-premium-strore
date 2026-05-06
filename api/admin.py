import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.models import SiteSetting, SiteConfig, Order, Product, Category, StockItem
from api.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", dependencies=[Depends(get_current_admin)])
def dashboard_stats(db: Session = Depends(get_db)):
    total_orders = db.query(Order).count()
    pending_orders = db.query(Order).filter(Order.status == "pending").count()
    completed_orders = db.query(Order).filter(Order.status == "completed").count()
    total_products = db.query(Product).count()
    total_categories = db.query(Category).count()
    total_stock = db.query(StockItem).filter(StockItem.is_sold == False).count()

    from sqlalchemy import func
    revenue_row = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_(["paid", "completed"])
    ).scalar()
    total_revenue = float(revenue_row) if revenue_row else 0.0

    recent_orders = db.query(Order).order_by(
        Order.created_at.desc()
    ).limit(10).all()

    from api.orders import order_to_dict
    return {
        "stats": {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
            "total_products": total_products,
            "total_categories": total_categories,
            "total_stock_available": total_stock,
            "total_revenue": total_revenue,
        },
        "recent_orders": [order_to_dict(o) for o in recent_orders],
    }


@router.get("/settings", dependencies=[Depends(get_current_admin)])
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(SiteSetting).all()
    return {s.key: s.value for s in settings}


@router.post("/settings", dependencies=[Depends(get_current_admin)])
def update_settings(data: dict, db: Session = Depends(get_db)):
    for key, value in data.items():
        setting = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(SiteSetting(key=key, value=str(value)))
    db.commit()
    return {"ok": True}


@router.get("/settings/public")
def get_public_settings(db: Session = Depends(get_db)):
    """Public settings like site name, logo, etc."""
    public_keys = ["site_name", "site_logo", "site_description", "site_banner", "currency", "tax_rate", "home_categories"]
    settings = db.query(SiteSetting).filter(SiteSetting.key.in_(public_keys)).all()
    result = {s.key: s.value for s in settings}
    # Also read from unified SiteConfig for additional fields
    config_keys = ["settings_general", "settings_images"]
    rows = db.query(SiteConfig).filter(SiteConfig.key.in_(config_keys)).all()
    for row in rows:
        try:
            data = json.loads(row.value) if row.value else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        if row.key == "settings_general":
            # Map unified general fields to public keys (unified takes priority if present)
            if data.get("title") and not result.get("site_name"):
                result["site_name"] = data["title"]
            if data.get("site_description") and not result.get("site_description"):
                result["site_description"] = data["site_description"]
            if data.get("copyright_text"):
                result["copyright_text"] = data["copyright_text"]
        elif row.key == "settings_images":
            if data.get("logo_url"):
                result["logo_url"] = data["logo_url"]
    return result


# ── Unified Settings (JSON-based, stored in SiteConfig) ──────────

SETTINGS_KEYS = [
    "settings_general",
    "settings_appearance",
    "settings_scripts",
    "settings_images",
    "settings_security",
    "settings_captcha",
]


# ── PayOS Payment Config ────────────────────────────────────────

PAYOS_SETTING_KEYS = ["payos_client_id", "payos_api_key", "payos_checksum_key", "app_base_url"]


@router.get("/payment/config", dependencies=[Depends(get_current_admin)])
def get_payment_config(db: Session = Depends(get_db)):
    """Get current PayOS configuration (masks sensitive keys)."""
    import os
    settings = db.query(SiteSetting).filter(
        SiteSetting.key.in_(PAYOS_SETTING_KEYS)
    ).all()
    cfg = {s.key: s.value or "" for s in settings}
    # Ensure all keys present
    for k in PAYOS_SETTING_KEYS:
        if k not in cfg:
            cfg[k] = ""
    # Override with env vars if set (env takes priority)
    env_client_id = os.environ.get("PAYOS_CLIENT_ID", "")
    env_api_key = os.environ.get("PAYOS_API_KEY", "")
    env_checksum_key = os.environ.get("PAYOS_CHECKSUM_KEY", "")
    env_base_url = os.environ.get("APP_BASE_URL", "")
    if env_client_id:
        cfg["payos_client_id"] = env_client_id
    if env_api_key:
        cfg["payos_api_key"] = env_api_key
    if env_checksum_key:
        cfg["payos_checksum_key"] = env_checksum_key
    if env_base_url:
        cfg["app_base_url"] = env_base_url
    # Mask sensitive values for display
    display = {
        "payos_client_id": cfg["payos_client_id"],
        "payos_api_key": _mask(cfg["payos_api_key"]),
        "payos_checksum_key": _mask(cfg["payos_checksum_key"]),
        "app_base_url": cfg["app_base_url"],
        "has_env_override": bool(env_client_id or env_api_key or env_checksum_key),
    }
    return display


def _mask(val: str) -> str:
    """Mask a string, showing first 4 and last 4 chars."""
    if not val or len(val) <= 8:
        return "••••••••" if val else ""
    return val[:4] + "••••" + val[-4:]


@router.post("/payment/config", dependencies=[Depends(get_current_admin)])
def update_payment_config(data: dict, db: Session = Depends(get_db)):
    """Update PayOS configuration in SiteSetting."""
    import os
    # Don't allow overwriting env-var values
    env_client_id = os.environ.get("PAYOS_CLIENT_ID", "")
    env_api_key = os.environ.get("PAYOS_API_KEY", "")
    env_checksum_key = os.environ.get("PAYOS_CHECKSUM_KEY", "")
    env_base_url = os.environ.get("APP_BASE_URL", "")

    updates = {}
    if "payos_client_id" in data and not env_client_id:
        updates["payos_client_id"] = str(data["payos_client_id"])
    if "payos_api_key" in data and not env_api_key:
        updates["payos_api_key"] = str(data["payos_api_key"])
    if "payos_checksum_key" in data and not env_checksum_key:
        updates["payos_checksum_key"] = str(data["payos_checksum_key"])
    if "app_base_url" in data and not env_base_url:
        updates["app_base_url"] = str(data["app_base_url"])

    for key, value in updates.items():
        setting = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(SiteSetting(key=key, value=value))
    db.commit()
    return {"ok": True, "updated_keys": list(updates.keys())}


@router.get("/payment/history", dependencies=[Depends(get_current_admin)])
def get_payment_history(
    status: str = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get payment/order history for admin."""
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    from api.orders import order_to_dict
    # Summary stats
    from sqlalchemy import func
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_(["paid", "completed"])
    ).scalar() or 0
    pending_count = db.query(Order).filter(Order.status == "pending").count()
    paid_count = db.query(Order).filter(Order.status == "paid").count()
    completed_count = db.query(Order).filter(Order.status == "completed").count()
    cancelled_count = db.query(Order).filter(Order.status == "cancelled").count()

    return {
        "total": total,
        "page": page,
        "items": [order_to_dict(o) for o in orders],
        "stats": {
            "total_revenue": float(total_revenue),
            "pending": pending_count,
            "paid": paid_count,
            "completed": completed_count,
            "cancelled": cancelled_count,
        }
    }


@router.get("/settings/unified", dependencies=[Depends(get_current_admin)])
def get_unified_settings(db: Session = Depends(get_db)):
    """Get all unified settings sections as JSON objects."""
    result = {}
    rows = db.query(SiteConfig).filter(SiteConfig.key.in_(SETTINGS_KEYS)).all()
    for row in rows:
        try:
            result[row.key] = json.loads(row.value) if row.value else {}
        except (json.JSONDecodeError, TypeError):
            result[row.key] = {}
    # Ensure all keys present even if missing from DB
    for key in SETTINGS_KEYS:
        if key not in result:
            result[key] = {}
    return result


@router.put("/settings/unified", dependencies=[Depends(get_current_admin)])
def update_unified_settings(data: dict, db: Session = Depends(get_db)):
    """Update one or more unified settings sections. Each key should map to a JSON object."""
    for key, value in data.items():
        if key not in SETTINGS_KEYS:
            continue
        json_str = json.dumps(value, ensure_ascii=False)
        row = db.query(SiteConfig).filter(SiteConfig.key == key).first()
        if row:
            row.value = json_str
        else:
            db.add(SiteConfig(key=key, value=json_str))
    db.commit()
    return {"ok": True}
