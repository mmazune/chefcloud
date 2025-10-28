#!/bin/bash
# M10-s2 Anti-theft Dashboards - API Examples
# Prerequisites: 
# - API running on http://localhost:3001
# - Valid JWT token in JWT_TOKEN environment variable

BASE_URL="${API_URL:-http://localhost:3001}"
TOKEN="${JWT_TOKEN:-your-jwt-token-here}"

echo "=== M10-s2 Anti-theft Dashboards API Examples ==="
echo ""

# 1. Get void leaderboard
echo "1. Void Leaderboard (last 30 days)"
curl -s "${BASE_URL}/dash/leaderboards/voids?from=2025-01-01&to=2025-01-31&limit=10" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 2. Get discount leaderboard
echo "2. Discount Leaderboard (last 30 days)"
curl -s "${BASE_URL}/dash/leaderboards/discounts?from=2025-01-01&to=2025-01-31&limit=10" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 3. Get no-drinks rate
echo "3. No-Drinks Rate per Waiter (last 30 days)"
curl -s "${BASE_URL}/dash/no-drinks-rate?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 4. Get late void heatmap
echo "4. Late Void Heatmap (7x24 matrix)"
curl -s "${BASE_URL}/dash/late-void-heatmap?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 5. Get recent anomalies
echo "5. Recent Anomaly Events (last 50)"
curl -s "${BASE_URL}/dash/anomalies/recent?limit=50" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 6. Get current thresholds
echo "6. Get Current Thresholds"
curl -s "${BASE_URL}/thresholds" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

# 7. Update thresholds
echo "7. Update Thresholds (set lateVoidMin=10, heavyDiscountUGX=8000)"
curl -s -X PATCH "${BASE_URL}/thresholds" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "lateVoidMin": 10,
    "heavyDiscountUGX": 8000
  }' | jq '.'
echo ""

# 8. Verify thresholds updated
echo "8. Verify Thresholds Updated"
curl -s "${BASE_URL}/thresholds" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.'
echo ""

echo "=== Done ==="
