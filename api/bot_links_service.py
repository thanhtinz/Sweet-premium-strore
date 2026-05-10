import secrets
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from api.bot_links_shared import (
    BOT_COMMANDS,
    ensure_aware_utc,
    get_bot_public_links,
    get_bot_user_by_platform,
    get_platform_link_status,
    get_recent_orders_summary,
    get_user_bot_link,
    normalize_platform,
    now_utc,
)
from db.models import UserBotLink
from db.repositories import UserBotLinkRepository


def create_link_code(db: Session, user_id: str, platform: str, expires_minutes: int = 30) -> UserBotLink:
    platform = normalize_platform(platform)
    repo = UserBotLinkRepository(db)
    item = repo.get_by_user_and_platform(str(user_id), platform)
    if not item:
        item = repo.create_pending_link(str(user_id), platform, f"pending:{platform}:{user_id}")
    repo.mark_link_code(
        item,
        link_code=secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:12].upper(),
        expires_at=now_utc() + timedelta(minutes=expires_minutes),
    )
    db.commit()
    db.refresh(item)
    return item


def upsert_platform_identity(
    db: Session,
    *,
    platform: str,
    platform_user_id: str,
    platform_username: Optional[str] = None,
    dm_channel_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> UserBotLink:
    platform = normalize_platform(platform)
    repo = UserBotLinkRepository(db)
    item = repo.get_by_platform_identity(platform, str(platform_user_id))
    if not item:
        item = repo.create_pending_link("", platform, str(platform_user_id))
        item.user_id = None
    repo.touch_identity(
        item,
        platform_username=platform_username,
        dm_channel_id=dm_channel_id,
        metadata=metadata,
        last_seen_at=now_utc(),
    )
    db.commit()
    db.refresh(item)
    return item


def link_platform_account(
    db: Session,
    *,
    user_id: str,
    platform: str,
    platform_user_id: str,
    platform_username: Optional[str] = None,
    dm_channel_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    verified: bool = True,
) -> UserBotLink:
    platform = normalize_platform(platform)
    repo = UserBotLinkRepository(db)
    item = repo.get_by_platform_identity(platform, str(platform_user_id))
    if not item:
        item = repo.get_by_user_and_platform(str(user_id), platform)
    if not item:
        item = repo.create_pending_link(str(user_id), platform, str(platform_user_id))
    repo.touch_identity(
        item,
        platform_username=platform_username,
        dm_channel_id=dm_channel_id,
        metadata=metadata,
        last_seen_at=now_utc(),
    )
    repo.mark_linked(
        item,
        user_id=str(user_id),
        platform_user_id=str(platform_user_id),
        verified=verified,
        linked_at=now_utc() if verified else item.linked_at,
        last_seen_at=now_utc(),
    )
    db.commit()
    db.refresh(item)
    return item


def consume_link_code(
    db: Session,
    *,
    platform: str,
    code: str,
    platform_user_id: str,
    platform_username: Optional[str] = None,
    dm_channel_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[UserBotLink]:
    platform = normalize_platform(platform)
    normalized_code = (code or "").strip().upper()
    if not normalized_code:
        return None
    repo = UserBotLinkRepository(db)
    item = repo.get_by_link_code(platform, normalized_code)
    if not item or not item.user_id:
        return None
    expires_at = ensure_aware_utc(item.link_code_expires_at)
    if expires_at and expires_at < now_utc():
        return None
    return link_platform_account(
        db,
        user_id=item.user_id,
        platform=platform,
        platform_user_id=platform_user_id,
        platform_username=platform_username,
        dm_channel_id=dm_channel_id,
        metadata=metadata,
        verified=True,
    )


def manual_link_platform_user_id(db: Session, user_id: str, platform: str, platform_user_id: str) -> UserBotLink:
    return link_platform_account(
        db,
        user_id=user_id,
        platform=platform,
        platform_user_id=platform_user_id,
        verified=True,
    )


def unlink_platform_account(db: Session, user_id: str, platform: str) -> bool:
    repo = UserBotLinkRepository(db)
    item = get_user_bot_link(db, user_id, platform)
    if not item:
        return False
    repo.unlink(item)
    db.commit()
    return True


def build_bot_response(db: Session, platform: str, platform_user_id: str, text: str) -> str:
    command = (text or "").strip()
    lowered = command.lower()
    if not command or lowered in ("/start", "start", "/help", "help"):
        commands = "\n".join([f"• {item['command']} — {item['description']}" for item in BOT_COMMANDS])
        return "Xin chào. Dùng các lệnh sau để liên kết và nhận hỗ trợ:\n" + commands
    if lowered.startswith("/link "):
        code = command.split(" ", 1)[1].strip()
        linked = consume_link_code(db, platform=platform, code=code, platform_user_id=platform_user_id)
        if linked:
            return "Liên kết thành công. Bạn đã có thể dùng /status, /account, /orders, /support."
        return "Mã liên kết không hợp lệ hoặc đã hết hạn. Hãy tạo mã mới trong trang tài khoản."
    user = get_bot_user_by_platform(db, platform, platform_user_id)
    if not user:
        return "Tài khoản bot này chưa được liên kết. Hãy dùng /link CODE từ trang tài khoản."
    if lowered in ("/status", "status"):
        status = get_platform_link_status(db, str(user.id), platform)
        lines = [
            f"Nền tảng: {platform}",
            f"Đã liên kết: {'Có' if status['linked'] else 'Không'}",
            f"ID nền tảng: {status['platform_user_id'] or '—'}",
            f"Username: {status['platform_username'] or '—'}",
            f"Linked at: {status['linked_at'] or '—'}",
            f"Last seen: {status['last_seen_at'] or '—'}",
        ]
        return "\n".join(lines)
    if lowered in ("/unlink", "unlink"):
        unlink_platform_account(db, str(user.id), platform)
        return "Đã gỡ liên kết bot hiện tại. Muốn dùng lại, hãy tạo mã mới và chạy /link CODE."
    if lowered in ("/account", "account"):
        return f"Tài khoản: {user.display_name or user.email}\nEmail: {user.email}\nSố dư: {float(user.balance or 0):,.0f}".replace(",", ".")
    if lowered in ("/orders", "orders"):
        orders = get_recent_orders_summary(db, str(user.id), limit=5)
        if not orders:
            return "Bạn chưa có đơn hàng nào gần đây."
        lines = ["Đơn hàng gần đây:"]
        for order in orders:
            lines.append(f"• {order['order_code']} — {order['status']} — {order['total_amount']:,.0f}".replace(",", "."))
        return "\n".join(lines)
    if lowered in ("/support", "support"):
        public_links = get_bot_public_links(db)
        support_hint = public_links.get("telegram_user_welcome") or "Nếu cần hỗ trợ, hãy liên hệ qua trang hỗ trợ trên website."
        return support_hint
    return "Lệnh chưa được hỗ trợ. Dùng /help để xem danh sách lệnh."
