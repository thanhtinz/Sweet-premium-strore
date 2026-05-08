from sqlalchemy import text
from db import Base, engine
from db.models import (  # noqa: F401 — import to register models
    Category, Product, ProductPackage, StockItem,
    PackageField, Order, OrderItem, SiteSetting, AdminUser, User,
    Announcement, UploadedImage
)


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12, 2)"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2)"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2)"))
        conn.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100)"))
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
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_order_items_order_id ON order_items(order_id)"))
