"""Add image_url column to categories table."""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DB556FD74B_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Check if image_url already exists
    from sqlalchemy import inspect
    insp = inspect(engine)
    existing = [c["name"] for c in insp.get_columns("categories")]
    if "image_url" not in existing:
        conn.execute(text("ALTER TABLE categories ADD COLUMN image_url VARCHAR(500)"))
        print("Added image_url column to categories")
    else:
        print("image_url column already exists")
