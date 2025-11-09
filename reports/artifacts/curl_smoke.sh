#!/usr/bin/env bash
# ChefCloud API Smoke Tests
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
TOKEN="${TOKEN:-REPLACE_WITH_VALID_JWT}"
ORG_ID="${ORG_ID:-ORG123}"

echo "=== ChefCloud Backend Smoke Tests ==="
echo "BASE: $BASE"

# Health
curl -sSf "$BASE/health" | jq . || echo "FAILED"

# E22.A: Franchise Overview Cache Smoke Test (miss then hit)
echo ""
echo "=== E22.A: Franchise Overview Cache Test ==="
PERIOD=$(date +%Y-%m)
echo "Testing cache behavior for period: $PERIOD"

echo -n "1st call (cache MISS): "
TIME1=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/overview?period=$PERIOD" -o /tmp/e22a_1.json -w "%{time_total}s")
echo "$TIME1 | cached=$(cat /tmp/e22a_1.json | jq -r '.cached // "N/A"')"

echo -n "2nd call (cache HIT):  "
TIME2=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/overview?period=$PERIOD" -o /tmp/e22a_2.json -w "%{time_total}s")
echo "$TIME2 | cached=$(cat /tmp/e22a_2.json | jq -r '.cached // "N/A"')"

# E22.B: Franchise Rankings Cache Smoke Test (miss then hit)
echo ""
echo "=== E22.B: Franchise Rankings Cache Test ==="
echo "Testing cache behavior for period: $PERIOD"

echo -n "1st call (cache MISS): "
TIME3=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/rankings?period=$PERIOD" -o /tmp/e22b_1.json -w "%{time_total}s")
echo "$TIME3 | cached=$(cat /tmp/e22b_1.json | jq -r '.cached // "N/A"')"

echo -n "2nd call (cache HIT):  "
TIME4=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/rankings?period=$PERIOD" -o /tmp/e22b_2.json -w "%{time_total}s")
echo "$TIME4 | cached=$(cat /tmp/e22b_2.json | jq -r '.cached // "N/A"')"

# E22.C: Franchise Budgets Cache Smoke Test (miss then hit)
echo ""
echo "=== E22.C: Franchise Budgets Cache Test ==="
echo "Testing cache behavior for period: $PERIOD"

echo -n "1st call (cache MISS): "
TIME5=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/budgets?period=$PERIOD" -o /tmp/e22c_1.json -w "%{time_total}s")
echo "$TIME5 | cached=$(cat /tmp/e22c_1.json | jq -r '.cached // "N/A"')"

echo -n "2nd call (cache HIT):  "
TIME6=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/franchise/budgets?period=$PERIOD" -o /tmp/e22c_2.json -w "%{time_total}s")
echo "$TIME6 | cached=$(cat /tmp/e22c_2.json | jq -r '.cached // "N/A"')"

# E22: Franchise
curl -sSf -H "Authorization: Bearer $TOKEN" "$BASE/franchise/overview?orgId=$ORG_ID&range=today" | jq . || echo "FAILED"

# E24: Billing
curl -sSf -H "Authorization: Bearer $TOKEN" "$BASE/billing/subscription?orgId=$ORG_ID" | jq . || echo "FAILED"

# E26: SSE Stream (5 sec) - SECURED
echo "Testing SSE stream security..."
timeout 5 curl -sSf -H "Authorization: Bearer $TOKEN" -N "$BASE/stream/kpis?orgId=$ORG_ID" | head -n 10 || echo "SSE (auth required)"

# E27: Costing
curl -sSf -H "Authorization: Bearer $TOKEN" "$BASE/analytics/costing/summary?orgId=$ORG_ID&since=2025-10-01" | jq . || echo "FAILED"

echo "=== Complete ==="

