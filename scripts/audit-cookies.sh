#!/usr/bin/env bash
set -euo pipefail

# Cookie and CORS audit script for production API
# Usage: EMAIL="user@example.com" PASSWORD="password" bash scripts/audit-cookies.sh

API_URL="https://chefcloud-b3d9.onrender.com"
FRONTEND_ORIGIN="https://chefcloud-web.vercel.app"

if [ -z "${EMAIL:-}" ] || [ -z "${PASSWORD:-}" ]; then
  echo "ERROR: EMAIL and PASSWORD environment variables required" >&2
  echo "Usage: EMAIL='user@example.com' PASSWORD='password' bash scripts/audit-cookies.sh" >&2
  exit 1
fi

echo "=================================================="
echo "ChefCloud Cookie & CORS Audit"
echo "API: $API_URL"
echo "Frontend Origin: $FRONTEND_ORIGIN"
echo "=================================================="
echo ""

# Test 1: Health check
echo "1. Testing /api/health (no auth, no CORS headers expected)..."
echo "---"
curl -si "${API_URL}/api/health" | sed -n '1,20p'
echo ""
echo ""

# Test 2: OPTIONS preflight for /auth/login
echo "2. Testing OPTIONS preflight for /auth/login (CORS check)..."
echo "---"
curl -si -X OPTIONS "${API_URL}/auth/login" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  | grep -iE "^HTTP|^access-control|^vary" || echo "(No CORS headers found)"
echo ""
echo ""

# Test 3: POST /auth/login with Origin header
echo "3. Testing POST /auth/login (cookie + CORS check)..."
echo "---"

LOGIN_RESPONSE=$(curl -si -X POST "${API_URL}/auth/login" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Extract and display status line
echo "$LOGIN_RESPONSE" | grep "^HTTP"
echo ""

# Extract and redact Set-Cookie headers
echo "Set-Cookie headers (values redacted):"
echo "$LOGIN_RESPONSE" | grep -i "^set-cookie:" | sed -E 's/(=)[^;]+/=<REDACTED>/g' || echo "(No Set-Cookie headers found)"
echo ""

# Extract CORS headers
echo "CORS headers:"
echo "$LOGIN_RESPONSE" | grep -iE "^access-control-allow-origin:|^access-control-allow-credentials:" || echo "(No CORS headers found)"
echo ""

# Extract body (first 500 chars to avoid leaking tokens)
echo "Response body (truncated):"
echo "$LOGIN_RESPONSE" | tail -n +$(echo "$LOGIN_RESPONSE" | grep -n "^$" | head -1 | cut -d: -f1) | head -c 500
echo ""
echo ""

echo "=================================================="
echo "Audit complete"
echo "=================================================="
echo ""
echo "Expected cookie attributes for cross-site XHR:"
echo "  - HttpOnly (prevents JavaScript access)"
echo "  - Secure (HTTPS only)"
echo "  - SameSite=None (allows cross-origin requests)"
echo ""
echo "Expected CORS headers:"
echo "  - access-control-allow-origin: ${FRONTEND_ORIGIN}"
echo "  - access-control-allow-credentials: true"
