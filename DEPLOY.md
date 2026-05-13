# Deploy lên VPS riêng

Hướng dẫn deploy Digital Product Shop lên VPS Ubuntu/Debian (22.04 / 24.04). Đã test trên VPS 2 vCPU / 2 GB RAM.

## 1. Yêu cầu

- Ubuntu 22.04+ hoặc Debian 12+, user `root` hoặc sudo
- Domain trỏ A-record về IP VPS
- Postgres 14+ (Neon cloud hoặc tự host)

## 2. Cài tools

```bash
apt update && apt install -y \
    python3.12 python3.12-venv python3-pip \
    git nginx certbot python3-certbot-nginx \
    build-essential libpq-dev curl
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

## 3. Clone & cài deps

```bash
git clone https://github.com/thanhtinz/Sweet-premium-strore.git /opt/dps
cd /opt/dps
uv sync
```

## 4. Database

### Option A — Neon (cloud, khuyên dùng)

1. Tạo project tại https://console.neon.tech
2. Copy connection string `postgresql://user:pass@xxx.neon.tech/db?sslmode=require`
3. Lưu vào `.env` ở bước 5.

### Option B — Postgres tự host

```bash
apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<EOF
CREATE USER dps WITH PASSWORD 'change_me_strong_password';
CREATE DATABASE dps_db OWNER dps;
GRANT ALL PRIVILEGES ON DATABASE dps_db TO dps;
EOF
```

> ⚠ Không cần chạy file `.sql` nào — schema tự tạo qua `db/init_db.py` lúc app khởi động lần đầu (`Base.metadata.create_all()` + versioned patches).

## 5. File `.env`

Tạo `/opt/dps/.env`:

```env
# --- Bắt buộc ---
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<chuoi-random-toi-thieu-32-ky-tu>
APP_PORT=3000

# --- Khuyến nghị ---
ALLOWED_ORIGINS=https://yourdomain.com
PYTHONUNBUFFERED=1

# --- Tuỳ chọn (đa số config đọc từ DB SiteConfig qua admin UI) ---
# PAYOS_CLIENT_ID=...
# PAYOS_API_KEY=...
# PAYOS_CHECKSUM_KEY=...
```

Sinh `JWT_SECRET`:
```bash
openssl rand -hex 32
```

> Token Discord / Telegram / Bot / OAuth Google/Facebook/Github không cần đặt env — đọc từ DB qua trang admin sau khi đăng nhập.

## 6. systemd unit

`/etc/systemd/system/dps.service`:

```ini
[Unit]
Description=Digital Product Shop
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dps
EnvironmentFile=/opt/dps/.env
ExecStart=/root/.local/bin/uv run uvicorn app:asgi --host 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/dps.log
StandardError=append:/var/log/dps.err.log

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now dps
systemctl status dps          # check
journalctl -u dps -f          # follow log
```

> ⚠ Bot Discord/Telegram chạy chung lifespan với FastAPI → **không dùng `--workers > 1`**, chỉ chạy 1 instance.

## 7. Nginx reverse proxy + HTTPS

`/etc/nginx/sites-available/dps`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 90s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dps /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot tự setup HTTPS + auto-renew.

## 8. Setup ban đầu

1. Mở `https://yourdomain.com/admin` → tạo tài khoản admin đầu tiên
2. Vào **Cài đặt** nhập:
   - SEO (tên site, logo, favicon)
   - Token Discord/Telegram bot
   - OAuth Google/Facebook/Github (nếu dùng)
   - PayOS / cấu hình thanh toán
   - Cấu hình SMTP gửi email
3. Tạo Category → Product → ProductPackage → Stock
4. Vào **API Providers** (nếu dùng nguồn ngoài SMM / topup / account premium)

## 9. Auto deploy khi git push

Cách 1 — thủ công sau mỗi push:
```bash
cd /opt/dps && git pull && uv sync && systemctl restart dps
```

Cách 2 — script `/opt/dps/scripts/deploy.sh`:
```bash
#!/bin/bash
set -e
cd /opt/dps
git fetch --all
git reset --hard origin/main
/root/.local/bin/uv sync
systemctl restart dps
echo "Deployed at $(date)"
```
```bash
chmod +x /opt/dps/scripts/deploy.sh
```

Cách 3 — GitHub Action SSH (tham khảo `appleboy/ssh-action`).

## 10. Backup

### Database
```bash
# Backup hằng ngày
echo "0 3 * * * root pg_dump \$DATABASE_URL > /backup/dps-\$(date +%F).sql" \
    > /etc/cron.d/dps-backup
```

### Uploads
```bash
rsync -a /opt/dps/static/uploads/ /backup/uploads/
```

## 11. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| 502 Bad Gateway | `systemctl status dps` + `journalctl -u dps -n 100` |
| App start xong nhưng API redirect 307 | Hard reload trình duyệt; restart service |
| Bot không online | Check token trong admin Site Config; check log `journalctl -u dps -f` |
| Database SSL closed | Thường do Neon idle disconnect — app tự reconnect, có thể bỏ qua |
| Đổi schema sau khi update code | Restart app — `init_db()` tự apply versioned patches |

## 12. Update version

```bash
cd /opt/dps
git pull
uv sync
systemctl restart dps
```

App sẽ tự chạy `init_db()` → apply schema patches mới (nếu có) → start.

## 13. Security checklist

- [ ] `JWT_SECRET` random ≥ 32 ký tự, không hardcode
- [ ] `ALLOWED_ORIGINS` chỉ chứa domain thật
- [ ] Firewall: `ufw allow 22,80,443/tcp; ufw enable`
- [ ] SSH disable password, dùng key
- [ ] Postgres không expose ra ngoài (`listen_addresses='localhost'`)
- [ ] Backup DB + uploads định kỳ
- [ ] HTTPS bắt buộc (certbot auto-renew)
