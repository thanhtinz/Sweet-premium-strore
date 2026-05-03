from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, DateTime,
    ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from db import Base


def now_utc():
    return datetime.now(timezone.utc)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    icon_url = Column(Text)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    children = relationship(
        "Category",
        foreign_keys="Category.parent_id",
        primaryjoin="Category.id == Category.parent_id",
        back_populates="parent",
    )
    parent = relationship(
        "Category",
        foreign_keys="Category.parent_id",
        primaryjoin="Category.parent_id == Category.id",
        back_populates="children",
        remote_side="Category.id",
    )
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    image_url = Column(Text)
    is_featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    category = relationship("Category", back_populates="products")
    packages = relationship("ProductPackage", back_populates="product", cascade="all, delete-orphan")


class ProductPackage(Base):
    __tablename__ = "product_packages"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    original_price = Column(Numeric(12, 2))
    description = Column(Text)
    delivery_type = Column(String(20), default="manual")  # manual | auto
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    product = relationship("Product", back_populates="packages")
    stock_items = relationship("StockItem", back_populates="package", cascade="all, delete-orphan")
    fields = relationship("PackageField", back_populates="package", cascade="all, delete-orphan")


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("product_packages.id", ondelete="CASCADE"), nullable=False)
    data = Column(Text, nullable=False)
    is_sold = Column(Boolean, default=False)
    sold_at = Column(DateTime(timezone=True))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    package = relationship("ProductPackage", back_populates="stock_items")


class PackageField(Base):
    __tablename__ = "package_fields"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("product_packages.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(255), nullable=False)
    field_type = Column(String(50), default="text")  # text, email, textarea, select
    is_required = Column(Boolean, default=True)
    options = Column(Text)  # JSON string for select options
    sort_order = Column(Integer, default=0)

    package = relationship("ProductPackage", back_populates="fields")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    user_email = Column(String(255))
    package_id = Column(Integer, ForeignKey("product_packages.id"), nullable=True)
    quantity = Column(Integer, default=1)
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="pending")  # pending, paid, processing, completed, cancelled
    payment_method = Column(String(50), default="payos")
    payment_link_id = Column(String(255))
    custom_fields_data = Column(JSON)
    delivery_data = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    package = relationship("ProductPackage")


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key = Column(String(255), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), unique=True, nullable=False)  # Neon Auth user_id
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), default="admin")  # admin | superadmin
    created_at = Column(DateTime(timezone=True), default=now_utc)
