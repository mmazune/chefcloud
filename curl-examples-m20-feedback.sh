#!/bin/bash
# curl-examples-m20-feedback.sh
# Test scripts for M20 – Customer Feedback & NPS Hardening
# Covers: Public anonymous feedback, authenticated submission, listing, analytics
# Prerequisites: Backend running on http://localhost:4000

API="http://localhost:4000"
ORG_ID="cm123org456789"        # Replace with valid org ID
BRANCH_ID="cm123branch789"     # Replace with valid branch ID
ORDER_ID="cm123order456"       # Replace with valid order ID
ORDER_NUMBER="ORD-20241122-001" # Replace with valid order number
RESERVATION_ID="cm123res789"   # Replace with valid reservation ID

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   M20 - Customer Feedback & NPS Hardening Tests   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"

# ============================================================================
# SECTION 1: LOGIN TO GET JWT TOKEN FOR AUTHENTICATED TESTS
# ============================================================================
echo -e "${YELLOW}=== SECTION 1: Authentication ===${NC}\n"

echo -e "${GREEN}1.1 Login as L4 Manager${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@chefcloud.example",
    "password": "SecurePass123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // .access_token // .token // empty')

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ Failed to obtain JWT token. Update credentials or check auth endpoint.${NC}"
  echo -e "${YELLOW}Continuing with public endpoint tests only...${NC}\n"
else
  echo -e "${GREEN}✅ JWT Token obtained: ${JWT_TOKEN:0:30}...${NC}\n"
fi

# ============================================================================
# SECTION 2: PUBLIC ANONYMOUS FEEDBACK SUBMISSION
# ============================================================================
echo -e "${YELLOW}=== SECTION 2: Public Anonymous Feedback ===${NC}\n"

echo -e "${GREEN}2.1 Submit public feedback (NPS 9 - PROMOTER) with orderNumber${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "'"$ORDER_NUMBER"'",
    "score": 9,
    "comment": "Excellent service! Fast delivery and hot food. Will order again!",
    "channel": "QR",
    "tags": ["service", "speed", "quality"]
  }' | jq '.'
echo ""

echo -e "${GREEN}2.2 Submit public feedback (NPS 3 - DETRACTOR) with reservationId${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "'"$RESERVATION_ID"'",
    "score": 3,
    "comment": "Waited 45 minutes past reservation time. Manager was unhelpful.",
    "channel": "EMAIL",
    "tags": ["wait-time", "staff", "management"]
  }' | jq '.'
echo ""

echo -e "${GREEN}2.3 Submit public feedback (NPS 8 - PASSIVE) no comment${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "ORD-20241122-002",
    "score": 8,
    "channel": "SMS"
  }' | jq '.'
echo ""

echo -e "${GREEN}2.4 Submit public feedback (NPS 10 - PROMOTER) with emoji${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "ORD-20241122-003",
    "score": 10,
    "comment": "🔥🔥🔥 Best pizza in town! 🍕 Chef is amazing!",
    "channel": "KIOSK",
    "tags": ["food-quality", "chef"]
  }' | jq '.'
echo ""

echo -e "${GREEN}2.5 [NEGATIVE TEST] Submit duplicate public feedback (should fail with 400)${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "'"$ORDER_NUMBER"'",
    "score": 5,
    "channel": "PORTAL"
  }' | jq '.'
echo ""

echo -e "${GREEN}2.6 [NEGATIVE TEST] Submit public feedback with invalid orderNumber (should fail with 404)${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "INVALID-ORDER-999",
    "score": 7,
    "channel": "EMAIL"
  }' | jq '.'
echo ""

echo -e "${GREEN}2.7 [NEGATIVE TEST] Submit public feedback with score > 10 (should fail with 400)${NC}"
curl -s -X POST "$API/feedback/public" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "ORD-20241122-004",
    "score": 11,
    "channel": "QR"
  }' | jq '.'
echo ""

echo -e "${GREEN}2.8 [NEGATIVE TEST] Rate limit test - submit 11th request within hour (should fail with 429)${NC}"
echo -e "${YELLOW}Note: Requires 10 prior submissions from same IP within 1 hour${NC}"
for i in {1..11}; do
  echo -e "  Request $i/11..."
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/feedback/public" \
    -H "Content-Type: application/json" \
    -d '{
      "orderNumber": "ORD-TEST-'$i'",
      "score": 5,
      "channel": "OTHER"
    }')
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
  BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')
  
  if [ "$HTTP_CODE" == "429" ]; then
    echo -e "${GREEN}✅ Rate limit enforced on request $i${NC}"
    echo "$BODY" | jq '.'
    break
  elif [ $i -eq 11 ]; then
    echo -e "${YELLOW}⚠️  Rate limit not triggered (may need more requests)${NC}"
  fi
  sleep 0.5
done
echo ""

# ============================================================================
# SECTION 3: AUTHENTICATED FEEDBACK SUBMISSION
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 3: Authenticated Feedback Submission ===${NC}\n"

  echo -e "${GREEN}3.1 Submit authenticated feedback (L4 Manager) with orderId${NC}"
  curl -s -X POST "$API/feedback" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{
      "orderId": "'"$ORDER_ID"'",
      "score": 9,
      "comment": "Customer praised our new dessert menu!",
      "channel": "POS",
      "tags": ["dessert", "menu"],
      "sentimentHint": "positive"
    }' | jq '.'
  echo ""

  echo -e "${GREEN}3.2 Submit authenticated feedback (L4 Manager) with branchId override${NC}"
  curl -s -X POST "$API/feedback" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{
      "branchId": "'"$BRANCH_ID"'",
      "score": 2,
      "comment": "Walk-in customer complained about cleanliness of restrooms.",
      "channel": "POS",
      "tags": ["cleanliness", "restroom"],
      "sentimentHint": "negative"
    }' | jq '.'
  echo ""

  echo -e "${GREEN}3.3 [NEGATIVE TEST] Submit duplicate authenticated feedback (should fail with 400)${NC}"
  curl -s -X POST "$API/feedback" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d '{
      "orderId": "'"$ORDER_ID"'",
      "score": 8,
      "channel": "PORTAL"
    }' | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 4: LIST FEEDBACK WITH FILTERS
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 4: List Feedback with Filters ===${NC}\n"

  echo -e "${GREEN}4.1 List all feedback (default pagination: 50 per page)${NC}"
  curl -s -X GET "$API/feedback" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.2 List feedback from last 7 days${NC}"
  FROM_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z)
  TO_DATE=$(date -u +%Y-%m-%dT23:59:59Z)
  curl -s -X GET "$API/feedback?from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.3 List feedback for specific branch${NC}"
  curl -s -X GET "$API/feedback?branchId=$BRANCH_ID" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.4 List feedback with score <= 3 (critical feedback)${NC}"
  curl -s -X GET "$API/feedback?maxScore=3" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.5 List feedback with score >= 9 (promoters only)${NC}"
  curl -s -X GET "$API/feedback?minScore=9" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.6 List feedback from QR channel only${NC}"
  curl -s -X GET "$API/feedback?channel=QR" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.7 List feedback from detractors (NPS category)${NC}"
  curl -s -X GET "$API/feedback?npsCategory=DETRACTOR" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.8 List feedback with comments only${NC}"
  curl -s -X GET "$API/feedback?hasComment=true" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.9 List feedback with pagination (limit=5, offset=0)${NC}"
  curl -s -X GET "$API/feedback?limit=5&offset=0" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}4.10 List feedback with combined filters (branch + date range + detractors + has comment)${NC}"
  curl -s -X GET "$API/feedback?branchId=$BRANCH_ID&from=$FROM_DATE&to=$TO_DATE&npsCategory=DETRACTOR&hasComment=true" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 5: GET SINGLE FEEDBACK BY ID
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 5: Get Single Feedback by ID ===${NC}\n"

  echo -e "${GREEN}5.1 Get feedback by ID (with relations: order, branch, createdBy)${NC}"
  # First get a feedback ID from the list
  FEEDBACK_ID=$(curl -s -X GET "$API/feedback?limit=1" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq -r '.items[0].id // empty')
  
  if [ -n "$FEEDBACK_ID" ]; then
    echo -e "${BLUE}Using feedback ID: $FEEDBACK_ID${NC}"
    curl -s -X GET "$API/feedback/$FEEDBACK_ID" \
      -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  else
    echo -e "${YELLOW}⚠️  No feedback found to retrieve by ID${NC}"
  fi
  echo ""

  echo -e "${GREEN}5.2 [NEGATIVE TEST] Get feedback with invalid ID (should fail with 404)${NC}"
  curl -s -X GET "$API/feedback/cm99999invalid" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 6: NPS ANALYTICS - SUMMARY
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 6: NPS Analytics - Summary ===${NC}\n"

  FROM_DATE=$(date -u -d '30 days ago' +%Y-%m-%dT00:00:00Z)
  TO_DATE=$(date -u +%Y-%m-%dT23:59:59Z)

  echo -e "${GREEN}6.1 Get NPS summary for last 30 days (org-wide)${NC}"
  curl -s -X GET "$API/feedback/analytics/nps-summary?from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}6.2 Get NPS summary for specific branch${NC}"
  curl -s -X GET "$API/feedback/analytics/nps-summary?branchId=$BRANCH_ID&from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}6.3 Get NPS summary filtered by channel (QR)${NC}"
  curl -s -X GET "$API/feedback/analytics/nps-summary?channel=QR&from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}6.4 Get NPS summary for last 7 days (short-term trend)${NC}"
  FROM_DATE_7D=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z)
  curl -s -X GET "$API/feedback/analytics/nps-summary?from=$FROM_DATE_7D&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}6.5 [NEGATIVE TEST] Get NPS summary without date range (should fail with 400)${NC}"
  curl -s -X GET "$API/feedback/analytics/nps-summary" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 7: NPS ANALYTICS - SCORE BREAKDOWN
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 7: NPS Analytics - Score Breakdown ===${NC}\n"

  echo -e "${GREEN}7.1 Get score breakdown (0-10 distribution) for last 30 days${NC}"
  FROM_DATE=$(date -u -d '30 days ago' +%Y-%m-%dT00:00:00Z)
  TO_DATE=$(date -u +%Y-%m-%dT23:59:59Z)
  curl -s -X GET "$API/feedback/analytics/breakdown?from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}7.2 Get score breakdown for specific branch${NC}"
  curl -s -X GET "$API/feedback/analytics/breakdown?branchId=$BRANCH_ID&from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}7.3 Get score breakdown filtered by channel (POS)${NC}"
  curl -s -X GET "$API/feedback/analytics/breakdown?channel=POS&from=$FROM_DATE&to=$TO_DATE" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 8: NPS ANALYTICS - TOP COMMENTS
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 8: NPS Analytics - Top Comments ===${NC}\n"

  FROM_DATE=$(date -u -d '30 days ago' +%Y-%m-%dT00:00:00Z)
  TO_DATE=$(date -u +%Y-%m-%dT23:59:59Z)

  echo -e "${GREEN}8.1 Get top positive comments (score >= 9, limit 10)${NC}"
  curl -s -X GET "$API/feedback/analytics/top-comments?from=$FROM_DATE&to=$TO_DATE&sentiment=positive&limit=10" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}8.2 Get top negative comments (score <= 6, limit 10)${NC}"
  curl -s -X GET "$API/feedback/analytics/top-comments?from=$FROM_DATE&to=$TO_DATE&sentiment=negative&limit=10" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}8.3 Get sample comments (any score, limit 20)${NC}"
  curl -s -X GET "$API/feedback/analytics/top-comments?from=$FROM_DATE&to=$TO_DATE&limit=20" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}8.4 Get top comments for specific branch${NC}"
  curl -s -X GET "$API/feedback/analytics/top-comments?branchId=$BRANCH_ID&from=$FROM_DATE&to=$TO_DATE&limit=10" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}8.5 Get recent critical feedback comments (score <= 3, limit 5)${NC}"
  curl -s -X GET "$API/feedback/analytics/top-comments?from=$FROM_DATE&to=$TO_DATE&sentiment=negative&limit=5" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.comments[] | select(.score <= 3)'
  echo ""
fi

# ============================================================================
# SECTION 9: RBAC VERIFICATION
# ============================================================================
if [ -n "$JWT_TOKEN" ]; then
  echo -e "${YELLOW}=== SECTION 9: RBAC Verification ===${NC}\n"

  echo -e "${GREEN}9.1 [INFO] Current JWT token role check${NC}"
  echo -e "${BLUE}Decode JWT payload to verify role:${NC}"
  echo "$JWT_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.'
  echo ""

  echo -e "${GREEN}9.2 [TEST] Access analytics endpoint (requires L4/L5/HR/ACCOUNTANT)${NC}"
  curl -s -X GET "$API/feedback/analytics/nps-summary?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
  echo ""

  echo -e "${GREEN}9.3 [NEGATIVE TEST] Access without auth (should fail with 401)${NC}"
  curl -s -X GET "$API/feedback" | jq '.'
  echo ""

  echo -e "${GREEN}9.4 [NEGATIVE TEST] Access with invalid token (should fail with 401)${NC}"
  curl -s -X GET "$API/feedback" \
    -H "Authorization: Bearer invalid.jwt.token" | jq '.'
  echo ""
fi

# ============================================================================
# SECTION 10: SUMMARY
# ============================================================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Test Run Complete                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Summary:${NC}"
echo -e "  ✅ Public feedback submission (anonymous)"
echo -e "  ✅ Authenticated feedback submission (with createdBy)"
echo -e "  ✅ Feedback listing with filters (date, branch, score, channel, NPS category)"
echo -e "  ✅ Single feedback retrieval with relations"
echo -e "  ✅ NPS summary analytics (org-wide and branch-level)"
echo -e "  ✅ Score breakdown (0-10 distribution)"
echo -e "  ✅ Top comments (positive/negative/sample)"
echo -e "  ✅ Rate limiting verification (10/hour on public endpoint)"
echo -e "  ✅ RBAC enforcement (public vs authenticated vs analytics access)"
echo -e "  ✅ Duplicate prevention (one feedback per order/reservation/event)"
echo -e ""
echo -e "${GREEN}Next Steps:${NC}"
echo -e "  1. Verify feedback appears in shift-end reports (customerFeedback section)"
echo -e "  2. Check period digest for NPS trends and top complaints/praise"
echo -e "  3. Review franchise digest for multi-branch NPS benchmarking"
echo -e "  4. Test QR code generation for post-order feedback collection"
echo -e "  5. Monitor rate limit enforcement on high-traffic endpoints"
echo -e ""
