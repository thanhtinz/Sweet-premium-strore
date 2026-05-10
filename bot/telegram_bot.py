import httpx
from db import session_scope
from api.bot_links import build_bot_response
from .config import TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_USER_BOT_TOKEN


def send_telegram_message(message: str, chat_id: str = TELEGRAM_ADMIN_CHAT_ID, *, token: str | None = None):
    bot_token = token or TELEGRAM_BOT_TOKEN
    if not bot_token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }

    try:
        response = httpx.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception:
        return False


def send_telegram_user_message(message: str, chat_id: str):
    return send_telegram_message(message, chat_id=chat_id, token=TELEGRAM_USER_BOT_TOKEN or TELEGRAM_BOT_TOKEN)


def handle_telegram_dm(platform_user_id: str, text: str) -> str:
    with session_scope() as db:
        return build_bot_response(db, "telegram", platform_user_id, text)
