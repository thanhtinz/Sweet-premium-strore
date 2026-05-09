"""
Balance / Wallet System
- Topup via PayOS
- Pay with balance (called from orders)
- Affiliate withdraw to balance
- Admin adjust
- Anti-cheat: row-level locking, IP logging, audit trail
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from api.auth import get_current_admin, get_current_user
from api.balance_service import (
    approve_withdrawal,
    create_affiliate_withdraw_request,
    create_topup_payment_link,
    create_topup_transaction,
    deduct_balance,
    process_balance_webhook,
    reject_withdrawal,
)
from api.balance_shared import (
    MAX_TOPUP,
    MIN_TOPUP,
    TOPUP_STEP,
    AdminAdjustRequest,
    TopupRequest,
    WithdrawRequest,
    _get_client_ip,
    _txn_to_dict,
)
from db import get_db
from db.models import BalanceTransaction, User

router = APIRouter(prefix="/balance", tags=["balance"])


@router.get("")
def get_balance(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
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
    items = q.order_by(BalanceTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "items": [_txn_to_dict(t) for t in items]}


@router.post("/topup")
def create_topup(data: TopupRequest, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.amount < MIN_TOPUP or data.amount > MAX_TOPUP:
        raise HTTPException(400, f"Số tiền nạp phải từ {MIN_TOPUP:,}đ đến {MAX_TOPUP:,}đ")
    if data.amount % TOPUP_STEP != 0:
        raise HTTPException(400, f"Số tiền phải là bội số của {TOPUP_STEP:,}đ")
    uid = int(current_user["user_id"])
    txn = create_topup_transaction(db, uid, data.amount, request)
    try:
        result = create_topup_payment_link(db, txn, data.amount, current_user.get("email", ""))
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
    body = await request.body()
    return process_balance_webhook(db, body)


@router.post("/affiliate-withdraw")
def affiliate_withdraw(data: WithdrawRequest, request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = int(current_user["user_id"])
    _txn, withdraw_amount = create_affiliate_withdraw_request(db, uid, data.amount, request)
    return {
        "success": True,
        "amount": withdraw_amount,
        "status": "pending",
        "message": "Yêu cầu rút hoa hồng đã được gửi, vui lòng chờ admin duyệt.",
    }


@router.get("/admin/withdrawals", dependencies=[Depends(get_current_admin)])
def admin_list_withdrawals(status: str = Query("pending"), page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    q = db.query(BalanceTransaction).filter(BalanceTransaction.type == "affiliate_withdraw")
    if status != "all":
        q = q.filter(BalanceTransaction.status == status)
    total = q.count()
    items = q.order_by(BalanceTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
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
def admin_approve_withdrawal(txn_id: int, request: Request, current_user: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = approve_withdrawal(db, txn_id, current_user["user_id"])
    return {"success": True, "new_balance": float(user.balance)}


@router.post("/admin/withdrawals/{txn_id}/reject")
def admin_reject_withdrawal(txn_id: int, request: Request, current_user: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    reject_withdrawal(db, txn_id, current_user["user_id"])
    return {"success": True}


@router.get("/admin/users", dependencies=[Depends(get_current_admin)])
def admin_list_users_balance(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
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


@router.post("/admin/adjust", dependencies=[Depends(get_current_admin)])
def admin_adjust_balance(data: AdminAdjustRequest, request: Request, current_user: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
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
        description=data.description or f"Admin điều chỉnh {'+' if data.amount > 0 else ''}{data.amount:,}đ",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.commit()
    return {"success": True, "user_id": data.user_id, "new_balance": float(new_balance)}


@router.get("/admin/transactions", dependencies=[Depends(get_current_admin)])
def admin_list_transactions(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(BalanceTransaction).filter(BalanceTransaction.status == "completed")
    if type:
        q = q.filter(BalanceTransaction.type == type)
    total = q.count()
    items = q.order_by(BalanceTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    user_ids = {t.user_id for t in items}
    users = {u.id: u.email for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {"total": total, "items": [{**_txn_to_dict(t), "user_email": users.get(t.user_id, "")} for t in items]}


@router.get("/admin/audit", dependencies=[Depends(get_current_admin)])
def admin_audit(db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        BalanceTransaction.user_id,
        func.sum(BalanceTransaction.amount).label("txn_sum"),
    ).filter(BalanceTransaction.status == "completed").group_by(BalanceTransaction.user_id).all()
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
    return {"ok": len(mismatches) == 0, "checked": len(results), "mismatches": mismatches}


__all__ = ["router", "deduct_balance"]
