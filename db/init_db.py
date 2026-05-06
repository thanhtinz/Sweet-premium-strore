from db import Base, engine
from db.models import (  # noqa: F401 — import to register models
    Category, Product, ProductPackage, StockItem,
    PackageField, Order, SiteSetting, AdminUser, User,
    Announcement
)


def init_db():
    Base.metadata.create_all(bind=engine)
