#!/bin/bash
# M11 POS Order Lifecycle - curl Examples
# Usage: ./curl-examples-m11.sh

API_URL="http://localhost:3000"
TOKEN="your-jwt-token-here"

echo "=== M11 POS Order Lifecycle Examples ==="

# 1. Create a new order with courses and seat assignments
echo -e "\n1. Create Order with Courses"
curl -X POST "$API_URL/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-001",
    "items": [
      {
        "menuItemId": "menu-soup",
        "qty": 2,
        "course": "STARTER",
        "seat": 1
      },
      {
        "menuItemId": "menu-steak",
        "qty": 2,
        "course": "MAIN",
        "seat": 1
      },
      {
        "menuItemId": "menu-wine",
        "qty": 1,
        "course": "BEVERAGE",
        "seat": 1
      }
    ]
  }'

ORDER_ID="order-123" # Replace with actual order ID from response

# 2. Send order to kitchen (NEW → SENT)
echo -e "\n\n2. Send to Kitchen"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/send-to-kitchen" \
  -H "Authorization: Bearer $TOKEN"

# 3. KDS marks tickets ready (manual step, then...)
# Mark order as ready (SENT → READY)
echo -e "\n\n3. Mark Order Ready (after KDS)"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/mark-ready" \
  -H "Authorization: Bearer $TOKEN"

# 4. Mark order as served (READY → SERVED)
echo -e "\n\n4. Mark as Served"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/mark-served" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "All items delivered to table 5"
  }'

# 5. Close order with payment (SERVED → CLOSED)
echo -e "\n\n5. Close Order"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "method": "CREDIT_CARD",
    "transactionId": "txn-456"
  }'

# 6. Void order (requires reason for SENT+ orders)
echo -e "\n\n6. Void Order"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer changed mind",
    "managerPin": "1234"
  }'

# 7. Transfer order to different table
echo -e "\n\n7. Transfer Table"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/transfer-table" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newTableId": "table-005",
    "reason": "Customer requested window seat"
  }'

# 8. Transfer order to different waiter
echo -e "\n\n8. Transfer Waiter"
curl -X POST "$API_URL/pos/orders/$ORDER_ID/transfer-waiter" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newWaiterId": "user-789",
    "reason": "Shift change"
  }'

# 9. TAKEAWAY shortcut (skip SERVED step)
echo -e "\n\n9. TAKEAWAY Order (NEW → SENT → READY → CLOSED)"
curl -X POST "$API_URL/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderType": "TAKEAWAY",
    "items": [
      { "menuItemId": "menu-burger", "qty": 1 }
    ]
  }'

TAKEAWAY_ID="order-456" # Replace with actual ID

curl -X POST "$API_URL/pos/orders/$TAKEAWAY_ID/send-to-kitchen" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST "$API_URL/pos/orders/$TAKEAWAY_ID/mark-ready" \
  -H "Authorization: Bearer $TOKEN"

# For TAKEAWAY, can close directly from READY (skip SERVED)
curl -X POST "$API_URL/pos/orders/$TAKEAWAY_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "method": "CASH"
  }'

# 10. Query order lifecycle audit trail
echo -e "\n\n10. Query Audit Trail"
curl -X GET "$API_URL/audit/events?resourceId=$ORDER_ID&resource=orders" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== Examples Complete ==="
