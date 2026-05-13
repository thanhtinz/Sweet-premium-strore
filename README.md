# 🔑 ShopKey — Cửa hàng sản phẩm số

Nền tảng bán tài khoản, key bản quyền, gift card, top-up game, dịch vụ SMM và các sản phẩm số tự động.

## ✨ Tính năng

### Bán hàng
- **Quản lý sản phẩm** — Danh mục, gói sản phẩm, biến thể giá, tồn kho
- **Loại danh mục** — `premium` (tài khoản/key), `game` (top-up UID/login), `giftcard`, dịch vụ SMM
- **Thanh toán tự động** — Tích hợp PayOS, giao hàng tức thì sau thanh toán
- **Số dư & nạp thẻ** — Ví nội bộ, nạp thẻ cào, code quà tặng
- **Flash sale, banner, mã giảm giá**

### Tự động hoá giao hàng
- **Manual** — Stock thủ công admin nhập sẵn
- **Auto** — Cấp key từ kho sẵn có
- **API providers** — Tích hợp nguồn ngoài: ShopKey/CMSNT (account_premium), Shoperis (topup_game)
- **SMM panel** — Adapter PerfectPanel/smmresell với đồng bộ catalog, đặt đơn, kiểm trạng thái, làm tròn giá

### Người dùng
- **Tài khoản** — Đăng ký/đăng nhập, OAuth (Google, Discord), 2FA (PyOTP)
- **Bot** — Telegram (admin + user), Discord (user DM), email SMTP
- **Affiliate** — Hệ thống giới thiệu nhận hoa hồng
- **Blog** — Theme riêng với header/footer/search client-side
- **Hỗ trợ** — Ticket, FAQ tĩnh, đánh giá sản phẩm

## 🛠 Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | FastAPI + Uvicorn |
| Frontend | Vanilla HTML/CSS/JS (SPA) |
| Database | PostgreSQL (Neon / self-hosted) |
| Auth | JWT + bcrypt + PyOTP (2FA) |
| Thanh toán | PayOS |
| Bot | aiogram (Telegram), discord.py |
| Package mgr | uv |

## 📦 Cài đặt nhanh (local)

Yêu cầu: Python 3.12+, PostgreSQL, [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/thanhtinz/Sweet-premium-strore.git
cd Sweet-premium-strore
cp .env.example .env          # điền DATABASE_URL + secrets
uv sync
./start.sh                    # mặc định bind 0.0.0.0:$APP_PORT (3000)
```

Schema tự tạo lần đầu chạy qua `db/init_db.py` + version patches (`db/schema_version.py`, hiện `LATEST_SCHEMA_VERSION=13`). Không có file `.sql` riêng.

## 🚀 Triển khai VPS

Xem hướng dẫn chi tiết (systemd + nginx + HTTPS + backup + auto-deploy) trong **[`DEPLOY.md`](./DEPLOY.md)**.

## ⚙️ Biến môi trường chính

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | Khuyến nghị | Secret JWT (tự sinh nếu trống) |
| `ADMIN_SECRET` | Khuyến nghị | Secret để cấp quyền admin đầu tiên |
| `APP_BASE_URL` | Không | URL public của app |
| `APP_PORT` | Không | Cổng dev/prod (mặc định 3000) |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | Không | Tích hợp PayOS |
| `GOOGLE_CLIENT_ID` / `DISCORD_CLIENT_ID` | Không | OAuth |

Đầy đủ: `.env.example`. Token Telegram/Discord và SMTP nằm trong DB (`SiteConfig`), không phải `.env`.

## 👤 Tạo Admin đầu tiên

1. Đăng ký tài khoản thường.
2. Cấp quyền:
   ```bash
   curl -X POST http://localhost:3000/api/auth/make-admin \
     -H "Content-Type: application/json" \
     -d '{"user_id": "1", "email": "your@email.com", "secret": "<ADMIN_SECRET>"}'
   ```

## 📁 Cấu trúc

```
├── app.py                 # ASGI entry
├── routes.py              # FastAPI app factory, lifespan (bots)
├── start.sh               # Production / VPS start
├── DEPLOY.md              # Hướng dẫn deploy VPS
├── api/
│   ├── admin_routes.py    # Admin endpoints
│   ├── auth*.py           # Auth + OAuth + 2FA
│   ├── products.py        # Sản phẩm + packages
│   ├── orders*.py         # Đơn + auto_deliver
│   ├── payment.py         # PayOS
│   ├── balance*.py        # Ví / nạp thẻ
│   ├── api_providers.py   # CRUD nguồn ngoài
│   ├── providers/         # Adapter: account_premium, topup_game, giftcard, smm_panel
│   ├── smm.py             # SMM panel CRUD + sync
│   ├── bot_links*.py      # Liên kết Telegram/Discord ↔ user
│   ├── blog.py, reviews.py, affiliates.py, ...
├── bot/
│   ├── run_bots.py        # Lifecycle gắn vào lifespan
│   ├── telegram_bot.py    # Admin + user (aiogram)
│   ├── discord_bot.py     # User DM
│   └── mail.py            # SMTP
├── db/
│   ├── models.py          # SQLAlchemy models
│   ├── init_db.py         # Auto-create + patch theo version
│   └── schema_version.py
├── static/                # SPA (index.html, app.js, admin.js, storefront.js, smm.js, blog*)
└── tests/                 # provider harness + integration tests
```

## 📄 License

MIT

## 👨‍💻 Tác giả

**thanhtinz** — [GitHub](https://github.com/thanhtinz)
