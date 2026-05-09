import json
from decimal import Decimal

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from api.balance_shared import _get_client_ip
from db.models import AffiliateUser, BalanceTransaction, User


def create_topup_transaction(db: Session, user_id: int, amount: int, request: Request) -> BalanceTransaction:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    txn = BalanceTransaction(
        user_id=user_id,
        amount=Decimal(amount),
        balance_after=Decimal(user.balance or 0),
        type="topup",
        status="pending",
        description=f"Nạp {amount:,}đ qua PayOS",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.flush()
    return txn


def create_topup_payment_link(db: Session, txn: BalanceTransaction, amount: int, email: str):
    from api.payment import get_payos_client, _get_payos_config
    from payos import ItemData, PaymentData

    _, _, _, base_url = _get_payos_config(db)
    payos = get_payos_client(db)
    item = ItemData(name="Nạp số dư tài khoản", quantity=1, price=amount)
    payment_data = PaymentData(
        orderCode=int(txn.id) + 900000,
        amount=amount,
        description=f"Nap {amount}"[:25],
        items=[item],
        returnUrl=f"{base_url}/#/profile?topup=success",
        cancelUrl=f"{base_url}/#/profile?topup=cancelled",
        buyerEmail=email,
    )
    result = payos.createPaymentLink(paymentData=payment_data)
    txn.reference = str(int(txn.id) + 900000)
    return result


def process_balance_webhook(db: Session, raw_body: bytes):
    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(400, "Invalid JSON")

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
    try:
        txn_id = int(order_code) - 900000
    except (ValueError, TypeError):
        return {"ok": True}
    if txn_id <= 0:
        return {"ok": True}

    if status == "PAID":
        txn = db.query(BalanceTransaction).filter(
            BalanceTransaction.id == txn_id,
            BalanceTransaction.type == "topup",
            BalanceTransaction.status == "pending",
        ).first()
        if not txn:
            return {"ok": True}
        user = db.query(User).filter(User.id == txn.user_id).with_for_update().first()
        if not user:
            return {"ok": True}
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


def deduct_balance(db: Session, user_id: int, amount: Decimal, order_code: str, ip: str = "") -> bool:
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


def create_affiliate_withdraw_request(db: Session, user_id: int, amount: int | None, request: Request):
    aff = db.query(AffiliateUser).filter(AffiliateUser.user_id == str(user_id)).with_for_update().first()
    if not aff:
        raise HTTPException(404, "Bạn chưa tham gia chương trình giới thiệu")
    existing_pending = db.query(BalanceTransaction).filter(
        BalanceTransaction.user_id == user_id,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if existing_pending:
        raise HTTPException(400, "Bạn đã có yêu cầu rút đang chờ duyệt")
    available = float(aff.total_earnings or 0) - float(aff.total_paid or 0)
    if available <= 0:
        raise HTTPException(400, "Không có hoa hồng để rút")
    withdraw_amount = amount if amount and amount <= available else int(available)
    if withdraw_amount < 1000:
        raise HTTPException(400, "Số tiền rút tối thiểu 1,000đ")
    txn = BalanceTransaction(
        user_id=user_id,
        amount=Decimal(withdraw_amount),
        balance_after=Decimal(0),
        type="affiliate_withdraw",
        status="pending",
        reference=f"affiliate:{aff.id}",
        description=f"Rút hoa hồng giới thiệu {withdraw_amount:,}đ",
        ip_address=_get_client_ip(request),
    )
    db.add(txn)
    db.commit()
    return txn, withdraw_amount


def approve_withdrawal(db: Session, txn_id: int, admin_user_id: str):
    txn = db.query(BalanceTransaction).filter(
        BalanceTransaction.id == txn_id,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if not txn:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã được xử lý")
    aff = db.query(AffiliateUser).filter(AffiliateUser.user_id == str(txn.user_id)).with_for_update().first()
    user = db.query(User).filter(User.id == txn.user_id).with_for_update().first()
    if not user:
        raise HTTPException(404, "User not found")
    if aff:
        available = float(aff.total_earnings or 0) - float(aff.total_paid or 0)
        if available < float(txn.amount):
            raise HTTPException(400, f"Hoa hồng khả dụng ({available:,.0f}đ) không đủ cho yêu cầu ({float(txn.amount):,.0f}đ)")
        aff.total_paid = Decimal(aff.total_paid or 0) + txn.amount
    user.balance = Decimal(user.balance or 0) + txn.amount
    txn.balance_after = user.balance
    txn.status = "completed"
    txn.description = (txn.description or "") + f" [Duyệt bởi admin:{admin_user_id}]"
    db.commit()
    return user


def reject_withdrawal(db: Session, txn_id: int, admin_user_id: str):
    txn = db.query(BalanceTransaction).filter(
        BalanceTransaction.id == txn_id,
        BalanceTransaction.type == "affiliate_withdraw",
        BalanceTransaction.status == "pending",
    ).first()
    if not txn:
        raise HTTPException(404, "Yêu cầu không tồn tại hoặc đã được xử lý")
    txn.status = "failed"
    txn.description = (txn.description or "") + f" [Từ chối bởi admin:{admin_user_id}]"
    db.commit()
    return txn
