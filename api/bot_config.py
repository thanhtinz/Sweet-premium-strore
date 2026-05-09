from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import SessionLocal
from db.models import SiteConfig
from api.auth import get_current_admin
import json
import os

router = APIRouter(prefix="/admin/bot-config", tags=["admin-bot"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/settings", dependencies=[Depends(get_current_admin)])
def get_bot_config(db: Session = Depends(get_db)):
    config = db.query(SiteConfig).filter_by(key="bot_smtp_config").first()
    if not config:
        return {}
    try:
        data = json.loads(config.value)
    except:
        return {}
    data["bot_commands"] = [
        {"command": "/start", "description": "Chào mừng và hướng dẫn liên kết"},
        {"command": "/help", "description": "Xem danh sách lệnh"},
        {"command": "/link CODE", "description": "Liên kết tài khoản"},
        {"command": "/status", "description": "Xem trạng thái liên kết"},
        {"command": "/account", "description": "Xem thông tin tài khoản"},
        {"command": "/orders", "description": "Xem đơn hàng gần đây"},
        {"command": "/support", "description": "Xem hướng dẫn hỗ trợ"},
        {"command": "/unlink", "description": "Gỡ liên kết bot"},
    ]
    data["link_storage"] = "DB table user_bot_links"
    data["discord_mode"] = "single_user_dm_bot"
    data["telegram_mode"] = "split_admin_user"
    return data

@router.get("/public")
def get_bot_public_info(db: Session = Depends(get_db)):
    """Public endpoint: returns only non-sensitive bot info for user profile"""
    config = db.query(SiteConfig).filter_by(key="bot_smtp_config").first()
    if not config:
        return {}
    try:
        data = json.loads(config.value)
        return {
            "has_telegram": bool(data.get("telegram_user_token") or data.get("telegram_token")),
            "has_discord": bool(data.get("discord_token")),
            "discord_invite": data.get("discord_invite", ""),
            "telegram_bot_username": data.get("telegram_bot_username", ""),
            "telegram_user_welcome": data.get("telegram_user_welcome", ""),
            "discord_mode": "single_user_dm_bot",
            "telegram_mode": "split_admin_user",
        }
    except:
        return {}

@router.put("/settings", dependencies=[Depends(get_current_admin)])
def update_bot_config(data: dict, db: Session = Depends(get_db)):
    config = db.query(SiteConfig).filter_by(key="bot_smtp_config").first()
    if not config:
        config = SiteConfig(key="bot_smtp_config", value=json.dumps(data))
        db.add(config)
    else:
        config.value = json.dumps(data)
    db.commit()
    
    # Update env file as well so bot can read it easily
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.bot")
    with open(env_path, "w") as f:
        f.write(f"TELEGRAM_BOT_TOKEN={data.get('telegram_token', '')}\n")
        f.write(f"TELEGRAM_ADMIN_CHAT_ID={data.get('telegram_admin_id', '')}\n")
        f.write(f"DISCORD_BOT_TOKEN={data.get('discord_token', '')}\n")
        f.write(f"DISCORD_ADMIN_CHANNEL_ID={data.get('discord_admin_id', '')}\n")
        f.write(f"SMTP_SERVER={data.get('smtp_server', '')}\n")
        f.write(f"SMTP_PORT={data.get('smtp_port', '587')}\n")
        f.write(f"SMTP_USERNAME={data.get('smtp_user', '')}\n")
        f.write(f"SMTP_PASSWORD={data.get('smtp_pass', '')}\n")
        f.write(f"SMTP_FROM_EMAIL={data.get('smtp_from', '')}\n")
        
    return {"message": "Config updated"}
