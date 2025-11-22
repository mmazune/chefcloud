#!/bin/bash

# =============================================================================
# M15 – Reservations, Deposits & Booking Portal curl Examples
# =============================================================================
# 
# This script demonstrates the complete reservation and event booking workflows
# including deposit handling, state transitions, and public booking portal APIs.
#
# Prerequisites:
# 1. ChefCloud API running on http://localhost:3000
# 2. Valid JWT token for authenticated endpoints
# 3. Test org/branch/user IDs set below
#
# Usage:
#   chmod +x curl-examples-m15-reservations.sh
#   ./curl-examples-m15-reservations.sh
#
# =============================================================================

set -e  # Exit on error

# Configuration
API_URL="http://localhost:3000"
JWT_TOKEN="your-jwt-token-here"  # Replace with actual token
ORG_ID="org-123"
BRANCH_ID="branch-456"
USER_ID="user-789"

echo "========================================="
echo "M15 Reservations & Bookings API Examples"
echo "========================================="
echo ""

# =============================================================================
# Section 1: Public Booking Portal (No Authentication)
# =============================================================================

echo "📍 1. PUBLIC BOOKING PORTAL"
echo ""

echo "1.1 Check Availability (Public)"
echo "  GET /public/availability"
curl -X GET "$API_URL/public/availability?branchId=$BRANCH_ID&date=2025-12-15&time=19:00:00&partySize=4" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "1.2 Create Public Reservation (from booking.chefcloud.com)"
echo "  POST /public/reservations"
PUBLIC_RESERVATION=$(curl -s -X POST "$API_URL/public/reservations" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "name": "John Public",
    "phone": "+256700123456",
    "guestEmail": "john@example.com",
    "partySize": 4,
    "startAt": "2025-12-15T19:00:00Z",
    "endAt": "2025-12-15T21:00:00Z",
    "notes": "Window seat if possible",
    "deposit": 50
  }')
echo "$PUBLIC_RESERVATION" | jq '.'
PUBLIC_RES_ID=$(echo "$PUBLIC_RESERVATION" | jq -r '.id')
echo "Created Public Reservation ID: $PUBLIC_RES_ID"
echo ""

echo "1.3 List Published Events (Public)"
echo "  GET /public/events"
curl -X GET "$API_URL/public/events?branchId=$BRANCH_ID&from=2025-12-01&to=2025-12-31" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "1.4 Get Event Details (Public)"
echo "  GET /public/events/:slug"
curl -X GET "$API_URL/public/events/summer-brunch-2025" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# =============================================================================
# Section 2: Internal Reservations Management (JWT Required)
# =============================================================================

echo "📍 2. INTERNAL RESERVATIONS (Staff Interface)"
echo ""

echo "2.1 Create Internal Reservation (L2+ Staff)"
echo "  POST /reservations"
INTERNAL_RESERVATION=$(curl -s -X POST "$API_URL/reservations" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "name": "Jane Smith",
    "phone": "+256700987654",
    "guestEmail": "jane@example.com",
    "partySize": 6,
    "startAt": "2025-12-20T20:00:00Z",
    "endAt": "2025-12-20T22:00:00Z",
    "tableId": "table-vip-1",
    "source": "PHONE",
    "notes": "Birthday celebration - bring champagne",
    "deposit": 100
  }')
echo "$INTERNAL_RESERVATION" | jq '.'
INTERNAL_RES_ID=$(echo "$INTERNAL_RESERVATION" | jq -r '.id')
echo "Created Internal Reservation ID: $INTERNAL_RES_ID"
echo ""

echo "2.2 List Reservations (Filter by Date & Status)"
echo "  GET /reservations?from=...&to=...&status=..."
curl -X GET "$API_URL/reservations?from=2025-12-01T00:00:00Z&to=2025-12-31T23:59:59Z&status=CONFIRMED" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "2.3 Get Reservation Details"
echo "  GET /reservations/:id"
curl -X GET "$API_URL/reservations/$INTERNAL_RES_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "2.4 Update Reservation"
echo "  PATCH /reservations/:id"
curl -X PATCH "$API_URL/reservations/$INTERNAL_RES_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "partySize": 8,
    "notes": "Birthday celebration - bring champagne + extra chairs"
  }' | jq '.'
echo ""

echo "2.5 Check Availability (Internal)"
echo "  GET /reservations/availability/check"
curl -X GET "$API_URL/reservations/availability/check?branchId=$BRANCH_ID&dateTime=2025-12-15T19:00:00Z&partySize=4&duration=120" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# =============================================================================
# Section 3: Reservation State Transitions
# =============================================================================

echo "📍 3. RESERVATION LIFECYCLE"
echo ""

echo "3.1 Confirm Reservation (Capture Deposit)"
echo "  POST /reservations/:id/confirm"
curl -X POST "$API_URL/reservations/$INTERNAL_RES_ID/confirm" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  ✓ Status: HELD → CONFIRMED"
echo "  ✓ Deposit: HELD → CAPTURED"
echo "  ✓ GL Posted: Dr Cash, Cr Deposit Liability"
echo ""

echo "3.2 Seat Guest (Link to POS Order)"
echo "  POST /reservations/:id/seat"
curl -X POST "$API_URL/reservations/$INTERNAL_RES_ID/seat" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-abc-123"
  }' | jq '.'
echo "  ✓ Status: CONFIRMED → SEATED"
echo "  ✓ Order linked: orderId set"
echo "  ✓ GL Posted: Dr Deposit Liability, Cr Revenue"
echo ""

echo "3.3 Mark No-Show (Forfeit Deposit)"
echo "  POST /reservations/:id/no-show"
echo "  Note: Only works after start time + 15min grace period"
curl -X POST "$API_URL/reservations/another-res-id/no-show" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "  ⚠ Cannot mark no-show (within grace period or wrong status)"
echo "  ✓ Status: CONFIRMED → NO_SHOW"
echo "  ✓ Deposit: CAPTURED → FORFEITED"
echo "  ✓ GL Posted: Dr Deposit Liability, Cr No-Show Revenue"
echo ""

echo "3.4 Cancel Reservation (Refund Deposit)"
echo "  POST /reservations/:id/cancel"
CREATE_CANCEL_RES=$(curl -s -X POST "$API_URL/reservations" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "'"$BRANCH_ID"'",
    "name": "Cancel Test",
    "phone": "+256700111111",
    "partySize": 2,
    "startAt": "2025-12-25T18:00:00Z",
    "endAt": "2025-12-25T20:00:00Z",
    "deposit": 25
  }')
CANCEL_RES_ID=$(echo "$CREATE_CANCEL_RES" | jq -r '.id')

curl -X POST "$API_URL/reservations/$CANCEL_RES_ID/confirm" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" > /dev/null

curl -X POST "$API_URL/reservations/$CANCEL_RES_ID/cancel" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  ✓ Status: CONFIRMED → CANCELLED"
echo "  ✓ Deposit: CAPTURED → REFUNDED"
echo "  ✓ GL Posted: Dr Deposit Liability, Cr Cash"
echo ""

# =============================================================================
# Section 4: Reporting & Analytics
# =============================================================================

echo "📍 4. REPORTING & ANALYTICS"
echo ""

echo "4.1 Get Booking Summary (Manager View)"
echo "  GET /reservations/summary?from=...&to=..."
curl -X GET "$API_URL/reservations/summary?from=2025-12-01T00:00:00Z&to=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "4.2 Franchise Booking Overview (Multi-Branch)"
echo "  GET /franchise/bookings/overview"
curl -X GET "$API_URL/franchise/bookings/overview?franchiseId=franchise-789&from=2025-12-01&to=2025-12-31" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "4.3 Branch Booking Summary"
echo "  GET /franchise/bookings/branch/:id/summary"
curl -X GET "$API_URL/franchise/bookings/branch/$BRANCH_ID/summary?from=2025-12-01&to=2025-12-31" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

# =============================================================================
# Section 5: Event Bookings & Tickets
# =============================================================================

echo "📍 5. EVENT BOOKINGS & TICKETS"
echo ""

echo "5.1 Create Event (L3+ Manager)"
echo "  POST /events"
EVENT=$(curl -s -X POST "$API_URL/events" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "'"$ORG_ID"'",
    "branchId": "'"$BRANCH_ID"'",
    "slug": "nye-2025",
    "title": "New Year'\''s Eve Gala 2025",
    "description": "Ring in the new year with fine dining and live music",
    "startsAt": "2025-12-31T20:00:00Z",
    "endsAt": "2026-01-01T02:00:00Z",
    "capacity": 100,
    "bookingDeadline": "2025-12-30T23:59:59Z"
  }')
echo "$EVENT" | jq '.'
EVENT_ID=$(echo "$EVENT" | jq -r '.id')
echo "Created Event ID: $EVENT_ID"
echo ""

echo "5.2 Add Event Tables (Pricing Tiers)"
echo "  POST /events/:id/tables"
curl -X POST "$API_URL/events/$EVENT_ID/tables" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "VIP Table",
    "capacity": 8,
    "price": 1000,
    "minSpend": 800,
    "deposit": 500
  }' | jq '.'
echo ""

echo "5.3 Publish Event (Make Public)"
echo "  POST /events/:id/publish"
curl -X POST "$API_URL/events/$EVENT_ID/publish" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  ✓ Status: DRAFT → PUBLISHED"
echo "  ✓ Now visible on /public/events"
echo ""

echo "5.4 Guest Books Event Ticket (Public)"
echo "  POST /public/events/:slug/book"
BOOKING=$(curl -s -X POST "$API_URL/public/events/nye-2025/book" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Wonderland",
    "email": "alice@example.com",
    "phone": "+256700222222",
    "eventTableId": "table-vip-1"
  }')
echo "$BOOKING" | jq '.'
BOOKING_ID=$(echo "$BOOKING" | jq -r '.id')
echo "Created Booking ID: $BOOKING_ID"
echo "  ✓ Status: HELD (awaiting payment)"
echo "  ✓ Expiration: 15 minutes from now"
echo ""

echo "5.5 Confirm Event Booking (After Payment)"
echo "  POST /events/:id/bookings/:bookingId/confirm"
curl -X POST "$API_URL/events/$EVENT_ID/bookings/$BOOKING_ID/confirm" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  ✓ Status: HELD → CONFIRMED"
echo "  ✓ Ticket code generated (ULID for QR)"
echo "  ✓ Confirmation email sent with QR PDF"
echo ""

echo "5.6 Check-In Guest at Event (Scan QR)"
echo "  POST /events/:id/bookings/:bookingId/check-in"
curl -X POST "$API_URL/events/$EVENT_ID/bookings/$BOOKING_ID/check-in" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketCode": "01HXYZ..."
  }' | jq '.'
echo "  ✓ Status: CONFIRMED → CHECKED_IN"
echo "  ✓ Prepaid credits activated"
echo ""

echo "5.7 List Event Bookings (Staff View)"
echo "  GET /events/:id/bookings"
curl -X GET "$API_URL/events/$EVENT_ID/bookings" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "5.8 Cancel Event (Refund All Bookings)"
echo "  POST /events/:id/cancel"
curl -X POST "$API_URL/events/$EVENT_ID/cancel" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancelReason": "Venue unavailable due to flooding"
  }' | jq '.'
echo "  ✓ Status: PUBLISHED → CANCELLED"
echo "  ✓ All bookings refunded"
echo ""

# =============================================================================
# Section 6: Deposit Accounting (GL Verification)
# =============================================================================

echo "📍 6. DEPOSIT ACCOUNTING (GL Integration)"
echo ""

echo "6.1 Verify Deposit Collection Posting"
echo "  GET /postings?reference=RESERVATION-DEPOSIT-*"
curl -X GET "$API_URL/postings?reference=RESERVATION-DEPOSIT-$INTERNAL_RES_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  Expected: Dr 1010 (Cash), Cr 2200 (Deposit Liability)"
echo ""

echo "6.2 Verify Deposit Application Posting"
echo "  GET /postings?reference=DEPOSIT-APPLY-*"
curl -X GET "$API_URL/postings?reference=DEPOSIT-APPLY-$INTERNAL_RES_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  Expected: Dr 2200 (Deposit Liability), Cr 4000 (Revenue)"
echo ""

echo "6.3 Verify No-Show Forfeiture Posting"
echo "  GET /postings?reference=NO-SHOW-*"
curl -X GET "$API_URL/postings?reference=NO-SHOW-some-res-id" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "  (No no-shows yet)"
echo "  Expected: Dr 2200 (Deposit Liability), Cr 4901 (No-Show Revenue)"
echo ""

echo "6.4 Verify Refund Posting"
echo "  GET /postings?reference=REFUND-*"
curl -X GET "$API_URL/postings?reference=REFUND-$CANCEL_RES_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo "  Expected: Dr 2200 (Deposit Liability), Cr 1010 (Cash)"
echo ""

# =============================================================================
# Complete
# =============================================================================

echo ""
echo "========================================="
echo "✓ M15 Examples Complete"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Public Reservation: $PUBLIC_RES_ID"
echo "  - Internal Reservation: $INTERNAL_RES_ID"
echo "  - Cancelled Reservation: $CANCEL_RES_ID"
echo "  - Event: $EVENT_ID"
echo "  - Event Booking: $BOOKING_ID"
echo ""
echo "Next Steps:"
echo "  1. Verify GL postings in accounting module"
echo "  2. Check deposit liability balance (account 2200)"
echo "  3. Review no-show revenue (account 4901)"
echo "  4. Test public booking portal UI at booking.chefcloud.com"
echo ""
