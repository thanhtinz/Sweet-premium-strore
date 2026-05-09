from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from db.providers import resolve_runtime_config_with_persisted_fallback
from tests.provider_harness import provider_env


def test_mysql_provider_env_harness_shape():
    with provider_env('mysql', 'mysql+pymysql://user:pass@localhost/db'):
        cfg = resolve_runtime_config_with_persisted_fallback(lambda: None)
        assert cfg.provider == 'mysql'
        assert cfg.database_url.startswith('mysql+pymysql://')


def test_supabase_provider_env_harness_shape():
    with provider_env('supabase_postgres', 'postgresql://user:pass@localhost/db'):
        cfg = resolve_runtime_config_with_persisted_fallback(lambda: None)
        assert cfg.provider == 'supabase_postgres'
        assert cfg.database_url.startswith('postgresql://')
