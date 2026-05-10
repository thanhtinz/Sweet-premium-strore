import json
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from api.bot_links import resolve_platform_target


ORDER_STATUS_LABELS = {
    "pending": "Chờ thanh toán",
    "paid": "Đã thanh toán",
    "processing": "Đang xử lý",
    "completed": "Hoàn thành",
    "cancelled": "Đã hủy",
}


def _resolve_user_telegram_chat_id(db: Session, user_id: str) -> Optional[str]:
    return resolve_platform_target(db, user_id, "telegram")


def _resolve_user_discord_target(db: Session, user_id: str) -> Optional[str]:
    return resolve_platform_target(db, user_id, "discord")


def _format_amount(amount) -> str:
    try:
        return f"{Decimal(amount):,.0f}".replace(",", ".")
    except Exception:
        return str(amount)


def notify_order_status_change(
    db: Session,
    order,
    *,
    previous_status: Optional[str] = None,
    note: Optional[str] = None,
    refund_amount: Optional[Decimal] = None,
):
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

    status_label = ORDER_STATUS_LABELS.get(order.status, order.status)
    prev_label = ORDER_STATUS_LABELS.get(previous_status, previous_status) if previous_status else None
    amount_text = _format_amount(order.total_amount)

    subject = f"[Đơn hàng {order.order_code}] {status_label}"
    lines = [
        f"Mã đơn: {order.order_code}",
        f"Trạng thái mới: {status_label}",
        f"Tổng tiền: {amount_text}",
    ]
    if prev_label:
        lines.insert(1, f"Trạng thái trước đó: {prev_label}")
    if note:
        lines.append(f"Ghi chú: {note}")
    if order.delivery_data:
        lines.append(f"Thông tin giao hàng: {order.delivery_data}")
    if refund_amount is not None:
        lines.append(f"Hoàn về số dư nội bộ: {_format_amount(refund_amount)}")

    plain_body = "\n".join(lines)
    html_body = "<br>".join(lines)

    if order.user_email and send_email:
        send_email(order.user_email, subject, html_body, is_html=True)

    chat_id = _resolve_user_telegram_chat_id(db, order.user_id)
    if chat_id and send_telegram_user_message:
        telegram_message = "\n".join([
            f"<b>{subject}</b>",
            *[line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for line in lines],
        ])
        send_telegram_user_message(telegram_message, chat_id=chat_id)

    discord_target = _resolve_user_discord_target(db, order.user_id)
    if discord_target and send_discord_message:
        discord_message = "\n".join([
            f"**{subject}**",
            *lines,
        ])
        send_discord_message(discord_message, channel_id=discord_target)
