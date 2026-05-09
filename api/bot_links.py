import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from db.models import Order, SiteConfig, User, UserBotLink


SUPPORTED_BOT_PLATFORMS = ("telegram", "discord")
BOT_COMMANDS = [
    {"command": "/start", "description": "Chào mừng và hướng dẫn liên kết tài khoản"},
    {"command": "/help", "description": "Xem danh sách lệnh hỗ trợ"},
    {"command": "/link CODE", "description": "Liên kết bot với tài khoản cửa hàng"},
    {"command": "/status", "description": "Xem trạng thái liên kết bot hiện tại"},
    {"command": "/account", "description": "Xem thông tin tài khoản và số dư"},
    {"command": "/orders", "description": "Xem các đơn hàng gần đây"},
    {"command": "/support", "description": "Xem hướng dẫn liên hệ hỗ trợ"},
    {"command": "/unlink", "description": "Gỡ liên kết bot khỏi tài khoản hiện tại"},
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_platform(platform: str) -> str:
    value = (platform or "").strip().lower()
    if value not in SUPPORTED_BOT_PLATFORMS:
        raise ValueError("Unsupported platform")
    return value


def _load_bot_config(db: Session) -> dict:
    row = db.query(SiteConfig).filter_by(key="bot_smtp_config").first()
    if not row or not row.value:
        return {}
    try:
        import json
        return json.loads(row.value)
    except Exception:
        return {}


def get_bot_public_links(db: Session) -> dict:
    cfg = _load_bot_config(db)
    return {
        "discord_invite": cfg.get("discord_invite", ""),
        "telegram_bot_username": cfg.get("telegram_bot_username", ""),
        "telegram_user_welcome": cfg.get("telegram_user_welcome", ""),
    }


def get_bot_commands() -> list[dict]:
    return BOT_COMMANDS


def get_user_bot_link(db: Session, user_id: str, platform: str) -> Optional[UserBotLink]:
    platform = _normalize_platform(platform)
    return db.query(UserBotLink).filter(
        UserBotLink.user_id == str(user_id),
        UserBotLink.platform == platform,
    ).first()


def get_user_bot_links_summary(db: Session, user_id: str) -> dict:
    items = db.query(UserBotLink).filter(UserBotLink.user_id == str(user_id)).all()
    by_platform = {item.platform: item for item in items}
    public_links = get_bot_public_links(db)
    result = {
        "commands": get_bot_commands(),
        "discord_invite": public_links["discord_invite"],
        "telegram_bot_username": public_links["telegram_bot_username"],
        "telegram_user_welcome": public_links["telegram_user_welcome"],
        "platforms": {},
    }
    for platform in SUPPORTED_BOT_PLATFORMS:
        item = by_platform.get(platform)
        active_code = bool(item and item.link_code and item.link_code_expires_at and item.link_code_expires_at >= now_utc())
        result["platforms"][platform] = {
            "linked": bool(item and item.is_verified and item.platform_user_id),
            "platform_user_id": item.platform_user_id if item and item.is_verified else "",
            "platform_username": item.platform_username if item else "",
            "dm_channel_id": item.dm_channel_id if item else "",
            "link_code": item.link_code if active_code else "",
            "has_active_code": active_code,
            "link_code_expires_at": item.link_code_expires_at.isoformat() if item and item.link_code_expires_at else None,
            "linked_at": item.linked_at.isoformat() if item and item.linked_at else None,
            "last_seen_at": item.last_seen_at.isoformat() if item and item.last_seen_at else None,
        }
    return result


def create_link_code(db: Session, user_id: str, platform: str, expires_minutes: int = 30) -> UserBotLink:
    platform = _normalize_platform(platform)
    item = get_user_bot_link(db, user_id, platform)
    if not item:
        item = UserBotLink(user_id=str(user_id), platform=platform, platform_user_id=f"pending:{platform}:{user_id}")
        db.add(item)
        db.flush()
    item.link_code = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:12].upper()
    item.link_code_expires_at = now_utc() + timedelta(minutes=expires_minutes)
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
    platform = _normalize_platform(platform)
    item = db.query(UserBotLink).filter(
        UserBotLink.platform == platform,
        UserBotLink.platform_user_id == str(platform_user_id),
    ).first()
    if not item:
        item = UserBotLink(platform=platform, platform_user_id=str(platform_user_id))
        db.add(item)
    if platform_username:
        item.platform_username = platform_username
    if dm_channel_id:
        item.dm_channel_id = dm_channel_id
    if metadata:
        item.metadata_json = {**(item.metadata_json or {}), **metadata}
    item.last_seen_at = now_utc()
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
    platform = _normalize_platform(platform)
    item = db.query(UserBotLink).filter(
        UserBotLink.platform == platform,
        UserBotLink.platform_user_id == str(platform_user_id),
    ).first()
    if not item:
        item = get_user_bot_link(db, user_id, platform)
    if not item:
        item = UserBotLink(platform=platform, platform_user_id=str(platform_user_id))
        db.add(item)
    item.user_id = str(user_id)
    item.platform_user_id = str(platform_user_id)
    if platform_username is not None:
        item.platform_username = platform_username
    if dm_channel_id is not None:
        item.dm_channel_id = dm_channel_id
    if metadata:
        item.metadata_json = {**(item.metadata_json or {}), **metadata}
    item.is_verified = verified
    item.linked_at = now_utc() if verified else item.linked_at
    item.last_seen_at = now_utc()
    item.link_code = None
    item.link_code_expires_at = None
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
    platform = _normalize_platform(platform)
    normalized_code = (code or "").strip().upper()
    if not normalized_code:
        return None
    item = db.query(UserBotLink).filter(
        UserBotLink.platform == platform,
        func.upper(UserBotLink.link_code) == normalized_code,
    ).first()
    if not item or not item.user_id:
        return None
    if item.link_code_expires_at and item.link_code_expires_at < now_utc():
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
    item = get_user_bot_link(db, user_id, platform)
    if not item:
        return False
    item.user_id = None
    item.is_verified = False
    item.link_code = None
    item.link_code_expires_at = None
    item.linked_at = None
    db.commit()
    return True


def get_platform_link_status(db: Session, user_id: str, platform: str) -> dict:
    item = get_user_bot_link(db, user_id, platform)
    return {
        "platform": platform,
        "linked": bool(item and item.is_verified and item.platform_user_id),
        "platform_user_id": item.platform_user_id if item and item.is_verified else "",
        "platform_username": item.platform_username if item else "",
        "dm_channel_id": item.dm_channel_id if item else "",
        "linked_at": item.linked_at.isoformat() if item and item.linked_at else None,
        "last_seen_at": item.last_seen_at.isoformat() if item and item.last_seen_at else None,
        "has_active_code": bool(item and item.link_code and item.link_code_expires_at and item.link_code_expires_at >= now_utc()),
        "link_code": item.link_code if item and item.link_code_expires_at and item.link_code_expires_at >= now_utc() else "",
        "link_code_expires_at": item.link_code_expires_at.isoformat() if item and item.link_code_expires_at else None,
    }


def resolve_platform_target(db: Session, user_id: str, platform: str) -> Optional[str]:
    item = get_user_bot_link(db, user_id, platform)
    if not item or not item.is_verified:
        return None
    return item.dm_channel_id or item.platform_user_id


def get_bot_user_by_platform(db: Session, platform: str, platform_user_id: str) -> Optional[User]:
    platform = _normalize_platform(platform)
    item = db.query(UserBotLink).filter(
        UserBotLink.platform == platform,
        UserBotLink.platform_user_id == str(platform_user_id),
        UserBotLink.is_verified.is_(True),
        UserBotLink.user_id.isnot(None),
    ).first()
    if not item:
        return None
    return db.query(User).filter(User.id == int(item.user_id)).first()


def get_recent_orders_summary(db: Session, user_id: str, limit: int = 5) -> list[dict]:
    orders = db.query(Order).filter(Order.user_id == str(user_id)).order_by(Order.created_at.desc()).limit(limit).all()
    return [
        {
            "order_code": order.order_code,
            "status": order.status,
            "total_amount": float(order.total_amount or 0),
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
        for order in orders
    ]


def build_bot_response(db: Session, platform: str, platform_user_id: str, text: str) -> str:
    command = (text or "").strip()
    lowered = command.lower()
    if not command or lowered in ("/start", "start", "/help", "help"):
        commands = "\n".join([f"• {item['command']} — {item['description']}" for item in BOT_COMMANDS])
        return "Xin chào. Dùng các lệnh sau để liên kết và nhận hỗ trợ:\n" + commands

    if lowered.startswith("/link "):
        code = command.split(" ", 1)[1].strip()
        linked = consume_link_code(
            db,
            platform=platform,
            code=code,
            platform_user_id=platform_user_id,
        )
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
