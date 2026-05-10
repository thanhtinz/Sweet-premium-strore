from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from db.models import Order, User, UserBotLink
from db.repositories import SiteConfigRepository, UserBotLinkRepository

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


def ensure_aware_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_platform(platform: str) -> str:
    value = (platform or "").strip().lower()
    if value not in SUPPORTED_BOT_PLATFORMS:
        raise ValueError("Unsupported platform")
    return value


def load_bot_config(db: Session) -> dict:
    return SiteConfigRepository(db).get_json("bot_smtp_config", default={}) or {}


def _telegram_user_bot_username(cfg: dict) -> str:
    user_username = (cfg.get("telegram_user_bot_username") or "").strip()
    if user_username:
        return user_username.lstrip("@")
    admin_token = (cfg.get("telegram_token") or "").strip()
    user_token = (cfg.get("telegram_user_token") or "").strip()
    if user_token and user_token != admin_token:
        return ""
    return (cfg.get("telegram_bot_username") or "").strip().lstrip("@")


def get_bot_public_links(db: Session) -> dict:
    cfg = load_bot_config(db)
    telegram_user_bot_username = _telegram_user_bot_username(cfg)
    return {
        "discord_invite": cfg.get("discord_invite", ""),
        "telegram_bot_username": telegram_user_bot_username,
        "telegram_admin_bot_username": (cfg.get("telegram_bot_username") or "").strip().lstrip("@"),
        "telegram_user_bot_username": telegram_user_bot_username,
        "telegram_user_welcome": cfg.get("telegram_user_welcome", ""),
    }


def get_bot_commands() -> list[dict]:
    return BOT_COMMANDS


def get_user_bot_link(db: Session, user_id: str, platform: str) -> Optional[UserBotLink]:
    platform = normalize_platform(platform)
    return UserBotLinkRepository(db).get_by_user_and_platform(str(user_id), platform)


def serialize_platform_link(item: Optional[UserBotLink]) -> dict:
    expires_at = ensure_aware_utc(item.link_code_expires_at) if item else None
    linked_at = ensure_aware_utc(item.linked_at) if item else None
    last_seen_at = ensure_aware_utc(item.last_seen_at) if item else None
    active_code = bool(item and item.link_code and expires_at and expires_at >= now_utc())
    return {
        "linked": bool(item and item.is_verified and item.platform_user_id),
        "platform_user_id": item.platform_user_id if item and item.is_verified else "",
        "platform_username": item.platform_username if item else "",
        "dm_channel_id": item.dm_channel_id if item else "",
        "link_code": item.link_code if active_code else "",
        "has_active_code": active_code,
        "link_code_expires_at": expires_at.isoformat() if expires_at else None,
        "linked_at": linked_at.isoformat() if linked_at else None,
        "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
    }


def get_user_bot_links_summary(db: Session, user_id: str) -> dict:
    items = UserBotLinkRepository(db).list_by_user(str(user_id))
    by_platform = {item.platform: item for item in items}
    public_links = get_bot_public_links(db)
    result = {
        "commands": get_bot_commands(),
        "discord_invite": public_links["discord_invite"],
        "telegram_bot_username": public_links["telegram_bot_username"],
        "telegram_admin_bot_username": public_links["telegram_admin_bot_username"],
        "telegram_user_bot_username": public_links["telegram_user_bot_username"],
        "telegram_user_welcome": public_links["telegram_user_welcome"],
        "platforms": {},
    }
    for platform in SUPPORTED_BOT_PLATFORMS:
        candidates = [item for item in items if item.platform == platform]
        verified = next((item for item in candidates if item.is_verified and item.platform_user_id), None)
        active_code = next((item for item in candidates if item.link_code), None)
        result["platforms"][platform] = serialize_platform_link(verified or active_code or (candidates[0] if candidates else None))
    return result


def get_platform_link_status(db: Session, user_id: str, platform: str) -> dict:
    item = get_user_bot_link(db, user_id, platform)
    return {"platform": platform, **serialize_platform_link(item)}


def resolve_platform_target(db: Session, user_id: str, platform: str) -> Optional[str]:
    item = get_user_bot_link(db, user_id, platform)
    if not item or not item.is_verified:
        return None
    return item.dm_channel_id or item.platform_user_id


def get_bot_user_by_platform(db: Session, platform: str, platform_user_id: str) -> Optional[User]:
    platform = normalize_platform(platform)
    item = UserBotLinkRepository(db).get_by_platform_identity(platform, str(platform_user_id))
    if not item or not item.is_verified or not item.user_id:
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
