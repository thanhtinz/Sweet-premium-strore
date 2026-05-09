import os
from dataclasses import dataclass
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker


POSTGRES = "postgres"
MYSQL = "mysql"
SUPABASE_POSTGRES = "supabase_postgres"
SUPPORTED_SQL_PROVIDERS = {POSTGRES, MYSQL, SUPABASE_POSTGRES}
DATABASE_PROVIDER_CONFIG_KEY = "db_provider_config"


@dataclass(frozen=True)
class DatabaseRuntimeConfig:
    provider: str
    database_url: str
    source: str


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _normalize_provider(value: str | None) -> str:
    raw = _clean(value).lower()
    aliases = {
        "postgresql": POSTGRES,
        "postgres": POSTGRES,
        "neon": POSTGRES,
        "mysql": MYSQL,
        "supabase": SUPABASE_POSTGRES,
        "supabase_postgres": SUPABASE_POSTGRES,
        "supabase-postgres": SUPABASE_POSTGRES,
    }
    return aliases.get(raw, raw or POSTGRES)


def _provider_candidates(provider: str) -> list[tuple[str, str]]:
    candidates: list[tuple[str, str]] = []
    if provider == POSTGRES:
        candidates.extend([
            ("POSTGRES_DATABASE_URL", _clean(os.environ.get("POSTGRES_DATABASE_URL"))),
            ("DB556FD74B_DATABASE_URL", _clean(os.environ.get("DB556FD74B_DATABASE_URL"))),
            ("DATABASE_URL", _clean(os.environ.get("DATABASE_URL"))),
        ])
    elif provider == MYSQL:
        candidates.extend([
            ("MYSQL_DATABASE_URL", _clean(os.environ.get("MYSQL_DATABASE_URL"))),
            ("DATABASE_URL", _clean(os.environ.get("DATABASE_URL"))),
        ])
    elif provider == SUPABASE_POSTGRES:
        candidates.extend([
            ("SUPABASE_DATABASE_URL", _clean(os.environ.get("SUPABASE_DATABASE_URL"))),
            ("POSTGRES_DATABASE_URL", _clean(os.environ.get("POSTGRES_DATABASE_URL"))),
            ("DATABASE_URL", _clean(os.environ.get("DATABASE_URL"))),
            ("DB556FD74B_DATABASE_URL", _clean(os.environ.get("DB556FD74B_DATABASE_URL"))),
        ])
    return candidates


def resolve_database_runtime_config() -> DatabaseRuntimeConfig:
    provider = _normalize_provider(os.environ.get("DB_PROVIDER"))
    if provider not in SUPPORTED_SQL_PROVIDERS:
        raise RuntimeError(
            f"Unsupported DB_PROVIDER '{provider}'. Supported values: {', '.join(sorted(SUPPORTED_SQL_PROVIDERS))}"
        )

    for source, value in _provider_candidates(provider):
        if value:
            return DatabaseRuntimeConfig(provider=provider, database_url=value, source=source)

    raise RuntimeError(
        "Database URL not configured for active provider. "
        "Set DB_PROVIDER and the matching *_DATABASE_URL env variable."
    )


def resolve_runtime_config_with_persisted_fallback(load_persisted_config=None) -> DatabaseRuntimeConfig:
    env_provider = _normalize_provider(os.environ.get("DB_PROVIDER"))
    if env_provider not in SUPPORTED_SQL_PROVIDERS:
        raise RuntimeError(
            f"Unsupported DB_PROVIDER '{env_provider}'. Supported values: {', '.join(sorted(SUPPORTED_SQL_PROVIDERS))}"
        )

    persisted = load_persisted_config() if callable(load_persisted_config) else None
    persisted_provider = None
    persisted_url = ""
    if isinstance(persisted, dict):
        persisted_provider = _normalize_provider(persisted.get("active_provider"))
        providers = persisted.get("providers") if isinstance(persisted.get("providers"), dict) else {}
        provider_cfg = providers.get(persisted_provider) if isinstance(providers.get(persisted_provider), dict) else {}
        persisted_url = _clean(provider_cfg.get("database_url"))

    if persisted_provider in SUPPORTED_SQL_PROVIDERS and persisted_url:
        return DatabaseRuntimeConfig(provider=persisted_provider, database_url=persisted_url, source="persisted_config")

    return resolve_database_runtime_config()


def build_engine(config: DatabaseRuntimeConfig) -> Engine:
    engine_kwargs = {"pool_pre_ping": True}
    if config.provider == MYSQL:
        engine_kwargs["pool_recycle"] = 3600
    return create_engine(config.database_url, **engine_kwargs)


def build_session_local(engine: Engine) -> sessionmaker:
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def mask_database_url(database_url: str) -> str:
    if not database_url:
        return ""
    parsed = urlparse(database_url)
    host = parsed.hostname or ""
    port = f":{parsed.port}" if parsed.port else ""
    db_name = parsed.path.lstrip("/") if parsed.path else ""
    auth = "••••"
    return f"{parsed.scheme}://{auth}@{host}{port}/{db_name}" if host or db_name else f"{parsed.scheme}://{auth}"


def describe_database_url(database_url: str) -> dict:
    if not database_url:
        return {
            "masked_url": "",
            "host": "",
            "port": None,
            "database_name": "",
        }
    parsed = urlparse(database_url)
    return {
        "masked_url": mask_database_url(database_url),
        "host": parsed.hostname or "",
        "port": parsed.port,
        "database_name": parsed.path.lstrip("/") if parsed.path else "",
    }


def default_provider_config() -> dict:
    return {
        "active_provider": POSTGRES,
        "providers": {
            POSTGRES: {"enabled": True, "database_url": "", "label": "Neon/Postgres"},
            MYSQL: {"enabled": False, "database_url": "", "label": "MySQL"},
            SUPABASE_POSTGRES: {"enabled": False, "database_url": "", "label": "Supabase Postgres"},
        },
    }


def normalize_provider_config(data: dict | None) -> dict:
    config = default_provider_config()
    if not isinstance(data, dict):
        return config

    active_provider = _normalize_provider(data.get("active_provider"))
    if active_provider in SUPPORTED_SQL_PROVIDERS:
        config["active_provider"] = active_provider

    providers = data.get("providers") if isinstance(data.get("providers"), dict) else {}
    for provider in SUPPORTED_SQL_PROVIDERS:
        incoming = providers.get(provider) if isinstance(providers.get(provider), dict) else {}
        config["providers"][provider]["enabled"] = bool(incoming.get("enabled", config["providers"][provider]["enabled"]))
        config["providers"][provider]["database_url"] = _clean(incoming.get("database_url"))
        if incoming.get("label"):
            config["providers"][provider]["label"] = str(incoming.get("label"))

    config["providers"][config["active_provider"]]["enabled"] = True
    return config


def provider_env_override(provider: str) -> dict:
    for source, value in _provider_candidates(provider):
        if value:
            return {"source": source, "database_url": value}
    return {"source": "", "database_url": ""}
