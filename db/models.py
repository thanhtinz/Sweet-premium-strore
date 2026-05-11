from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric, DateTime,
    ForeignKey, JSON, UniqueConstraint, LargeBinary
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db import Base



def now_utc():
    return datetime.now(timezone.utc)


class UploadedImage(Base):
    __tablename__ = "uploaded_images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=True)
    data = Column(LargeBinary, nullable=False)
    mime_type = Column(String(100), nullable=False, default="application/octet-stream")
    created_at = Column(DateTime(timezone=True), default=now_utc)


class ApiProvider(Base):
    __tablename__ = "api_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    provider_type = Column(String(50), nullable=False)  # account_premium | topup_game | giftcard
    partner_id = Column(String(100), nullable=True)  # giftcard protocol: partner_id
    card_rates = Column(JSON, nullable=True)  # giftcard: {"VIETTEL":{"10000":20,...},...} = % chiết khấu nạp thẻ
    base_url = Column(String(500), nullable=False)
    api_key = Column(Text, nullable=False)
    api_secret = Column(Text, nullable=True)  # only account_premium
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    icon_url = Column(Text)
    image_url = Column(String(500), nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    product_type = Column(String(20), default="premium")  # premium | game | giftcard
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
    topup_type = Column(String(20), nullable=True)    # uid | login (game only)
    server_region = Column(String(20), nullable=True)  # vietnam | global (game only)
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
    notes = Column(Text)  # warnings/notes specific to this package
    image_url = Column(Text, nullable=True)  # package image/icon
    delivery_type = Column(String(20), default="manual")  # manual | auto | api
    is_stock_managed = Column(Boolean, default=False)  # toggle kho cho gói thủ công
    stock_quantity = Column(Integer, default=0)  # số lượng tồn kho (cho gói bật quản lý kho)
    api_provider_id = Column(Integer, ForeignKey("api_providers.id", ondelete="SET NULL"), nullable=True)
    external_product_id = Column(String(255), nullable=True)  # product ID on source
    external_plan_id = Column(String(255), nullable=True)     # plan ID on source
    auto_markup = Column(Boolean, default=False)  # auto price = source × (1 + markup/100)
    markup_percent = Column(Numeric(5, 2), nullable=True)  # % tăng giá, VD: 15 = +15%
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    product = relationship("Product", back_populates="packages")
    api_provider = relationship("ApiProvider")
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
    package_id = Column(Integer, ForeignKey("product_packages.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1)
    subtotal_amount = Column(Numeric(12, 2), nullable=True)
    discount_amount = Column(Numeric(12, 2), nullable=True)
    tax_amount = Column(Numeric(12, 2), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False)
    coupon_code = Column(String(100), nullable=True)
    status = Column(String(20), default="pending")  # pending, paid, processing, completed, cancelled
    payment_method = Column(String(50), default="payos")
    payment_link_id = Column(String(255))
    custom_fields_data = Column(JSON)
    delivery_data = Column(Text)
    notes = Column(Text)
    api_provider_id = Column(Integer, ForeignKey("api_providers.id", ondelete="SET NULL"), nullable=True)
    external_order_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    package = relationship("ProductPackage")
    api_provider = relationship("ApiProvider")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("product_packages.id", ondelete="SET NULL"), nullable=True)
    product_name_snapshot = Column(String(255), nullable=True)
    package_name_snapshot = Column(String(255), nullable=True)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    line_total = Column(Numeric(12, 2), nullable=False)
    custom_fields_data = Column(JSON)
    delivery_data = Column(Text)
    status = Column(String(20), default="pending")
    external_order_id = Column(String(255), nullable=True)
    api_status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    order = relationship("Order", back_populates="items")
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
    link = Column(Text)  # app route e.g. /category/vpn or external URL
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


class UserBotLink(Base):
    __tablename__ = "user_bot_links"
    __table_args__ = (
        UniqueConstraint("platform", "platform_user_id", name="uq_user_bot_links_platform_user"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=True, index=True)
    platform = Column(String(20), nullable=False, index=True)  # telegram | discord
    platform_user_id = Column(String(255), nullable=False, index=True)
    platform_username = Column(String(255), nullable=True)
    dm_channel_id = Column(String(255), nullable=True)
    link_code = Column(String(64), nullable=True, unique=True, index=True)
    link_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, default=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    linked_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)


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
    description = Column(String(500), nullable=True)  # shown on offers page
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


# ── Wishlist ───────────────────────────────────────────────

class Wishlist(Base):
    __tablename__ = "wishlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    __table_args__ = (UniqueConstraint('user_id', 'product_id', name='uq_wishlist_user_product'),)


# ── API Keys ──────────────────────────────────────────

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    key_prefix = Column(String(12), nullable=False)       # first 8 chars for display
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 hex
    allowed_domains = Column(Text, nullable=True)          # comma-separated domains
    callback_url = Column(Text, nullable=True)             # OAuth-style callback URL
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    last_used_at = Column(DateTime(timezone=True), nullable=True)


# ── Card Charge (đổi thẻ nạp số dư) ─────────────────

class CardChargeTransaction(Base):
    __tablename__ = "card_charge_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    telco = Column(String(30), nullable=False)  # VIETTEL, VINAPHONE, MOBIFONE, VNMOBI...
    code = Column(String(100), nullable=False)
    serial = Column(String(100), nullable=False)
    declared_amount = Column(Numeric(12, 2), nullable=False)  # mệnh giá khai báo
    real_value = Column(Numeric(12, 2), nullable=True)  # mệnh giá thực (từ callback)
    discount_rate = Column(Numeric(5, 2), nullable=False, default=0)  # % chiết khấu tại thời điểm gửi
    credited_amount = Column(Numeric(12, 2), nullable=True)  # tiền cộng cho user (0 nếu sai/lỗi)
    request_id = Column(String(100), unique=True, nullable=False, index=True)
    trans_id = Column(String(100), nullable=True)  # mã GD bên đối tác
    api_provider_id = Column(Integer, ForeignKey("api_providers.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="pending")  # pending|success|wrong_amount|failed|maintenance
    callback_data = Column(JSON, nullable=True)  # raw callback JSON
    balance_transaction_id = Column(Integer, ForeignKey("balance_transactions.id"), nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user = relationship("User")
    api_provider = relationship("ApiProvider")
