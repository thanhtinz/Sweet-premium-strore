import requests
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
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"Telegram error: {e}")
        return False
