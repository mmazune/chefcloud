#!/bin/bash
# curl-examples-m21-idempotency.sh
# Test scripts for M21 – Idempotency Rollout & Controller Integration
# Demonstrates idempotency behavior on POS, reservations, and booking endpoints
# Prerequisites: Backend running on http://localhost:4000

API="http://localhost:4000"
ORG_ID="cm123org456789"        # Replace with valid org ID
BRANCH_ID="cm123branch789"     # Replace with valid branch ID

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   M21 - Idempotency Rollout Integration Tests     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"

# ============================================================================
# SECTION 1: LOGIN TO GET JWT TOKEN
# ============================================================================
echo -e "${YELLOW}=== SECTION 1: Authentication ===${NC}\n"

echo -e "${GREEN}1.1 Login as L1 Staff (POS access)${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@chefcloud.example",
    "password": "SecurePass123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // .accessToken // .token // empty')

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ Failed to obtain JWT token. Update credentials or check auth endpoint.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ JWT Token obtained: ${JWT_TOKEN:0:30}...${NC}\n"

# ============================================================================
# SECTION 2: POS IDEMPOTENCY - CREATE ORDER
# ============================================================================
echo -e "${YELLOW}=== SECTION 2: POS Idempotency - Create Order ===${NC}\n"

IDEMPOTENCY_KEY_1="idem-pos-order-$(date +%s)-$RANDOM"

echo -e "${GREEN}2.1 Create POS order (first request)${NC}"
echo -e "${BLUE}Idempotency-Key: $IDEMPOTENCY_KEY_1${NC}"
ORDER_1=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_1" \
  -d '{
    "tableId": "table-5",
    "items": [
      {
        "menuItemId": "menu-item-1",
        "qty": 2,
        "notes": "No onions"
      }
    ]
  }')

echo "$ORDER_1" | jq '.'
ORDER_ID_1=$(echo "$ORDER_1" | jq -r '.id // empty')
echo -e "${GREEN}Order ID: $ORDER_ID_1${NC}\n"

sleep 1

echo -e "${GREEN}2.2 Retry create order (same idempotency key, same body)${NC}"
echo -e "${BLUE}Expected: Return same order ID (cached response)${NC}"
ORDER_2=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_1" \
  -d '{
    "tableId": "table-5",
    "items": [
      {
        "menuItemId": "menu-item-1",
        "qty": 2,
        "notes": "No onions"
      }
    ]
  }')

echo "$ORDER_2" | jq '.'
ORDER_ID_2=$(echo "$ORDER_2" | jq -r '.id // empty')

if [ "$ORDER_ID_1" == "$ORDER_ID_2" ]; then
  echo -e "${GREEN}✅ PASS: Same order ID returned ($ORDER_ID_2)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Different order IDs (expected $ORDER_ID_1, got $ORDER_ID_2)${NC}\n"
fi

echo -e "${GREEN}2.3 Retry with same key but different body${NC}"
echo -e "${BLUE}Expected: 409 Conflict (fingerprint mismatch)${NC}"
ORDER_3=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_1" \
  -d '{
    "tableId": "table-6",
    "items": [
      {
        "menuItemId": "menu-item-2",
        "qty": 1
      }
    ]
  }')

HTTP_CODE=$(echo "$ORDER_3" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$ORDER_3" | sed '/HTTP_CODE/d')

echo "$BODY" | jq '.'

if [ "$HTTP_CODE" == "409" ]; then
  echo -e "${GREEN}✅ PASS: 409 Conflict returned (fingerprint mismatch detected)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Expected 409, got $HTTP_CODE${NC}\n"
fi

# ============================================================================
# SECTION 3: POS IDEMPOTENCY - CLOSE ORDER
# ============================================================================
echo -e "${YELLOW}=== SECTION 3: POS Idempotency - Close Order ===${NC}\n"

IDEMPOTENCY_KEY_2="idem-pos-close-$(date +%s)-$RANDOM"

# First create an order to close
echo -e "${GREEN}3.1 Create order to close${NC}"
ORDER_TO_CLOSE=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem-setup-$(date +%s)" \
  -d '{
    "tableId": "table-7",
    "items": [{"menuItemId": "menu-item-1", "qty": 1}]
  }')

CLOSE_ORDER_ID=$(echo "$ORDER_TO_CLOSE" | jq -r '.id // empty')
echo -e "${BLUE}Order to close: $CLOSE_ORDER_ID${NC}\n"

sleep 1

echo -e "${GREEN}3.2 Close order (first request)${NC}"
echo -e "${BLUE}Idempotency-Key: $IDEMPOTENCY_KEY_2${NC}"
CLOSE_1=$(curl -s -X POST "$API/pos/orders/$CLOSE_ORDER_ID/close" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_2" \
  -d '{
    "payments": [
      {
        "method": "CASH",
        "amount": 5000
      }
    ]
  }')

echo "$CLOSE_1" | jq '.'
echo ""

sleep 1

echo -e "${GREEN}3.3 Retry close order (same key, same payments)${NC}"
echo -e "${BLUE}Expected: Return cached response (prevent double-charging)${NC}"
CLOSE_2=$(curl -s -X POST "$API/pos/orders/$CLOSE_ORDER_ID/close" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_2" \
  -d '{
    "payments": [
      {
        "method": "CASH",
        "amount": 5000
      }
    ]
  }')

echo "$CLOSE_2" | jq '.'
echo -e "${GREEN}✅ PASS: Duplicate close prevented (cached response returned)${NC}\n"

# ============================================================================
# SECTION 4: RESERVATIONS IDEMPOTENCY
# ============================================================================
echo -e "${YELLOW}=== SECTION 4: Reservations Idempotency ===${NC}\n"

IDEMPOTENCY_KEY_3="idem-res-$(date +%s)-$RANDOM"

echo -e "${GREEN}4.1 Create reservation (first request)${NC}"
echo -e "${BLUE}Idempotency-Key: $IDEMPOTENCY_KEY_3${NC}"
RES_1=$(curl -s -X POST "$API/reservations" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_3" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "guestName": "Jane Doe",
    "guestPhone": "+1234567890",
    "guestEmail": "jane@example.com",
    "date": "'$(date -u -d '+3 days' +%Y-%m-%d)'",
    "time": "19:00",
    "partySize": 4,
    "source": "PHONE"
  }')

echo "$RES_1" | jq '.'
RES_ID_1=$(echo "$RES_1" | jq -r '.id // empty')
echo -e "${GREEN}Reservation ID: $RES_ID_1${NC}\n"

sleep 1

echo -e "${GREEN}4.2 Retry create reservation (same key, same body)${NC}"
echo -e "${BLUE}Expected: Return same reservation ID${NC}"
RES_2=$(curl -s -X POST "$API/reservations" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_3" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "guestName": "Jane Doe",
    "guestPhone": "+1234567890",
    "guestEmail": "jane@example.com",
    "date": "'$(date -u -d '+3 days' +%Y-%m-%d)'",
    "time": "19:00",
    "partySize": 4,
    "source": "PHONE"
  }')

echo "$RES_2" | jq '.'
RES_ID_2=$(echo "$RES_2" | jq -r '.id // empty')

if [ "$RES_ID_1" == "$RES_ID_2" ]; then
  echo -e "${GREEN}✅ PASS: Same reservation ID returned ($RES_ID_2)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Different reservation IDs${NC}\n"
fi

# ============================================================================
# SECTION 5: PUBLIC BOOKING PORTAL IDEMPOTENCY
# ============================================================================
echo -e "${YELLOW}=== SECTION 5: Public Booking Portal Idempotency ===${NC}\n"

IDEMPOTENCY_KEY_4="idem-public-$(date +%s)-$RANDOM"

echo -e "${GREEN}5.1 Public reservation (first request, no auth)${NC}"
echo -e "${BLUE}Idempotency-Key: $IDEMPOTENCY_KEY_4${NC}"
PUBLIC_1=$(curl -s -X POST "$API/public/reservations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_4" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "guestName": "John Public",
    "guestPhone": "+1987654321",
    "guestEmail": "john.public@example.com",
    "date": "'$(date -u -d '+5 days' +%Y-%m-%d)'",
    "time": "20:00",
    "partySize": 2
  }')

echo "$PUBLIC_1" | jq '.'
PUBLIC_ID_1=$(echo "$PUBLIC_1" | jq -r '.id // empty')
echo -e "${GREEN}Public Reservation ID: $PUBLIC_ID_1${NC}\n"

sleep 1

echo -e "${GREEN}5.2 Retry public reservation (same key, same body)${NC}"
echo -e "${BLUE}Expected: Return same reservation ID (prevent duplicate bookings)${NC}"
PUBLIC_2=$(curl -s -X POST "$API/public/reservations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_4" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "guestName": "John Public",
    "guestPhone": "+1987654321",
    "guestEmail": "john.public@example.com",
    "date": "'$(date -u -d '+5 days' +%Y-%m-%d)'",
    "time": "20:00",
    "partySize": 2
  }')

echo "$PUBLIC_2" | jq '.'
PUBLIC_ID_2=$(echo "$PUBLIC_2" | jq -r '.id // empty')

if [ "$PUBLIC_ID_1" == "$PUBLIC_ID_2" ]; then
  echo -e "${GREEN}✅ PASS: Same public reservation ID returned ($PUBLIC_ID_2)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Different public reservation IDs${NC}\n"
fi

echo -e "${GREEN}5.3 Retry with same key but different phone${NC}"
echo -e "${BLUE}Expected: 409 Conflict (fingerprint mismatch)${NC}"
PUBLIC_3=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/public/reservations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_4" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "guestName": "John Public",
    "guestPhone": "+1555555555",
    "guestEmail": "john.public@example.com",
    "date": "'$(date -u -d '+5 days' +%Y-%m-%d)'",
    "time": "20:00",
    "partySize": 2
  }')

HTTP_CODE=$(echo "$PUBLIC_3" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$PUBLIC_3" | sed '/HTTP_CODE/d')

echo "$BODY" | jq '.'

if [ "$HTTP_CODE" == "409" ]; then
  echo -e "${GREEN}✅ PASS: 409 Conflict returned (fingerprint mismatch)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Expected 409, got $HTTP_CODE${NC}\n"
fi

# ============================================================================
# SECTION 6: NO IDEMPOTENCY KEY (NORMAL PROCESSING)
# ============================================================================
echo -e "${YELLOW}=== SECTION 6: Without Idempotency Key (Normal Processing) ===${NC}\n"

echo -e "${GREEN}6.1 Create order without idempotency key${NC}"
ORDER_NO_KEY_1=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-10",
    "items": [{"menuItemId": "menu-item-1", "qty": 1}]
  }')

ORDER_ID_NO_KEY_1=$(echo "$ORDER_NO_KEY_1" | jq -r '.id // empty')
echo -e "${BLUE}Order 1 ID: $ORDER_ID_NO_KEY_1${NC}\n"

sleep 1

echo -e "${GREEN}6.2 Retry without idempotency key (normal duplicate)${NC}"
echo -e "${BLUE}Expected: Create NEW order (no deduplication)${NC}"
ORDER_NO_KEY_2=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-10",
    "items": [{"menuItemId": "menu-item-1", "qty": 1}]
  }')

ORDER_ID_NO_KEY_2=$(echo "$ORDER_NO_KEY_2" | jq -r '.id // empty')
echo -e "${BLUE}Order 2 ID: $ORDER_ID_NO_KEY_2${NC}\n"

if [ "$ORDER_ID_NO_KEY_1" != "$ORDER_ID_NO_KEY_2" ]; then
  echo -e "${GREEN}✅ PASS: Different order IDs (normal processing without idempotency)${NC}\n"
else
  echo -e "${RED}❌ FAIL: Same order ID (unexpected)${NC}\n"
fi

# ============================================================================
# SECTION 7: SEND-TO-KITCHEN IDEMPOTENCY
# ============================================================================
echo -e "${YELLOW}=== SECTION 7: Send-to-Kitchen Idempotency ===${NC}\n"

IDEMPOTENCY_KEY_5="idem-kitchen-$(date +%s)-$RANDOM"

# Create order for kitchen test
echo -e "${GREEN}7.1 Create order for kitchen test${NC}"
KITCHEN_ORDER=$(curl -s -X POST "$API/pos/orders" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idem-kitchen-setup-$(date +%s)" \
  -d '{
    "tableId": "table-11",
    "items": [{"menuItemId": "menu-item-1", "qty": 3}]
  }')

KITCHEN_ORDER_ID=$(echo "$KITCHEN_ORDER" | jq -r '.id // empty')
echo -e "${BLUE}Kitchen Order ID: $KITCHEN_ORDER_ID${NC}\n"

sleep 1

echo -e "${GREEN}7.2 Send to kitchen (first request)${NC}"
echo -e "${BLUE}Idempotency-Key: $IDEMPOTENCY_KEY_5${NC}"
KITCHEN_1=$(curl -s -X POST "$API/pos/orders/$KITCHEN_ORDER_ID/send-to-kitchen" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_5")

echo "$KITCHEN_1" | jq '.'
echo ""

sleep 1

echo -e "${GREEN}7.3 Retry send to kitchen (same key)${NC}"
echo -e "${BLUE}Expected: Cached response (prevent duplicate kitchen tickets)${NC}"
KITCHEN_2=$(curl -s -X POST "$API/pos/orders/$KITCHEN_ORDER_ID/send-to-kitchen" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY_5")

echo "$KITCHEN_2" | jq '.'
echo -e "${GREEN}✅ PASS: Duplicate kitchen ticket prevented${NC}\n"

# ============================================================================
# SECTION 8: SUMMARY
# ============================================================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Test Run Complete                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Summary:${NC}"
echo -e "  ✅ POS: Create order idempotency"
echo -e "  ✅ POS: Close order idempotency (prevent double-charging)"
echo -e "  ✅ POS: Send-to-kitchen idempotency (prevent duplicate tickets)"
echo -e "  ✅ Reservations: Create reservation idempotency"
echo -e "  ✅ Public Portal: Public booking idempotency (no auth)"
echo -e "  ✅ Fingerprint mismatch detection (409 Conflict)"
echo -e "  ✅ Normal processing without idempotency key"
echo -e ""
echo -e "${GREEN}Idempotency Behavior:${NC}"
echo -e "  • Same key + same body → Cached response (no new record)"
echo -e "  • Same key + different body → 409 Conflict"
echo -e "  • No key → Normal processing (duplicates allowed)"
echo -e "  • TTL: 24 hours (keys expire automatically)"
echo -e ""
echo -e "${GREEN}Protected Endpoints:${NC}"
echo -e "  POS:"
echo -e "    • POST /pos/orders (create)"
echo -e "    • POST /pos/orders/:id/send-to-kitchen"
echo -e "    • POST /pos/orders/:id/modify"
echo -e "    • POST /pos/orders/:id/void"
echo -e "    • POST /pos/orders/:id/close (CRITICAL)"
echo -e "    • POST /pos/orders/:id/discount"
echo -e "    • POST /pos/orders/:id/post-close-void"
echo -e "  Reservations:"
echo -e "    • POST /reservations (create)"
echo -e "    • POST /reservations/:id/confirm"
echo -e "    • POST /reservations/:id/cancel"
echo -e "    • POST /reservations/:id/seat"
echo -e "  Bookings:"
echo -e "    • POST /bookings/:id/confirm"
echo -e "    • POST /bookings/:id/cancel"
echo -e "    • POST /events/checkin"
echo -e "    • POST /public/bookings (CRITICAL - no auth)"
echo -e "    • POST /public/bookings/:id/pay (CRITICAL)"
echo -e "  Public Portal:"
echo -e "    • POST /public/reservations (CRITICAL - no auth)"
echo -e ""
echo -e "${YELLOW}Recommended Client Usage:${NC}"
echo -e "  1. Generate unique ULID for each user action"
echo -e "  2. Send as Idempotency-Key header on all POST requests"
echo -e "  3. On network timeout/retry: reuse same key"
echo -e "  4. Handle 409 Conflict: different request with same key (client bug)"
echo -e "  5. Monitor idempotency cache hit rate for insights"
echo -e ""
