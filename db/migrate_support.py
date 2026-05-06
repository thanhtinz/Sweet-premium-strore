#!/usr/bin/env python
"""
Migration: Add support system tables (tickets, policies, config)
Run with: uv run python db/migrate_support.py
"""

import os
from db import SessionLocal, engine
from db.models import Base

def migrate():
    """Create new tables for support system"""
    print("Creating support system tables...")
    
    # Create all tables defined in models
    Base.metadata.create_all(bind=engine)
    
    print("✓ Tables created successfully")
    print("  - site_config")
    print("  - support_pages")
    print("  - support_tickets")
    print("  - ticket_messages")
    
    # Add default config values
    db = SessionLocal()
    try:
        from db.models import SiteConfig
        
        # Check if already exists
        existing = db.query(SiteConfig).filter_by(key="contact_email").first()
        if not existing:
            configs = [
                SiteConfig(
                    key="contact_email",
                    value="support@shopkey.vn",
                    description="Customer support email address"
                ),
                SiteConfig(
                    key="contact_phone",
                    value="1900 xxxx",
                    description="Customer support phone number"
                ),
                SiteConfig(
                    key="contact_address",
                    value="Việt Nam",
                    description="Company address"
                ),
                SiteConfig(
                    key="contact_facebook",
                    value="https://facebook.com/shopkey",
                    description="Facebook page link"
                ),
                SiteConfig(
                    key="working_hours",
                    value="24/7",
                    description="Customer support working hours"
                ),
            ]
            db.add_all(configs)
            db.commit()
            print("✓ Default config values added")
    except Exception as e:
        print(f"Note: Config values may already exist: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
