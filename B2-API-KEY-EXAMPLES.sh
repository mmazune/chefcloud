#!/bin/bash
# B2 Security - API Key Examples
# ChefCloud API - Spout Ingest with API Key Authentication

set -e

API_URL="${API_URL:-http://localhost:3001}"

echo "=========================================="
echo "B2: API Key Security Examples"
echo "=========================================="
echo

# Step 1: Login as L5 user (requires existing user)
echo "Step 1: Login as L5 Admin User"
echo "Note: This requires an existing L5 user in the database"
echo
echo "Example login request:"
echo "curl -X POST \"$API_URL/auth/login\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"email\":\"admin@example.com\",\"password\":\"your-password\"}'"
echo
read -p "Enter your JWT token (from login response): " JWT_TOKEN
echo

# Step 2: Create API Key
echo "Step 2: Create API Key"
API_KEY_RESPONSE=$(curl -s -X POST "$API_URL/ops/apikeys" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Spout Ingestion",
    "scopes": ["spout:ingest"]
  }')

echo "Response:"
echo "$API_KEY_RESPONSE" | jq '.'
echo

API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.key')
echo "⚠️  SAVE THIS KEY: $API_KEY"
echo "   (It will not be shown again!)"
echo

# Step 3: List API Keys (verify it was created)
echo "Step 3: List API Keys"
curl -s -X GET "$API_URL/ops/apikeys" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo

# Step 4: Create Spout Device (requires branchId)
read -p "Enter your branchId (or press Enter to skip device creation): " BRANCH_ID
if [ -n "$BRANCH_ID" ]; then
  echo "Creating Spout Device..."
  DEVICE_RESPONSE=$(curl -s -X POST "$API_URL/hardware/spout/devices" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Spout Device",
      "vendor": "SANDBOX",
      "branchId": "'"$BRANCH_ID"'"
    }')
  
  echo "$DEVICE_RESPONSE" | jq '.'
  DEVICE_ID=$(echo "$DEVICE_RESPONSE" | jq -r '.id')
  DEVICE_SECRET=$(echo "$DEVICE_RESPONSE" | jq -r '.secret')
  echo
  echo "Device ID: $DEVICE_ID"
  echo "Device Secret: $DEVICE_SECRET"
  echo
fi

# Step 5: Spout Ingest WITHOUT API Key (should fail with 401)
if [ -n "$DEVICE_ID" ]; then
  echo "Step 5: Spout Ingest WITHOUT API Key (should fail)"
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
    -H "Content-Type: application/json" \
    -d '{
      "deviceId": "'"$DEVICE_ID"'",
      "pulses": 42,
      "occurredAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }' 2>&1 | head -15
  echo
  
  # Step 6: Spout Ingest WITH API Key (should succeed)
  echo "Step 6: Spout Ingest WITH API Key (should succeed)"
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
    -H "X-Api-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "deviceId": "'"$DEVICE_ID"'",
      "pulses": 42,
      "occurredAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }' 2>&1 | head -20
  echo
  
  # Step 7: Spout Ingest WITH API Key + HMAC Signature
  echo "Step 7: Spout Ingest WITH API Key + HMAC Signature"
  echo "Note: Set SPOUT_VERIFY=true in .env to enable signature verification"
  echo
  
  TIMESTAMP=$(date +%s)
  OCCURRED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  BODY='{"deviceId":"'$DEVICE_ID'","pulses":100,"occurredAt":"'$OCCURRED_AT'"}'
  DATA="${DEVICE_SECRET}${BODY}${TIMESTAMP}"
  SIGNATURE=$(echo -n "$DATA" | openssl dgst -sha256 -hex | awk '{print $2}')
  
  echo "Signature: $SIGNATURE"
  echo "Timestamp: $TIMESTAMP"
  echo
  
  curl -i -X POST "$API_URL/hardware/spout/ingest" \
    -H "X-Api-Key: $API_KEY" \
    -H "X-Spout-Signature: $SIGNATURE" \
    -H "Content-Type: application/json" \
    -d '{
      "deviceId": "'"$DEVICE_ID"'",
      "pulses": 100,
      "occurredAt": "'"$OCCURRED_AT"'",
      "raw": {
        "timestamp": "'"$TIMESTAMP"'"
      }
    }' 2>&1 | head -20
  echo
fi

echo "=========================================="
echo "✅ B2 Security Examples Complete!"
echo "=========================================="
echo
echo "Summary:"
echo "- API keys use argon2id hashing"
echo "- X-Api-Key header required for /hardware/spout/ingest"
echo "- HMAC signatures use SHA256 with timestamp"
echo "- Replay protection: 5-minute window"
echo "- Rate limiting: 60 req/min per IP (configurable)"
echo
echo "See B2-SECURITY-HARDENING.md for full documentation"
