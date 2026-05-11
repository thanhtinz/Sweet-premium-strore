from sqlalchemy import inspect, text

SCHEMA_VERSION_TABLE = "schema_version_state"
LATEST_SCHEMA_VERSION = 5


def ensure_schema_version_table(conn):
    dialect = conn.engine.dialect.name
    if dialect == "postgresql":
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {SCHEMA_VERSION_TABLE} (
                key VARCHAR(100) PRIMARY KEY,
                version INTEGER NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
    elif dialect == "mysql":
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {SCHEMA_VERSION_TABLE} (
                `key` VARCHAR(100) PRIMARY KEY,
                version INTEGER NOT NULL,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
    else:
        raise RuntimeError(f"Unsupported SQL dialect for schema versioning: {dialect}")


def get_schema_version(conn, key: str = "default") -> int:
    ensure_schema_version_table(conn)
    row = conn.execute(text(f"SELECT version FROM {SCHEMA_VERSION_TABLE} WHERE key = :key"), {"key": key}).fetchone()
    return int(row[0]) if row else 0


def set_schema_version(conn, version: int, key: str = "default"):
    dialect = conn.engine.dialect.name
    if dialect == "postgresql":
        conn.execute(text(f"""
            INSERT INTO {SCHEMA_VERSION_TABLE} (key, version)
            VALUES (:key, :version)
            ON CONFLICT (key)
            DO UPDATE SET version = EXCLUDED.version, updated_at = CURRENT_TIMESTAMP
        """), {"key": key, "version": version})
    elif dialect == "mysql":
        conn.execute(text(f"""
            INSERT INTO {SCHEMA_VERSION_TABLE} (`key`, version)
            VALUES (:key, :version)
            ON DUPLICATE KEY UPDATE version = VALUES(version), updated_at = CURRENT_TIMESTAMP
        """), {"key": key, "version": version})
    else:
        raise RuntimeError(f"Unsupported SQL dialect for schema versioning: {dialect}")


def apply_versioned_patches(conn, patch_steps: list[tuple[int, callable]]):
    current_version = get_schema_version(conn)
    for version, patch_fn in sorted(patch_steps, key=lambda item: item[0]):
        if version <= current_version:
            continue
        patch_fn(conn)
        set_schema_version(conn, version)
