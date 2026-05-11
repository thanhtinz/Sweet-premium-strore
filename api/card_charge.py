"""Card charge (nạp thẻ cào) — submit scratch card → credit balance.

Endpoints:
  POST /card-charge/submit         — user submits a card
  POST /card-charge/callback       — provider callback (no auth)
  GET  /card-charge/history        — user's card charge history
  GET  /card-charge/rates          — current discount rates per telco/denomination
  GET  /card-charge/{id}/status    — check single transaction
  GET  /card-charge/admin/history  — admin view all
"""

import logging
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_admin, get_current_user
from api.balance_shared import _get_client_ip
from api.providers import get_provider
from db import get_db
from db.models import ApiProvider, BalanceTransaction, CardChargeTransaction, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/card-charge", tags=["card-charge"])


# ── Pydantic ──────────────────────────────────────────

class CardSubmitRequest(BaseModel):
    telco: str
    code: str
    serial: str
    amount: int  # declared denomination


# ── Helpers ───────────────────────────────────────────

def _get_active_giftcard_provider(db: Session) -> ApiProvider:
    """Get the first active giftcard provider."""
    p = db.query(ApiProvider).filter(
        ApiProvider.provider_type == "giftcard",
        ApiProvider.is_active == True,
    ).first()
    if not p:
        raise HTTPException(503, "Hệ thống nạp thẻ cào chưa được cấu hình")
    return p


def _get_discount_rate(provider: ApiProvider, telco: str, amount: int) -> float:
    """Look up discount rate from provider.card_rates.

    New format: { "exchange_enabled": true, "discount_rate": 20 }
    Legacy flat: { "VIETTEL": 20, ... }
    Legacy nested: { "VIETTEL": {"10000": 20, ...}, ... }
    Returns % as float (e.g. 20.0 means 20%).
    """
    rates = provider.card_rates or {}
    # New single-rate format
    if "discount_rate" in rates:
        return float(rates["discount_rate"])
    # Legacy per-telco
    telco_rates = rates.get(telco.upper(), rates.get("DEFAULT", 0))
    if isinstance(telco_rates, dict):
        return float(telco_rates.get(str(amount), telco_rates.get("DEFAULT", 0)))
    return float(telco_rates)


def _txn_to_dict(t: CardChargeTransaction) -> dict:
    return {
        "id": t.id,
        "telco": t.telco,
        "serial": t.serial[-4:].rjust(len(t.serial), "*") if t.serial else "",
        "declared_amount": float(t.declared_amount),
        "real_value": float(t.real_value) if t.real_value else None,
        "discount_rate": float(t.discount_rate),
        "credited_amount": float(t.credited_amount) if t.credited_amount else None,
        "status": t.status,
        "request_id": t.request_id,
        "trans_id": t.trans_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ── Submit card ───────────────────────────────────────

@router.post("/submit")
async def submit_card(
    data: CardSubmitRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])

    # Validate
    if not data.code.strip() or not data.serial.strip():
        raise HTTPException(400, "Mã thẻ và serial không được để trống")
    if data.amount <= 0:
        raise HTTPException(400, "Mệnh giá không hợp lệ")

    provider = _get_active_giftcard_provider(db)

    # Check exchange enabled
    rates = provider.card_rates or {}
    if not rates.get("exchange_enabled", False):
        raise HTTPException(400, "Chức năng đổi thẻ chưa được bật")

    discount_rate = _get_discount_rate(provider, data.telco, data.amount)
    request_id = uuid.uuid4().hex[:16]

    # Create transaction record
    txn = CardChargeTransaction(
        user_id=user_id,
        telco=data.telco.upper().strip(),
        code=data.code.strip(),
        serial=data.serial.strip(),
        declared_amount=Decimal(data.amount),
        discount_rate=Decimal(str(discount_rate)),
        request_id=request_id,
        api_provider_id=provider.id,
        status="pending",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # Call provider
    try:
        adapter = get_provider(provider)
        result = await adapter.charge_card(
            telco=txn.telco,
            code=data.code.strip(),
            serial=data.serial.strip(),
            amount=data.amount,
            request_id=request_id,
        )
        # Provider may return immediate result or async via callback
        status_code = result.get("status", 99)
        txn.trans_id = str(result.get("trans_id", ""))

        if status_code == 1:
            # Immediate success — correct denomination
            _credit_card(db, txn, real_value=data.amount, status="success")
        elif status_code == 2:
            # Wrong denomination — lose everything
            txn.real_value = Decimal(str(result.get("value", 0)))
            txn.credited_amount = Decimal(0)
            txn.status = "wrong_amount"
            db.commit()
        elif status_code == 3:
            txn.status = "failed"
            txn.credited_amount = Decimal(0)
            db.commit()
        elif status_code == 4:
            txn.status = "maintenance"
            db.commit()
        elif status_code == 100:
            txn.status = "failed"
            txn.credited_amount = Decimal(0)
            db.commit()
        # status 99 = pending, wait for callback
        else:
            db.commit()

    except Exception as e:
        logger.error(f"Card charge submit error: {e}")
        txn.status = "failed"
        txn.credited_amount = Decimal(0)
        db.commit()

    return _txn_to_dict(txn)


def _credit_card(db: Session, txn: CardChargeTransaction, real_value: int, status: str = "success"):
    """Credit user balance from a successful card charge."""
    txn.real_value = Decimal(str(real_value))
    credited = Decimal(str(real_value)) * (1 - txn.discount_rate / 100)
    txn.credited_amount = credited
    txn.status = status

    if credited > 0:
        user = db.query(User).filter(User.id == txn.user_id).with_for_update().first()
        if user:
            user.balance = Decimal(user.balance or 0) + credited
            bal_txn = BalanceTransaction(
                user_id=txn.user_id,
                amount=credited,
                balance_after=user.balance,
                type="card_charge",
                status="completed",
                reference=f"card:{txn.request_id}",
                description=f"Nạp thẻ {txn.telco} {int(txn.declared_amount):,}đ → {int(credited):,}đ",
                ip_address=txn.ip_address,
            )
            db.add(bal_txn)
            db.flush()
            txn.balance_transaction_id = bal_txn.id

    db.commit()


# ── Callback (no auth — called by provider) ──────────

@router.post("/callback")
async def card_callback(request: Request, db: Session = Depends(get_db)):
    """Provider callback after card processing.

    Expected fields: status, request_id, declared_value, value, amount,
                     code, serial, telco, trans_id, sign, message, ...
    """
    try:
        body = await request.json()
    except Exception:
        # Some providers send form data
        form = await request.form()
        body = dict(form)

    logger.info(f"Card charge callback: request_id={body.get('request_id')}, status={body.get('status')}")

    req_id = str(body.get("request_id", ""))
    if not req_id:
        return {"status": "error", "message": "missing request_id"}

    txn = db.query(CardChargeTransaction).filter(
        CardChargeTransaction.request_id == req_id
    ).first()
    if not txn:
        logger.warning(f"Card callback: unknown request_id {req_id}")
        return {"status": "error", "message": "unknown request_id"}

    # Already processed
    if txn.status not in ("pending",):
        return {"status": "ok", "message": "already processed"}

    # Verify signature — MANDATORY
    provider = db.query(ApiProvider).filter(ApiProvider.id == txn.api_provider_id).first()
    if not provider:
        logger.warning(f"Card callback: provider not found for txn {req_id}")
        return {"status": "error", "message": "provider not found"}

    adapter = get_provider(provider)
    received_sign = str(body.get("sign", body.get("callback_sign", "")))
    code = str(body.get("code", ""))
    serial = str(body.get("serial", ""))
    if not received_sign or not adapter.verify_callback_sign(code, serial, received_sign):
        logger.warning(f"Card callback: invalid or missing sign for {req_id}")
        return {"status": "error", "message": "invalid sign"}

    # Store raw callback
    txn.callback_data = body
    txn.trans_id = str(body.get("trans_id", txn.trans_id or ""))

    status_code = int(body.get("status", 0))
    real_value = int(body.get("value", body.get("amount", 0)))

    if status_code == 1:
        _credit_card(db, txn, real_value=real_value, status="success")
    elif status_code == 2:
        # Wrong denomination — mất thẻ, không nhận gì
        txn.real_value = Decimal(str(real_value))
        txn.credited_amount = Decimal(0)
        txn.status = "wrong_amount"
        db.commit()
    elif status_code == 3:
        txn.status = "failed"
        txn.credited_amount = Decimal(0)
        db.commit()
    elif status_code == 4:
        txn.status = "maintenance"
        db.commit()
    else:
        txn.status = "failed"
        txn.credited_amount = Decimal(0)
        db.commit()

    return {"status": "ok"}


# ── User history ──────────────────────────────────────

@router.get("/history")
def card_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])
    q = db.query(CardChargeTransaction).filter(CardChargeTransaction.user_id == user_id)
    total = q.count()
    items = q.order_by(CardChargeTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_txn_to_dict(t) for t in items]}


# ── Single status ─────────────────────────────────────

@router.get("/{txn_id}/status")
def card_status(
    txn_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["user_id"])
    txn = db.query(CardChargeTransaction).filter(
        CardChargeTransaction.id == txn_id,
        CardChargeTransaction.user_id == user_id,
    ).first()
    if not txn:
        raise HTTPException(404, "Không tìm thấy giao dịch")
    return _txn_to_dict(txn)


# ── Rates (public) ────────────────────────────────────

@router.get("/rates")
def card_rates(db: Session = Depends(get_db)):
    """Return current card charge discount rates + available telcos."""
    provider = db.query(ApiProvider).filter(
        ApiProvider.provider_type == "giftcard",
        ApiProvider.is_active == True,
    ).first()
    if not provider:
        return {"available": False, "exchange_enabled": False, "telcos": [], "rates": {}, "amounts": []}

    rates = provider.card_rates or {}
    exchange_enabled = rates.get("exchange_enabled", False)

    if not exchange_enabled:
        return {"available": True, "exchange_enabled": False, "telcos": [], "rates": {}, "amounts": []}

    from api.providers.giftcard import DEFAULT_TELCOS, DEFAULT_AMOUNTS
    return {
        "available": True,
        "exchange_enabled": True,
        "telcos": DEFAULT_TELCOS,
        "amounts": DEFAULT_AMOUNTS,
        "discount_rate": rates.get("discount_rate", 0),
        "rates": rates,
    }


# ── Admin history ─────────────────────────────────────

@router.get("/admin/history")
def admin_card_history(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = db.query(CardChargeTransaction)
    if status:
        q = q.filter(CardChargeTransaction.status == status)
    total = q.count()
    items = q.order_by(CardChargeTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    user_ids = {t.user_id for t in items}
    users = {u.id: u.email for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    def _admin_dict(t):
        d = _txn_to_dict(t)
        d["user_email"] = users.get(t.user_id, "")
        d["code"] = t.code  # admin sees full code
        d["serial"] = t.serial  # admin sees full serial
        d["callback_data"] = t.callback_data
        d["ip_address"] = t.ip_address
        return d

    return {"total": total, "items": [_admin_dict(t) for t in items]}
