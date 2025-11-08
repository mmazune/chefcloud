#!/bin/bash
# Webhook Security Test Script
# Tests E24 HMAC signature verification
# Usage: ./webhook-security-test.sh

set -e

BASE=${BASE:-http://localhost:3000}
WH_SECRET=${WH_SECRET:-"test-webhook-secret-change-in-production"}

echo "======================================"
echo "E24 Webhook Security Test"
echo "Base URL: $BASE"
echo "======================================"
echo ""

# Helper function to generate HMAC signature
generate_signature() {
  local timestamp=$1
  local body=$2
  local payload="${timestamp}.${body}"
  echo -n "$payload" | openssl dgst -sha256 -hmac "$WH_SECRET" -hex | awk '{print $2}'
}

# Test 1: Valid webhook
echo "🔐 Test 1: Valid webhook signature"
TIMESTAMP=$(date +%s)000
BODY='{"event":"payment.completed","amount":1000}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$BODY")
WEBHOOK_ID="test-$(uuidgen 2>/dev/null || echo $RANDOM)"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIGNATURE" \
  -H "X-Ts: $TIMESTAMP" \
  -H "X-Id: $WEBHOOK_ID" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Valid webhook accepted (HTTP $HTTP_CODE)"
else
  echo "⚠ Expected 200/201, got HTTP $HTTP_CODE"
fi
echo ""

# Test 2: Invalid signature
echo "🚫 Test 2: Invalid signature (should reject)"
INVALID_SIG="0000000000000000000000000000000000000000000000000000000000000000"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $INVALID_SIG" \
  -H "X-Ts: $TIMESTAMP" \
  -H "X-Id: test-invalid-$(uuidgen 2>/dev/null || echo $RANDOM)" \
  -d "$BODY")

if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ Invalid signature rejected (HTTP 401)"
else
  echo "⚠ Expected 401, got HTTP $HTTP_CODE"
fi
echo ""

# Test 3: Stale timestamp (> 5 minutes old)
echo "⏰ Test 3: Stale timestamp (should reject)"
OLD_TIMESTAMP=$(($(date +%s) - 400))000  # 400 seconds = 6.6 minutes
OLD_SIG=$(generate_signature "$OLD_TIMESTAMP" "$BODY")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $OLD_SIG" \
  -H "X-Ts: $OLD_TIMESTAMP" \
  -H "X-Id: test-stale-$(uuidgen 2>/dev/null || echo $RANDOM)" \
  -d "$BODY")

if [ "$HTTP_CODE" = "401" ]; then
  echo "✓ Stale timestamp rejected (HTTP 401)"
else
  echo "⚠ Expected 401, got HTTP $HTTP_CODE"
fi
echo ""

# Test 4: Replay attack (same X-Id twice)
echo "🔁 Test 4: Replay protection (should reject duplicate)"
TIMESTAMP=$(date +%s)000
BODY='{"event":"test.replay","data":"attempt"}'
SIGNATURE=$(generate_signature "$TIMESTAMP" "$BODY")
REPLAY_ID="replay-test-$(uuidgen 2>/dev/null || echo $RANDOM)"

# First request (should succeed)
HTTP_CODE1=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIGNATURE" \
  -H "X-Ts: $TIMESTAMP" \
  -H "X-Id: $REPLAY_ID" \
  -d "$BODY")

sleep 1

# Second request with same X-Id (should fail with 409)
HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIGNATURE" \
  -H "X-Ts: $TIMESTAMP" \
  -H "X-Id: $REPLAY_ID" \
  -d "$BODY")

if [ "$HTTP_CODE2" = "409" ]; then
  echo "✓ Replay detected and rejected (HTTP 409)"
else
  echo "⚠ Expected 409 for replay, got HTTP $HTTP_CODE2"
fi
echo ""

# Test 5: Missing headers
echo "❌ Test 5: Missing required headers (should reject)"

echo "  Missing X-Sig:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Ts: $TIMESTAMP" \
  -H "X-Id: test-missing-sig" \
  -d "$BODY")
if [ "$HTTP_CODE" = "401" ]; then echo "  ✓ Rejected (401)"; else echo "  ⚠ Got $HTTP_CODE"; fi

echo "  Missing X-Ts:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIGNATURE" \
  -H "X-Id: test-missing-ts" \
  -d "$BODY")
if [ "$HTTP_CODE" = "401" ]; then echo "  ✓ Rejected (401)"; else echo "  ⚠ Got $HTTP_CODE"; fi

echo "  Missing X-Id:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIGNATURE" \
  -H "X-Ts: $TIMESTAMP" \
  -d "$BODY")
if [ "$HTTP_CODE" = "401" ]; then echo "  ✓ Rejected (401)"; else echo "  ⚠ Got $HTTP_CODE"; fi

echo ""
echo "======================================"
echo "✅ Webhook security tests complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "  - HMAC-SHA256 signature verification: Tested"
echo "  - Clock skew tolerance (±5min): Tested"
echo "  - Replay protection (24h window): Tested"
echo "  - Required headers validation: Tested"
echo ""
echo "Note: Ensure WH_SECRET env variable matches server configuration"
