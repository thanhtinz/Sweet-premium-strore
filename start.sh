#!/bin/bash
set -e

# Unified Linux start script for VPS/runtime use.
# - Loads .env automatically when present
# - Ensures dependencies are synced
# - Starts the web server; FastAPI lifespan starts bot runner once
# - Uses APP_PORT when provided, otherwise defaults to 3000

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

APP_PORT=${APP_PORT:-3000}

if [ -f /usr/local/lib/workshop-devguard.sh ]; then
  source /usr/local/lib/workshop-devguard.sh
  devguard_acquire "${APP_PORT}"
fi

if [ -z "$DATABASE_URL" ] && [ -n "$DB556FD74B_DATABASE_URL" ]; then
  DATABASE_URL="$DB556FD74B_DATABASE_URL"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[ERROR] DATABASE_URL is not set"
  exit 1
fi

if [ ! -d ".venv" ]; then
  uv sync --compile-bytecode --frozen || uv sync --compile-bytecode
fi

echo "[start] Starting web server on 0.0.0.0:${APP_PORT}"
exec uv run uvicorn app:asgi --host 0.0.0.0 --port "$APP_PORT"
