import os
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from db import get_db
from db.models import Order, OrderItem, ProductPackage, User
from db.repositories import SiteConfigRepository
from api.auth import get_current_user
from api.orders import auto_deliver

router = APIRouter(prefix="/payment", tags=["payment"])

PAYOS_CLIENT_ID = os.environ.get("PAYOS_CLIENT_ID", "")
PAYOS_API_KEY = os.environ.get("PAYOS_API_KEY", "")
PAYOS_CHECKSUM_KEY = os.environ.get("PAYOS_CHECKSUM_KEY", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3001")


def _get_payos_config(db: Session = None):
    """Get PayOS config from env vars first, fallback to DB (SiteSetting)."""
    client_id = PAYOS_CLIENT_ID
    api_key = PAYOS_API_KEY
    checksum_key = PAYOS_CHECKSUM_KEY
    base_url = APP_BASE_URL
    if db:
        repo = SiteConfigRepository(db)
        client_id = client_id or (repo.get_value("payos_client_id") or "")
        api_key = api_key or (repo.get_value("payos_api_key") or "")
        checksum_key = checksum_key or (repo.get_value("payos_checksum_key") or "")
        base_url = repo.get_value("app_base_url") or base_url
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


def _serialize_order_payment(order: Order):
    order_items = order.items or []
    items = []
    if order_items:
        for order_item in order_items:
            package = order_item.package
            product = package.product if package else None
            items.append({
                "product_name": order_item.product_name_snapshot or (product.name if product else "Sản phẩm số"),
                "package_name": order_item.package_name_snapshot or (package.name if package else "Gói"),
                "quantity": order_item.quantity or 1,
                "line_total": float(order_item.line_total or 0),
                "product_img": order_item.product_img_snapshot or (product.image_url if product else None),
            })
    else:
        package = order.package
        product = package.product if package else None
        items.append({
            "product_name": product.name if product else "Sản phẩm số",
            "package_name": package.name if package else "Gói",
            "quantity": order.quantity or 1,
            "line_total": float(order.total_amount or 0),
            "product_img": product.image_url if product else None,
        })

    return {
        "order_code": order.order_code,
        "status": order.status,
        "payment_method": order.payment_method,
        "payment_link_id": order.payment_link_id,
        "total_amount": float(order.total_amount or 0),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "user_email": order.user_email,
        "customer_name": order.user.full_name if getattr(order, "user", None) else None,
        "items": items,
    }


@router.post("/create-link")
def create_payment_link(
    data: CreatePaymentRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    client_id, api_key, checksum_key, base_url = _get_payos_config(db)
    if not client_id:
        raise HTTPException(status_code=503, detail="Payment not configured")

    order = db.query(Order).options(
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(
        Order.order_code == data.order_code,
        Order.user_id == current_user["user_id"],
        Order.status == "pending"
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        from payos import PaymentData, ItemData
        payos = get_payos_client(db)

        items = []
        order_items = getattr(order, "items", [])
        if order_items:
            for order_item in order_items:
                package = getattr(order_item, "package", None)
                product_name = order_item.product_name_snapshot or (package.product.name if package and getattr(package, "product", None) else "Sản phẩm số")
                package_name = order_item.package_name_snapshot or (package.name if package else "Gói")
                unit_price = int((order_item.line_total or 0) / max(order_item.quantity or 1, 1))
                items.append(ItemData(
                    name=f"{product_name} - {package_name}"[:50],
                    quantity=order_item.quantity,
                    price=unit_price,
                ))
        else:
            package = getattr(order, "package", None)
            pkg_name = package.name if package else "Sản phẩm số"
            product_name = package.product.name if package and getattr(package, "product", None) else ""
            items.append(ItemData(
                name=f"{product_name} - {pkg_name}"[:50],
                quantity=order.quantity,
                price=int(order.total_amount),
            ))

        payment_data = PaymentData(
            orderCode=int(order.id),
            amount=int(order.total_amount),
            description=f"Thanh toan {order.order_code}"[:25],
            items=items,
            returnUrl=f"{base_url}/#/orders/{order.order_code}?checkout=payos&status=paid",
            cancelUrl=f"{base_url}/#/orders/{order.order_code}?checkout=payos&status=cancelled",
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
            "amount": int(order.total_amount or 0),
            "status": order.status,
            "expires_at": getattr(result, "expiredAt", None),
            "bin": getattr(result, "bin", None),
            "account_number": getattr(result, "accountNumber", None),
            "account_name": getattr(result, "accountName", None),
            "description": getattr(result, "description", None) or f"Thanh toan {order.order_code}"[:25],
            "order": _serialize_order_payment(order),
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

    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not order:
        return {"ok": True}

    now = datetime.now(timezone.utc)
    if status == "PAID":
        order.status = "paid"
        order.updated_at = now
        for item in order.items or []:
            item.status = "paid"
            item.updated_at = now
        db.commit()
        # Auto-deliver if applicable
        auto_deliver(order, db)
        db.commit()
    elif status in ("CANCELLED", "EXPIRED"):
        order.status = "cancelled"
        order.updated_at = now
        for item in order.items or []:
            item.status = "cancelled"
            item.updated_at = now
        db.commit()

    return {"ok": True}


@router.get("/checkout-data/{order_code}")
def get_checkout_data(
    order_code: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).options(
        joinedload(Order.user),
        joinedload(Order.package).joinedload(ProductPackage.product),
        joinedload(Order.items).joinedload(OrderItem.package).joinedload(ProductPackage.product),
    ).filter(
        Order.order_code == order_code,
        Order.user_id == current_user["user_id"]
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payload = _serialize_order_payment(order)
    payload["payos"] = {
        "payment_url": None,
        "payment_link_id": order.payment_link_id,
        "qr_code": None,
        "amount": int(order.total_amount or 0),
        "status": order.status,
        "expires_at": None,
        "bin": None,
        "account_number": None,
        "account_name": None,
        "description": f"Thanh toan {order.order_code}"[:25],
    }

    client_id, _, _, _ = _get_payos_config(db)
    if order.payment_method == "payos" and order.payment_link_id and client_id:
        try:
            payos = get_payos_client(db)
            info = payos.getPaymentLinkInfomation(orderId=order.id)
            payload["payos"].update({
                "payment_url": getattr(info, "checkoutUrl", None),
                "payment_link_id": getattr(info, "paymentLinkId", None) or order.payment_link_id,
                "qr_code": getattr(info, "qrCode", None),
                "amount": getattr(info, "amount", None) or int(order.total_amount or 0),
                "status": getattr(info, "status", None) or order.status,
                "expires_at": getattr(info, "expiredAt", None),
                "bin": getattr(info, "bin", None),
                "account_number": getattr(info, "accountNumber", None),
                "account_name": getattr(info, "accountName", None),
                "description": getattr(info, "description", None) or payload["payos"]["description"],
            })
        except Exception:
            pass

    return payload


@router.get("/status/{order_code}")
def check_payment_status(
    order_code: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).options(joinedload(Order.items)).filter(
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
                for item in order.items or []:
                    item.status = "paid"
                    item.updated_at = datetime.now(timezone.utc)
                auto_deliver(order, db)
                db.commit()
        except Exception:
            pass

    return {
        "order_code": order.order_code,
        "status": order.status,
        "delivery_data": order.delivery_data if order.status == "completed" else None,
        "payment_link_id": order.payment_link_id,
    }
