import json
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from db import SessionLocal
from db.init_db import init_db
from db.models import SiteConfig
from api.bot_links import link_platform_account



def main():
    init_db()
    db = SessionLocal()
    try:
        row = db.query(SiteConfig).filter_by(key="bot_smtp_config").first()
        if not row or not row.value:
            print("No bot_smtp_config found")
            return
        try:
            data = json.loads(row.value)
        except Exception:
            print("Invalid bot_smtp_config JSON")
            return

        mappings = data.get("telegram_user_links") or data.get("telegram_user_map") or {}
        if not isinstance(mappings, dict) or not mappings:
            print("No legacy telegram mappings found")
            return

        migrated = 0
        skipped = 0
        for user_id, chat_id in mappings.items():
            user_id = str(user_id).strip()
            chat_id = str(chat_id).strip()
            if not user_id or not chat_id:
                skipped += 1
                continue
            link_platform_account(
                db,
                user_id=user_id,
                platform="telegram",
                platform_user_id=chat_id,
                dm_channel_id=chat_id,
                metadata={"source": "legacy_json_backfill"},
                verified=True,
            )
            migrated += 1
        print(f"Migrated {migrated} telegram mappings; skipped {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
