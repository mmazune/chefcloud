#!/bin/bash
# M19: Staff Insights & Employee-of-the-Month - API Examples
# Complete curl examples for all staff insights endpoints

BASE_URL="http://localhost:3000"
ORG_ID="org_test"
BRANCH_ID="branch_main"

# Login as L5 (Owner) to get JWT
echo "=== Logging in as Owner (L5) ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@chefcloud.test",
    "password": "password123"
  }')
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
echo "Token: $TOKEN"
echo ""

# 1. GET /staff/insights/rankings - Get staff rankings for current month
echo "=== 1. Get Staff Rankings (Current Month) ==="
curl -X GET "$BASE_URL/staff/insights/rankings?periodType=MONTH" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 2. GET /staff/insights/rankings - Get staff rankings for specific week
echo "=== 2. Get Staff Rankings (Week 47, 2025) ==="
curl -X GET "$BASE_URL/staff/insights/rankings?periodType=WEEK&from=2025-11-17&to=2025-11-23" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 3. GET /staff/insights/rankings - Branch-specific rankings
echo "=== 3. Get Staff Rankings (Branch-Specific) ==="
curl -X GET "$BASE_URL/staff/insights/rankings?periodType=MONTH&branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 4. GET /staff/insights/employee-of-month - Get employee of the month
echo "=== 4. Get Employee-of-the-Month (November 2025) ==="
curl -X GET "$BASE_URL/staff/insights/employee-of-month?referenceDate=2025-11-15" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 5. GET /staff/insights/employee-of-week - Get employee of the week
echo "=== 5. Get Employee-of-the-Week (Week 47) ==="
curl -X GET "$BASE_URL/staff/insights/employee-of-week?referenceDate=2025-11-20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 6. GET /staff/insights/employee-of-month - Get highest sales award
echo "=== 6. Get Highest Sales Award (Current Month) ==="
curl -X GET "$BASE_URL/staff/insights/employee-of-month?category=HIGHEST_SALES" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 7. GET /staff/insights/employee-of-month - Get most reliable award
echo "=== 7. Get Most Reliable Award (Current Month) ==="
curl -X GET "$BASE_URL/staff/insights/employee-of-month?category=MOST_RELIABLE" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 8. POST /staff/insights/awards - Create/persist award for current month
echo "=== 8. Create Award (Employee-of-the-Month) ==="
curl -X POST "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "MONTH",
    "referenceDate": "2025-11-15",
    "category": "TOP_PERFORMER"
  }' | jq '.'
echo ""

# 9. POST /staff/insights/awards - Create weekly award (idempotent)
echo "=== 9. Create Award (Employee-of-the-Week) ==="
curl -X POST "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "WEEK",
    "referenceDate": "2025-11-20",
    "branchId": "'"$BRANCH_ID"'",
    "category": "TOP_PERFORMER"
  }' | jq '.'
echo ""

# 10. POST /staff/insights/awards - Create highest sales award
echo "=== 10. Create Award (Highest Sales) ==="
curl -X POST "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "MONTH",
    "referenceDate": "2025-11-01",
    "category": "HIGHEST_SALES"
  }' | jq '.'
echo ""

# 11. GET /staff/insights/awards - List all awards
echo "=== 11. List All Awards ==="
curl -X GET "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 12. GET /staff/insights/awards - List awards for specific employee
echo "=== 12. List Awards for Specific Employee ==="
EMPLOYEE_ID="emp_12345"
curl -X GET "$BASE_URL/staff/insights/awards?employeeId=$EMPLOYEE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 13. GET /staff/insights/awards - List awards by period type
echo "=== 13. List Monthly Awards ==="
curl -X GET "$BASE_URL/staff/insights/awards?periodType=MONTH" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 14. GET /staff/insights/awards - List awards by category
echo "=== 14. List 'Highest Sales' Awards ==="
curl -X GET "$BASE_URL/staff/insights/awards?category=HIGHEST_SALES" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 15. GET /staff/insights/awards - List awards with date range
echo "=== 15. List Awards (November 2025) ==="
curl -X GET "$BASE_URL/staff/insights/awards?fromDate=2025-11-01&toDate=2025-11-30" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 16. GET /staff/insights/awards - Pagination
echo "=== 16. List Awards (Paginated, 10 per page) ==="
curl -X GET "$BASE_URL/staff/insights/awards?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 17. GET /staff/insights/me - Staff self-view (as L3 user)
echo "=== 17. Get My Own Insights (Staff Self-View) ==="
# Login as L3 staff
STAFF_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "waiter@chefcloud.test",
    "password": "password123"
  }')
STAFF_TOKEN=$(echo $STAFF_LOGIN | jq -r '.access_token')

curl -X GET "$BASE_URL/staff/insights/me?periodType=MONTH" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 18. GET /staff/insights/me - Weekly self-view
echo "=== 18. Get My Own Insights (Week) ==="
curl -X GET "$BASE_URL/staff/insights/me?periodType=WEEK" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 19. Attempt unauthorized access (L3 trying to view rankings)
echo "=== 19. Unauthorized Access (L3 Viewing Rankings) - Should Fail ==="
curl -X GET "$BASE_URL/staff/insights/rankings?periodType=MONTH" \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# 20. Quarterly award
echo "=== 20. Get Employee-of-the-Quarter (Q4 2025) ==="
curl -X GET "$BASE_URL/staff/insights/employee-of-quarter?referenceDate=2025-11-01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "=== M19 API Examples Complete ==="
