from sqlalchemy import inspect, text

from db import Base, DATABASE_PROVIDER, engine
from db.models import (  # noqa: F401 — import to register models
    Category, Product, ProductPackage, StockItem,
    PackageField, Order, OrderItem, SiteSetting, AdminUser, User,
    Announcement, UploadedImage, UserBotLink, ApiKey, ApiProvider,
    CardChargeTransaction, SmmPlatform, SmmCategory, SmmService, SmmOrder
)
from db.schema_version import LATEST_SCHEMA_VERSION, apply_versioned_patches


def _dialect_name() -> str:
    return engine.dialect.name


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def _add_missing_columns(conn, inspector, table_name: str, columns: list[tuple[str, str]]):
    for column_name, ddl in columns:
        if not _has_column(inspector, table_name, column_name):
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))


def _ensure_indexes(conn, inspector):
    if not _has_index(inspector, "user_bot_links", "uq_user_bot_links_platform_user"):
        conn.execute(text("CREATE UNIQUE INDEX uq_user_bot_links_platform_user ON user_bot_links(platform, platform_user_id)"))

    if not _has_index(inspector, "user_bot_links", "ix_user_bot_links_user_platform"):
        conn.execute(text("CREATE INDEX ix_user_bot_links_user_platform ON user_bot_links(user_id, platform)"))

    if not _has_index(inspector, "user_bot_links", "ix_user_bot_links_platform_verified"):
        conn.execute(text("CREATE INDEX ix_user_bot_links_platform_verified ON user_bot_links(platform, is_verified)"))

    if not _has_index(inspector, "user_bot_links", "uq_user_bot_links_link_code"):
        if _dialect_name() == "postgresql":
            conn.execute(text("CREATE UNIQUE INDEX uq_user_bot_links_link_code ON user_bot_links(link_code) WHERE link_code IS NOT NULL"))
        else:
            conn.execute(text("CREATE UNIQUE INDEX uq_user_bot_links_link_code ON user_bot_links(link_code)"))

    if not _has_index(inspector, "order_items", "ix_order_items_order_id"):
        conn.execute(text("CREATE INDEX ix_order_items_order_id ON order_items(order_id)"))


def _ensure_order_items_table(conn):
    dialect = _dialect_name()
    if dialect == "postgresql":
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                package_id INTEGER REFERENCES product_packages(id) ON DELETE SET NULL,
                product_name_snapshot VARCHAR(255),
                package_name_snapshot VARCHAR(255),
                quantity INTEGER DEFAULT 1,
                unit_price NUMERIC(12, 2) NOT NULL,
                line_total NUMERIC(12, 2) NOT NULL,
                custom_fields_data JSON,
                delivery_data TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
    elif dialect == "mysql":
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
                order_id INTEGER NOT NULL,
                package_id INTEGER NULL,
                product_name_snapshot VARCHAR(255),
                package_name_snapshot VARCHAR(255),
                quantity INTEGER DEFAULT 1,
                unit_price NUMERIC(12, 2) NOT NULL,
                line_total NUMERIC(12, 2) NOT NULL,
                custom_fields_data JSON,
                delivery_data TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                CONSTRAINT fk_order_items_package FOREIGN KEY (package_id) REFERENCES product_packages(id) ON DELETE SET NULL
            )
        """))
    else:
        raise RuntimeError(f"Unsupported SQL dialect for init_db: {dialect} (provider={DATABASE_PROVIDER})")


def _patch_v1(conn):
    inspector = inspect(conn)
    _add_missing_columns(conn, inspector, "orders", [
        ("subtotal_amount", "subtotal_amount NUMERIC(12, 2)"),
        ("discount_amount", "discount_amount NUMERIC(12, 2)"),
        ("tax_amount", "tax_amount NUMERIC(12, 2)"),
        ("coupon_code", "coupon_code VARCHAR(100)"),
    ])


def _patch_v2(conn):
    inspector = inspect(conn)
    timestamp_type = "TIMESTAMP WITH TIME ZONE" if _dialect_name() == "postgresql" else "TIMESTAMP NULL"
    json_type = "JSON"
    _add_missing_columns(conn, inspector, "user_bot_links", [
        ("platform_username", "platform_username VARCHAR(255)"),
        ("dm_channel_id", "dm_channel_id VARCHAR(255)"),
        ("link_code", "link_code VARCHAR(64)"),
        ("link_code_expires_at", f"link_code_expires_at {timestamp_type}"),
        ("is_verified", "is_verified BOOLEAN DEFAULT FALSE"),
        ("metadata_json", f"metadata_json {json_type}"),
        ("linked_at", f"linked_at {timestamp_type}"),
        ("last_seen_at", f"last_seen_at {timestamp_type}"),
    ])
    _ensure_order_items_table(conn)
    _ensure_indexes(conn, inspect(conn))


def _patch_v3(conn):
    """Add allowed_domains and callback_url to api_keys."""
    inspector = inspect(conn)
    if "api_keys" in inspector.get_table_names():
        _add_missing_columns(conn, inspector, "api_keys", [
            ("allowed_domains", "allowed_domains TEXT"),
            ("callback_url", "callback_url TEXT"),
        ])


def _patch_v4(conn):
    """Add API provider support: new columns on categories, products, product_packages, orders, order_items."""
    inspector = inspect(conn)
    timestamp_type = "TIMESTAMP WITH TIME ZONE" if _dialect_name() == "postgresql" else "TIMESTAMP NULL"

    # Category: product_type
    _add_missing_columns(conn, inspector, "categories", [
        ("product_type", "product_type VARCHAR(20) DEFAULT 'premium'"),
    ])

    # Product: topup_type, server_region
    _add_missing_columns(conn, inspector, "products", [
        ("topup_type", "topup_type VARCHAR(20)"),
        ("server_region", "server_region VARCHAR(20)"),
    ])

    # ProductPackage: image_url, api fields
    _add_missing_columns(conn, inspector, "product_packages", [
        ("image_url", "image_url TEXT"),
        ("api_provider_id", "api_provider_id INTEGER REFERENCES api_providers(id) ON DELETE SET NULL"),
        ("external_product_id", "external_product_id VARCHAR(255)"),
        ("external_plan_id", "external_plan_id VARCHAR(255)"),
    ])

    # Order: api fields
    _add_missing_columns(conn, inspector, "orders", [
        ("api_provider_id", "api_provider_id INTEGER REFERENCES api_providers(id) ON DELETE SET NULL"),
        ("external_order_id", "external_order_id VARCHAR(255)"),
    ])

    # OrderItem: api fields
    _add_missing_columns(conn, inspector, "order_items", [
        ("external_order_id", "external_order_id VARCHAR(255)"),
        ("api_status", "api_status VARCHAR(50)"),
    ])


def _patch_v5(conn):
    """Add giftcard support: card_charge_transactions table, api_providers partner_id/card_rates, package auto_markup."""
    inspector = inspect(conn)

    # api_providers: partner_id + card_rates
    _add_missing_columns(conn, inspector, "api_providers", [
        ("partner_id", "partner_id VARCHAR(100)"),
        ("card_rates", "card_rates JSON"),
    ])

    # product_packages: auto_markup
    _add_missing_columns(conn, inspector, "product_packages", [
        ("auto_markup", "auto_markup BOOLEAN DEFAULT FALSE"),
        ("markup_percent", "markup_percent NUMERIC(5,2)"),
    ])

    # card_charge_transactions table
    if not inspector.has_table("card_charge_transactions"):
        num_type = "NUMERIC(12,2)"
        rate_type = "NUMERIC(5,2)"
        ts_type = "TIMESTAMP WITH TIME ZONE" if _dialect_name() == "postgresql" else "TIMESTAMP NULL"
        conn.execute(text(f"""
            CREATE TABLE card_charge_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                telco VARCHAR(30) NOT NULL,
                code VARCHAR(100) NOT NULL,
                serial VARCHAR(100) NOT NULL,
                declared_amount {num_type} NOT NULL,
                real_value {num_type},
                discount_rate {rate_type} NOT NULL DEFAULT 0,
                credited_amount {num_type},
                request_id VARCHAR(100) NOT NULL UNIQUE,
                trans_id VARCHAR(100),
                api_provider_id INTEGER REFERENCES api_providers(id) ON DELETE SET NULL,
                status VARCHAR(20) DEFAULT 'pending',
                callback_data JSON,
                balance_transaction_id INTEGER REFERENCES balance_transactions(id),
                ip_address VARCHAR(50),
                created_at {ts_type} DEFAULT NOW(),
                updated_at {ts_type} DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_card_charge_user ON card_charge_transactions(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_card_charge_request ON card_charge_transactions(request_id)"))


def _patch_v6(conn):
    """SMM Panel tables — created by create_all, just ensure extra indexes."""
    for stmt in [
        "CREATE INDEX IF NOT EXISTS idx_smm_orders_user ON smm_orders(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_smm_orders_status ON smm_orders(status)",
        "CREATE INDEX IF NOT EXISTS idx_smm_services_category ON smm_services(category_id)",
    ]:
        conn.execute(text(stmt))


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        apply_versioned_patches(conn, [
            (1, _patch_v1),
            (2, _patch_v2),
            (3, _patch_v3),
            (4, _patch_v4),
            (5, _patch_v5),
            (6, _patch_v6),
        ])
        if LATEST_SCHEMA_VERSION < 6:
            raise RuntimeError("LATEST_SCHEMA_VERSION is behind applied patch definitions")
