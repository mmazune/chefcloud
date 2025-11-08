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
