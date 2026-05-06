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
    image_url = Column(String(500), nullable=True)
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
    notes = Column(Text)  # purchase notes / warnings
    image_url = Column(Text)
    is_featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    category = relationship("Category", back_populates="products")
    packages = relationship("ProductPackage", back_populates="product", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")


class ProductPackage(Base):
    __tablename__ = "product_packages"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    original_price = Column(Numeric(12, 2))
    description = Column(Text)
    delivery_type = Column(String(20), default="manual")  # manual | auto
    is_stock_managed = Column(Boolean, default=False)  # toggle kho cho gói thủ công
    stock_quantity = Column(Integer, default=0)  # số lượng tồn kho (cho gói bật quản lý kho)
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


class Banner(Base):
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    image_url = Column(Text, nullable=False)
    link = Column(Text)  # hash route e.g. #/category/vpn or external URL
    banner_type = Column(String(20), default="hero")  # hero | category
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # null for social-only accounts
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    provider = Column(String(50), default="local")  # local | google | discord
    provider_id = Column(String(255), nullable=True)  # external user id
    two_factor_secret = Column(String(255), nullable=True)  # TOTP secret key
    balance = Column(Numeric(12, 2), default=0, server_default="0", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), unique=True, nullable=False)  # users.id as string
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), default="admin")  # admin | superadmin
    created_at = Column(DateTime(timezone=True), default=now_utc)


class BalanceTransaction(Base):
    __tablename__ = "balance_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)  # positive=credit, negative=debit
    balance_after = Column(Numeric(12, 2), nullable=False)
    type = Column(String(30), nullable=False)  # topup | purchase | affiliate_withdraw | admin_adjust | refund
    status = Column(String(20), default="completed")  # pending | completed | failed
    reference = Column(String(255))  # order_code, payos order code, etc.
    description = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=now_utc)

    user = relationship("User")


class FlashSale(Base):
    __tablename__ = "flash_sales"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("product_packages.id", ondelete="CASCADE"), nullable=False)
    sale_price = Column(Numeric(12, 2), nullable=False)
    quantity_limit = Column(Integer, default=0)  # 0 = unlimited
    quantity_sold = Column(Integer, default=0)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    package = relationship("ProductPackage")


class GiftCode(Base):
    __tablename__ = "gift_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    discount_type = Column(String(10), default="percent")  # percent | fixed
    discount_value = Column(Numeric(12, 2), nullable=False)  # % or VND
    min_order = Column(Numeric(12, 2), default=0)
    max_discount = Column(Numeric(12, 2), nullable=True)  # cap for percent type
    usage_limit = Column(Integer, default=0)  # 0 = unlimited
    usage_count = Column(Integer, default=0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Show on UI
    created_at = Column(DateTime(timezone=True), default=now_utc)


class AffiliateUser(Base):
    __tablename__ = "affiliate_users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255))
    ref_code = Column(String(50), unique=True, nullable=False, index=True)
    commission_rate = Column(Numeric(5, 2), default=5.00)  # %
    total_earnings = Column(Numeric(12, 2), default=0)
    total_paid = Column(Numeric(12, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    referrals = relationship("AffiliateReferral", back_populates="affiliate")


class AffiliateReferral(Base):
    __tablename__ = "affiliate_referrals"

    id = Column(Integer, primary_key=True, index=True)
    affiliate_id = Column(Integer, ForeignKey("affiliate_users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    order_amount = Column(Numeric(12, 2), default=0)
    commission = Column(Numeric(12, 2), default=0)
    status = Column(String(20), default="pending")  # pending | approved | paid
    created_at = Column(DateTime(timezone=True), default=now_utc)

    affiliate = relationship("AffiliateUser", back_populates="referrals")


# ── Blog ──────────────────────────────────────────────

class BlogCategory(Base):
    __tablename__ = "blog_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    posts = relationship("BlogPost", back_populates="category")


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("blog_categories.id"), nullable=True)
    title = Column(String(500), nullable=False)
    slug = Column(String(500), unique=True, nullable=False, index=True)
    excerpt = Column(Text)  # short summary for listings
    content = Column(Text, nullable=False)  # HTML content
    thumbnail_url = Column(Text)
    meta_title = Column(String(500))  # SEO
    meta_description = Column(Text)  # SEO
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    author_id = Column(String(255), nullable=True)  # user id
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    category = relationship("BlogCategory", back_populates="posts")


# ── Reviews ───────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(255), nullable=False, index=True)
    user_name = Column(String(255))
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text)
    is_verified = Column(Boolean, default=False)  # bought the product
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    product = relationship("Product", back_populates="reviews")


# ── Support Settings ──────────────────────────────────

class SiteConfig(Base):
    __tablename__ = "site_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text)  # JSON or plain text
    description = Column(Text)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ── Support Pages (Policies, FAQs, Guidelines) ────────

class SupportPage(Base):
    __tablename__ = "support_pages"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)  # HTML content
    page_type = Column(String(50))  # warranty | purchase_guide | faq | privacy
    meta_description = Column(Text)
    is_published = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ── Support Tickets ───────────────────────────────────

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    user_email = Column(String(255), nullable=False)
    user_name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="normal")  # low | normal | high | urgent
    status = Column(String(20), default="open")  # open | in_progress | resolved | closed
    category = Column(String(100))  # order | product | payment | other
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    assigned_to = Column(String(255), nullable=True)  # admin user
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String(255), nullable=False)
    sender_name = Column(String(255), nullable=False)
    sender_type = Column(String(20))  # user | admin
    message = Column(Text, nullable=False)
    attachments = Column(JSON, default={})  # file URLs
    is_internal = Column(Boolean, default=False)  # not visible to user
    created_at = Column(DateTime(timezone=True), default=now_utc)

    ticket = relationship("SupportTicket", back_populates="messages")


# ── Announcements ─────────────────────────────────────

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    type = Column(String(30), default="info")  # info | warning | promo | update
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
