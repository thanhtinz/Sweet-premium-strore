# Digital Product Shop — Phase 1: MVP Core

## Context
Build website bán sản phẩm số (tài khoản, key, gift card...) tương tự shopkey.trumapi.com.
Phase 1 tập trung vào core mua bán: Storefront, Admin Panel, Quản lý sản phẩm, Auth, Thanh toán PayOS.

## Tech Stack
- **Backend**: FastAPI (Python) — file gốc: `app.py`, `routes.py`
- **Frontend**: Vanilla HTML/CSS/JS — responsive PC + Mobile
- **Database**: Neon PostgreSQL (prefix `DB556FD74B`)
- **Auth**: Neon Auth (built-in, không cần custom JWT/bcrypt)
- **Payment**: PayOS Python SDK (`payos` package)
- **AI** (Phase sau): Xiaomi MiMo API trực tiếp + Groq (OpenAI-compatible)

## Scope Phase 1
### In Scope
1. User Auth (đăng ký/đăng nhập via Neon Auth)
2. Storefront (trang chủ, danh mục, chi tiết sản phẩm, giỏ hàng)
3. Admin Panel (CRUD categories, products, product packages, stock management)
4. Checkout & Payment (PayOS — QR bank transfer)
5. Order Management (đơn hàng, giao acc tự động hoặc thủ công)
6. Responsive UI (mobile-first design)

### Non-Goals (Phase sau)
- FlashSale, Giftcode, Affiliate
- Messaging, Quick Replies
- Email Marketing, Telegram Bot
- AI content generation
- Multi-language, Multi-currency
- Blog
- API kết nối website khác
- Nạp tiền USDT, PayPal, thẻ cào

## Database Schema

### Tables

```sql
-- Categories (chuyên mục)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    icon_url TEXT,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (sản phẩm)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Packages (gói sản phẩm — mỗi sản phẩm có nhiều gói với giá khác nhau)
CREATE TABLE product_packages (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2),
    description TEXT,
    delivery_type VARCHAR(20) DEFAULT 'manual', -- 'manual' | 'auto'
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Items (tài khoản/key để giao tự động)
CREATE TABLE stock_items (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES product_packages(id) ON DELETE CASCADE,
    data TEXT NOT NULL, -- account info, key, etc.
    is_sold BOOLEAN DEFAULT false,
    sold_at TIMESTAMPTZ,
    order_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom Fields (trường dữ liệu tùy chỉnh cho từng gói)
CREATE TABLE package_fields (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES product_packages(id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) DEFAULT 'text', -- text, email, textarea, select
    is_required BOOLEAN DEFAULT true,
    options TEXT, -- JSON for select options
    sort_order INTEGER DEFAULT 0
);

-- Orders (đơn hàng)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    user_id TEXT NOT NULL, -- from Neon Auth
    user_email VARCHAR(255),
    package_id INTEGER REFERENCES product_packages(id),
    quantity INTEGER DEFAULT 1,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, processing, completed, cancelled
    payment_method VARCHAR(50) DEFAULT 'payos',
    payment_link_id VARCHAR(255),
    custom_fields_data JSONB, -- buyer's input for package_fields
    delivery_data TEXT, -- delivered account/key info
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Settings (cấu hình website)
CREATE TABLE site_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Project Structure

```
/
├── app.py                  # FastAPI entry (existing)
├── routes.py               # Main router factory (existing, extend)
├── start.sh                # Dev server (existing)
├── pyproject.toml           # Dependencies (existing, add payos, sqlalchemy, etc.)
│
├── db/
│   ├── __init__.py          # Engine, session factory
│   ├── models.py            # SQLAlchemy ORM models
│   └── init_db.py           # Create tables on startup
│
├── api/
│   ├── __init__.py
│   ├── auth.py              # Neon Auth endpoints (login/register/session)
│   ├── categories.py        # Category CRUD API
│   ├── products.py          # Product + Package CRUD API
│   ├── orders.py            # Order creation, status, history
│   ├── payment.py           # PayOS integration (create link, webhook)
│   ├── admin.py             # Admin-only endpoints + middleware
│   └── stock.py             # Stock item management
│
├── static/
│   ├── index.html           # Storefront SPA shell (existing, rewrite)
│   ├── styles.css           # Global styles (existing, rewrite)
│   ├── app.js               # Main JS router + state (existing, rewrite)
│   │
│   ├── css/
│   │   ├── variables.css    # Design tokens, colors, spacing
│   │   ├── components.css   # Reusable UI components
│   │   ├── responsive.css   # Mobile breakpoints
│   │   └── admin.css        # Admin panel styles
│   │
│   ├── js/
│   │   ├── router.js        # Client-side SPA router
│   │   ├── api.js           # API client (fetch wrapper)
│   │   ├── auth.js          # Auth state, login/register UI
│   │   ├── store.js         # Storefront pages (home, category, product)
│   │   ├── cart.js          # Cart logic
│   │   ├── orders.js        # Order history, status
│   │   └── admin/
│   │       ├── dashboard.js  # Admin dashboard
│   │       ├── categories.js # Category management
│   │       ├── products.js   # Product + package management
│   │       ├── orders.js     # Order management
│   │       └── stock.js      # Stock management
│   │
│   └── pages/               # HTML templates loaded by router
│       ├── home.html
│       ├── category.html
│       ├── product.html
│       ├── cart.html
│       ├── checkout.html
│       ├── orders.html
│       ├── login.html
│       ├── register.html
│       └── admin/
│           ├── dashboard.html
│           ├── categories.html
│           ├── products.html
│           ├── orders.html
│           └── stock.html
```

## Implementation Plan

### Step 1: Database & Backend Foundation
- Add dependencies: `sqlalchemy`, `payos`, `python-jose`, `passlib`
- Setup `db/` module: engine, models, init_db
- Create all tables on startup
- Files: `pyproject.toml`, `db/__init__.py`, `db/models.py`, `db/init_db.py`, `routes.py`

### Step 2: Auth System
- Integrate Neon Auth for user registration/login
- Admin role check (first user = admin, or config-based)
- Session/token management
- Files: `api/auth.py`, `routes.py`

### Step 3: Admin Panel — Categories & Products
- CRUD API cho categories (nested, with icon)
- CRUD API cho products, packages, custom fields
- Stock item upload (bulk text paste)
- Admin middleware (check admin role)
- Files: `api/admin.py`, `api/categories.py`, `api/products.py`, `api/stock.py`

### Step 4: Storefront Frontend
- SPA router (hash-based: `#/`, `#/category/slug`, `#/product/slug`)
- Home page: banner area, category grid, featured products
- Category page: product listing with filters
- Product detail page: package selection, custom fields, add to cart
- Cart page: review items, proceed to checkout
- Responsive design: mobile-first, breakpoints at 768px, 1024px
- Files: `static/` toàn bộ HTML/CSS/JS

### Step 5: PayOS Payment Integration
- Create payment link khi checkout
- PayOS webhook nhận callback khi thanh toán thành công
- Auto-update order status
- Auto-deliver stock items (nếu delivery_type = 'auto')
- Files: `api/payment.py`, `api/orders.py`

### Step 6: Order Management
- Customer: xem lịch sử đơn, trạng thái, nhận account/key
- Admin: danh sách đơn, xử lý thủ công, giao hàng manual
- Files: `api/orders.py`, admin UI

## Payment Flow (PayOS)
```
Customer checkout → API tạo PayOS payment link → Redirect đến PayOS
    → Customer quét QR / chuyển khoản
    → PayOS webhook callback → Verify checksum → Update order status
    → Nếu auto: giao stock item → Nếu manual: admin xử lý
```

## Environment Variables Needed
```
# Database (already configured)
DB556FD74B_DATABASE_URL
DB556FD74B_DIRECT_URL
DB556FD74B_NEON_AUTH_URL

# PayOS (cần user thêm)
PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
```

## UI Design Approach
- **Mobile-first responsive** — flexbox/grid layout
- **Clean, modern design** — không quá phức tạp
- **Color scheme**: Professional dark/light với accent color
- **Card-based product grid** — hover effects, smooth transitions
- **Admin panel**: Sidebar navigation, data tables, modal forms
- **No external CSS frameworks** — pure CSS cho performance

## Verification
1. Truy cập storefront → thấy categories, products
2. Đăng ký/đăng nhập thành công
3. Add to cart → checkout → PayOS payment link tạo đúng
4. Admin panel: CRUD categories, products, packages, stock
5. Order flow: paid → auto/manual delivery → customer nhận hàng
6. Responsive: test trên mobile viewport (375px, 768px, 1024px)

## Phases Roadmap (sau Phase 1)
- **Phase 2**: Multi-language, Multi-currency, FlashSale, Giftcode
- **Phase 3**: Affiliate Program, Blog
- **Phase 4**: Messaging, Quick Replies, Email Marketing
- **Phase 5**: Telegram Bot, AI (MiMo + Groq), API kết nối bên ngoài
- **Phase 6**: Advanced security, USDT/PayPal/thẻ cào payment
