#!/usr/bin/env bash
set -euo pipefail

# Cookie and CORS audit script for cross-domain authentication
# Usage: EMAIL="user@example.com" PASSWORD="password" bash scripts/audit-cookies.sh

BASE_URL="${BASE_URL:-https://chefcloud-b3d9.onrender.com}"
ORIGIN="${ORIGIN:-https://chefcloud-web.vercel.app}"

if [ -z "${EMAIL:-}" ] || [ -z "${PASSWORD:-}" ]; then
  echo "ERROR: EMAIL and PASSWORD environment variables are required" >&2
  echo "" >&2
  echo "Usage:" >&2
  echo "  EMAIL='user@example.com' PASSWORD='password' bash scripts/audit-cookies.sh" >&2
  echo "" >&2
  echo "Optional:" >&2
  echo "  BASE_URL='https://...' ORIGIN='https://...' EMAIL='...' PASSWORD='...' bash scripts/audit-cookies.sh" >&2
  exit 1
fi

echo "=================================================="
echo "ChefCloud CORS + Cookie Audit"
echo "=================================================="
echo "BASE_URL: $BASE_URL"
echo "ORIGIN:   $ORIGIN"
echo "EMAIL:    $EMAIL"
echo ""

# Step 1: OPTIONS preflight to /auth/login
echo "1. Testing OPTIONS preflight to /auth/login..."
echo "---"
OPTIONS_RESPONSE=$(curl -s -D - -o /dev/null -X OPTIONS "${BASE_URL}/auth/login" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type")

echo "$OPTIONS_RESPONSE" | grep "^HTTP"
echo "$OPTIONS_RESPONSE" | grep -iE "^access-control-allow-origin:" || echo "(No Access-Control-Allow-Origin)"
echo "$OPTIONS_RESPONSE" | grep -iE "^access-control-allow-credentials:" || echo "(No Access-Control-Allow-Credentials)"
echo "$OPTIONS_RESPONSE" | grep -iE "^access-control-allow-methods:" || echo "(No Access-Control-Allow-Methods)"
echo "$OPTIONS_RESPONSE" | grep -iE "^access-control-allow-headers:" || echo "(No Access-Control-Allow-Headers)"
echo ""

# Step 2: Attempt registration (non-fatal)
echo "2. Attempting POST /auth/register (detecting if endpoint exists)..."
echo "---"
REGISTER_RESPONSE=$(curl -s -D - -o /dev/null -X POST "${BASE_URL}/auth/register" \
  -H "Origin: ${ORIGIN}" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || true)

REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | grep "^HTTP" | awk '{print $2}')

if [ "$REGISTER_STATUS" = "200" ] || [ "$REGISTER_STATUS" = "201" ]; then
  echo "Registration successful (HTTP $REGISTER_STATUS)"
elif [ "$REGISTER_STATUS" = "409" ]; then
  echo "User already exists (HTTP 409) - this is fine, continuing to login"
elif [ "$REGISTER_STATUS" = "404" ]; then
  echo "Registration endpoint not found (HTTP 404) - this is fine, continuing to login"
else
  echo "Registration returned HTTP $REGISTER_STATUS - continuing to login anyway"
fi
echo ""

# Step 3: POST /auth/login
echo "3. Testing POST /auth/login (main auth flow)..."
echo "---"
LOGIN_RESPONSE=$(curl -s -D - -o /tmp/login-body.txt -X POST "${BASE_URL}/auth/login" \
  -H "Origin: ${ORIGIN}" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Print HTTP status
echo "$LOGIN_RESPONSE" | grep "^HTTP"
echo ""

# Print CORS headers
echo "CORS Headers:"
echo "$LOGIN_RESPONSE" | grep -iE "^access-control-allow-origin:" || echo "(No Access-Control-Allow-Origin)"
echo "$LOGIN_RESPONSE" | grep -iE "^access-control-allow-credentials:" || echo "(No Access-Control-Allow-Credentials)"
echo ""

# Print Set-Cookie headers with redacted values
echo "Set-Cookie Headers (values redacted):"
if echo "$LOGIN_RESPONSE" | grep -qi "^set-cookie:"; then
  echo "$LOGIN_RESPONSE" | grep -i "^set-cookie:" | sed -E 's/(set-cookie: [^=]+=)[^;]+/\1<REDACTED>/i'
else
  echo "(No Set-Cookie headers found)"
fi
echo ""

# Print response body (first 200 chars to avoid token leakage)
echo "Response Body (first 200 chars):"
head -c 200 /tmp/login-body.txt
echo ""
echo ""

# Cleanup
rm -f /tmp/login-body.txt

echo "=================================================="
echo "Audit Complete"
echo "=================================================="
echo ""
echo "Expected for cross-domain auth:"
echo "  ✓ access-control-allow-origin: $ORIGIN"
echo "  ✓ access-control-allow-credentials: true"
echo "  ✓ set-cookie: <name>=<REDACTED>; HttpOnly; Secure; SameSite=None"

