import os
import hmac
import hashlib
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from db import get_db
from db.models import Order
from api.auth import get_current_user
from api.orders import auto_deliver

router = APIRouter(prefix="/payment", tags=["payment"])

PAYOS_CLIENT_ID = os.environ.get("PAYOS_CLIENT_ID", "")
PAYOS_API_KEY = os.environ.get("PAYOS_API_KEY", "")
PAYOS_CHECKSUM_KEY = os.environ.get("PAYOS_CHECKSUM_KEY", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3001")


def _get_payos_config(db: Session = None):
    """Get PayOS config from env vars first, fallback to DB."""
    client_id = PAYOS_CLIENT_ID
    api_key = PAYOS_API_KEY
    checksum_key = PAYOS_CHECKSUM_KEY
    base_url = APP_BASE_URL
    if db and (not client_id or not api_key or not checksum_key):
        from db.models import SiteSetting
        settings = db.query(SiteSetting).filter(
            SiteSetting.key.in_(["payos_client_id", "payos_api_key", "payos_checksum_key", "app_base_url"])
        ).all()
        cfg = {s.key: s.value for s in settings}
        client_id = client_id or cfg.get("payos_client_id", "")
        api_key = api_key or cfg.get("payos_api_key", "")
        checksum_key = checksum_key or cfg.get("payos_checksum_key", "")
        base_url = cfg.get("app_base_url") or base_url
    return client_id, api_key, checksum_key, base_url


def get_payos_client(db: Session = None):
    from payos import PayOS
    client_id, api_key, checksum_key, _ = _get_payos_config(db)
    return PayOS(
        client_id=client_id,
        api_key=api_key,
        checksum_key=checksum_key,
    )


class CreatePaymentRequest(BaseModel):
    order_code: str


@router.post("/create-link")
def create_payment_link(
    data: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    client_id, api_key, checksum_key, base_url = _get_payos_config(db)
    if not client_id:
        raise HTTPException(status_code=503, detail="Payment not configured")

    order = db.query(Order).filter(
        Order.order_code == data.order_code,
        Order.user_id == current_user["user_id"],
        Order.status == "pending"
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        from payos import PaymentData, ItemData
        payos = get_payos_client(db)

        pkg_name = order.package.name if order.package else "Sản phẩm số"
        product_name = ""
        if order.package and order.package.product:
            product_name = order.package.product.name

        item = ItemData(
            name=f"{product_name} - {pkg_name}"[:50],
            quantity=order.quantity,
            price=int(order.total_amount),
        )

        payment_data = PaymentData(
            orderCode=int(order.id),
            amount=int(order.total_amount),
            description=f"Thanh toan {order.order_code}"[:25],
            items=[item],
            returnUrl=f"{base_url}/#/orders/{order.order_code}?paid=1",
            cancelUrl=f"{base_url}/#/checkout?cancelled=1",
            buyerEmail=order.user_email or "",
        )

        result = payos.createPaymentLink(paymentData=payment_data)
        order.payment_link_id = result.paymentLinkId
        order.status = "pending"
        db.commit()

        return {
            "payment_url": result.checkoutUrl,
            "payment_link_id": result.paymentLinkId,
            "order_code": order.order_code,
            "qr_code": result.qrCode if hasattr(result, "qrCode") else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PayOS error: {str(e)}")


@router.post("/webhook")
async def payos_webhook(request: Request, db: Session = Depends(get_db)):
    """PayOS webhook — called by PayOS after successful payment."""
    body = await request.body()
    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Verify checksum
    _, _, checksum_key, _ = _get_payos_config(db)
    if checksum_key:
        try:
            payos = get_payos_client(db)
            payos.verifyPaymentWebhookData(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    data = payload.get("data", {})
    order_id = data.get("orderCode")
    status = data.get("status", "")  # PAID | CANCELLED | EXPIRED

    if not order_id:
        return {"ok": True}

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"ok": True}

    now = datetime.now(timezone.utc)
    if status == "PAID":
        order.status = "paid"
        order.updated_at = now
        db.commit()
        # Auto-deliver if applicable
        auto_deliver(order, db)
        db.commit()
    elif status in ("CANCELLED", "EXPIRED"):
        order.status = "cancelled"
        order.updated_at = now
        db.commit()

    return {"ok": True}


@router.get("/status/{order_code}")
def check_payment_status(
    order_code: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.order_code == order_code,
        Order.user_id == current_user["user_id"]
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Also check PayOS for latest status if still pending
    client_id, _, _, _ = _get_payos_config(db)
    if order.status == "pending" and order.payment_link_id and client_id:
        try:
            payos = get_payos_client(db)
            info = payos.getPaymentLinkInfomation(orderId=order.id)
            if info.status == "PAID":
                order.status = "paid"
                auto_deliver(order, db)
                db.commit()
        except Exception:
            pass

    return {
        "order_code": order.order_code,
        "status": order.status,
        "delivery_data": order.delivery_data if order.status == "completed" else None,
    }
