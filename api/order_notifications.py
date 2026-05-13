import logging
from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy.orm import Session

from api.bot_links import resolve_platform_target

logger = logging.getLogger("order-notify")


ORDER_STATUS_LABELS = {
    "pending": "Chờ thanh toán",
    "paid": "Đã thanh toán",
    "processing": "Đang xử lý",
    "completed": "Hoàn thành",
    "cancelled": "Đã hủy",
    "canceled": "Đã hủy",
    "failed": "Thất bại",
    "in_progress": "Đang chạy",
    "partial": "Hoàn thành một phần",
}


def _format_amount(amount) -> str:
    try:
        return f"{Decimal(amount):,.0f}".replace(",", ".")
    except Exception:
        return str(amount)


def _send_multi_channel(
    db: Session,
    *,
    user_id: Optional[str],
    user_email: Optional[str],
    subject: str,
    lines: Sequence[str],
):
    """Fan-out: email + telegram user bot + discord user bot."""
    try:
        from bot.mail import send_email
    except Exception:
        send_email = None
    try:
        from bot.telegram_bot import send_telegram_user_message
    except Exception:
        send_telegram_user_message = None
    try:
        from bot.discord_bot import send_discord_message
    except Exception:
        send_discord_message = None

    html_body = "<br>".join(lines)

    if user_email and send_email:
        try:
            send_email(user_email, subject, html_body, is_html=True)
        except Exception as e:
            logger.warning(f"send_email failed: {e}")

    uid_str = str(user_id) if user_id is not None else None
    if uid_str:
        chat_id = resolve_platform_target(db, uid_str, "telegram")
        if chat_id and send_telegram_user_message:
            try:
                tg_msg = "\n".join([
                    f"<b>{subject}</b>",
                    *[l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for l in lines],
                ])
                send_telegram_user_message(tg_msg, chat_id=chat_id)
            except Exception as e:
                logger.warning(f"send_telegram_user_message failed: {e}")

        discord_target = resolve_platform_target(db, uid_str, "discord")
        if discord_target and send_discord_message:
            try:
                dc_msg = "\n".join([f"**{subject}**", *lines])
                send_discord_message(dc_msg, channel_id=discord_target)
            except Exception as e:
                logger.warning(f"send_discord_message failed: {e}")


def _classify_order_type(order) -> str:
    """Best-effort: detect order content type for prettier labels."""
    try:
        items = order.items or []
        for it in items:
            pkg = it.package
            if pkg and pkg.product and pkg.product.category:
                pt = pkg.product.category.product_type
                if pt and pt != "premium":
                    return pt
    except Exception:
        pass
    return "premium"


_TYPE_BADGE = {
    "premium": "Tài khoản Premium",
    "game": "Nạp game",
    "giftcard": "Thẻ cào",
}


def notify_order_created(db: Session, order):
    """Notify user that a new Order has been created (any product type)."""
    amount_text = _format_amount(order.total_amount)
    otype = _classify_order_type(order)
    type_label = _TYPE_BADGE.get(otype, otype)
    status_label = ORDER_STATUS_LABELS.get(order.status, order.status)

    subject = f"[Đơn {order.order_code}] Đã tạo đơn hàng"
    lines = [
        f"Loại: {type_label}",
        f"Mã đơn: {order.order_code}",
        f"Trạng thái: {status_label}",
        f"Tổng tiền: {amount_text}",
        f"Phương thức: {order.payment_method or '—'}",
    ]
    _send_multi_channel(
        db,
        user_id=order.user_id,
        user_email=order.user_email,
        subject=subject,
        lines=lines,
    )


def notify_order_status_change(
    db: Session,
    order,
    *,
    previous_status: Optional[str] = None,
    note: Optional[str] = None,
    refund_amount: Optional[Decimal] = None,
):
    """Notify user on Order (premium/game/giftcard) status change."""
    status_label = ORDER_STATUS_LABELS.get(order.status, order.status)
    prev_label = ORDER_STATUS_LABELS.get(previous_status, previous_status) if previous_status else None
    amount_text = _format_amount(order.total_amount)
    otype = _classify_order_type(order)
    type_label = _TYPE_BADGE.get(otype, otype)

    subject = f"[Đơn {order.order_code}] {status_label}"
    lines = [
        f"Loại: {type_label}",
        f"Mã đơn: {order.order_code}",
        f"Trạng thái mới: {status_label}",
        f"Tổng tiền: {amount_text}",
    ]
    if prev_label:
        lines.insert(2, f"Trạng thái trước đó: {prev_label}")
    if note:
        lines.append(f"Ghi chú: {note}")
    if order.delivery_data:
        snippet = (order.delivery_data or "")[:1500]
        lines.append(f"Thông tin giao hàng:\n{snippet}")
    if refund_amount is not None:
        lines.append(f"Hoàn về số dư nội bộ: {_format_amount(refund_amount)}")

    _send_multi_channel(
        db,
        user_id=order.user_id,
        user_email=order.user_email,
        subject=subject,
        lines=lines,
    )


def notify_smm_order_event(
    db: Session,
    smm_order,
    *,
    event: str,
    previous_status: Optional[str] = None,
    note: Optional[str] = None,
):
    """Notify user on SmmOrder lifecycle event (created|completed|failed|status_change)."""
    from db.models import User

    status_label = ORDER_STATUS_LABELS.get(smm_order.status, smm_order.status)
    prev_label = ORDER_STATUS_LABELS.get(previous_status, previous_status) if previous_status else None

    event_titles = {
        "created": "Đơn SMM đã được tạo",
        "completed": "Đơn SMM hoàn thành",
        "failed": "Đơn SMM thất bại",
        "status_change": f"Đơn SMM: {status_label}",
    }
    title = event_titles.get(event, f"Đơn SMM: {status_label}")
    subject = f"[SMM #{smm_order.order_code}] {title}"

    lines = [
        f"Loại: SMM",
        f"Mã đơn: {smm_order.order_code}",
        f"Dịch vụ: {smm_order.service_name or '—'}",
        f"Số lượng: {smm_order.quantity}",
        f"Link: {smm_order.link}",
        f"Chi phí: {_format_amount(smm_order.charge)}",
        f"Trạng thái: {status_label}",
    ]
    if prev_label and event == "status_change":
        lines.append(f"Trạng thái trước đó: {prev_label}")
    if note:
        lines.append(f"Ghi chú: {note}")

    # Resolve email
    user_email = None
    try:
        user = db.query(User).filter(User.id == smm_order.user_id).first()
        if user:
            user_email = user.email
    except Exception:
        pass

    _send_multi_channel(
        db,
        user_id=str(smm_order.user_id),
        user_email=user_email,
        subject=subject,
        lines=lines,
    )
