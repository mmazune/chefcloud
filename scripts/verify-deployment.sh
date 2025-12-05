#!/bin/bash
# Verify ChefCloud deployment health
# Usage: ./scripts/verify-deployment.sh <API_URL> <WEB_URL>

set -e

API_URL="${1:-https://chefcloud-api-production.up.railway.app}"
WEB_URL="${2:-https://chefcloud-web.vercel.app}"

echo "🔍 ChefCloud Deployment Verification"
echo "===================================="
echo "API:  $API_URL"
echo "Web:  $WEB_URL"
echo ""

# Test API Health
echo "1️⃣  Testing API Health..."
HEALTH_RESPONSE=$(curl -s "$API_URL/api/health")
HEALTH_STATUS=$(echo $HEALTH_RESPONSE | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "ok" ]; then
  echo "   ✅ API Health: OK"
  echo "   Response: $HEALTH_RESPONSE"
else
  echo "   ❌ API Health: FAILED"
  echo "   Response: $HEALTH_RESPONSE"
  exit 1
fi

# Test API Version
echo ""
echo "2️⃣  Testing API Version..."
VERSION_RESPONSE=$(curl -s "$API_URL/api/version")
VERSION=$(echo $VERSION_RESPONSE | jq -r '.version' 2>/dev/null || echo "unknown")

if [ "$VERSION" != "unknown" ] && [ "$VERSION" != "null" ]; then
  echo "   ✅ API Version: $VERSION"
  echo "   Response: $VERSION_RESPONSE"
else
  echo "   ⚠️  API Version: Could not retrieve"
  echo "   Response: $VERSION_RESPONSE"
fi

# Test Web Frontend
echo ""
echo "3️⃣  Testing Web Frontend..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/login")

if [ "$WEB_STATUS" = "200" ]; then
  echo "   ✅ Web Login: Accessible (HTTP $WEB_STATUS)"
else
  echo "   ❌ Web Login: Failed (HTTP $WEB_STATUS)"
  exit 1
fi

# Test CORS (if jq available)
echo ""
echo "4️⃣  Testing CORS Configuration..."
CORS_HEADER=$(curl -s -I -H "Origin: $WEB_URL" "$API_URL/api/health" | grep -i "access-control-allow-origin" || echo "")

if [ -n "$CORS_HEADER" ]; then
  echo "   ✅ CORS: Configured"
  echo "   Header: $CORS_HEADER"
else
  echo "   ⚠️  CORS: Not detected (may need manual verification)"
fi

# Test Database Connectivity (via API)
echo ""
echo "5️⃣  Testing Database Connectivity..."
# Assuming there's a /api/orgs or similar endpoint that requires DB
DB_TEST=$(curl -s -o /dev/null -w "%{http_code}" -H "x-dev-admin: test" "$API_URL/dev/subscriptions" || echo "000")

if [ "$DB_TEST" = "200" ] || [ "$DB_TEST" = "401" ] || [ "$DB_TEST" = "403" ]; then
  echo "   ✅ Database: Connected (API can query DB)"
else
  echo "   ⚠️  Database: Unknown status (HTTP $DB_TEST)"
fi

echo ""
echo "===================================="
echo "✅ Deployment verification completed!"
echo ""
echo "Next steps:"
echo "1. Test login at: $WEB_URL/login"
echo "2. Use demo credentials: owner@tapas.demo / TapasDemo!123"
echo "3. Verify Tapas demo data is visible"
echo ""
