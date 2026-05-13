"""SMM Panel — API routes for platforms, categories, services, orders."""

import logging
import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from db import get_db
from db.models import (
    ApiProvider,
    SiteConfig,
    SmmCategory,
    SmmOrder,
    SmmPlatform,
    SmmService,
    User,
)
from api.auth_shared import get_current_admin, get_current_user
from api.rate_limit import rate_limit

logger = logging.getLogger(__name__)

# ── Refund helper ──────────────────────────────────────────────
_TERMINAL_REFUND = {"canceled", "cancelled", "failed"}
_REFUND_MARKER = "[REFUNDED]"


def _maybe_refund_on_terminal(db: Session, order: SmmOrder, prev_status: str | None = None) -> bool:
    """
    Hoàn tiền nếu đơn API hiện đang canceled/cancelled/failed và chưa có marker
    [REFUNDED] trong admin_notes. Idempotent — gọi nhiều lần cũng chỉ hoàn 1 lần.
    prev_status giữ lại cho tương thích, không dùng nữa.
    """
    from decimal import Decimal
    try:
        if not order or not order.user_id:
            return False
        new_status = (order.status or "").lower()
        if new_status not in _TERMINAL_REFUND:
            return False
        if order.admin_notes and _REFUND_MARKER in order.admin_notes:
            return False
        charge = Decimal(str(order.charge or 0))
        if charge <= 0:
            note = f"{_REFUND_MARKER} +0 ({new_status})"
            order.admin_notes = (order.admin_notes + " | " + note) if order.admin_notes else note
            return False
        user = db.query(User).filter(User.id == order.user_id).with_for_update().first()
        if not user:
            return False
        user.balance = Decimal(str(user.balance or 0)) + charge
        note = f"{_REFUND_MARKER} +{charge:,.0f} ({new_status})"
        order.admin_notes = (order.admin_notes + " | " + note) if order.admin_notes else note
        return True
    except Exception as _e:
        logger.warning(f"Refund-on-terminal failed for order {getattr(order, 'id', '?')}: {_e}")
        return False
router = APIRouter(prefix="/smm", tags=["smm"])


# ── Helpers ───────────────────────────────────────────────────

def _gen_order_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "SMM" + "".join(secrets.choice(chars) for _ in range(8))


def _slugify(text: str) -> str:
    import re
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


# ── Pydantic schemas ─────────────────────────────────────────

class PlatformCreate(BaseModel):
    name: str
    icon_url: str | None = None
    sort_order: int = 0
    is_active: bool = True

class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True

class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    rate: float = 0
    cost_rate: float = 0
    min_quantity: int = 1
    max_quantity: int = 10000
    delivery_type: str = "manual"
    api_provider_id: int | None = None
    external_service_id: int | None = None
    can_refill: bool = False
    can_cancel: bool = False
    drip_feed: bool = False
    service_type: str = "Default"
    avg_time_minutes: int | None = None  # None = Auto
    is_active: bool = True
    sort_order: int = 0

class OrderPlace(BaseModel):
    service_id: int
    link: str
    quantity: int
    scheduled_at: str | None = None       # ISO datetime string, None = immediate
    repeat_count: int = 0                  # 0 = no repeat
    repeat_interval: int = 0              # minutes between repeats
    extras: dict | None = None            # service-type specific: comments, hashtags, keywords, ...

class OrderStatusUpdate(BaseModel):
    status: str
    start_count: int | None = None
    remains: int | None = None
    admin_notes: str | None = None

class SyncRequest(BaseModel):
    provider_id: int
    platform_id: int = 0  # 0 = auto-create/match by category

class SyncCategoriesRequest(BaseModel):
    provider_id: int
    platform_id: int
    category_names: list[str] | None = None  # None hoặc rỗng = tất cả

class SyncSelectedRequest(BaseModel):
    provider_id: int
    target_category_id: int
    external_service_ids: list[int]


# ══════════════════════════════════════════════════════════════
#  ADMIN — SMM Providers (separate from general API providers)
# ══════════════════════════════════════════════════════════════

@router.get("/providers", dependencies=[Depends(get_current_admin)])
def list_smm_providers(db: Session = Depends(get_db)):
    """List all SMM-type API providers with stats."""
    providers = (
        db.query(ApiProvider)
        .filter(ApiProvider.provider_type == "smm_panel")
        .order_by(ApiProvider.id)
        .all()
    )
    result = []
    for p in providers:
        svc_count = db.query(func.count(SmmService.id)).filter(SmmService.api_provider_id == p.id).scalar() or 0
        cat_ids = db.query(SmmService.category_id).filter(SmmService.api_provider_id == p.id).distinct().all()
        cat_count = len(cat_ids)
        order_count = db.query(func.count(SmmOrder.id)).filter(SmmOrder.api_provider_id == p.id).scalar() or 0
        total_revenue = db.query(func.coalesce(func.sum(SmmOrder.charge), 0)).filter(SmmOrder.api_provider_id == p.id).scalar() or 0
        # Cost = sum(service.cost_rate * order.quantity / 1000) — converted via exchange_rate
        settings = p.settings or {}
        ex_rate = float(settings.get("exchange_rate") or 1)
        cost_query = (
            db.query(func.coalesce(func.sum(SmmService.cost_rate * SmmOrder.quantity / 1000.0), 0))
            .select_from(SmmOrder)
            .join(SmmService, SmmService.id == SmmOrder.smm_service_id)
            .filter(SmmOrder.api_provider_id == p.id)
        ).scalar() or 0
        total_cost = float(cost_query) * ex_rate
        total_profit = float(total_revenue) - total_cost
        result.append({
            "id": p.id,
            "name": p.name,
            "base_url": p.base_url,
            "is_active": p.is_active,
            "settings": settings,
            "stats": {
                "services": svc_count,
                "categories": cat_count,
                "orders": order_count,
                "revenue": float(total_revenue),
                "cost": total_cost,
                "profit": total_profit,
            },
        })
    return result


@router.post("/providers", dependencies=[Depends(get_current_admin)])
def create_smm_provider(body: dict, db: Session = Depends(get_db)):
    """Create a new SMM panel provider."""
    prov = ApiProvider(
        name=body["name"],
        provider_type="smm_panel",
        base_url=body["base_url"],
        api_key=body["api_key"],
        is_active=body.get("is_active", True),
        settings=body.get("settings", {}),
    )
    db.add(prov)
    db.commit()
    db.refresh(prov)
    return {"id": prov.id, "name": prov.name}


@router.put("/providers/{pid}", dependencies=[Depends(get_current_admin)])
def update_smm_provider(pid: int, body: dict, db: Session = Depends(get_db)):
    """Update SMM provider."""
    prov = db.query(ApiProvider).filter(ApiProvider.id == pid, ApiProvider.provider_type == "smm_panel").first()
    if not prov:
        raise HTTPException(404, "Provider not found")
    if "name" in body:
        prov.name = body["name"]
    if "base_url" in body:
        prov.base_url = body["base_url"]
    if "api_key" in body and body["api_key"]:
        prov.api_key = body["api_key"]
    if "is_active" in body:
        prov.is_active = body["is_active"]

    recomputed = 0
    if "settings" in body:
        old_settings = prov.settings or {}
        new_settings = body["settings"] or {}
        old_markup = float(old_settings.get("price_markup", 0) or 0)
        new_markup = float(new_settings.get("price_markup", 0) or 0)
        prov.settings = new_settings
        # Auto recompute sell rate cho tất cả service của provider này khi markup đổi
        if abs(new_markup - old_markup) > 1e-9:
            factor = 1 + new_markup / 100 if new_markup > 0 else 1
            svcs = db.query(SmmService).filter(SmmService.api_provider_id == prov.id).all()
            for sv in svcs:
                if sv.cost_rate is None:
                    continue
                sv.rate = round(float(sv.cost_rate) * factor, 2)
                recomputed += 1
    db.commit()
    return {"ok": True, "recomputed": recomputed}


@router.delete("/providers/{pid}", dependencies=[Depends(get_current_admin)])
def delete_smm_provider(pid: int, db: Session = Depends(get_db)):
    prov = db.query(ApiProvider).filter(ApiProvider.id == pid, ApiProvider.provider_type == "smm_panel").first()
    if not prov:
        raise HTTPException(404, "Provider not found")
    db.delete(prov)
    db.commit()
    return {"ok": True}


@router.post("/providers/{pid}/balance", dependencies=[Depends(get_current_admin)])
async def get_smm_provider_balance(pid: int, db: Session = Depends(get_db)):
    """Get balance from SMM provider, converted to VND."""
    prov = db.query(ApiProvider).filter(ApiProvider.id == pid, ApiProvider.provider_type == "smm_panel").first()
    if not prov:
        raise HTTPException(404, "Provider not found")
    from api.providers import get_provider
    adapter = get_provider(prov)
    try:
        raw = await adapter.get_balance()
        # raw is a ProviderBalance dataclass
        balance_usd = float(getattr(raw, "amount", 0) or 0)
        raw_currency = getattr(raw, "currency", "USD") or "USD"
        settings = prov.settings or {}
        exchange_rate = float(settings.get("exchange_rate") or 1)
        currency = settings.get("currency", raw_currency)
        balance_vnd = balance_usd * exchange_rate
        return {
            "ok": True,
            "balance_raw": balance_usd,
            "currency": currency,
            "exchange_rate": exchange_rate,
            "balance_vnd": balance_vnd,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
    platform_id: int


# ══════════════════════════════════════════════════════════════
#  ADMIN — Platforms
# ══════════════════════════════════════════════════════════════

@router.get("/platforms", dependencies=[Depends(get_current_admin)])
def list_platforms(db: Session = Depends(get_db)):
    platforms = db.query(SmmPlatform).order_by(SmmPlatform.sort_order, SmmPlatform.id).all()
    result = []
    for p in platforms:
        cat_count = db.query(func.count(SmmCategory.id)).filter(SmmCategory.platform_id == p.id).scalar()
        svc_count = (
            db.query(func.count(SmmService.id))
            .join(SmmCategory, SmmService.category_id == SmmCategory.id)
            .filter(SmmCategory.platform_id == p.id)
            .scalar()
        )
        result.append({
            "id": p.id, "name": p.name, "slug": p.slug,
            "icon_url": p.icon_url, "sort_order": p.sort_order,
            "is_active": p.is_active,
            "category_count": cat_count, "service_count": svc_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return result


@router.post("/platforms", dependencies=[Depends(get_current_admin)])
def create_platform(body: PlatformCreate, db: Session = Depends(get_db)):
    slug = _slugify(body.name)
    if db.query(SmmPlatform).filter(SmmPlatform.slug == slug).first():
        raise HTTPException(400, "Platform slug already exists")
    p = SmmPlatform(name=body.name, slug=slug, icon_url=body.icon_url,
                    sort_order=body.sort_order, is_active=body.is_active)
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name, "slug": p.slug}


@router.put("/platforms/{pid}", dependencies=[Depends(get_current_admin)])
def update_platform(pid: int, body: PlatformCreate, db: Session = Depends(get_db)):
    p = db.query(SmmPlatform).get(pid)
    if not p:
        raise HTTPException(404, "Platform not found")
    p.name = body.name
    p.icon_url = body.icon_url
    p.sort_order = body.sort_order
    p.is_active = body.is_active
    db.commit()
    return {"ok": True}


@router.delete("/platforms/{pid}", dependencies=[Depends(get_current_admin)])
def delete_platform(pid: int, db: Session = Depends(get_db)):
    p = db.query(SmmPlatform).get(pid)
    if not p:
        raise HTTPException(404, "Platform not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Categories
# ══════════════════════════════════════════════════════════════

@router.get("/categories/all", dependencies=[Depends(get_current_admin)])
def list_all_categories(platform_id: int | None = None, db: Session = Depends(get_db)):
    """All categories with platform info for admin, optional platform filter."""
    q = (
        db.query(SmmCategory)
        .join(SmmPlatform, SmmCategory.platform_id == SmmPlatform.id)
    )
    if platform_id:
        q = q.filter(SmmCategory.platform_id == platform_id)
    cats = q.order_by(SmmPlatform.sort_order, SmmCategory.sort_order, SmmCategory.id).all()
    result = []
    for c in cats:
        plat = c.platform
        svc_count = db.query(func.count(SmmService.id)).filter(SmmService.category_id == c.id).scalar()
        result.append({
            "id": c.id, "platform_id": c.platform_id,
            "name": c.name, "slug": c.slug,
            "sort_order": c.sort_order, "is_active": c.is_active,
            "service_count": svc_count,
            "platform_name": plat.name if plat else "",
            "platform_icon": plat.icon_url if plat else "",
        })
    return result


@router.get("/platforms/{pid}/categories", dependencies=[Depends(get_current_admin)])
def list_categories(pid: int, db: Session = Depends(get_db)):
    cats = (
        db.query(SmmCategory)
        .filter(SmmCategory.platform_id == pid)
        .order_by(SmmCategory.sort_order, SmmCategory.id)
        .all()
    )
    result = []
    for c in cats:
        svc_count = db.query(func.count(SmmService.id)).filter(SmmService.category_id == c.id).scalar()
        result.append({
            "id": c.id, "platform_id": c.platform_id,
            "name": c.name, "slug": c.slug,
            "sort_order": c.sort_order, "is_active": c.is_active,
            "service_count": svc_count,
        })
    return result


@router.post("/platforms/{pid}/categories", dependencies=[Depends(get_current_admin)])
def create_category(pid: int, body: CategoryCreate, db: Session = Depends(get_db)):
    if not db.query(SmmPlatform).get(pid):
        raise HTTPException(404, "Platform not found")
    slug = _slugify(body.name)
    existing = db.query(SmmCategory).filter(
        SmmCategory.platform_id == pid, SmmCategory.slug == slug
    ).first()
    if existing:
        raise HTTPException(400, "Category slug already exists in this platform")
    c = SmmCategory(platform_id=pid, name=body.name, slug=slug,
                    sort_order=body.sort_order, is_active=body.is_active)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "slug": c.slug}


@router.put("/categories/{cid}", dependencies=[Depends(get_current_admin)])
def update_category(cid: int, body: CategoryCreate, db: Session = Depends(get_db)):
    c = db.query(SmmCategory).get(cid)
    if not c:
        raise HTTPException(404, "Category not found")
    c.name = body.name
    c.sort_order = body.sort_order
    c.is_active = body.is_active
    db.commit()
    return {"ok": True}


@router.delete("/categories/{cid}", dependencies=[Depends(get_current_admin)])
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.query(SmmCategory).get(cid)
    if not c:
        raise HTTPException(404, "Category not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Services
# ══════════════════════════════════════════════════════════════

@router.get("/categories/{cid}/services", dependencies=[Depends(get_current_admin)])
def list_services(cid: int, db: Session = Depends(get_db)):
    svcs = (
        db.query(SmmService)
        .filter(SmmService.category_id == cid)
        .order_by(SmmService.sort_order, SmmService.id)
        .all()
    )
    return [
        {
            "id": s.id, "category_id": s.category_id,
            "name": s.name, "description": s.description,
            "rate": s.rate, "min_quantity": s.min_quantity, "max_quantity": s.max_quantity,
            "delivery_type": s.delivery_type,
            "api_provider_id": s.api_provider_id,
            "external_service_id": s.external_service_id,
            "can_refill": s.can_refill, "can_cancel": s.can_cancel,
            "is_active": s.is_active, "sort_order": s.sort_order,
        }
        for s in svcs
    ]


@router.get("/services/all", dependencies=[Depends(get_current_admin)])
def list_all_services(platform_id: int | None = None, category_id: int | None = None, db: Session = Depends(get_db)):
    """All services with platform/category info for admin, optional filters."""
    q = (
        db.query(SmmService)
        .join(SmmCategory, SmmService.category_id == SmmCategory.id)
        .join(SmmPlatform, SmmCategory.platform_id == SmmPlatform.id)
    )
    if platform_id:
        q = q.filter(SmmCategory.platform_id == platform_id)
    if category_id:
        q = q.filter(SmmService.category_id == category_id)
    svcs = q.order_by(SmmPlatform.sort_order, SmmCategory.sort_order, SmmService.sort_order).all()
    # Map providers for name lookup
    provider_map = {p.id: p for p in db.query(ApiProvider).all()}
    result = []
    for s in svcs:
        cat = s.category
        plat = cat.platform if cat else None
        prov = provider_map.get(s.api_provider_id) if s.api_provider_id else None
        result.append({
            "id": s.id, "name": s.name, "rate": s.rate,
            "cost_rate": getattr(s, "cost_rate", 0) or 0,
            "min_quantity": s.min_quantity, "max_quantity": s.max_quantity,
            "delivery_type": s.delivery_type,
            "can_refill": s.can_refill, "can_cancel": s.can_cancel,
            "drip_feed": getattr(s, "drip_feed", False),
            "service_type": s.service_type or "Default",
            "avg_time_minutes": getattr(s, "avg_time_minutes", None),
            "computed_avg_time_minutes": compute_avg_time_per_1000(db, s.id),
            "is_active": s.is_active, "sort_order": s.sort_order,
            "category_id": s.category_id,
            "category_name": cat.name if cat else "",
            "platform_id": cat.platform_id if cat else None,
            "platform_name": plat.name if plat else "",
            "platform_icon": plat.icon_url if plat else "",
            "api_provider_id": s.api_provider_id,
            "api_provider_name": prov.name if prov else "",
            "external_service_id": s.external_service_id,
            "description": s.description,
        })
    return result


def _validate_service_body(body: "ServiceCreate"):
    """Validate min/max/rate so user-side checks can rely on backend invariants (M3)."""
    if body.min_quantity is None or body.min_quantity < 1:
        raise HTTPException(400, "min_quantity phải >= 1")
    if body.max_quantity is None or body.max_quantity < body.min_quantity:
        raise HTTPException(400, "max_quantity phải >= min_quantity")
    if body.max_quantity > 2_000_000_000:
        raise HTTPException(400, "max_quantity quá lớn (giới hạn 2 tỷ)")
    if body.rate is None or body.rate < 0:
        raise HTTPException(400, "rate không hợp lệ")


def compute_avg_time_per_1000(db: Session, smm_service_id: int) -> float | None:
    """
    Avg completion time (minutes) normalized to a quantity of 1000,
    based on the 10 most recently completed orders of this service.
    Returns None if there are no completed orders.
    """
    rows = (
        db.query(SmmOrder.created_at, SmmOrder.updated_at, SmmOrder.quantity)
        .filter(
            SmmOrder.smm_service_id == smm_service_id,
            SmmOrder.status == "completed",
            SmmOrder.quantity > 0,
            SmmOrder.created_at.isnot(None),
            SmmOrder.updated_at.isnot(None),
        )
        .order_by(SmmOrder.updated_at.desc())
        .limit(10)
        .all()
    )
    if not rows:
        return None
    samples = []
    for created, updated, qty in rows:
        try:
            elapsed_min = max(0.0, (updated - created).total_seconds() / 60.0)
            samples.append(elapsed_min * 1000.0 / float(qty))
        except Exception:
            continue
    if not samples:
        return None
    return round(sum(samples) / len(samples), 1)


@router.post("/categories/{cid}/services", dependencies=[Depends(get_current_admin)])
def create_service(cid: int, body: ServiceCreate, db: Session = Depends(get_db)):
    if not db.query(SmmCategory).get(cid):
        raise HTTPException(404, "Category not found")
    _validate_service_body(body)
    s = SmmService(
        category_id=cid, name=body.name, description=body.description,
        rate=body.rate, cost_rate=body.cost_rate, min_quantity=body.min_quantity, max_quantity=body.max_quantity,
        delivery_type=body.delivery_type,
        api_provider_id=body.api_provider_id, external_service_id=body.external_service_id,
        can_refill=body.can_refill, can_cancel=body.can_cancel,
        drip_feed=body.drip_feed, service_type=body.service_type,
        avg_time_minutes=body.avg_time_minutes,
        is_active=body.is_active, sort_order=body.sort_order,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}


@router.put("/services/{sid}", dependencies=[Depends(get_current_admin)])
def update_service(sid: int, body: ServiceCreate, db: Session = Depends(get_db)):
    s = db.query(SmmService).get(sid)
    if not s:
        raise HTTPException(404, "Service not found")
    _validate_service_body(body)
    for field in ["name", "description", "rate", "cost_rate", "min_quantity", "max_quantity",
                  "delivery_type", "api_provider_id", "external_service_id",
                  "can_refill", "can_cancel", "drip_feed", "service_type",
                  "avg_time_minutes", "is_active", "sort_order"]:
        setattr(s, field, getattr(body, field))
    db.commit()
    return {"ok": True}


@router.patch("/services/{sid}/active", dependencies=[Depends(get_current_admin)])
def toggle_service_active(sid: int, body: dict, db: Session = Depends(get_db)):
    s = db.query(SmmService).get(sid)
    if not s:
        raise HTTPException(404, "Service not found")
    s.is_active = bool(body.get("is_active"))
    db.commit()
    return {"ok": True, "is_active": s.is_active}


@router.delete("/services/{sid}", dependencies=[Depends(get_current_admin)])
def delete_service(sid: int, db: Session = Depends(get_db)):
    s = db.query(SmmService).get(sid)
    if not s:
        raise HTTPException(404, "Service not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/services/bulk-delete", dependencies=[Depends(get_current_admin)])
def bulk_delete_services(body: dict, db: Session = Depends(get_db)):
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "ids required")
    try:
        ids_int = [int(x) for x in ids]
    except Exception:
        raise HTTPException(400, "ids must be integers")
    deleted = db.query(SmmService).filter(SmmService.id.in_(ids_int)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.post("/services/round-prices", dependencies=[Depends(get_current_admin)])
def round_prices(body: dict, db: Session = Depends(get_db)):
    """Làm tròn giá bán (rate) của danh sách dịch vụ về số nguyên.
    Quy tắc: < .5 làm tròn xuống, >= .5 làm tròn lên (Python round half-up via Decimal).
    """
    from decimal import Decimal, ROUND_HALF_UP
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "ids required")
    try:
        ids_int = [int(x) for x in ids]
    except Exception:
        raise HTTPException(400, "ids must be integers")
    rows = db.query(SmmService).filter(SmmService.id.in_(ids_int)).all()
    changed = 0
    for s in rows:
        if s.rate is None:
            continue
        new_val = int(Decimal(str(s.rate)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        if float(s.rate) != float(new_val):
            s.rate = new_val
            changed += 1
    db.commit()
    return {"ok": True, "updated": changed, "total": len(rows)}


# ── Sync from API provider ───────────────────────────────────

@router.get("/providers/{pid}/remote-services", dependencies=[Depends(get_current_admin)])
async def remote_services(pid: int, db: Session = Depends(get_db)):
    """Fetch raw services from an SMM provider for the sync stepper UI.
    Returns provider's categories + flat services list with previewed local price.
    """
    p = db.query(ApiProvider).filter(
        ApiProvider.id == pid,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    from api.providers import get_provider
    adapter = get_provider(p)
    try:
        raw = await adapter.get_services()
    except Exception as e:
        logger.exception("SMM remote_services: get_services failed")
        raise HTTPException(502, f"Lỗi gọi nguồn: {e!r}")
    if not isinstance(raw, list):
        raise HTTPException(502, f"Nguồn trả về định dạng không hợp lệ: {type(raw).__name__}")
    settings = p.settings or {}
    exchange_rate = float(settings.get("exchange_rate", 1) or 1)
    price_markup = float(settings.get("price_markup", 0) or 0)

    def conv(r):
        try:
            v = float(r) * exchange_rate
            if price_markup > 0:
                v *= (1 + price_markup / 100)
            return round(v, 2)
        except Exception:
            return 0.0

    services = []
    cat_counts: dict[str, int] = {}
    for s in raw:
        cat = s.get("category", "Other") or "Other"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        try:
            sid = int(s.get("service", 0))
        except Exception:
            sid = 0
        services.append({
            "service": sid,
            "name": s.get("name", ""),
            "description": s.get("description") or s.get("desc") or "",
            "category": cat,
            "type": s.get("type", "Default"),
            "rate_raw": float(s.get("rate", 0) or 0),
            "rate_local": conv(s.get("rate", 0)),
            "min": int(s.get("min", 1) or 1),
            "max": int(s.get("max", 10000) or 10000),
            "refill": bool(s.get("refill", False)),
            "cancel": bool(s.get("cancel", False)),
        })
    categories = sorted(
        [{"name": k, "count": v} for k, v in cat_counts.items()],
        key=lambda x: x["name"].lower(),
    )
    return {
        "provider_id": p.id,
        "provider_name": p.name,
        "exchange_rate": exchange_rate,
        "price_markup": price_markup,
        "categories": categories,
        "services": services,
    }


@router.post("/services/sync-selected", dependencies=[Depends(get_current_admin)])
async def sync_selected_services(body: SyncSelectedRequest, db: Session = Depends(get_db)):
    """Import only the explicitly selected external services into a chosen local category."""
    provider = db.query(ApiProvider).filter(
        ApiProvider.id == body.provider_id,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(404, "SMM provider not found or inactive")
    if not (provider.settings or {}).get("sync_services", True):
        raise HTTPException(400, "Toggle 'Đồng bộ Dịch vụ' đang tắt — bật lên ở cài đặt provider trước")
    target = db.query(SmmCategory).get(body.target_category_id)
    if not target:
        raise HTTPException(404, "Danh mục đích không tồn tại")
    if not body.external_service_ids:
        raise HTTPException(400, "Chưa chọn dịch vụ nào")

    from api.providers import get_provider
    adapter = get_provider(provider)
    try:
        raw = await adapter.get_services()
    except Exception as e:
        logger.exception("SMM sync_selected_services: get_services failed")
        raise HTTPException(502, f"Lỗi gọi nguồn: {e!r}")
    if not isinstance(raw, list):
        raise HTTPException(502, f"Nguồn trả về định dạng không hợp lệ: {type(raw).__name__}")

    settings = provider.settings or {}
    exchange_rate = float(settings.get("exchange_rate", 1) or 1)
    price_markup = float(settings.get("price_markup", 0) or 0)
    filter_html = settings.get("filter_html", True)

    import re
    def strip_html(t: str) -> str:
        if not t:
            return t
        return re.sub(r"<[^>]+>", "", t).strip()
    def conv(r):
        """Cost VND (chưa markup)."""
        try:
            return round(float(r) * exchange_rate, 2)
        except Exception:
            return 0.0
    def apply_markup(c):
        try:
            return round(float(c) * (1 + price_markup / 100), 2) if price_markup > 0 else round(float(c), 2)
        except Exception:
            return float(c or 0)

    wanted = {int(x) for x in body.external_service_ids}
    selected = [s for s in raw if int(s.get("service", 0) or 0) in wanted]

    created, updated = 0, 0
    for svc in selected:
        ext_id = str(int(svc.get("service", 0)))
        raw_name = svc.get("name", f"Service {ext_id}")
        name = strip_html(raw_name) if filter_html else raw_name
        raw_desc = svc.get("description") or svc.get("desc") or ""
        desc = strip_html(raw_desc) if filter_html else raw_desc
        cost = conv(svc.get("rate", 0))
        price = apply_markup(cost)
        existing = db.query(SmmService).filter(
            SmmService.api_provider_id == provider.id,
            SmmService.external_service_id == ext_id,
        ).first()
        if existing:
            existing.category_id = target.id
            existing.name = name
            existing.description = desc
            existing.rate = price
            existing.cost_rate = cost
            existing.min_quantity = int(svc.get("min", existing.min_quantity) or existing.min_quantity)
            existing.max_quantity = int(svc.get("max", existing.max_quantity) or existing.max_quantity)
            existing.service_type = svc.get("type", existing.service_type or "Default")
            existing.can_refill = bool(svc.get("refill", False))
            existing.can_cancel = bool(svc.get("cancel", False))
            existing.delivery_type = "api"
            updated += 1
        else:
            db.add(SmmService(
                category_id=target.id,
                name=name,
                description=desc,
                rate=price,
                cost_rate=cost,
                min_quantity=int(svc.get("min", 1) or 1),
                max_quantity=int(svc.get("max", 10000) or 10000),
                delivery_type="api",
                api_provider_id=provider.id,
                external_service_id=ext_id,
                can_refill=bool(svc.get("refill", False)),
                can_cancel=bool(svc.get("cancel", False)),
                service_type=svc.get("type", "Default"),
            ))
            created += 1
    db.commit()
    return {"ok": True, "created": created, "updated": updated, "selected": len(selected)}


@router.get("/providers/{pid}/remote-categories", dependencies=[Depends(get_current_admin)])
async def remote_categories(pid: int, platform_id: int = 0, db: Session = Depends(get_db)):
    """Preview các category mà nguồn cung cấp + đánh dấu đã tồn tại trên platform."""
    p = db.query(ApiProvider).filter(
        ApiProvider.id == pid,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    from api.providers import get_provider
    adapter = get_provider(p)
    try:
        raw = await adapter.get_services()
    except Exception as e:
        logger.exception("SMM remote_categories: get_services failed")
        raise HTTPException(502, f"Lỗi gọi nguồn: {e!r}")
    if not isinstance(raw, list):
        raise HTTPException(502, "Nguồn trả về định dạng không hợp lệ")
    cat_counts: dict[str, int] = {}
    for s in raw:
        cat = (s.get("category") or "Other").strip()
        if cat:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
    existing_slugs: set[str] = set()
    if platform_id:
        existing_slugs = {
            row[0] for row in db.query(SmmCategory.slug).filter(SmmCategory.platform_id == platform_id).all()
        }
    out = []
    for name, cnt in cat_counts.items():
        out.append({
            "name": name,
            "count": cnt,
            "slug": _slugify(name),
            "exists": _slugify(name) in existing_slugs,
        })
    out.sort(key=lambda x: x["name"].lower())
    return {"provider_id": p.id, "platform_id": platform_id, "categories": out}


@router.post("/categories/sync", dependencies=[Depends(get_current_admin)])
async def sync_categories_only(body: SyncCategoriesRequest, db: Session = Depends(get_db)):
    """Sync ONLY categories from provider (no services). Nếu body.category_names rỗng → tạo tất cả còn thiếu;
    có giá trị → chỉ tạo các tên trong danh sách. Yêu cầu provider.settings.sync_categories=True."""
    provider = db.query(ApiProvider).filter(
        ApiProvider.id == body.provider_id,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(404, "SMM provider not found or inactive")
    settings = provider.settings or {}
    if not settings.get("sync_categories", True):
        raise HTTPException(400, "Toggle 'Đồng bộ Chuyên mục' đang tắt — bật lên ở cài đặt provider trước")
    platform = db.query(SmmPlatform).get(body.platform_id)
    if not platform:
        raise HTTPException(404, "Platform not found")
    from api.providers import get_provider
    adapter = get_provider(provider)
    try:
        raw_services = await adapter.get_services()
    except Exception as e:
        logger.exception("SMM sync_categories_only: get_services failed")
        raise HTTPException(502, f"Lỗi gọi nguồn: {e!r}")
    if not isinstance(raw_services, list):
        raise HTTPException(502, f"Nguồn trả về định dạng không hợp lệ: {type(raw_services).__name__}")

    # Thu thập tên category duy nhất + đếm
    cat_counts: dict[str, int] = {}
    for s in raw_services:
        cat = (s.get("category") or "Other").strip()
        if cat:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

    # Lọc theo selection (nếu có)
    selection = set(body.category_names or [])
    if selection:
        cat_counts = {k: v for k, v in cat_counts.items() if k in selection}

    created = 0
    existed = 0
    for cat_name, cnt in cat_counts.items():
        slug = _slugify(cat_name)
        exists = db.query(SmmCategory).filter(
            SmmCategory.platform_id == platform.id,
            SmmCategory.slug == slug,
        ).first()
        if exists:
            existed += 1
            continue
        db.add(SmmCategory(platform_id=platform.id, name=cat_name, slug=slug))
        created += 1
    db.commit()
    return {"ok": True, "created": created, "existed": existed, "total_remote": len(cat_counts)}


@router.post("/services/sync", dependencies=[Depends(get_current_admin)])
async def sync_services(body: SyncRequest, db: Session = Depends(get_db)):
    """Sync services from SMM panel API provider into a platform."""
    provider = db.query(ApiProvider).filter(
        ApiProvider.id == body.provider_id,
        ApiProvider.provider_type == "smm_panel",
        ApiProvider.is_active == True,
    ).first()
    if not provider:
        raise HTTPException(404, "SMM provider not found or inactive")

    platform = db.query(SmmPlatform).get(body.platform_id)
    if not platform:
        raise HTTPException(404, "Platform not found")

    from api.providers import get_provider
    adapter = get_provider(provider)
    try:
        raw_services = await adapter.get_services()
    except Exception as e:
        logger.exception("SMM sync_services: get_services failed")
        raise HTTPException(502, f"Lỗi gọi nguồn: {e!r}")
    if not isinstance(raw_services, list):
        raise HTTPException(502, f"Nguồn trả về định dạng không hợp lệ: {type(raw_services).__name__}")

    # Exchange rate & markup from provider settings
    settings = provider.settings or {}
    exchange_rate = float(settings.get("exchange_rate", 1))
    price_markup = float(settings.get("price_markup", 0))
    sync_categories = settings.get("sync_categories", True)
    sync_services_flag = settings.get("sync_services", True)
    sync_prices = settings.get("sync_prices", True)
    sync_descriptions = settings.get("sync_descriptions", False)
    sync_advanced = settings.get("sync_advanced", False)
    filter_html = settings.get("filter_html", True)

    import re
    def strip_html(text: str) -> str:
        """Remove HTML tags from text."""
        if not text:
            return text
        return re.sub(r'<[^>]+>', '', text).strip()

    def convert_rate(raw_rate):
        """Cost trong VND (chưa markup)."""
        return round(float(raw_rate) * exchange_rate, 2)

    def apply_markup(cost_vnd):
        """Giá bán = cost × (1 + markup%)."""
        if price_markup > 0:
            return round(float(cost_vnd) * (1 + price_markup / 100), 2)
        return round(float(cost_vnd), 2)

    created, updated, skipped = 0, 0, 0
    # Group by category
    by_cat: dict[str, list] = {}
    for svc in raw_services:
        cat_name = svc.get("category", "Other")
        by_cat.setdefault(cat_name, []).append(svc)

    for cat_name, svcs in by_cat.items():
        slug = _slugify(cat_name)
        cat = db.query(SmmCategory).filter(
            SmmCategory.platform_id == platform.id,
            SmmCategory.slug == slug,
        ).first()

        if not cat:
            # sync_categories=False → skip creating new categories
            if not sync_categories:
                skipped += len(svcs)
                continue
            cat = SmmCategory(platform_id=platform.id, name=cat_name, slug=slug)
            db.add(cat)
            db.flush()

        for svc in svcs:
            ext_id = str(int(svc.get("service", 0)))
            existing = db.query(SmmService).filter(
                SmmService.category_id == cat.id,
                SmmService.api_provider_id == provider.id,
                SmmService.external_service_id == ext_id,
            ).first()

            if existing:
                # Update existing service
                # Toggle "Cập nhật Tên & Mô tả" → gate cả name lẫn description
                if sync_descriptions:
                    raw_name_u = svc.get("name")
                    if raw_name_u:
                        existing.name = strip_html(raw_name_u) if filter_html else raw_name_u
                    raw_desc_u = svc.get("description") or svc.get("desc") or ""
                    if raw_desc_u:
                        existing.description = strip_html(raw_desc_u) if filter_html else raw_desc_u
                if sync_prices:
                    raw_rate = svc.get("rate")
                    if raw_rate is not None:
                        existing.cost_rate = convert_rate(raw_rate)
                    # Chỉ re-apply markup khi đồng bộ giá → giá bán = cost × (1 + markup%)
                    if existing.cost_rate is not None:
                        existing.rate = apply_markup(existing.cost_rate)
                existing.min_quantity = int(svc.get("min", existing.min_quantity))
                existing.max_quantity = int(svc.get("max", existing.max_quantity))
                if sync_advanced:
                    existing.can_refill = bool(svc.get("refill", False))
                    existing.can_cancel = bool(svc.get("cancel", False))
                existing.service_type = svc.get("type", existing.service_type or "Default")
                updated += 1
            else:
                # sync_services=False → skip creating new services
                if not sync_services_flag:
                    skipped += 1
                    continue
                raw_name = svc.get("name", f"Service {ext_id}")
                name = strip_html(raw_name) if filter_html else raw_name
                if sync_descriptions:
                    raw_desc = svc.get("description") or svc.get("desc") or ""
                    desc = strip_html(raw_desc) if filter_html else raw_desc
                else:
                    desc = None
                _cost = convert_rate(svc.get("rate", 0))
                _price = apply_markup(_cost)
                new_svc = SmmService(
                    category_id=cat.id,
                    name=name,
                    description=desc,
                    rate=_price,
                    cost_rate=_cost,
                    min_quantity=int(svc.get("min", 1)),
                    max_quantity=int(svc.get("max", 10000)),
                    delivery_type="api",
                    api_provider_id=provider.id,
                    external_service_id=ext_id,
                    can_refill=bool(svc.get("refill", False)) if sync_advanced else False,
                    can_cancel=bool(svc.get("cancel", False)) if sync_advanced else False,
                    service_type=svc.get("type", "Default"),
                )
                db.add(new_svc)
                created += 1

    db.commit()
    return {"ok": True, "created": created, "updated": updated, "skipped": skipped, "total_raw": len(raw_services)}


# ══════════════════════════════════════════════════════════════
#  ADMIN — Orders
# ══════════════════════════════════════════════════════════════

@router.get("/admin/orders", dependencies=[Depends(get_current_admin)])
def admin_list_orders(
    status: str = Query(None),
    search: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(SmmOrder).order_by(SmmOrder.id.desc())
    if status:
        q = q.filter(SmmOrder.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (SmmOrder.order_code.ilike(term))
            | (SmmOrder.link.ilike(term))
            | (SmmOrder.service_name.ilike(term))
        )
    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()

    # Stats (unfiltered)
    from sqlalchemy import func as sqf
    stats_q = db.query(SmmOrder)
    total_all = stats_q.count()
    pending_count = stats_q.filter(SmmOrder.status.in_(["pending", "processing"])).count()
    in_progress_count = stats_q.filter(SmmOrder.status == "in_progress").count()
    completed_count = stats_q.filter(SmmOrder.status == "completed").count()
    partial_count = stats_q.filter(SmmOrder.status == "partial").count()
    canceled_count = stats_q.filter(SmmOrder.status.in_(["canceled", "cancelled"])).count()
    scheduled_count = stats_q.filter(SmmOrder.status == "scheduled").count()
    revenue = db.query(sqf.coalesce(sqf.sum(SmmOrder.charge), 0)).scalar() or 0

    return {
        "total": total,
        "page": page,
        "stats": {
            "total": total_all,
            "pending": pending_count,
            "in_progress": in_progress_count,
            "completed": completed_count,
            "partial": partial_count,
            "canceled": canceled_count,
            "scheduled": scheduled_count,
            "revenue": revenue,
        },
        "orders": [
            {
                "id": o.id, "code": o.order_code,
                "user_id": o.user_id,
                "user_name": o.user.display_name if o.user else None,
                "user_email": o.user.email if o.user else None,
                "platform_name": o.platform_name,
                "category_name": o.category_name,
                "service_id": o.smm_service_id,
                "service_name": o.service_name,
                "service_type": o.service_type or "Default",
                "link": o.link, "quantity": o.quantity, "charge": o.charge,
                "status": o.status, "delivery_type": o.delivery_type,
                "start_count": o.start_count,
                "remains": o.remains,
                "external_order_id": o.external_order_id,
                "api_provider_id": o.api_provider_id,
                "provider_name": o.api_provider.name if o.api_provider else None,
                "provider_url": o.api_provider.base_url if o.api_provider else None,
                "admin_notes": o.admin_notes,
                "user_comment": (o.extras or "").strip() if o.extras else "",
                "scheduled_at": o.scheduled_at.isoformat() if o.scheduled_at else None,
                "repeat_count": o.repeat_count or 0,
                "repeat_remaining": o.repeat_remaining or 0,
                "repeat_interval": o.repeat_interval or 0,
                "parent_order_id": o.parent_order_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.put("/admin/orders/{oid}/status", dependencies=[Depends(get_current_admin)])
def admin_update_order_status(oid: int, body: OrderStatusUpdate, db: Session = Depends(get_db)):
    o = db.query(SmmOrder).get(oid)
    if not o:
        raise HTTPException(404, "Order not found")
    o.status = body.status
    if body.admin_notes is not None:
        o.admin_notes = body.admin_notes
    if body.start_count is not None:
        o.start_count = body.start_count
    if body.remains is not None:
        o.remains = body.remains
    db.commit()
    return {"ok": True}


@router.delete("/admin/orders/{oid}", dependencies=[Depends(get_current_admin)])
def admin_delete_order(oid: int, db: Session = Depends(get_db)):
    o = db.query(SmmOrder).get(oid)
    if not o:
        raise HTTPException(404, "Order not found")
    db.delete(o)
    db.commit()
    return {"ok": True}


@router.post("/admin/orders/{oid}/check", dependencies=[Depends(get_current_admin)])
async def admin_check_order(oid: int, db: Session = Depends(get_db)):
    o = db.query(SmmOrder).get(oid)
    if not o or o.delivery_type != "api" or not o.external_order_id or not o.api_provider_id:
        raise HTTPException(400, "Not an API order or missing external ID")
    provider = db.query(ApiProvider).get(o.api_provider_id)
    if not provider:
        raise HTTPException(404, "Provider not found")

    from api.providers import get_provider
    adapter = get_provider(provider)
    result = await adapter.get_order_status(o.external_order_id)
    o.status = result.status
    db.commit()
    return {"ok": True, "status": result.status, "message": result.message}


@router.post("/admin/orders/check-all", dependencies=[Depends(get_current_admin)])
async def admin_check_all_orders(db: Session = Depends(get_db)):
    """Batch check status for all pending/processing API orders."""
    orders = (
        db.query(SmmOrder)
        .filter(
            SmmOrder.delivery_type == "api",
            SmmOrder.external_order_id.isnot(None),
            SmmOrder.status.in_(["pending", "processing", "in_progress"]),
        )
        .all()
    )
    if not orders:
        return {"ok": True, "checked": 0}

    # Group by provider
    by_provider: dict[int, list] = {}
    for o in orders:
        if o.api_provider_id:
            by_provider.setdefault(o.api_provider_id, []).append(o)

    checked = 0
    prev_status_map: dict[int, str] = {o.id: o.status for o in orders}
    from api.providers import get_provider
    for pid, provider_orders in by_provider.items():
        provider = db.query(ApiProvider).get(pid)
        if not provider:
            continue
        adapter = get_provider(provider)
        # Use batch status if available
        order_ids = [o.external_order_id for o in provider_orders if o.external_order_id]
        if hasattr(adapter, "get_multiple_status") and len(order_ids) > 1:
            try:
                statuses = await adapter.get_multiple_status(order_ids)
                status_map = {
                    "Completed": "completed", "Processing": "processing",
                    "In progress": "in_progress", "Partial": "partial",
                    "Canceled": "canceled", "Pending": "pending",
                }
                for o in provider_orders:
                    data = statuses.get(o.external_order_id, {})
                    if isinstance(data, dict) and not data.get("error"):
                        raw = data.get("status", "")
                        o.status = status_map.get(raw, raw.lower()) if raw else o.status
                        try:
                            if data.get("start_count") not in (None, "", "null"):
                                o.start_count = int(float(data.get("start_count")))
                        except Exception:
                            pass
                        try:
                            if data.get("remains") not in (None, "", "null"):
                                o.remains = int(float(data.get("remains")))
                        except Exception:
                            pass
                        checked += 1
            except Exception as e:
                logger.error(f"Batch status check failed for provider {pid}: {e}")
        else:
            for o in provider_orders:
                try:
                    result = await adapter.get_order_status(o.external_order_id)
                    o.status = result.status
                    checked += 1
                except Exception as e:
                    logger.error(f"Status check failed for order {o.id}: {e}")

    db.commit()

    # Auto-refund cho các đơn đang ở canceled/cancelled/failed (idempotent)
    try:
        for _pid, plist in by_provider.items():
            for o in plist:
                _maybe_refund_on_terminal(db, o)
        db.commit()
    except Exception as _e:
        logger.warning(f"Batch refund pass failed: {_e}")

    # Notify users on terminal status transitions
    try:
        from api.order_notifications import notify_smm_order_event
        terminal = {"completed", "partial", "canceled", "cancelled", "failed"}
        for _pid, plist in by_provider.items():
            for o in plist:
                prev = prev_status_map.get(o.id)
                if o.status != prev and o.status in terminal:
                    event = "completed" if o.status in ("completed", "partial") else "failed"
                    try:
                        notify_smm_order_event(db, o, event=event, previous_status=prev)
                    except Exception:
                        pass
    except Exception:
        pass

    return {"ok": True, "checked": checked}


# ══════════════════════════════════════════════════════════════
#  USER — Catalog & Orders
# ══════════════════════════════════════════════════════════════

@router.get("/catalog")
def user_catalog(db: Session = Depends(get_db)):
    """Public catalog: platforms → categories → services (active only)."""
    platforms = (
        db.query(SmmPlatform)
        .filter(SmmPlatform.is_active == True)
        .order_by(SmmPlatform.sort_order, SmmPlatform.id)
        .all()
    )
    result = []
    for p in platforms:
        cats = (
            db.query(SmmCategory)
            .filter(SmmCategory.platform_id == p.id, SmmCategory.is_active == True)
            .order_by(SmmCategory.sort_order, SmmCategory.id)
            .all()
        )
        cat_list = []
        for c in cats:
            svcs = (
                db.query(SmmService)
                .filter(SmmService.category_id == c.id, SmmService.is_active == True)
                .order_by(SmmService.sort_order, SmmService.id)
                .all()
            )
            if not svcs:
                continue
            cat_list.append({
                "id": c.id, "name": c.name, "slug": c.slug,
                "services": [
                    {
                        "id": s.id, "name": s.name, "description": s.description,
                        "rate": s.rate, "min_quantity": s.min_quantity,
                        "max_quantity": s.max_quantity,
                        "can_refill": s.can_refill,
                        "can_cancel": s.can_cancel,
                        "service_type": s.service_type or "Default",
                        "avg_time_minutes": getattr(s, "avg_time_minutes", None),
                        "computed_avg_time_minutes": compute_avg_time_per_1000(db, s.id),
                    }
                    for s in svcs
                ],
            })
        if not cat_list:
            continue
        result.append({
            "id": p.id, "name": p.name, "slug": p.slug,
            "icon_url": p.icon_url,
            "categories": cat_list,
        })
    return result


@router.get("/service/{sid}")
def user_service_detail(sid: int, db: Session = Depends(get_db)):
    """Public single-service detail for the order page."""
    svc = db.query(SmmService).filter(SmmService.id == sid, SmmService.is_active == True).first()
    if not svc:
        raise HTTPException(404, "Service not found")
    cat = db.query(SmmCategory).filter(SmmCategory.id == svc.category_id).first()
    plat = db.query(SmmPlatform).filter(SmmPlatform.id == cat.platform_id).first() if cat else None
    return {
        "id": svc.id, "name": svc.name, "description": svc.description,
        "rate": svc.rate, "min_quantity": svc.min_quantity,
        "max_quantity": svc.max_quantity,
        "can_refill": svc.can_refill, "can_cancel": svc.can_cancel,
        "category": {"id": cat.id, "name": cat.name, "slug": cat.slug} if cat else None,
        "platform": {"id": plat.id, "name": plat.name, "slug": plat.slug, "icon_url": plat.icon_url} if plat else None,
    }


@router.post("/orders", dependencies=[Depends(rate_limit("smm_order", 30, 60))])
def user_place_order(
    body: OrderPlace,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = db.query(SmmService).get(body.service_id)
    if not svc or not svc.is_active:
        raise HTTPException(404, "Service not found or inactive")

    # Service-type specific handling — adjust quantity / validate extras
    stype = (svc.service_type or "Default").strip()
    extras = body.extras or {}
    # Normalize and apply per-type rules
    if stype == "Package":
        # Quantity always 1 (1 package per order)
        body.quantity = 1
    elif stype == "Custom Comments":
        # Quantity = number of non-empty lines in comments
        raw_c = (extras.get("comments") or "").strip()
        lines = [ln.strip() for ln in raw_c.splitlines() if ln.strip()]
        if not lines:
            raise HTTPException(400, "Vui lòng nhập danh sách bình luận (mỗi dòng 1 bình luận)")
        body.quantity = len(lines)
        extras["comments"] = "\n".join(lines)
    elif stype == "Custom Comments Package":
        raw_c = (extras.get("comments") or "").strip()
        lines = [ln.strip() for ln in raw_c.splitlines() if ln.strip()]
        if not lines:
            raise HTTPException(400, "Vui lòng nhập danh sách bình luận")
        extras["comments"] = "\n".join(lines)
    elif stype == "Mentions Hashtag":
        if not (extras.get("hashtags") or "").strip():
            raise HTTPException(400, "Vui lòng nhập hashtag")
    elif stype == "SEO":
        if not (extras.get("keywords") or "").strip():
            raise HTTPException(400, "Vui lòng nhập từ khoá SEO")
    elif stype == "Subscriptions":
        # username is the typical subscription identifier; quantity is min posts target
        if not (extras.get("username") or extras.get("link") or body.link or "").strip():
            raise HTTPException(400, "Vui lòng nhập username/link kênh")

    if body.quantity < svc.min_quantity or body.quantity > svc.max_quantity:
        raise HTTPException(400, f"Quantity must be between {svc.min_quantity} and {svc.max_quantity}")

    # Validate link (M1): must be http(s) URL with a host
    from urllib.parse import urlparse
    _link_raw = (body.link or "").strip()
    if len(_link_raw) < 4 or len(_link_raw) > 2048:
        raise HTTPException(400, "Link không hợp lệ")
    try:
        _u = urlparse(_link_raw)
    except Exception:
        raise HTTPException(400, "Link không hợp lệ")
    if _u.scheme not in ("http", "https") or not _u.netloc or "." not in _u.netloc:
        raise HTTPException(400, "Link phải là URL http(s) hợp lệ")
    body.link = _link_raw

    cat = svc.category
    plat = cat.platform if cat else None

    # Calculate charge (subtotal + VAT from SiteConfig) — Decimal to avoid float drift
    from decimal import Decimal, ROUND_HALF_UP
    def _q2(v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    subtotal = _q2(Decimal(str(svc.rate)) * Decimal(body.quantity) / Decimal(1000))
    try:
        tax_cfg = db.query(SiteConfig).filter(SiteConfig.key == "tax_rate").first()
        tax_rate = Decimal(str(tax_cfg.value)) if tax_cfg and tax_cfg.value else Decimal("0")
    except Exception:
        tax_rate = Decimal("0")
    tax_amount = _q2(subtotal * tax_rate / Decimal(100))
    charge = _q2(subtotal + tax_amount)

    # Check user balance (lock row to prevent race on concurrent orders)
    user = db.query(User).filter(User.id == int(current_user["user_id"])).with_for_update().first()
    if not user:
        raise HTTPException(404, "User not found")
    user_balance = Decimal(str(user.balance or 0))
    if user_balance < charge:
        raise HTTPException(400, f"Số dư không đủ. Cần {charge:,.0f}, hiện có {user_balance:,.0f}")

    # Deduct balance
    user.balance = user_balance - charge

    # Create order
    # Parse schedule
    sched_dt = None
    if body.scheduled_at:
        from datetime import datetime, timezone
        try:
            sched_dt = datetime.fromisoformat(body.scheduled_at.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at format")

    import json as _json
    order = SmmOrder(
        order_code=_gen_order_code(),
        user_id=user.id,
        smm_service_id=svc.id,
        platform_name=plat.name if plat else "",
        category_name=cat.name if cat else "",
        service_name=svc.name,
        link=body.link,
        quantity=body.quantity,
        charge=charge,
        service_type=svc.service_type or "Default",
        extras=_json.dumps(extras, ensure_ascii=False) if extras else None,
        delivery_type=svc.delivery_type,
        api_provider_id=svc.api_provider_id,
        scheduled_at=sched_dt,
        repeat_count=body.repeat_count,
        repeat_interval=body.repeat_interval,
        repeat_remaining=body.repeat_count,
    )
    # If scheduled, set status to 'scheduled' and skip immediate API call
    if sched_dt:
        order.status = "scheduled"

    db.add(order)
    db.flush()

    # If API delivery and NOT scheduled, try to place order with provider now
    if not sched_dt and svc.delivery_type == "api" and svc.api_provider_id and svc.external_service_id:
        try:
            from api.providers import get_provider
            provider = db.query(ApiProvider).get(svc.api_provider_id)
            if provider:
                import asyncio
                adapter = get_provider(provider)
                result = asyncio.run(
                    adapter.create_order(
                        product_id="",
                        plan_id=str(svc.external_service_id),
                        quantity=body.quantity,
                        fields_data={"link": body.link, "quantity": body.quantity, **(extras or {})},
                    )
                )
                order.external_order_id = result.order_id
                order.status = result.status if result.order_id else "failed"
                if result.status == "failed":
                    # Refund on failure
                    user.balance = Decimal(str(user.balance or 0)) + charge
                    order.admin_notes = f"{_REFUND_MARKER} +{charge:,.0f} (failed at create) | API error: {result.message}"
        except Exception as e:
            logger.error(f"SMM API order failed: {e}")
            order.status = "failed"
            user.balance = Decimal(str(user.balance or 0)) + charge
            order.admin_notes = f"{_REFUND_MARKER} +{charge:,.0f} (failed at create) | API error: {str(e)}"

    db.commit()
    # Notify user (create + initial status)
    try:
        from api.order_notifications import notify_smm_order_event
        notify_smm_order_event(db, order, event="failed" if order.status == "failed" else "created")
    except Exception:
        pass
    return {
        "id": order.id, "order_code": order.order_code,
        "status": order.status, "charge": order.charge,
        "external_order_id": order.external_order_id,
        "scheduled_at": order.scheduled_at.isoformat() if order.scheduled_at else None,
        "repeat_count": order.repeat_count,
        "repeat_remaining": order.repeat_remaining,
    }


@router.get("/orders")
def user_list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    search: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    q = db.query(SmmOrder).filter(SmmOrder.user_id == uid)
    if status:
        q = q.filter(SmmOrder.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (SmmOrder.order_code.ilike(term))
            | (SmmOrder.link.ilike(term))
            | (SmmOrder.service_name.ilike(term))
        )
    q = q.order_by(SmmOrder.id.desc())
    total = q.count()
    orders = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "orders": [
            {
                "id": o.id, "order_code": o.order_code,
                "platform_name": o.platform_name,
                "category_name": o.category_name,
                "service_name": o.service_name,
                "link": o.link, "quantity": o.quantity, "charge": o.charge,
                "status": o.status, "delivery_type": o.delivery_type,
                "service_type": o.service_type or "Default",
                "external_order_id": o.external_order_id,
                "start_count": o.start_count,
                "remains": o.remains,
                "can_refill": o.smm_service.can_refill if o.smm_service else False,
                "refill_id": o.refill_id,
                "refill_status": o.refill_status,
                "scheduled_at": o.scheduled_at.isoformat() if o.scheduled_at else None,
                "repeat_count": o.repeat_count or 0,
                "repeat_remaining": o.repeat_remaining or 0,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ],
    }


@router.post("/orders/refresh-all")
async def user_refresh_all_orders(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batch refresh trạng thái các đơn API đang pending/processing/in_progress của user."""
    uid = int(current_user["user_id"])
    orders = (
        db.query(SmmOrder)
        .filter(
            SmmOrder.user_id == uid,
            SmmOrder.delivery_type == "api",
            SmmOrder.external_order_id.isnot(None),
            SmmOrder.api_provider_id.isnot(None),
            SmmOrder.status.in_(["pending", "processing", "in_progress"]),
        )
        .limit(100)
        .all()
    )
    if not orders:
        return {"ok": True, "checked": 0, "refunded": 0}

    from api.providers import get_provider
    import json as _json

    by_provider: dict[int, list] = {}
    for o in orders:
        by_provider.setdefault(o.api_provider_id, []).append(o)

    prev_status_map = {o.id: o.status for o in orders}
    checked = 0
    status_map = {
        "Completed": "completed", "Processing": "processing",
        "In progress": "in_progress", "Partial": "partial",
        "Canceled": "canceled", "Pending": "pending",
    }

    for pid, plist in by_provider.items():
        provider = db.query(ApiProvider).get(pid)
        if not provider:
            continue
        adapter = get_provider(provider)
        order_ids = [o.external_order_id for o in plist if o.external_order_id]
        used_batch = False
        if hasattr(adapter, "get_multiple_status") and len(order_ids) > 1:
            try:
                statuses = await adapter.get_multiple_status(order_ids)
                used_batch = True
                for o in plist:
                    data = statuses.get(o.external_order_id, {})
                    if isinstance(data, dict) and not data.get("error"):
                        raw = data.get("status", "")
                        if raw:
                            new_st = status_map.get(raw, raw.lower())
                            if new_st and new_st != "unknown":
                                o.status = new_st
                        for fld, key in (("start_count", "start_count"), ("remains", "remains")):
                            v = data.get(key)
                            if v not in (None, "", "null"):
                                try:
                                    setattr(o, fld, int(float(v)))
                                except Exception:
                                    pass
                        checked += 1
            except Exception as e:
                logger.warning(f"User batch status check failed for provider {pid}: {e}")
        if not used_batch:
            for o in plist:
                try:
                    result = await adapter.get_order_status(o.external_order_id)
                    if result.status and result.status != "unknown":
                        o.status = result.status
                    if result.delivery_data:
                        try:
                            dd = _json.loads(result.delivery_data) if isinstance(result.delivery_data, str) else result.delivery_data
                            for fld, key in (("start_count", "start_count"), ("remains", "remains")):
                                v = (dd or {}).get(key)
                                if v not in (None, "", "null"):
                                    try:
                                        setattr(o, fld, int(float(v)))
                                    except Exception:
                                        pass
                        except Exception:
                            pass
                    checked += 1
                except Exception as e:
                    logger.warning(f"User status check failed for order {o.id}: {e}")

    db.commit()

    # Refund on terminal (idempotent — gọi cho mọi đơn, helper tự skip nếu đã hoàn)
    refunded = 0
    try:
        for _pid, plist in by_provider.items():
            for o in plist:
                if _maybe_refund_on_terminal(db, o):
                    refunded += 1
        db.commit()
    except Exception as _e:
        logger.warning(f"User batch refund pass failed: {_e}")

    # Notify
    try:
        from api.order_notifications import notify_smm_order_event
        terminal = {"completed", "partial", "canceled", "cancelled", "failed"}
        for _pid, plist in by_provider.items():
            for o in plist:
                prev = prev_status_map.get(o.id)
                if o.status != prev and o.status in terminal:
                    event = "completed" if o.status in ("completed", "partial") else "failed"
                    try:
                        notify_smm_order_event(db, o, event=event, previous_status=prev)
                    except Exception:
                        pass
    except Exception:
        pass

    return {"ok": True, "checked": checked, "refunded": refunded}


@router.get("/orders/{oid}")
async def user_get_order(
    oid: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    o = db.query(SmmOrder).options(joinedload(SmmOrder.smm_service)).filter(
        SmmOrder.id == oid, SmmOrder.user_id == uid
    ).first()
    if not o:
        raise HTTPException(404, "Order not found")

    # Try to fetch live status from provider if API order
    if o.delivery_type == "api" and o.external_order_id and o.api_provider_id:
        try:
            provider = db.query(ApiProvider).get(o.api_provider_id)
            if provider:
                from api.providers import get_provider
                adapter = get_provider(provider)
                result = await adapter.get_order_status(o.external_order_id)
                prev_status = o.status
                # Chỉ cập nhật status nếu provider trả về trạng thái hợp lệ (tránh ghi đè bằng "unknown")
                if result.status and result.status != "unknown":
                    o.status = result.status
                # Parse start_count / remains — ưu tiên delivery_data JSON, fallback regex message
                import re, json as _json
                sc_val = rm_val = None
                if result.delivery_data:
                    try:
                        _dd = _json.loads(result.delivery_data) if isinstance(result.delivery_data, str) else result.delivery_data
                        sc_val = _dd.get("start_count")
                        rm_val = _dd.get("remains")
                    except Exception:
                        pass
                if sc_val is None or rm_val is None:
                    msg = result.message or ""
                    sc = re.search(r"start_count[:\s]*(\d+)", msg, re.I)
                    rm = re.search(r"remains[:\s]*(\d+)", msg, re.I)
                    if sc and sc_val is None: sc_val = sc.group(1)
                    if rm and rm_val is None: rm_val = rm.group(1)
                try:
                    if sc_val is not None and str(sc_val).strip() not in ("", "None", "null"):
                        o.start_count = int(float(sc_val))
                except Exception:
                    pass
                try:
                    if rm_val is not None and str(rm_val).strip() not in ("", "None", "null"):
                        o.remains = int(float(rm_val))
                except Exception:
                    pass
                # Refund nếu hiện đang canceled/cancelled/failed và chưa có marker
                # (idempotent — gọi cả khi status không đổi để bắt các đơn đã huỷ từ trước)
                refunded_now = _maybe_refund_on_terminal(db, o, prev_status)
                db.commit()
                # Notify on terminal transitions
                if o.status != prev_status and o.status in ("completed", "partial", "canceled", "cancelled", "failed"):
                    try:
                        from api.order_notifications import notify_smm_order_event
                        event = "completed" if o.status in ("completed", "partial") else "failed"
                        notify_smm_order_event(db, o, event=event, previous_status=prev_status)
                    except Exception:
                        pass
        except Exception as _e:
            logger.warning(f"SMM live status fetch failed for order {o.id}: {_e}")

    # Refund pass cuối — idempotent, chạy độc lập với adapter
    # Bắt cả trường hợp adapter exception hoặc đơn đã ở trạng thái terminal từ trước
    try:
        if _maybe_refund_on_terminal(db, o):
            db.commit()
            logger.info(f"[REFUND] Order #{o.id} (status={o.status}) refunded +{o.charge}")
    except Exception as _e:
        logger.warning(f"Refund pass failed for order {o.id}: {_e}")
        db.rollback()

    svc = o.smm_service
    return {
        "id": o.id, "order_code": o.order_code,
        "platform_name": o.platform_name,
        "category_name": o.category_name,
        "service_name": o.service_name,
        "link": o.link, "quantity": o.quantity, "charge": o.charge,
        "status": o.status, "delivery_type": o.delivery_type,
        "service_type": o.service_type or "Default",
        "external_order_id": o.external_order_id,
        "start_count": o.start_count,
        "remains": o.remains,
        "can_refill": svc.can_refill if svc else False,
        "refill_id": o.refill_id,
        "refill_status": o.refill_status,
        "service_description": svc.description if svc else None,
        "scheduled_at": o.scheduled_at.isoformat() if o.scheduled_at else None,
        "repeat_count": o.repeat_count or 0,
        "repeat_remaining": o.repeat_remaining or 0,
        "repeat_interval": o.repeat_interval or 0,
        "parent_order_id": o.parent_order_id,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


@router.post("/orders/{oid}/refill")
async def user_request_refill(
    oid: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    o = db.query(SmmOrder).filter(SmmOrder.id == oid, SmmOrder.user_id == uid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if o.status != "completed":
        raise HTTPException(400, "Chỉ có thể bảo hành đơn đã hoàn thành")
    if not (o.smm_service and o.smm_service.can_refill):
        raise HTTPException(400, "Dịch vụ này không hỗ trợ bảo hành")
    if o.refill_id:
        raise HTTPException(400, "Đơn này đã yêu cầu bảo hành rồi")

    if o.delivery_type == "api" and o.external_order_id and o.api_provider_id:
        provider = db.query(ApiProvider).get(o.api_provider_id)
        if provider:
            from api.providers import get_provider
            adapter = get_provider(provider)
            result = await adapter.create_refill(o.external_order_id)
            refill_id = str(result.get("refill", ""))
            if refill_id and refill_id != "0":
                o.refill_id = refill_id
                o.refill_status = "pending"
                db.commit()
                return {"ok": True, "refill_id": refill_id}
            else:
                raise HTTPException(400, f"Bảo hành thất bại: {result}")
    else:
        # Manual refill — mark as pending for admin
        o.refill_status = "pending"
        db.commit()
        return {"ok": True, "refill_status": "pending"}


@router.get("/orders/{oid}/refill-status")
async def user_refill_status(
    oid: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    o = db.query(SmmOrder).filter(SmmOrder.id == oid, SmmOrder.user_id == uid).first()
    if not o:
        raise HTTPException(404, "Order not found")
    if not o.refill_id and not o.refill_status:
        return {"refill_status": None}

    # If API and has refill_id, check with provider
    if o.delivery_type == "api" and o.refill_id and o.api_provider_id:
        provider = db.query(ApiProvider).get(o.api_provider_id)
        if provider:
            from api.providers import get_provider
            adapter = get_provider(provider)
            try:
                result = await adapter.get_refill_status(o.refill_id)
                o.refill_status = result.get("status", o.refill_status)
                db.commit()
            except Exception as e:
                logger.error(f"Refill status check failed: {e}")

    return {"refill_id": o.refill_id, "refill_status": o.refill_status}


@router.get("/warranty")
async def user_warranty_list(
    status: str = Query("", description="filter refill status"),
    search: str = Query("", description="search keyword"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List warranty/refill requests for the current user (view-only)."""
    uid = int(current_user["user_id"])
    q = db.query(SmmOrder).filter(
        SmmOrder.user_id == uid,
        SmmOrder.refill_status.isnot(None),
    )
    if status:
        q = q.filter(SmmOrder.refill_status == status)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            (SmmOrder.order_code.ilike(s))
            | (SmmOrder.refill_id.ilike(s))
            | (SmmOrder.service_name.ilike(s))
            | (SmmOrder.link.ilike(s))
        )
    total = q.count()
    rows = (
        q.order_by(SmmOrder.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    items = []
    for o in rows:
        items.append(
            {
                "id": o.id,
                "warranty_code": o.refill_id or f"BH{o.id:06d}",
                "order_code": o.order_code,
                "order_id": o.id,
                "service_name": o.service_name,
                "refill_status": o.refill_status,
                "created_at": (o.updated_at or o.created_at).isoformat()
                if (o.updated_at or o.created_at)
                else None,
            }
        )
    return {"items": items, "total": total, "page": page, "limit": limit}
