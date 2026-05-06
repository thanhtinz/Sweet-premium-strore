#!/usr/bin/env python
"""
Migration: Add is_stock_managed and stock_quantity to product_packages
Run with: uv run python db/migrate_stock_mgmt.py
"""

from sqlalchemy import text
from db import engine


def migrate():
    with engine.connect() as conn:
        # Add is_stock_managed column
        try:
            conn.execute(text("ALTER TABLE product_packages ADD COLUMN is_stock_managed BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("✓ Added is_stock_managed column")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("  is_stock_managed column already exists, skipping")
                conn.rollback()
            else:
                print(f"  Error adding is_stock_managed: {e}")
                conn.rollback()

        # Add stock_quantity column
        try:
            conn.execute(text("ALTER TABLE product_packages ADD COLUMN stock_quantity INTEGER DEFAULT 0"))
            conn.commit()
            print("✓ Added stock_quantity column")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("  stock_quantity column already exists, skipping")
                conn.rollback()
            else:
                print(f"  Error adding stock_quantity: {e}")
                conn.rollback()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
