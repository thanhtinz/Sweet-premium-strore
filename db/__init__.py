import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Support both connector prefix and standard DATABASE_URL
DATABASE_URL = (
    os.environ.get("DB556FD74B_DATABASE_URL")
    or os.environ.get("DATABASE_URL")
    or ""
).strip()

if not DATABASE_URL:
    raise RuntimeError(
        "Database URL not configured. Set DATABASE_URL environment variable. "
        "Example: postgresql://user:pass@host:5432/dbname"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
