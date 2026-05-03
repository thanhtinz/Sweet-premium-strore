from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.models import SiteSetting, Order, Product, Category, StockItem
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
    public_keys = ["site_name", "site_logo", "site_description", "site_banner", "currency"]
    settings = db.query(SiteSetting).filter(SiteSetting.key.in_(public_keys)).all()
    return {s.key: s.value for s in settings}
