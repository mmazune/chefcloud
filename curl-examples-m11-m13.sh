#!/bin/bash
# M11-M13 POS Lifecycle, Payments & Voids - API Examples

BASE_URL="http://localhost:3001"
TOKEN="your-jwt-token-here"

# ==========================================
# M11: Order Lifecycle
# ==========================================

echo "=== Create Order ==="
ORDER_ID=$(curl -s -X POST "$BASE_URL/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-uuid",
    "serviceType": "DINE_IN",
    "items": [
      { "menuItemId": "menu-item-uuid", "qty": 2 }
    ]
  }' | jq -r '.id')
echo "Order ID: $ORDER_ID"

echo "=== Send to Kitchen ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/send-to-kitchen" \
  -H "Authorization: Bearer $TOKEN"

echo "=== Mark Order Served ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/mark-served" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "All items delivered" }'

echo "=== Transfer Table ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/transfer-table" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newTableId": "new-table-uuid",
    "reason": "Customer request"
  }'

# ==========================================
# M12: Split Payments & Tips
# ==========================================

echo "=== Split Payments ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/split-payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      { "method": "CASH", "amount": 50000, "tipAmount": 3000 },
      { "method": "CARD", "amount": 30000, "tipAmount": 2000 }
    ]
  }'

echo "=== Get Order Totals Summary ==="
curl "$BASE_URL/pos/orders/$ORDER_ID/totals" \
  -H "Authorization: Bearer $TOKEN"

echo "=== Close Order (legacy single payment) ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 80000,
    "method": "CASH",
    "tipAmount": 5000
  }'

# ==========================================
# M13: Item-Level Voids
# ==========================================

echo "=== Pre-Prep Void (PENDING/SENT) ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/items/$ITEM_ID/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1,
    "reason": "CUSTOMER_CHANGED_MIND"
  }'

echo "=== Post-Prep Void (PREPARING/READY/SERVED) ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/items/$ITEM_ID/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 1,
    "reason": "QUALITY_ISSUE",
    "approvedByEmployeeId": "manager-uuid"
  }'

echo "=== Void Entire Order (order-level) ==="
curl -X POST "$BASE_URL/pos/orders/$ORDER_ID/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "managerPin": "1234"
  }'

# ==========================================
# KDS Operations
# ==========================================

echo "=== Get KDS Queue ==="
curl "$BASE_URL/kds/queue?station=HOT_KITCHEN" \
  -H "Authorization: Bearer $TOKEN"

echo "=== Mark Ticket Ready ==="
curl -X POST "$BASE_URL/kds/tickets/$TICKET_ID/mark-ready" \
  -H "Authorization: Bearer $TOKEN"

echo "=== Recall Ticket ==="
curl -X POST "$BASE_URL/kds/tickets/$TICKET_ID/recall" \
  -H "Authorization: Bearer $TOKEN"
