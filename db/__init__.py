from contextlib import contextmanager

from sqlalchemy.orm import declarative_base

from db.providers import (
    build_engine,
    build_session_local,
    resolve_database_runtime_config,
    resolve_runtime_config_with_persisted_fallback,
)


def _load_persisted_provider_config():
    try:
        from db.repositories import DatabaseProviderConfigRepository
        bootstrap_config = resolve_database_runtime_config()
        bootstrap_engine = build_engine(bootstrap_config)
        BootstrapSessionLocal = build_session_local(bootstrap_engine)
        db = BootstrapSessionLocal()
        try:
            return DatabaseProviderConfigRepository(db).load()
        finally:
            db.close()
            bootstrap_engine.dispose()
    except Exception:
        return None


runtime_config = resolve_runtime_config_with_persisted_fallback(_load_persisted_provider_config)
DATABASE_PROVIDER = runtime_config.provider
DATABASE_URL = runtime_config.database_url
DATABASE_URL_SOURCE = runtime_config.source

engine = build_engine(runtime_config)
SessionLocal = build_session_local(engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
