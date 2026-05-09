import os

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from db.providers import (
    SUPPORTED_SQL_PROVIDERS,
    build_engine,
    describe_database_url,
    mask_database_url,
    provider_env_override,
)
from db.repositories import DatabaseProviderConfigRepository, SiteConfigRepository

SETTINGS_KEYS = [
    "settings_general",
    "settings_appearance",
    "settings_scripts",
    "settings_images",
    "settings_security",
    "settings_captcha",
    "settings_features",
]

PAYOS_SETTING_KEYS = ["payos_client_id", "payos_api_key", "payos_checksum_key", "app_base_url"]


def mask_value(val: str) -> str:
    if not val or len(val) <= 8:
        return "••••••••" if val else ""
    return val[:4] + "••••" + val[-4:]


def get_public_settings_payload(db: Session, legacy_settings: dict[str, str]) -> dict:
    result = dict(legacy_settings)
    rows = SiteConfigRepository(db).get_many_json(["settings_general", "settings_images", "settings_features", "settings_appearance"])
    for key, data in rows.items():
        if not isinstance(data, dict):
            data = {}
        if key == "settings_general":
            if data.get("title") and not result.get("site_name"):
                result["site_name"] = data["title"]
            if data.get("site_description") and not result.get("site_description"):
                result["site_description"] = data["site_description"]
            if data.get("copyright_text"):
                result["copyright_text"] = data["copyright_text"]
            for field in ["currency_name", "currency_icon", "tax_rate", "contact_email", "contact_phone", "contact_hours", "social_fb", "social_tele", "social_discord"]:
                if field in data and data[field] is not None:
                    result[field] = data[field]
        elif key == "settings_images":
            for field in ["logo_url", "favicon_url", "default_image_url", "default_avatar_url"]:
                if data.get(field):
                    result[field] = data[field]
        elif key == "settings_features":
            result["features"] = data
        elif key == "settings_appearance":
            if data.get("home_categories"):
                result["home_categories"] = data["home_categories"]
    return result


def get_payment_config_payload(db: Session) -> dict:
    repo = SiteConfigRepository(db)
    cfg = {key: (repo.get_value(key) or "") for key in PAYOS_SETTING_KEYS}
    env_client_id = os.environ.get("PAYOS_CLIENT_ID", "")
    env_api_key = os.environ.get("PAYOS_API_KEY", "")
    env_checksum_key = os.environ.get("PAYOS_CHECKSUM_KEY", "")
    env_base_url = os.environ.get("APP_BASE_URL", "")
    if env_client_id:
        cfg["payos_client_id"] = env_client_id
    if env_api_key:
        cfg["payos_api_key"] = env_api_key
    if env_checksum_key:
        cfg["payos_checksum_key"] = env_checksum_key
    if env_base_url:
        cfg["app_base_url"] = env_base_url
    return {
        "payos_client_id": cfg["payos_client_id"],
        "payos_api_key": mask_value(cfg["payos_api_key"]),
        "payos_checksum_key": mask_value(cfg["payos_checksum_key"]),
        "app_base_url": cfg["app_base_url"],
        "has_env_override": bool(env_client_id or env_api_key or env_checksum_key),
    }


def update_payment_config_values(db: Session, data: dict) -> list[str]:
    env_client_id = os.environ.get("PAYOS_CLIENT_ID", "")
    env_api_key = os.environ.get("PAYOS_API_KEY", "")
    env_checksum_key = os.environ.get("PAYOS_CHECKSUM_KEY", "")
    env_base_url = os.environ.get("APP_BASE_URL", "")
    updates = {}
    if "payos_client_id" in data and not env_client_id:
        updates["payos_client_id"] = str(data["payos_client_id"])
    if "payos_api_key" in data and not env_api_key:
        updates["payos_api_key"] = str(data["payos_api_key"])
    if "payos_checksum_key" in data and not env_checksum_key:
        updates["payos_checksum_key"] = str(data["payos_checksum_key"])
    if "app_base_url" in data and not env_base_url:
        updates["app_base_url"] = str(data["app_base_url"])
    repo = SiteConfigRepository(db)
    for key, value in updates.items():
        repo.set_value(key, value)
    db.commit()
    return list(updates.keys())


def load_database_provider_config(db: Session) -> dict:
    return DatabaseProviderConfigRepository(db).load()


def save_database_provider_config(db: Session, config: dict) -> dict:
    normalized = DatabaseProviderConfigRepository(db).save(config)
    db.commit()
    return normalized


def serialize_database_provider_config(config: dict) -> dict:
    active_provider = config["active_provider"]
    providers = {}
    for provider, provider_cfg in config["providers"].items():
        env_override = provider_env_override(provider)
        effective_url = env_override["database_url"] or provider_cfg.get("database_url", "")
        providers[provider] = {
            "enabled": bool(provider_cfg.get("enabled")),
            "label": provider_cfg.get("label") or provider,
            "has_stored_url": bool(provider_cfg.get("database_url")),
            "has_env_override": bool(env_override["database_url"]),
            "env_source": env_override["source"],
            **describe_database_url(effective_url),
        }
    return {
        "active_provider": active_provider,
        "supported_providers": sorted(SUPPORTED_SQL_PROVIDERS),
        "providers": providers,
    }


def merge_database_provider_config(current: dict, data: dict) -> dict:
    merged = {
        "active_provider": data.get("active_provider", current["active_provider"]),
        "providers": {},
    }
    incoming_providers = data.get("providers") if isinstance(data.get("providers"), dict) else {}
    for provider, provider_cfg in current["providers"].items():
        incoming = incoming_providers.get(provider) if isinstance(incoming_providers.get(provider), dict) else {}
        next_url = incoming.get("database_url", provider_cfg.get("database_url", ""))
        if isinstance(next_url, str):
            next_url = next_url.strip()
        if next_url == "":
            next_url = provider_cfg.get("database_url", "")
        merged["providers"][provider] = {
            "enabled": incoming.get("enabled", provider_cfg.get("enabled")),
            "database_url": next_url,
            "label": incoming.get("label", provider_cfg.get("label", provider)),
        }
    return merged


def test_database_connection_payload(db: Session, data: dict) -> dict:
    provider = data.get("provider")
    database_url = (data.get("database_url") or "").strip()
    if not provider:
        config = load_database_provider_config(db)
        provider = config["active_provider"]
        provider_cfg = config["providers"].get(provider, {})
        env_override = provider_env_override(provider)
        database_url = database_url or env_override["database_url"] or provider_cfg.get("database_url", "")
    provider = str(provider).strip().lower()
    if provider not in SUPPORTED_SQL_PROVIDERS:
        raise ValueError("Unsupported provider")
    if not database_url:
        raise ValueError("Database URL is required for connection test")
    try:
        engine = build_engine(type("Cfg", (), {"provider": provider, "database_url": database_url, "source": "manual"})())
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return {"ok": True, "provider": provider, "masked_url": mask_database_url(database_url)}
    except SQLAlchemyError as exc:
        return {"ok": False, "provider": provider, "masked_url": mask_database_url(database_url), "error": str(exc.__class__.__name__)}
