import os
from sqlalchemy import text
from db.init_db import engine

def run_migration():
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='two_factor_secret'"))
            if result.rowcount == 0:
                print("Adding two_factor_secret column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255)"))
                conn.commit()
                print("Migration successful!")
            else:
                print("Column already exists.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    run_migration()
