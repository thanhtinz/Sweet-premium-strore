# 🔑 ShopKey — Cửa hàng sản phẩm số

Nền tảng bán tài khoản, key bản quyền, gift card và các sản phẩm số tự động.

## ✨ Tính năng

- **Quản lý sản phẩm** — Danh mục, gói sản phẩm, biến thể giá, tồn kho tự động
- **Thanh toán tự động** — Tích hợp PayOS, giao hàng tức thì sau thanh toán
- **Quản lý đơn hàng** — Theo dõi trạng thái, lịch sử mua hàng
- **Hệ thống tài khoản** — Đăng ký/đăng nhập, OAuth (Google, Discord), xác thực 2 bước (2FA)
- **Admin panel** — Quản lý toàn diện: sản phẩm, đơn hàng, cài đặt, banner, flash sale, mã quà tặng
- **Blog** — Viết bài, danh mục blog
- **Hỗ trợ khách hàng** — Hệ thống ticket, trang hỗ trợ tĩnh (FAQ, bảo hành, hướng dẫn)
- **Affiliate** — Hệ thống giới thiệu nhận hoa hồng
- **Thông báo** — Banner quảng cáo, flash sale, thông báo hệ thống
- **Bot thông báo** — Telegram, Discord, Email (SMTP)
- **Tìm kiếm** — Tìm sản phẩm và bài viết
- **Đánh giá** — Hệ thống review sản phẩm

## 🛠 Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | FastAPI + Uvicorn |
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Database | PostgreSQL (Neon / self-hosted) |
| Auth | JWT + bcrypt + PyOTP (2FA) |
| Thanh toán | PayOS |
| Template | Jinja2 |

## 📦 Cài đặt

### Yêu cầu
- Python 3.12+
- PostgreSQL database

### Bước 1: Clone repo
```bash
git clone https://github.com/thanhtinz/Sweet-premium-strore.git
cd Sweet-premium-strore
```

### Bước 2: Cấu hình môi trường
```bash
cp .env.example .env
# Mở .env và điền DATABASE_URL + các biến cần thiết
```

### Bước 3: Cài dependencies
```bash
# Cách 1: pip
pip install -r requirements.txt

# Cách 2: uv (nhanh hơn)
uv sync
```

### Bước 4: Chạy app
```bash
# Cách 1: Script có sẵn
chmod +x start-vps.sh
./start-vps.sh

# Cách 2: Trực tiếp
uvicorn app:asgi --host 0.0.0.0 --port 3000
```

App sẽ chạy tại `http://localhost:3000`

## 🐳 Docker

```bash
docker build -t shopkey .
docker run -d --env-file .env -p 3000:3000 shopkey
```

## ⚙️ Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | Khuyến nghị | Secret key cho JWT (tự sinh nếu bỏ trống) |
| `ADMIN_SECRET` | Khuyến nghị | Secret để tạo admin đầu tiên |
| `APP_BASE_URL` | Không | URL public của app |
| `PAYOS_CLIENT_ID` | Không | PayOS Client ID |
| `PAYOS_API_KEY` | Không | PayOS API Key |
| `PAYOS_CHECKSUM_KEY` | Không | PayOS Checksum Key |
| `GOOGLE_CLIENT_ID` | Không | Google OAuth |
| `DISCORD_CLIENT_ID` | Không | Discord OAuth |

Xem đầy đủ trong `.env.example`.

## 👤 Tạo tài khoản Admin

1. Đăng ký tài khoản thường qua giao diện
2. Gọi API để nâng quyền:
```bash
curl -X POST http://localhost:3000/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"user_id": "1", "email": "your@email.com", "secret": "changeme123"}'
```
> Thay `secret` bằng giá trị `ADMIN_SECRET` trong `.env`

## 📁 Cấu trúc project

```
├── app.py              # Entry point (ASGI)
├── routes.py           # FastAPI app factory + routing
├── api/                # API endpoints
│   ├── auth.py         # Auth, OAuth, 2FA
│   ├── products.py     # Sản phẩm
│   ├── orders.py       # Đơn hàng
│   ├── payment.py      # Thanh toán PayOS
│   ├── admin.py        # Admin endpoints
│   ├── support.py      # Hỗ trợ khách hàng
│   ├── blog.py         # Blog
│   └── ...             # Các module khác
├── db/
│   ├── __init__.py     # Database engine + session
│   ├── models.py       # SQLAlchemy models
│   └── init_db.py      # Auto-create tables
├── static/             # Frontend (HTML/CSS/JS)
│   ├── index.html      # SPA entry
│   ├── styles.css      # Styles
│   ├── app.js          # Router + khởi tạo
│   ├── core.js         # Utils, API calls
│   ├── storefront.js   # Trang chủ, sản phẩm, giỏ hàng
│   ├── admin.js        # Admin panel
│   └── ...             # Các module JS khác
├── bot/                # Bot thông báo
├── Dockerfile          # Docker build
├── requirements.txt    # Python dependencies
├── start-vps.sh        # Script chạy trên VPS
└── .env.example        # Mẫu biến môi trường
```

## 📄 License

MIT

## 👨‍💻 Tác giả

**thanhtinz** — [GitHub](https://github.com/thanhtinz)
