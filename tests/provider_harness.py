import os
from contextlib import contextmanager
from pathlib import Path
import sys

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


PROVIDER_ENV_KEYS = {
    'postgres': ['DB_PROVIDER', 'POSTGRES_DATABASE_URL', 'DATABASE_URL'],
    'mysql': ['DB_PROVIDER', 'MYSQL_DATABASE_URL', 'DATABASE_URL'],
    'supabase_postgres': ['DB_PROVIDER', 'SUPABASE_DATABASE_URL', 'POSTGRES_DATABASE_URL', 'DATABASE_URL'],
}


@contextmanager
def provider_env(provider: str, database_url: str | None = None):
    keys = set().union(*PROVIDER_ENV_KEYS.values())
    backup = {key: os.environ.get(key) for key in keys}
    try:
        for key in keys:
            os.environ.pop(key, None)
        os.environ['DB_PROVIDER'] = provider
        if database_url:
            if provider == 'postgres':
                os.environ['POSTGRES_DATABASE_URL'] = database_url
            elif provider == 'mysql':
                os.environ['MYSQL_DATABASE_URL'] = database_url
            elif provider == 'supabase_postgres':
                os.environ['SUPABASE_DATABASE_URL'] = database_url
        yield
    finally:
        for key in keys:
            os.environ.pop(key, None)
        for key, value in backup.items():
            if value is not None:
                os.environ[key] = value


def build_test_client():
    from routes import create_app
    app = create_app('static')
    return TestClient(app)


def assert_health_ok(client: TestClient):
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json()['ok'] is True
