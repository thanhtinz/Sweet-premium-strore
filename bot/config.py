import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.bot"), override=False)


def _load_db_bot_config() -> dict:
    try:
        from db import SessionLocal
        from db.repositories import SiteConfigRepository

        db = SessionLocal()
        try:
            return SiteConfigRepository(db).get_json("bot_smtp_config", default={}) or {}
        finally:
            db.close()
    except Exception:
        return {}


_DB_BOT_CONFIG = _load_db_bot_config()


def _config_value(env_key: str, db_key: str, default: str = "") -> str:
    env_value = os.getenv(env_key, "")
    if env_value:
        return env_value
    return str(_DB_BOT_CONFIG.get(db_key) or default)


TELEGRAM_BOT_TOKEN = _config_value("TELEGRAM_BOT_TOKEN", "telegram_token")
TELEGRAM_USER_BOT_TOKEN = _config_value("TELEGRAM_USER_BOT_TOKEN", "telegram_user_token")
TELEGRAM_BOT_USERNAME = _config_value("TELEGRAM_BOT_USERNAME", "telegram_bot_username")
TELEGRAM_USER_BOT_USERNAME = _config_value("TELEGRAM_USER_BOT_USERNAME", "telegram_user_bot_username")
TELEGRAM_ADMIN_CHAT_ID = _config_value("TELEGRAM_ADMIN_CHAT_ID", "telegram_admin_id")

DISCORD_BOT_TOKEN = _config_value("DISCORD_BOT_TOKEN", "discord_token")
DISCORD_ADMIN_CHANNEL_ID = _config_value("DISCORD_ADMIN_CHANNEL_ID", "discord_admin_id")
DISCORD_USER_CHANNEL_ID = os.getenv("DISCORD_USER_CHANNEL_ID", "")

SMTP_SERVER = _config_value("SMTP_SERVER", "smtp_server")
SMTP_PORT = int(_config_value("SMTP_PORT", "smtp_port", "587") or 587)
SMTP_USERNAME = _config_value("SMTP_USERNAME", "smtp_user")
SMTP_PASSWORD = _config_value("SMTP_PASSWORD", "smtp_pass")
SMTP_FROM_EMAIL = _config_value("SMTP_FROM_EMAIL", "smtp_from")
