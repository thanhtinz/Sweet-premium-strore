import os
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from db import get_db
from db.models import Order, OrderItem, ProductPackage, User
from db.repositories import SiteConfigRepository
from api.auth import get_current_user, get_current_admin
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
                "product_img": getattr(order_item, "product_img_snapshot", None) or (product.image_url if product else None),
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
        "customer_name": getattr(getattr(order, "user", None), "display_name", None),
        "items": items,
    }


def _payos_attr(obj, snake_name: str, camel_name: str = None, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        if snake_name in obj:
            return obj.get(snake_name)
        if camel_name and camel_name in obj:
            return obj.get(camel_name)
        return default
    if hasattr(obj, snake_name):
        return getattr(obj, snake_name)
    if camel_name and hasattr(obj, camel_name):
        return getattr(obj, camel_name)
    return default


def _payos_url_from_info(info):
    direct_url = (
        _payos_attr(info, "checkout_url", "checkoutUrl")
        or _payos_attr(info, "payment_url", "paymentUrl")
        or _payos_attr(info, "checkoutUrl")
    )
    if direct_url:
        return direct_url
    link_id = _payos_link_id_from_info(info)
    return f"https://pay.payos.vn/web/{link_id}" if link_id else None


def _payos_link_id_from_info(info):
    return (
        _payos_attr(info, "payment_link_id", "paymentLinkId")
        or _payos_attr(info, "id")
    )


def _payos_payload(order: Order, info):
    payment_link_id = _payos_link_id_from_info(info) or order.payment_link_id
    return {
        "payment_url": _payos_url_from_info(info),
        "payment_link_id": payment_link_id,
        "order_code": order.order_code,
        "qr_code": _payos_attr(info, "qr_code", "qrCode"),
        "amount": _payos_attr(info, "amount") or int(order.total_amount or 0),
        "status": _payos_attr(info, "status") or order.status,
        "expires_at": _payos_attr(info, "expired_at", "expiredAt"),
        "bin": _payos_attr(info, "bin"),
        "account_number": _payos_attr(info, "account_number", "accountNumber"),
        "account_name": _payos_attr(info, "account_name", "accountName"),
        "description": _payos_attr(info, "description") or f"Thanh toan {order.order_code}"[:25],
        "order": _serialize_order_payment(order),
    }


def _is_payos_not_found_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(token in text for token in ["not found", "không tìm thấy", "khong tim thay", "mã thanh toán không tồn tại", "ma thanh toan khong ton tai", "payment link not found", "404"])


def _is_payos_existing_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(token in text for token in ["tồn tại", "ton tai", "exist", "duplicate", "already"])


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
        from payos.types import CreatePaymentLinkRequest, ItemData

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
                    quantity=order_item.quantity or 1,
                    price=max(unit_price, 0),
                ))
        else:
            package = getattr(order, "package", None)
            pkg_name = package.name if package else "Sản phẩm số"
            product_name = package.product.name if package and getattr(package, "product", None) else ""
            items.append(ItemData(
                name=f"{product_name} - {pkg_name}"[:50],
                quantity=order.quantity or 1,
                price=int(order.total_amount or 0),
            ))

        payment_data = CreatePaymentLinkRequest(
            order_code=int(order.id),
            amount=int(order.total_amount or 0),
            description=f"Thanh toan {order.order_code}"[:25],
            cancel_url=f"{base_url}/orders/{order.order_code}?checkout=payos&status=cancelled",
            return_url=f"{base_url}/orders/{order.order_code}?checkout=payos&status=paid",
            items=items,
            buyer_email=order.user_email or None,
            buyer_name=str(order.user_email).split('@')[0][:25] if order.user_email else "Khach",
            expired_at=int((datetime.now(timezone.utc) + timedelta(minutes=15)).timestamp()),
        )

        payos = get_payos_client(db)
        if order.payment_link_id:
            return {
                "payment_url": f"https://pay.payos.vn/web/{order.payment_link_id}",
                "payment_link_id": order.payment_link_id,
                "order_code": order.order_code,
                "qr_code": None,
                "amount": int(order.total_amount or 0),
                "status": order.status,
                "expires_at": None,
                "bin": None,
                "account_number": None,
                "account_name": None,
                "description": f"Thanh toan {order.order_code}"[:25],
                "order": _serialize_order_payment(order),
            }
        try:
            result = payos.payment_requests.create(payment_data)
        except Exception as create_error:
            if not _is_payos_existing_error(create_error):
                raise
            try:
                result = payos.payment_requests.get(id=order.id)
            except Exception:
                raise create_error

        order.payment_link_id = _payos_link_id_from_info(result) or order.payment_link_id
        order.status = "pending"
        db.commit()

        return _payos_payload(order, result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PayOS error: {str(e)}")


class PayOSTestRequest(BaseModel):
    payos_client_id: str
    payos_api_key: str
    payos_checksum_key: str

@router.post("/test")
def test_payos_connection(
    data: PayOSTestRequest,
    current_admin: dict = Depends(get_current_admin)
):
    try:
        from payos import PayOS
        from payos.types import CreatePaymentLinkRequest
        payos = PayOS(
            client_id=data.payos_client_id,
            api_key=data.payos_api_key,
            checksum_key=data.payos_checksum_key
        )
        # Attempt to retrieve a non-existent link.
        # If credentials are correct, PayOS returns a typical 4xx API error (like "Payment link not found").
        # If credentials are bad, it returns unauthorized.
        try:
            payos.payment_requests.get(id=9999999999)
            return {"message": "Kết nối thành công (API credentials hợp lệ)"}
        except Exception as e:
            # payos library exceptions usually carry the HTTP status code
            err_str = str(e).lower()
            if "unauthorized" in err_str or "invalid" in err_str:
                raise ValueError("Sai Client ID, API Key hoặc Checksum Key")
            return {"message": "Kết nối thành công tới PayOS"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Test thất bại: {str(e)}")


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
            webhook_data = payos.webhooks.verify(payload)
            # The verify method raises if invalid, but also returns a validated object
            # if we wanted to use it. We fall back to accessing dict properties if
            # webhookBody behaves differently.
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    data = payload.get("data", {})
    order_id = data.get("orderCode")
    # In older/some versions it comes from code/desc instead of status
    status = payload.get("code", "")
    if status == "00":
        status = "PAID"
    elif "status" in data:
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
            info = payos.payment_requests.get(id=order.id)
            payload["payos"].update(_payos_payload(order, info))
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
            info = payos.payment_requests.get(id=order.id)
            payos_status = _payos_attr(info, "status")
            now = datetime.now(timezone.utc)
            if payos_status == "PAID":
                order.status = "paid"
                order.updated_at = now
                for item in order.items or []:
                    item.status = "paid"
                    item.updated_at = now
                auto_deliver(order, db)
                db.commit()
            elif payos_status in ("CANCELLED", "EXPIRED"):
                order.status = "cancelled"
                order.updated_at = now
                for item in order.items or []:
                    item.status = "cancelled"
                    item.updated_at = now
                db.commit()
        except Exception:
            pass

    return {
        "order_code": order.order_code,
        "status": order.status,
        "delivery_data": order.delivery_data if order.status == "completed" else None,
        "payment_link_id": order.payment_link_id,
    }
