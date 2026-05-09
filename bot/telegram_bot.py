import httpx
from db import session_scope
from api.bot_links import build_bot_response
from .config import TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID


def send_telegram_message(message: str, chat_id: str = TELEGRAM_ADMIN_CHAT_ID):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
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


def handle_telegram_dm(platform_user_id: str, text: str) -> str:
    with session_scope() as db:
        return build_bot_response(db, "telegram", platform_user_id, text)
