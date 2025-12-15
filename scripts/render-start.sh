#!/usr/bin/env bash
set -euo pipefail

# Render production start script
# Runs Prisma migrations from packages/db context, then starts API server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[render-start] root=$ROOT_DIR"
echo "[render-start] running prisma migrate deploy from packages/db"

cd "$ROOT_DIR/packages/db"

if [ ! -x "./node_modules/.bin/prisma" ]; then
  echo "[render-start] ERROR: prisma binary not found at packages/db/node_modules/.bin/prisma" >&2
  exit 1
fi

if [ ! -f "./prisma/schema.prisma" ]; then
  echo "[render-start] ERROR: schema not found at packages/db/prisma/schema.prisma" >&2
  exit 1
fi

./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "[render-start] migrations done, starting API"
cd "$ROOT_DIR"

if [ ! -f "services/api/dist/src/main.js" ]; then
  echo "[render-start] ERROR: API entrypoint not found at services/api/dist/src/main.js" >&2
  echo "[render-start] Did the build step complete successfully?" >&2
  exit 1
fi

node services/api/dist/src/main.js
