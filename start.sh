#!/bin/bash
set -e

# Unified Linux start script for VPS/runtime use.
# - Loads .env automatically when present
# - Ensures dependencies are synced
# - Starts bot runner and web server together
# - Uses APP_PORT when provided, otherwise defaults to 3000

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

APP_PORT=${APP_PORT:-3000}

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL is not set"
  exit 1
fi

if [ ! -d ".venv" ]; then
  uv sync --compile-bytecode --frozen || uv sync --compile-bytecode
fi

cleanup() {
  if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
    kill "$BOT_PID" 2>/dev/null || true
    wait "$BOT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[start] Starting bot runner"
uv run python bot/run_bots.py &
BOT_PID=$!

echo "[start] Starting web server on 0.0.0.0:${APP_PORT}"
exec uv run uvicorn app:asgi --host 0.0.0.0 --port "$APP_PORT"
