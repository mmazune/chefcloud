#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/services/api"
REPORT_DIR="$ROOT_DIR/reports/smoke"
mkdir -p "$REPORT_DIR"

PORT="${PORT:-3030}"
HOST="127.0.0.1"
BASE="http://$HOST:$PORT"

# Env gates (override in CI if needed)
export NODE_ENV=production
export METRICS_ENABLED="${METRICS_ENABLED:-1}"
export DOCS_ENABLED="${DOCS_ENABLED:-0}"
export ERROR_INCLUDE_STACKS="${ERROR_INCLUDE_STACKS:-0}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

echo "[smoke] starting API on $BASE (METRICS_ENABLED=$METRICS_ENABLED)"
cd "$API_DIR"

# start app in background
node dist/src/main.js > "$REPORT_DIR/app.stdout.log" 2> "$REPORT_DIR/app.stderr.log" &
APP_PID=$!
echo "$APP_PID" > "$REPORT_DIR/app.pid"

# wait until port is ready (max 20s)
attempts=40
until curl -fsS "$BASE/healthz" -o /dev/null || [[ $attempts -eq 0 ]]; do
  sleep 0.5
  attempts=$((attempts-1))
done

if [[ $attempts -eq 0 ]]; then
  echo "[smoke] boot timeout; last 100 lines of stderr:"
  tail -n 100 "$REPORT_DIR/app.stderr.log" || true
  kill $APP_PID 2>/dev/null || true
  exit 1
fi

echo "[smoke] /healthz"
curl -fsS "$BASE/healthz" -o "$REPORT_DIR/healthz.json"
echo "[smoke] /readiness"
curl -fsS "$BASE/readiness" -o "$REPORT_DIR/readiness.json"

if [[ "${METRICS_ENABLED}" == "1" ]]; then
  echo "[smoke] /metrics"
  curl -fsS "$BASE/metrics" -o "$REPORT_DIR/metrics.txt"
  # basic Prometheus sanity (counter/help/type line existence)
  if ! grep -E '^[a-zA-Z_:][a-zA-Z0-9_:]*\s' "$REPORT_DIR/metrics.txt" >/dev/null; then
    echo "[smoke] metrics endpoint lacks Prometheus lines"
    kill $APP_PID 2>/dev/null || true
    exit 2
  fi
fi

# success — capture short summary
{
  echo "BASE=$BASE"
  echo "HEALTHZ_STATUS=200"
  echo "READINESS_STATUS=200"
  [[ "${METRICS_ENABLED}" == "1" ]] && echo "METRICS_STATUS=200"
} > "$REPORT_DIR/summary.env"

# stop app
kill $APP_PID 2>/dev/null || true

# give time to exit; force after 5s
for i in {1..10}; do
  if ! kill -0 $APP_PID 2>/dev/null; then
    exit 0
  fi
  sleep 0.5
done
echo "[smoke] forcing kill -9"
kill -9 $APP_PID 2>/dev/null || true
exit 0
