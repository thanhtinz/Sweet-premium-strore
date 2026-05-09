from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.admin_shared import (
    SETTINGS_KEYS,
    get_payment_config_payload,
    get_public_settings_payload,
    load_database_provider_config,
    merge_database_provider_config,
    save_database_provider_config,
    serialize_database_provider_config,
    test_database_connection_payload,
    update_payment_config_values,
)
from api.auth import get_current_admin
from db import get_db
from db.models import Category, Order, Product, SiteSetting, StockItem
from db.repositories import SiteConfigRepository

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
    revenue_row = db.query(func.sum(Order.total_amount)).filter(Order.status.in_(["paid", "completed"])).scalar()
    total_revenue = float(revenue_row) if revenue_row else 0.0
    recent_orders = db.query(Order).order_by(Order.created_at.desc()).limit(10).all()
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
    public_keys = ["site_name", "site_logo", "site_description", "site_banner", "currency", "tax_rate", "home_categories"]
    settings = db.query(SiteSetting).filter(SiteSetting.key.in_(public_keys)).all()
    return get_public_settings_payload(db, {s.key: s.value for s in settings})


@router.get("/payment/config", dependencies=[Depends(get_current_admin)])
def get_payment_config(db: Session = Depends(get_db)):
    return get_payment_config_payload(db)


@router.post("/payment/config", dependencies=[Depends(get_current_admin)])
def update_payment_config(data: dict, db: Session = Depends(get_db)):
    updated_keys = update_payment_config_values(db, data)
    return {"ok": True, "updated_keys": updated_keys}


@router.get("/settings/database", dependencies=[Depends(get_current_admin)])
def get_database_settings(db: Session = Depends(get_db)):
    return serialize_database_provider_config(load_database_provider_config(db))


@router.put("/settings/database", dependencies=[Depends(get_current_admin)])
def update_database_settings(data: dict, db: Session = Depends(get_db)):
    current = load_database_provider_config(db)
    normalized = save_database_provider_config(db, merge_database_provider_config(current, data))
    return {"ok": True, "config": serialize_database_provider_config(normalized)}


@router.post("/settings/database/test-connection", dependencies=[Depends(get_current_admin)])
def test_database_connection(data: dict, db: Session = Depends(get_db)):
    try:
        return test_database_connection_payload(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/payment/history", dependencies=[Depends(get_current_admin)])
def get_payment_history(status: str = None, page: int = 1, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    from api.orders import order_to_dict
    from sqlalchemy import func
    total_revenue = db.query(func.sum(Order.total_amount)).filter(Order.status.in_(["paid", "completed"])).scalar() or 0
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
    result = SiteConfigRepository(db).get_many_json(SETTINGS_KEYS)
    for key in SETTINGS_KEYS:
        if key not in result:
            result[key] = {}
    return result


@router.put("/settings/unified", dependencies=[Depends(get_current_admin)])
def update_unified_settings(data: dict, db: Session = Depends(get_db)):
    repo = SiteConfigRepository(db)
    for key, value in data.items():
        if key not in SETTINGS_KEYS:
            continue
        repo.set_json(key, value)
    db.commit()
    return {"ok": True}
