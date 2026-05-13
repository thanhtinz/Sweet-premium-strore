from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.repositories import SiteConfigRepository
from api.auth import get_current_admin
import json
import os

router = APIRouter(prefix="/admin/bot-config", tags=["admin-bot"])

# M4: mask sensitive token/password fields when returning to admin UI.
# The client sends the same string back to indicate "no change".
MASKED_FIELDS = (
    "telegram_token", "telegram_user_token", "discord_token",
    "smtp_pass",
)
MASK_SENTINEL = "********"


def _mask_value(v: str | None) -> str:
    s = (v or "").strip()
    if not s:
        return ""
    return MASK_SENTINEL


def _mask_secrets(data: dict) -> dict:
    out = dict(data or {})
    for k in MASKED_FIELDS:
        if out.get(k):
            out[k] = _mask_value(out[k])
    return out


def _merge_secrets(new_data: dict, existing: dict) -> dict:
    """Restore original secret if client sent the mask sentinel back unchanged."""
    out = dict(new_data or {})
    for k in MASKED_FIELDS:
        incoming = out.get(k)
        if incoming == MASK_SENTINEL or incoming == "":
            # treat empty string as "no change" too, unless explicit clear marker
            if incoming == MASK_SENTINEL:
                out[k] = existing.get(k, "")
    return out


def _telegram_user_bot_username(data: dict) -> str:
    user_username = (data.get("telegram_user_bot_username") or "").strip()
    if user_username:
        return user_username.lstrip("@")
    admin_token = (data.get("telegram_token") or "").strip()
    user_token = (data.get("telegram_user_token") or "").strip()
    if user_token and user_token != admin_token:
        return ""
    return (data.get("telegram_bot_username") or "").strip().lstrip("@")


@router.get("/settings", dependencies=[Depends(get_current_admin)])
def get_bot_config(db: Session = Depends(get_db)):
    default_commands = [
        {"command": "/start", "description": "Chào mừng và hướng dẫn liên kết"},
        {"command": "/help", "description": "Xem danh sách lệnh"},
        {"command": "/link CODE", "description": "Liên kết tài khoản"},
        {"command": "/status", "description": "Xem trạng thái liên kết"},
        {"command": "/account", "description": "Xem thông tin tài khoản"},
        {"command": "/orders", "description": "Xem đơn hàng gần đây"},
        {"command": "/support", "description": "Xem hướng dẫn hỗ trợ"},
        {"command": "/unlink", "description": "Gỡ liên kết bot"},
    ]
    repo = SiteConfigRepository(db)
    data = repo.get_json("bot_smtp_config", default={}) or {}
    data["bot_commands"] = default_commands
    data["link_storage"] = "DB table user_bot_links"
    data["discord_mode"] = "single_user_dm_bot"
    data["discord_link_methods"] = ["dm_code", "oauth_auto_link", "manual_uid"]
    data["telegram_mode"] = "split_admin_user"
    return _mask_secrets(data)

@router.get("/public")
def get_bot_public_info(db: Session = Depends(get_db)):
    """Public endpoint: returns only non-sensitive bot info for user profile"""
    data = SiteConfigRepository(db).get_json("bot_smtp_config", default={}) or {}
    return {
        "has_telegram": bool(data.get("telegram_user_token") or data.get("telegram_token")),
        "has_discord": bool(data.get("discord_token")),
        "discord_invite": data.get("discord_invite", ""),
        "discord_mode": "single_user_dm_bot",
        "discord_link_methods": ["dm_code", "oauth_auto_link", "manual_uid"],
        "discord_dm_hint": data.get("discord_dm_hint", "Mở bot Discord, gửi /link CODE trong DM hoặc đăng nhập bằng Discord để auto-link."),
        "telegram_bot_username": _telegram_user_bot_username(data),
        "telegram_admin_bot_username": (data.get("telegram_bot_username") or "").strip().lstrip("@"),
        "telegram_user_bot_username": _telegram_user_bot_username(data),
        "telegram_user_welcome": data.get("telegram_user_welcome", ""),
        "telegram_mode": "split_admin_user",
    }

@router.put("/settings", dependencies=[Depends(get_current_admin)])
def update_bot_config(data: dict, db: Session = Depends(get_db)):
    repo = SiteConfigRepository(db)
    existing = repo.get_json("bot_smtp_config", default={}) or {}
    data = _merge_secrets(data, existing)
    repo.set_json("bot_smtp_config", data)
    db.commit()
    
    # Update env file as well so bot can read it easily
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.bot")
    with open(env_path, "w") as f:
        f.write(f"TELEGRAM_BOT_TOKEN={data.get('telegram_token', '')}\n")
        f.write(f"TELEGRAM_USER_BOT_TOKEN={data.get('telegram_user_token', '')}\n")
        f.write(f"TELEGRAM_BOT_USERNAME={data.get('telegram_bot_username', '')}\n")
        f.write(f"TELEGRAM_USER_BOT_USERNAME={data.get('telegram_user_bot_username', '')}\n")
        f.write(f"TELEGRAM_ADMIN_CHAT_ID={data.get('telegram_admin_id', '')}\n")
        f.write(f"DISCORD_BOT_TOKEN={data.get('discord_token', '')}\n")
        f.write(f"DISCORD_ADMIN_CHANNEL_ID={data.get('discord_admin_id', '')}\n")
        f.write(f"SMTP_SERVER={data.get('smtp_server', '')}\n")
        f.write(f"SMTP_PORT={data.get('smtp_port', '587')}\n")
        f.write(f"SMTP_USERNAME={data.get('smtp_user', '')}\n")
        f.write(f"SMTP_PASSWORD={data.get('smtp_pass', '')}\n")
        f.write(f"SMTP_FROM_EMAIL={data.get('smtp_from', '')}\n")
        
    return {"message": "Config updated"}


from pydantic import BaseModel

class BotTestRequest(BaseModel):
    token: str

class MailTestRequest(BaseModel):
    to_email: str

@router.post("/test-mail", dependencies=[Depends(get_current_admin)])
def test_mail(data: MailTestRequest, db: Session = Depends(get_db)):
    import smtplib
    from email.mime.text import MIMEText
    config = SiteConfigRepository(db).get_json("bot_smtp_config", default={}) or {}
    server = config.get("smtp_server", "")
    port = int(config.get("smtp_port", 587) or 587)
    user = config.get("smtp_user", "")
    password = config.get("smtp_pass", "")
    from_email = config.get("smtp_from", "") or user
    if not server or not user or not password:
        raise HTTPException(400, "Chưa cấu hình SMTP đầy đủ")
    try:
        msg = MIMEText("Đây là email test từ hệ thống. Nếu bạn nhận được email này, cấu hình SMTP đã hoạt động.", "plain", "utf-8")
        msg["Subject"] = "Test email hệ thống"
        msg["From"] = from_email
        msg["To"] = data.to_email
        with smtplib.SMTP(server, port) as s:
            s.starttls()
            s.login(user, password)
            s.send_message(msg)
        return {"message": f"Gửi thành công đến {data.to_email}"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(400, "Sai tài khoản hoặc mật khẩu SMTP")
    except smtplib.SMTPConnectError:
        raise HTTPException(400, f"Không kết nối được {server}:{port}")
    except Exception as e:
        raise HTTPException(400, f"Lỗi: {str(e)}")

@router.post("/test-telegram", dependencies=[Depends(get_current_admin)])
async def test_telegram_connection(data: BotTestRequest):
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.telegram.org/bot{data.token}/getMe")
            if resp.status_code == 200:
                bot_info = resp.json().get("result", {})
                return {"message": f"Kết nối thành công! Bot: @{bot_info.get('username')}"}
            else:
                return {"message": "Kết nối thất bại (Sai Token)"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi: {str(e)}")

@router.post("/test-discord", dependencies=[Depends(get_current_admin)])
async def test_discord_connection(data: BotTestRequest):
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://discord.com/api/v10/users/@me",
                headers={"Authorization": f"Bot {data.token}"}
            )
            if resp.status_code == 200:
                bot_info = resp.json()
                return {"message": f"Kết nối thành công! Bot: {bot_info.get('username')}"}
            else:
                return {"message": "Kết nối thất bại (Sai Token)"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi: {str(e)}")
