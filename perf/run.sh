#!/bin/bash
# E54-s1: k6 load test runner

set -e

API_URL="${API_URL:-http://localhost:3001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ AUTH_TOKEN env var required (JWT token for L5 admin)"
  echo "Usage: AUTH_TOKEN=your-jwt ./run.sh [scenario]"
  exit 1
fi

SCENARIO="${1:-all}"

echo "🚀 Running k6 load tests against $API_URL"
echo ""

run_scenario() {
  local name=$1
  local file=$2
  
  echo "📊 Running: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if command -v k6 &> /dev/null; then
    k6 run --env API_URL="$API_URL" --env AUTH_TOKEN="$AUTH_TOKEN" "$file"
  elif command -v docker &> /dev/null; then
    docker run --rm -i --network host \
      -v "$(pwd):/scripts" \
      grafana/k6:latest run \
      --env API_URL="$API_URL" \
      --env AUTH_TOKEN="$AUTH_TOKEN" \
      "/scripts/$file"
  else
    echo "❌ Neither k6 nor docker found. Install k6 or docker."
    echo "   Install k6: https://k6.io/docs/get-started/installation/"
    exit 1
  fi
  
  echo ""
}

case $SCENARIO in
  sse)
    run_scenario "SSE Load Test" "scenarios/kpis-sse.js"
    ;;
  pos)
    run_scenario "POS Happy Path" "scenarios/pos-happy.js"
    ;;
  owner)
    run_scenario "Owner Overview Polling" "scenarios/owner-overview.js"
    ;;
  all)
    run_scenario "SSE Load Test" "scenarios/kpis-sse.js"
    run_scenario "POS Happy Path" "scenarios/pos-happy.js"
    run_scenario "Owner Overview Polling" "scenarios/owner-overview.js"
    ;;
  *)
    echo "Usage: $0 [sse|pos|owner|all]"
    exit 1
    ;;
esac

echo "✅ Load tests complete"
