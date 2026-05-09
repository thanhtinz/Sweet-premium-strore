from urllib import request, error
import json

from db import session_scope
from api.bot_links import build_bot_response, upsert_platform_identity
from .config import DISCORD_BOT_TOKEN, DISCORD_ADMIN_CHANNEL_ID


def send_discord_message(message: str, channel_id: str = DISCORD_ADMIN_CHANNEL_ID):
    if not DISCORD_BOT_TOKEN or not channel_id or not message:
        return False

    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    payload = json.dumps({"content": message}).encode("utf-8")
    req = request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "digital-product-shop/discord-dm-compat",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as resp:
            return 200 <= getattr(resp, "status", 0) < 300
    except error.HTTPError:
        return False
    except Exception:
        return False


def sync_discord_dm_identity(platform_user_id: str, *, platform_username: str | None = None, dm_channel_id: str | None = None, metadata: dict | None = None):
    with session_scope() as db:
        upsert_platform_identity(
            db,
            platform="discord",
            platform_user_id=str(platform_user_id),
            platform_username=platform_username,
            dm_channel_id=dm_channel_id,
            metadata=metadata or {"source": "discord_dm"},
        )


def handle_discord_dm(platform_user_id: str, text: str) -> str:
    with session_scope() as db:
        return build_bot_response(db, "discord", platform_user_id, text)
