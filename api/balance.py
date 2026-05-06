"""
Balance / Wallet System
- Topup via PayOS
- Pay with balance (called from orders)
- Affiliate withdraw to balance
- Admin adjust
- Anti-cheat: row-level locking, IP logging, audit trail
"""

import json
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from db import get_db
from db.models import User, BalanceTransaction, AffiliateUser
from api.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/balance", tags=["balance"])

# ── Constants ──
MIN_TOPUP = 10_000
MAX_TOPUP = 10_000_000
TOPUP_STEP = 1_000

# ── Helpers ──

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _txn_to_dict(t: BalanceTransaction) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "amount": float(t.amount),
        "balance_after": float(t.balance_after),
        "type": t.type,
        "status": t.status,
        "reference": t.reference,
        "description": t.description,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── User endpoints ──

@router.get("")
def get_balance(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == int(current_user["user_id"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    return {"balance": float(user.balance or 0)}


@router.get("/history")
def get_balance_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])
    q = db.query(BalanceTransaction).filter(
        BalanceTransaction.user_id == uid,
        BalanceTransaction.status == "completed",
    )
    total = q.count()
    items = q.order_by(BalanceTransaction.created_at.desc()) \
             .offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "items": [_txn_to_dict(t) for t in items],
    }


# ── Topup via PayOS ──

class TopupRequest(BaseModel):
    amount: int


@router.post("/topup")
def create_topup(
    data: TopupRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate amount
    if data.amount < MIN_TOPUP or data.amount > MAX_TOPUP:
        raise HTTPException(400, f"Số tiền nạp phải từ {MIN_TOPUP:,}đ đến {MAX_TOPUP:,}đ")
    if data.amount % TOPUP_STEP != 0:
        raise HTTPException(400, f"Số tiền phải là bội số của {TOPUP_STEP:,}đ")

    uid = int(current_user["user_id"])
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(404, "User not found")

    # Create pending transaction
    txn = BalanceTransaction(
        user_id=uid,
        amount=Decimal(data.amount),
        balance_after=Decimal(user.balance or 0),  # will be updated on completion
        type="topup",
        status="pending",
        description=f"Nạp {data.amount:,}đ qua PayOS",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.flush()  # get txn.id

    # Create PayOS payment link
    try:
        from api.payment import get_payos_client, _get_payos_config
        from payos import PaymentData, ItemData

        _, _, _, base_url = _get_payos_config(db)
        payos = get_payos_client(db)

        item = ItemData(name="Nạp số dư tài khoản", quantity=1, price=data.amount)
        payment_data = PaymentData(
            orderCode=int(txn.id) + 900000,  # offset to avoid collision with order IDs
            amount=data.amount,
            description=f"Nap {data.amount}"[:25],
            items=[item],
            returnUrl=f"{base_url}/#/profile?topup=success",
            cancelUrl=f"{base_url}/#/profile?topup=cancelled",
            buyerEmail=current_user.get("email", ""),
        )
        result = payos.createPaymentLink(paymentData=payment_data)
        txn.reference = str(int(txn.id) + 900000)
        db.commit()

        return {
            "payment_url": result.checkoutUrl,
            "transaction_id": txn.id,
            "qr_code": getattr(result, "qrCode", None),
        }
    except Exception as e:
        txn.status = "failed"
        db.commit()
        raise HTTPException(500, f"PayOS error: {str(e)}")


@router.post("/webhook")
async def balance_webhook(request: Request, db: Session = Depends(get_db)):
    """PayOS webhook for topup transactions."""
    body = await request.body()
    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    # Verify signature — FAIL CLOSED: reject if checksum key is not configured
    from api.payment import get_payos_client, _get_payos_config
    _, _, checksum_key, _ = _get_payos_config(db)
    if not checksum_key:
        raise HTTPException(403, "Webhook signature verification not configured")
    try:
        payos = get_payos_client(db)
        payos.verifyPaymentWebhookData(payload)
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")

    data = payload.get("data", {})
    order_code = data.get("orderCode")
    status = data.get("status", "")

    if not order_code:
        return {"ok": True}

    # Map back to transaction ID — validate type safely
    try:
        txn_id = int(order_code) - 900000
    except (ValueError, TypeError):
        return {"ok": True}  # Not a topup order code
    if txn_id <= 0:
        return {"ok": True}  # Not a topup transaction

    if status == "PAID":
        # Row-level lock user to prevent race conditions
        txn = db.query(BalanceTransaction).filter(
            BalanceTransaction.id == txn_id,
            BalanceTransaction.type == "topup",
            BalanceTransaction.status == "pending",
        ).first()
        if not txn:
            return {"ok": True}  # Already processed or not found

        user = db.query(User).filter(User.id == txn.user_id).with_for_update().first()
        if not user:
            return {"ok": True}

        # Credit balance
        user.balance = Decimal(user.balance or 0) + txn.amount
        txn.balance_after = user.balance
        txn.status = "completed"
        db.commit()

    elif status in ("CANCELLED", "EXPIRED"):
        txn = db.query(BalanceTransaction).filter(
            BalanceTransaction.id == txn_id,
            BalanceTransaction.status == "pending",
        ).first()
        if txn:
            txn.status = "failed"
            db.commit()

    return {"ok": True}


# ── Pay with balance (called internally from orders) ──

def deduct_balance(db: Session, user_id: int, amount: Decimal, order_code: str, ip: str = "") -> bool:
    """
    Deduct balance atomically with row-level lock.
    Returns True if successful, raises HTTPException if insufficient.
    """
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(404, "User not found")

    current = Decimal(user.balance or 0)
    if current < amount:
        raise HTTPException(400, f"Số dư không đủ. Hiện có: {float(current):,.0f}đ, cần: {float(amount):,.0f}đ")

    user.balance = current - amount
    txn = BalanceTransaction(
        user_id=user_id,
        amount=-amount,
        balance_after=user.balance,
        type="purchase",
        status="completed",
        reference=order_code,
        description=f"Thanh toán đơn {order_code}",
        ip_address=ip,
    )
    db.add(txn)
    return True


# ── Affiliate withdraw to balance ──

class WithdrawRequest(BaseModel):
    amount: Optional[int] = None  # None = withdraw all available


@router.post("/affiliate-withdraw")
def affiliate_withdraw(
    data: WithdrawRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = int(current_user["user_id"])

    # Lock BOTH affiliate and user rows to prevent race conditions
    aff = db.query(AffiliateUser).filter(
        AffiliateUser.user_id == str(uid)
    ).with_for_update().first()
    if not aff:
        raise HTTPException(404, "Bạn chưa tham gia chương trình giới thiệu")

    # Check for existing pending withdrawal
    existing_pending = db.query(BalanceTransaction).filter(
        BalanceTransaction.user_id == uid,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if existing_pending:
        raise HTTPException(400, "Bạn đã có yêu cầu rút đang chờ duyệt")

    # Recompute available AFTER acquiring lock
    available = float(aff.total_earnings or 0) - float(aff.total_paid or 0)
    if available <= 0:
        raise HTTPException(400, "Không có hoa hồng để rút")

    withdraw_amount = data.amount if data.amount and data.amount <= available else int(available)
    if withdraw_amount < 1000:
        raise HTTPException(400, "Số tiền rút tối thiểu 1,000đ")

    # Create PENDING transaction — admin must approve
    txn = BalanceTransaction(
        user_id=uid,
        amount=Decimal(withdraw_amount),
        balance_after=Decimal(0),  # will be set on approval
        type="affiliate_withdraw",
        status="pending",
        reference=f"affiliate:{aff.id}",
        description=f"Rút hoa hồng giới thiệu {withdraw_amount:,}đ",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.commit()

    return {
        "success": True,
        "amount": withdraw_amount,
        "status": "pending",
        "message": "Yêu cầu rút hoa hồng đã được gửi, vui lòng chờ admin duyệt.",
    }


# ── Admin endpoints ──

@router.get("/admin/withdrawals", dependencies=[Depends(get_current_admin)])
def admin_list_withdrawals(
    status: str = Query("pending"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(BalanceTransaction).filter(
        BalanceTransaction.type == "affiliate_withdraw",
    )
    if status != "all":
        q = q.filter(BalanceTransaction.status == status)
    total = q.count()
    items = q.order_by(BalanceTransaction.created_at.desc()) \
             .offset((page - 1) * limit).limit(limit).all()
    user_ids = {t.user_id for t in items}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {
        "total": total,
        "items": [{
            **_txn_to_dict(t),
            "user_email": users[t.user_id].email if t.user_id in users else "",
            "user_name": users[t.user_id].display_name if t.user_id in users else "",
        } for t in items],
    }


@router.post("/admin/withdrawals/{txn_id}/approve")
def admin_approve_withdrawal(
    txn_id: int,
    request: Request,
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    txn = db.query(BalanceTransaction).filter(
        BalanceTransaction.id == txn_id,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if not txn:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã được xử lý")

    # Lock affiliate and user rows
    aff = db.query(AffiliateUser).filter(
        AffiliateUser.user_id == str(txn.user_id)
    ).with_for_update().first()

    user = db.query(User).filter(User.id == txn.user_id).with_for_update().first()
    if not user:
        raise HTTPException(404, "User not found")

    # Verify affiliate still has enough earnings
    if aff:
        available = float(aff.total_earnings or 0) - float(aff.total_paid or 0)
        if available < float(txn.amount):
            raise HTTPException(400, f"Hoa hồng khả dụng ({available:,.0f}đ) không đủ cho yêu cầu ({float(txn.amount):,.0f}đ)")
        aff.total_paid = Decimal(aff.total_paid or 0) + txn.amount

    # Credit balance
    user.balance = Decimal(user.balance or 0) + txn.amount
    txn.balance_after = user.balance
    txn.status = "completed"
    txn.description = (txn.description or "") + f" [Duyệt bởi admin:{current_user['user_id']}]"

    db.commit()
    return {"success": True, "new_balance": float(user.balance)}


@router.post("/admin/withdrawals/{txn_id}/reject")
def admin_reject_withdrawal(
    txn_id: int,
    request: Request,
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    txn = db.query(BalanceTransaction).filter(
        BalanceTransaction.id == txn_id,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if not txn:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã được xử lý")

    txn.status = "failed"
    txn.description = (txn.description or "") + f" [Từ chối bởi admin:{current_user['user_id']}]"
    db.commit()
    return {"success": True}


@router.get("/admin/users", dependencies=[Depends(get_current_admin)])
def admin_list_users_balance(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(User).filter(User.is_active == True)
    total = q.count()
    users = q.order_by(User.balance.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "items": [{
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "balance": float(u.balance or 0),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        } for u in users],
    }


class AdminAdjustRequest(BaseModel):
    user_id: int
    amount: int  # positive = add, negative = deduct
    description: str = ""


@router.post("/admin/adjust", dependencies=[Depends(get_current_admin)])
def admin_adjust_balance(
    data: AdminAdjustRequest,
    request: Request,
    current_user: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if data.amount == 0:
        raise HTTPException(400, "Số tiền phải khác 0")

    user = db.query(User).filter(User.id == data.user_id).with_for_update().first()
    if not user:
        raise HTTPException(404, "User not found")

    new_balance = Decimal(user.balance or 0) + Decimal(data.amount)
    if new_balance < 0:
        raise HTTPException(400, "Số dư không thể âm")

    user.balance = new_balance
    txn = BalanceTransaction(
        user_id=data.user_id,
        amount=Decimal(data.amount),
        balance_after=new_balance,
        type="admin_adjust",
        status="completed",
        reference=f"admin:{current_user['user_id']}",
        description=data.description or f"Admin điều chỉnh {'+'if data.amount>0 else ''}{data.amount:,}đ",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.commit()

    return {
        "success": True,
        "user_id": data.user_id,
        "new_balance": float(new_balance),
    }


@router.get("/admin/transactions", dependencies=[Depends(get_current_admin)])
def admin_list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(BalanceTransaction).filter(BalanceTransaction.status == "completed")
    if type:
        q = q.filter(BalanceTransaction.type == type)
    total = q.count()
    items = q.order_by(BalanceTransaction.created_at.desc()) \
             .offset((page - 1) * limit).limit(limit).all()
    # Join user email
    user_ids = {t.user_id for t in items}
    users = {u.id: u.email for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {
        "total": total,
        "items": [{**_txn_to_dict(t), "user_email": users.get(t.user_id, "")} for t in items],
    }


@router.get("/admin/audit", dependencies=[Depends(get_current_admin)])
def admin_audit(db: Session = Depends(get_db)):
    """Verify balance integrity: sum of completed transactions should equal user balance."""
    from sqlalchemy import func
    results = db.query(
        BalanceTransaction.user_id,
        func.sum(BalanceTransaction.amount).label("txn_sum"),
    ).filter(
        BalanceTransaction.status == "completed"
    ).group_by(BalanceTransaction.user_id).all()

    mismatches = []
    for r in results:
        user = db.query(User).filter(User.id == r.user_id).first()
        if user and abs(float(user.balance or 0) - float(r.txn_sum or 0)) > 0.01:
            mismatches.append({
                "user_id": r.user_id,
                "email": user.email,
                "balance": float(user.balance or 0),
                "txn_sum": float(r.txn_sum or 0),
                "diff": float(user.balance or 0) - float(r.txn_sum or 0),
            })

    return {
        "ok": len(mismatches) == 0,
        "checked": len(results),
        "mismatches": mismatches,
    }
