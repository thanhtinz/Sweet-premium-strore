import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from db.models import SiteConfig, UserBotLink
from db.providers import DATABASE_PROVIDER_CONFIG_KEY, default_provider_config, normalize_provider_config


class SiteConfigRepository:
    model = SiteConfig

    def __init__(self, db: Session):
        self.db = db

    def get_row(self, key: str) -> SiteConfig | None:
        return self.db.query(SiteConfig).filter(SiteConfig.key == key).first()

    def get_value(self, key: str, default: str | None = None) -> str | None:
        row = self.get_row(key)
        return row.value if row else default

    def get_json(self, key: str, default: Any = None):
        row = self.get_row(key)
        if not row or not row.value:
            return default
        try:
            return json.loads(row.value)
        except (json.JSONDecodeError, TypeError):
            return default

    def set_value(self, key: str, value: str) -> SiteConfig:
        row = self.get_row(key)
        if row:
            row.value = value
        else:
            row = SiteConfig(key=key, value=value)
            self.db.add(row)
        return row

    def set_json(self, key: str, value: Any) -> SiteConfig:
        return self.set_value(key, json.dumps(value, ensure_ascii=False))

    def list_rows(self) -> list[SiteConfig]:
        return self.db.query(SiteConfig).all()

    def get_many_json(self, keys: list[str]) -> dict[str, Any]:
        result = {}
        rows = self.db.query(SiteConfig).filter(SiteConfig.key.in_(keys)).all()
        for row in rows:
            try:
                result[row.key] = json.loads(row.value) if row.value else {}
            except (json.JSONDecodeError, TypeError):
                result[row.key] = {}
        return result


class DatabaseProviderConfigRepository:
    def __init__(self, db: Session):
        self.db = db
        self.site_config = SiteConfigRepository(db)

    def load(self) -> dict:
        data = self.site_config.get_json(DATABASE_PROVIDER_CONFIG_KEY, default=None)
        if data is None:
            return default_provider_config()
        return normalize_provider_config(data)

    def save(self, config: dict) -> dict:
        normalized = normalize_provider_config(config)
        self.site_config.set_json(DATABASE_PROVIDER_CONFIG_KEY, normalized)
        return normalized


class UserBotLinkRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_and_platform(self, user_id: str, platform: str) -> UserBotLink | None:
        return self.db.query(UserBotLink).filter(
            UserBotLink.user_id == str(user_id),
            UserBotLink.platform == platform,
        ).order_by(
            UserBotLink.is_verified.desc(),
            UserBotLink.linked_at.desc(),
            UserBotLink.updated_at.desc(),
            UserBotLink.id.desc(),
        ).first()

    def list_by_user(self, user_id: str) -> list[UserBotLink]:
        return self.db.query(UserBotLink).filter(UserBotLink.user_id == str(user_id)).order_by(
            UserBotLink.platform.asc(),
            UserBotLink.is_verified.desc(),
            UserBotLink.linked_at.desc(),
            UserBotLink.updated_at.desc(),
            UserBotLink.id.desc(),
        ).all()

    def get_by_link_code(self, platform: str, link_code: str) -> UserBotLink | None:
        normalized_code = (link_code or "").strip().upper()
        return self.db.query(UserBotLink).filter(
            UserBotLink.platform == platform,
            func.upper(UserBotLink.link_code) == normalized_code,
        ).first()

    def get_by_platform_identity(self, platform: str, platform_user_id: str) -> UserBotLink | None:
        return self.db.query(UserBotLink).filter(
            UserBotLink.platform == platform,
            UserBotLink.platform_user_id == str(platform_user_id),
        ).first()

    def create_pending_link(self, user_id: str, platform: str, platform_user_id: str) -> UserBotLink:
        item = UserBotLink(user_id=str(user_id), platform=platform, platform_user_id=str(platform_user_id))
        self.db.add(item)
        self.db.flush()
        return item

    def touch_identity(
        self,
        item: UserBotLink,
        *,
        platform_username: str | None = None,
        dm_channel_id: str | None = None,
        metadata: dict | None = None,
        last_seen_at: datetime | None = None,
    ) -> UserBotLink:
        if platform_username:
            item.platform_username = platform_username
        if dm_channel_id:
            item.dm_channel_id = dm_channel_id
        if metadata:
            item.metadata_json = {**(item.metadata_json or {}), **metadata}
        if last_seen_at is not None:
            item.last_seen_at = last_seen_at
        return item

    def mark_link_code(self, item: UserBotLink, *, link_code: str, expires_at: datetime) -> UserBotLink:
        item.link_code = link_code
        item.link_code_expires_at = expires_at
        return item

    def mark_linked(
        self,
        item: UserBotLink,
        *,
        user_id: str,
        platform_user_id: str,
        verified: bool,
        linked_at: datetime | None,
        last_seen_at: datetime | None,
    ) -> UserBotLink:
        item.user_id = str(user_id)
        item.platform_user_id = str(platform_user_id)
        item.is_verified = verified
        item.linked_at = linked_at
        item.last_seen_at = last_seen_at
        item.link_code = None
        item.link_code_expires_at = None
        return item

    def unlink(self, item: UserBotLink) -> UserBotLink:
        item.user_id = None
        item.is_verified = False
        item.link_code = None
        item.link_code_expires_at = None
        item.linked_at = None
        return item
