#!/bin/bash
set -e

# ── Digital Product Shop — VPS Start Script ──────────
# Usage:
#   cp .env.example .env   # fill in your values
#   chmod +x start-vps.sh
#   ./start-vps.sh

# Load .env if exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "[OK] Loaded .env"
else
    echo "[WARN] No .env file found. Copy .env.example to .env and configure it."
    echo "       Run: cp .env.example .env"
    exit 1
fi

PORT=${APP_PORT:-3000}

# Check required vars
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL is not set in .env"
    exit 1
fi

echo "[OK] DATABASE_URL is set"
echo "[>>] Starting server on port $PORT..."

exec uvicorn app:asgi --host 0.0.0.0 --port "$PORT"
