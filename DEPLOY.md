# Deploy lên VPS riêng

Hướng dẫn đầy đủ deploy Digital Product Shop lên VPS Ubuntu/Debian 22.04 / 24.04.
Đã test trên VPS 2 vCPU / 2 GB RAM.

---

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Cấu hình VPS cơ bản](#2-cấu-hình-vps-cơ-bản)
3. [Cài tools](#3-cài-tools)
4. [Clone & cài deps](#4-clone--cài-deps)
5. [Database](#5-database)
6. [File .env](#6-file-env)
7. [systemd service](#7-systemd-service)
8. [Đấu domain & HTTPS](#8-đấu-domain--https)
9. [Setup admin ban đầu](#9-setup-admin-ban-đầu)
10. [Lệnh thường dùng trên VPS](#10-lệnh-thường-dùng-trên-vps)
11. [Auto deploy](#11-auto-deploy)
12. [Backup](#12-backup)
13. [Troubleshooting](#13-troubleshooting)
14. [Security checklist](#14-security-checklist)

---

## 1. Yêu cầu

| Mục | Tối thiểu |
|---|---|
| OS | Ubuntu 22.04+ hoặc Debian 12+ |
| RAM | 1 GB (khuyến nghị 2 GB) |
| CPU | 1 vCPU (khuyến nghị 2) |
| Disk | 10 GB |
| User | `root` hoặc sudo |
| Domain | Đã mua và có quyền trỏ DNS |
| Database | Neon cloud (khuyến nghị) hoặc Postgres tự host |

---

## 2. Cấu hình VPS cơ bản

### 2.1 Cập nhật hệ thống

```bash
apt update && apt upgrade -y
```

### 2.2 Tạo swap (nếu RAM ≤ 1 GB)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Kiểm tra
free -h
```

### 2.3 Firewall (UFW)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

> ⚠ Port 3000 của app **không** cần mở ra ngoài — nginx đóng vai trò reverse proxy.

### 2.4 Bảo mật SSH (tuỳ chọn nhưng khuyến nghị)

```bash
# Đổi cổng SSH (tùy ý, ví dụ 2200)
sed -i 's/#Port 22/Port 2200/' /etc/ssh/sshd_config
ufw allow 2200/tcp
ufw delete allow OpenSSH

# Tắt đăng nhập bằng password (chỉ nên làm sau khi đã thêm SSH key)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

systemctl restart sshd
```

### 2.5 Múi giờ

```bash
timedatectl set-timezone Asia/Ho_Chi_Minh
timedatectl status
```

---

## 3. Cài tools

```bash
apt install -y \
    python3.12 python3.12-venv python3-pip \
    git nginx certbot python3-certbot-nginx \
    build-essential libpq-dev curl wget unzip

# Cài uv (package manager Python)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc   # hoặc source ~/.profile

# Kiểm tra
uv --version
```

---

## 4. Clone & cài deps

```bash
git clone https://github.com/thanhtinz/Sweet-premium-strore.git /opt/dps
cd /opt/dps
uv sync
```

---

## 5. Database

### Option A — Neon cloud (khuyến nghị, không cần quản lý)

1. Tạo project tại https://console.neon.tech (free tier là đủ cho shop nhỏ)
2. Vào **Dashboard → Connection string** → chọn **psycopg2**
3. Copy chuỗi dạng: `postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require`
4. Dán vào `.env` ở bước tiếp theo.

### Option B — Postgres tự host

```bash
apt install -y postgresql postgresql-contrib
sudo -u postgres psql << 'EOF'
CREATE USER dps WITH PASSWORD 'doi_mat_khau_manh';
CREATE DATABASE dps_db OWNER dps;
GRANT ALL PRIVILEGES ON DATABASE dps_db TO dps;
EOF
```

Connection string: `postgresql://dps:doi_mat_khau_manh@localhost/dps_db`

> ⚠ Schema tự tạo khi app khởi động lần đầu — **không cần** chạy file `.sql` nào.

---

## 6. File .env

```bash
cp /opt/dps/.env.example /opt/dps/.env
nano /opt/dps/.env
```

Nội dung tối thiểu cần điền:

```env
# --- Bắt buộc ---
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<chuoi-random-32-ky-tu-tro-len>
APP_PORT=3000

# --- Khuyến nghị ---
ADMIN_SECRET=<secret-de-cap-quyen-admin-lan-dau>
APP_BASE_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
PYTHONUNBUFFERED=1
```

Sinh `JWT_SECRET` và `ADMIN_SECRET`:
```bash
openssl rand -hex 32   # chạy 2 lần, lấy 2 giá trị khác nhau
```

> Token Telegram / Discord bot, OAuth (Google, Github, Discord), PayOS, SMTP đều **đặt trong Admin UI → Cài đặt**, không cần khai báo trong `.env`.

---

## 7. systemd service

Tạo file `/etc/systemd/system/dps.service`:

```bash
nano /etc/systemd/system/dps.service
```

Nội dung:

```ini
[Unit]
Description=Digital Product Shop (FastAPI)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dps
EnvironmentFile=/opt/dps/.env
ExecStart=/root/.local/bin/uv run uvicorn app:asgi \
    --host 127.0.0.1 \
    --port 3000 \
    --workers 1 \
    --log-level info
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/dps.log
StandardError=append:/var/log/dps.err.log

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable dps
systemctl start dps
systemctl status dps
```

> Dùng `--workers 1` vì app có in-process bot runner. Muốn nhiều worker cần tách bot ra process riêng.

---

## 8. Đấu domain & HTTPS

### 8.1 Trỏ DNS

Vào trang quản lý domain (Cloudflare, GoDaddy, Namecheap, …) và tạo record:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<IP VPS>` | Auto |
| A | `www` | `<IP VPS>` | Auto |

> Nếu dùng Cloudflare Proxy (cam), lúc cài certbot hãy tắt proxy (chuyển về DNS only — mây xám) rồi bật lại sau.

Kiểm tra DNS đã propagate chưa:
```bash
ping yourdomain.com
# hoặc
nslookup yourdomain.com
```

### 8.2 Cấu hình nginx

```bash
nano /etc/nginx/sites-available/dps
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Max upload size (ảnh sản phẩm, file, …)
    client_max_body_size 50M;

    # Static files phục vụ trực tiếp (tuỳ chọn, tăng hiệu suất)
    location /static/ {
        alias /opt/dps/static/;
        expires 7d;
        access_log off;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # WebSocket / SSE (bot lifespan, real-time)
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 90s;
    }
}
```

```bash
# Kích hoạt site
ln -s /etc/nginx/sites-available/dps /etc/nginx/sites-enabled/

# Tắt site default nếu còn
rm -f /etc/nginx/sites-enabled/default

# Kiểm tra cú pháp
nginx -t

# Reload
systemctl reload nginx
```

### 8.3 Cài SSL / HTTPS (certbot)

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Nhập email → Agree → chọn **Redirect** (tự redirect HTTP → HTTPS).

Certbot tự thêm config HTTPS vào nginx và đặt cronjob auto-renew.

Kiểm tra auto-renew:
```bash
certbot renew --dry-run
```

Sau khi xong, truy cập `https://yourdomain.com` là thấy app.

---

## 9. Setup admin ban đầu

1. Đăng ký tài khoản thường tại `https://yourdomain.com`
2. Cấp quyền admin:

```bash
curl -X POST https://yourdomain.com/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"user_id": "1", "email": "you@email.com", "secret": "<ADMIN_SECRET>"}'
```

3. Đăng nhập → vào `/admin` → **Cài đặt** và điền:
   - Tên site, logo, favicon, SEO
   - Token Telegram Bot / Discord Bot
   - OAuth Google / Github / Discord (Client ID + Secret)
   - PayOS (`Client ID`, `API Key`, `Checksum Key`)
   - SMTP email
4. Tạo **Danh mục → Sản phẩm → Gói sản phẩm → Kho hàng**
5. Nếu dùng SMM hoặc API providers: vào **API Providers** → thêm nguồn

---

## 10. Lệnh thường dùng trên VPS

### Xem trạng thái app

```bash
systemctl status dps
```

### Khởi động / tắt / restart

```bash
systemctl start dps
systemctl stop dps
systemctl restart dps
```

### Xem log realtime

```bash
# Log app (stdout)
tail -f /var/log/dps.log

# Log lỗi (stderr)
tail -f /var/log/dps.err.log

# Log systemd (cả hai, dùng khi app crash ngay khi start)
journalctl -u dps -f
journalctl -u dps -n 100         # 100 dòng gần nhất
journalctl -u dps --since today
```

### Xem log nginx

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Cập nhật code mới

```bash
cd /opt/dps
git pull
uv sync
systemctl restart dps
```

### Xem tài nguyên hệ thống

```bash
htop          # real-time CPU/RAM (cài: apt install htop)
df -h         # disk
free -h       # RAM + swap
```

### Kiểm tra app có đang chạy không

```bash
systemctl is-active dps        # active / inactive
curl -s http://127.0.0.1:3000/api/health | jq
```

### Chỉnh sửa .env rồi restart

```bash
nano /opt/dps/.env
systemctl restart dps
```

### Xem database (nếu self-host Postgres)

```bash
sudo -u postgres psql dps_db
# Trong psql:
\dt             # list tables
\q              # thoát
```

### Gia hạn SSL thủ công

```bash
certbot renew
systemctl reload nginx
```

### Xem certbot auto-renew timer

```bash
systemctl list-timers | grep certbot
```

---

## 11. Auto deploy

### Cách 1 — Pull thủ công

```bash
cd /opt/dps && git pull && uv sync && systemctl restart dps
```

### Cách 2 — Script deploy

```bash
cat > /opt/dps/scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/dps
git fetch --all
git reset --hard origin/main
/root/.local/bin/uv sync
systemctl restart dps
echo "✅ Deployed at $(date)"
EOF
chmod +x /opt/dps/scripts/deploy.sh
```

Chạy: `bash /opt/dps/scripts/deploy.sh`

### Cách 3 — GitHub Actions SSH

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          script: bash /opt/dps/scripts/deploy.sh
```

Thêm `VPS_HOST` (IP VPS) và `VPS_SSH_KEY` (private key) vào **GitHub Repo → Settings → Secrets**.

---

## 12. Backup

### Database (self-host Postgres)

```bash
# Backup thủ công
pg_dump $DATABASE_URL > /backup/dps-$(date +%F).sql

# Backup tự động hằng ngày lúc 3 giờ sáng
mkdir -p /backup
echo "0 3 * * * root pg_dump \$DATABASE_URL > /backup/dps-\$(date +\%F).sql" \
    > /etc/cron.d/dps-backup
```

Restore:
```bash
psql $DATABASE_URL < /backup/dps-2025-05-15.sql
```

### Uploads (ảnh sản phẩm, file do user upload)

```bash
rsync -a /opt/dps/static/uploads/ /backup/uploads/
rsync -a /opt/dps/static/banners/ /backup/banners/
```

---

## 13. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| 502 Bad Gateway | `systemctl status dps` → app chưa start hoặc crash |
| App crash ngay khi start | `journalctl -u dps -n 50` xem lỗi; thường thiếu `DATABASE_URL` |
| API redirect 307 liên tục | Hard reload browser (`Ctrl+Shift+R`); hoặc restart nginx |
| Bot Telegram/Discord offline | Kiểm tra token trong Admin → Cài đặt; xem `journalctl -u dps -f` |
| Upload ảnh lỗi 413 | Tăng `client_max_body_size` trong nginx rồi `systemctl reload nginx` |
| Database SSL error (Neon) | Neon idle disconnect — app tự reconnect; bỏ qua nếu thoáng qua |
| Schema mới sau update | Restart app — `init_db()` tự apply patches; không cần migrate thủ công |
| Certbot lỗi không gia hạn được | Kiểm tra DNS còn trỏ đúng không; tắt Cloudflare Proxy khi renew |
| Quên `ADMIN_SECRET` | Tạo giá trị mới trong `.env` và restart; hoặc `UPDATE users SET is_admin=true WHERE email='...'` qua psql |

---

## 14. Security checklist

- [ ] `JWT_SECRET` random ≥ 32 ký tự, không hardcode
- [ ] `ADMIN_SECRET` đặt sau khi có admin rồi có thể để trống
- [ ] `ALLOWED_ORIGINS` chỉ chứa domain thật của bạn
- [ ] Firewall: chỉ mở 22 (hoặc port SSH tùy chỉnh), 80, 443
- [ ] SSH: tắt đăng nhập bằng password, dùng SSH key
- [ ] Port 3000 **không** expose ra ngoài (chỉ localhost)
- [ ] Postgres không expose ra internet (không mở port 5432 trên UFW)
- [ ] HTTPS bắt buộc (certbot auto-renew hoạt động)
- [ ] Backup DB và uploads định kỳ
- [ ] Không commit `.env` vào git (đã có trong `.gitignore`)
