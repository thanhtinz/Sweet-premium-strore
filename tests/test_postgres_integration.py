from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from db import session_scope
from db.init_db import init_db
from db.models import SiteConfig, UserBotLink
from tests.provider_harness import assert_health_ok, build_test_client


def test_postgres_boot_and_config_crud():
    init_db()
    client = build_test_client()
    assert_health_ok(client)

    with session_scope() as db:
        row = db.query(SiteConfig).filter(SiteConfig.key == 'integration_test_config').first()
        if not row:
            row = SiteConfig(key='integration_test_config', value='{"ok": true}')
            db.add(row)
        else:
            row.value = '{"ok": true}'

    with session_scope() as db:
        row = db.query(SiteConfig).filter(SiteConfig.key == 'integration_test_config').first()
        assert row is not None
        assert row.value == '{"ok": true}'


def test_postgres_user_bot_links_table_ready():
    init_db()
    with session_scope() as db:
        count = db.query(UserBotLink).count()
        assert count >= 0
