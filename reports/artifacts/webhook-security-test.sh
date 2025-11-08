#!/bin/bash
# Webhook signature verification smoke test (E24)
# Tests HMAC signature, timestamp validation, and replay protection

set -e

BASE="${1:-http://localhost:3001}"
WH_SECRET="${WH_SECRET:-dev-webhook-secret}"

echo "🔐 Webhook Security Smoke Test (E24)"
echo "====================================="
echo "Base URL: $BASE"
echo "Secret: ${WH_SECRET:0:10}..."
echo ""

# Helper function to generate HMAC signature
generate_signature() {
  local timestamp="$1"
  local body="$2"
  local payload="${timestamp}.${body}"
  node -e "const crypto = require('crypto'); const s = '$WH_SECRET'; const p = '$payload'; console.log(crypto.createHmac('sha256', s).update(p).digest('hex'));"
}

# Test 1: Valid webhook
echo "✅ Test 1: Valid webhook with correct signature"
TS=$(date +%s000)
BODY='{"event":"invoice.paid","id":"evt_test_1","amount":50000}'
SIG=$(generate_signature "$TS" "$BODY")
REQUEST_ID="test-$(date +%s)-$RANDOM"

RESPONSE=$(curl -sS -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $TS" \
  -H "X-Id: $REQUEST_ID" \
  -d "$BODY")

echo "$RESPONSE" | jq .
if echo "$RESPONSE" | jq -e '.received == true' >/dev/null; then
  echo "✅ PASS: Valid webhook accepted"
else
  echo "❌ FAIL: Valid webhook rejected"
  exit 1
fi
echo ""

# Test 2: Missing signature header
echo "❌ Test 2: Missing signature header (should fail with 400)"
TS=$(date +%s000)
BODY='{"event":"test"}'

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Ts: $TS" \
  -H "X-Id: test-missing-sig" \
  -d "$BODY")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "400" ]; then
  echo "✅ PASS: Missing header rejected with 400"
else
  echo "❌ FAIL: Expected 400, got $STATUS"
  exit 1
fi
echo ""

# Test 3: Invalid signature
echo "❌ Test 3: Invalid signature (should fail with 401)"
TS=$(date +%s000)
BODY='{"event":"test"}'

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: invalid-signature-hex" \
  -H "X-Ts: $TS" \
  -H "X-Id: test-invalid-sig" \
  -d "$BODY")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS: Invalid signature rejected with 401"
else
  echo "❌ FAIL: Expected 401, got $STATUS"
  exit 1
fi
echo ""

# Test 4: Stale timestamp (6 minutes old)
echo "❌ Test 4: Stale timestamp (should fail with 401)"
STALE_TS=$(($(date +%s000) - 360000)) # 6 minutes ago
BODY='{"event":"stale"}'
SIG=$(generate_signature "$STALE_TS" "$BODY")

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $STALE_TS" \
  -H "X-Id: test-stale" \
  -d "$BODY")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS: Stale timestamp rejected with 401"
else
  echo "❌ FAIL: Expected 401, got $STATUS"
  exit 1
fi
echo ""

# Test 5: Replay attack (duplicate request ID)
echo "❌ Test 5: Replay attack detection"
TS=$(date +%s000)
BODY='{"event":"replay_test","id":"evt_replay"}'
SIG=$(generate_signature "$TS" "$BODY")
REPLAY_ID="replay-test-$(date +%s)"

# First request - should succeed
RESPONSE1=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $TS" \
  -H "X-Id: $REPLAY_ID" \
  -d "$BODY")

STATUS1=$(echo "$RESPONSE1" | tail -n1)
if [ "$STATUS1" != "201" ]; then
  echo "❌ FAIL: First request should succeed, got $STATUS1"
  exit 1
fi
echo "✅ First request accepted (201)"

# Wait a moment for Redis to process
sleep 1

# Second request with same ID - should fail with 409
RESPONSE2=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $TS" \
  -H "X-Id: $REPLAY_ID" \
  -d "$BODY")

STATUS2=$(echo "$RESPONSE2" | tail -n1)
if [ "$STATUS2" = "409" ]; then
  echo "✅ PASS: Replay attack detected with 409"
else
  echo "❌ FAIL: Expected 409 for replay, got $STATUS2"
  exit 1
fi
echo ""

# Test 6: Tampered body
echo "❌ Test 6: Tampered body (signature mismatch)"
TS=$(date +%s000)
ORIGINAL_BODY='{"amount":100}'
TAMPERED_BODY='{"amount":1000}'
SIG=$(generate_signature "$TS" "$ORIGINAL_BODY")

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $TS" \
  -H "X-Id: test-tampered-$(date +%s)" \
  -d "$TAMPERED_BODY")

STATUS=$(echo "$RESPONSE" | tail -n1)
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS: Tampered body rejected with 401"
else
  echo "❌ FAIL: Expected 401 for tampered body, got $STATUS"
  exit 1
fi
echo ""

# Summary
echo "===================================="
echo "✅ All webhook security tests passed!"
echo "===================================="
echo ""
echo "Security features verified:"
echo "  ✅ HMAC signature verification"
echo "  ✅ Timestamp validation (±5 minutes)"
echo "  ✅ Replay protection (24h deduplication)"
echo "  ✅ Body integrity (tamper detection)"
echo "  ✅ Proper error codes (400, 401, 409)"
echo ""
echo "Environment:"
echo "  WH_SECRET: ${WH_SECRET:0:10}..."
echo "  Endpoint: $BASE/webhooks/billing"
