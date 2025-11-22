---

## M11 – POS Order Lifecycle Hardening

### Overview

M11 provides enterprise-grade POS order lifecycle management with:

- **Canonical State Machine**: Enforced state transitions with business rule validation
- **Item-Level Tracking**: Per-item status, courses, seat assignment, void tracking
- **Transfer Flows**: Table and waiter transfers with full audit trail
- **Audit Trail**: Every state change and critical action fully logged
- **Integration**: Seamless with KDS (M1), Inventory (M3), Anti-theft (M5), Accounting (M8)

### Order State Machine

**State Diagram**:
```
   NEW ──> SENT ──> IN_KITCHEN ──> READY ──> SERVED ──> CLOSED
    │       │         │             │          │
    └───────┴─────────┴─────────────┴──────────┴────> VOIDED
```

**Allowed Transitions**:

| From | To | Who | Validation |
|------|-----|-----|-----------|
| NEW | SENT | L1+ | Must have items |
| SENT | IN_KITCHEN | L1+ | - |
| SENT/IN_KITCHEN | READY | L1+ | All KDS tickets ready |
| READY | SERVED | L1+ | - |
| SERVED | CLOSED | L1+ | Payments ≥ total |
| READY | CLOSED | L1+ | Only TAKEAWAY, payment complete |
| NEW | VOIDED | L2+ | - |
| SENT/IN_KITCHEN | VOIDED | L3+ | Requires reason |
| READY/SERVED | VOIDED | L4+ | Requires reason + wastage ack |
| CLOSED | VOIDED | L4+ | Requires GL reversal flag |

**Usage**:
```typescript
// Via OrderStateMachineService
await stateMachine.sendToKitchen(orderId, { userId, branchId });
await stateMachine.markReady(orderId, { userId, branchId });
await stateMachine.markServed(orderId, { userId, branchId });
await stateMachine.close(orderId, { userId, branchId });
await stateMachine.void(orderId, { userId, branchId, reason: 'Customer request' });

// Check allowed transitions
const allowed = stateMachine.getAllowedTransitions(OrderStatus.READY);
// Returns: [SERVED, CLOSED, VOIDED]

// Validate before transition
await stateMachine.validateTransition(orderId, OrderStatus.CLOSED, context);
```

### Order Item Lifecycle

**Item Status Enum**:
```prisma
enum OrderItemStatus {
  PENDING     // Not yet sent to kitchen
  SENT        // Sent to KDS
  PREPARING   // Being prepared (KDS acknowledged)
  READY       // Ready for serving
  SERVED      // Delivered to guest
  VOIDED      // Item cancelled/voided
}
```

**Course Enum**:
```prisma
enum Course {
  STARTER
  MAIN
  DESSERT
  BEVERAGE
  SIDE
}
```

**OrderItem Fields**:
```prisma
model OrderItem {
  // ... existing fields
  status      OrderItemStatus? @default(PENDING)
  course      Course?
  seat        Int?             // Guest seat number
  sentAt      DateTime?
  readyAt     DateTime?
  servedAt    DateTime?
  voidedAt    DateTime?
  voidedById  String?
  voidReason  String?
}
```

**Example: Create order with courses**:
```bash
curl -X POST $API_URL/pos/orders \
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
```

### API Endpoints

#### 1. Send to Kitchen
**Endpoint**: `POST /pos/orders/:id/send-to-kitchen`  
**RBAC**: L1+  
**State Transition**: NEW → SENT

```bash
curl -X POST $API_URL/pos/orders/order-123/send-to-kitchen \
  -H "Authorization: Bearer $TOKEN"

# Response: Order with status=SENT
```

#### 2. Mark as Served
**Endpoint**: `POST /pos/orders/:id/mark-served`  
**RBAC**: L1+  
**State Transition**: READY → SERVED

```bash
curl -X POST $API_URL/pos/orders/order-123/mark-served \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "All items delivered" }'

# Response: Order with status=SERVED, metadata.servedAt timestamp
```

#### 3. Void Order
**Endpoint**: `POST /pos/orders/:id/void`  
**RBAC**: L2+ (L3+ for SENT orders, L4+ for READY/SERVED)  
**State Transition**: Any → VOIDED

```bash
curl -X POST $API_URL/pos/orders/order-123/void \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer changed mind",
    "managerPin": "1234"
  }'

# Response: Order with status=VOIDED, metadata.voidedAt, voidReason
```

**Void Requirements**:
- NEW state: No reason required
- SENT/IN_KITCHEN: Requires reason, manager PIN for high value
- READY/SERVED: Requires reason + wastage acknowledgement
- CLOSED: Requires GL reversal (use post-close-void endpoint)

#### 4. Close Order (Payment)
**Endpoint**: `POST /pos/orders/:id/close`  
**RBAC**: L1+  
**State Transition**: SERVED/READY → CLOSED

```bash
curl -X POST $API_URL/pos/orders/order-123/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 50000 }'

# Triggers:
# - Payment validation (sum ≥ total)
# - Inventory consumption (M3 StockMovements)
# - GL posting (M8 revenue + COGS)
# - Costing calculation (E27)
# - Promotion application (E37)
```

#### 5. Transfer Table
**Endpoint**: `POST /pos/orders/:id/transfer-table`  
**RBAC**: L2+  
**State Constraint**: Not CLOSED/VOIDED

```bash
curl -X POST $API_URL/pos/orders/order-123/transfer-table \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newTableId": "table-005",
    "reason": "Customer requested different seating"
  }'

# Response: Order with updated tableId
# Audit event: order.table_transferred
```

#### 6. Transfer Waiter
**Endpoint**: `POST /pos/orders/:id/transfer-waiter`  
**RBAC**: L3+  
**State Constraint**: Not CLOSED/VOIDED

```bash
curl -X POST $API_URL/pos/orders/order-123/transfer-waiter \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newWaiterId": "user-456",
    "reason": "Shift change"
  }'

# Response: Order with updated userId (waiter)
# Audit event: order.waiter_transferred
```

### Void vs Discount vs Comp

**Void (Order Level)**:
- Changes order status to VOIDED
- Requires reason for SENT+ orders
- Requires manager approval for high-value voids
- Tracked via order status + metadata
- Use case: Customer cancellation, wrong order

**Void (Item Level)** - *Future Enhancement*:
- Sets OrderItem.status = VOIDED
- Sets voidedAt, voidedById, voidReason
- Does NOT change order status
- Reduces order total
- Use case: Single item cancellation

**Discount**:
- Reduces order total
- Tracked in Discount model
- Requires manager approval for large discounts
- Does NOT change order status
- Use case: Customer satisfaction, promotions

**Comp (Free Item)** - *Future Enhancement*:
- Discount of 100%
- Special discount type or reason
- Always requires manager approval
- Use case: VIP treatment, service recovery

### Integration with Other Modules

#### M1 (KDS) Integration

**Order → KDS Flow**:
1. Order created (NEW) → KdsTickets created (QUEUED)
2. sendToKitchen() → Order.SENT, KdsTickets remain QUEUED
3. KDS marks ticket ready → KdsTicket.COMPLETED, readyAt set
4. *Manual*: Call markReady() → Order.READY (when all tickets ready)

**Future Auto-Sync**:
```typescript
// In KdsService.markTicketReady()
const allReady = await this.checkAllTicketsReady(orderId);
if (allReady) {
  await orderStateMachine.markReady(orderId, {
    userId: 'system',
    branchId,
    skipValidation: true,
  });
}
```

#### M3 (Inventory) Integration

**Stock Movements**:
- Created on `closeOrder()` via StockMovementsService
- Movement type: SALE
- FIFO costing applied
- Anomaly detection: NEGATIVE_STOCK flag

**Void Behavior**:
- Pre-kitchen void (NEW): No stock movement (nothing consumed)
- Post-kitchen void (SENT+): Items already consumed → Should create wastage entry
- Post-close void: Stock already moved → Use postCloseVoid with GL reversal

#### M5 (Anti-theft) Integration

**Anomaly Detection**:
- NO_DRINKS flag if order has no beverages
- High void frequency tracked per waiter
- Large discounts tracked per waiter
- Void reasons analyzed for patterns

**WaiterMetrics Queries**:
```sql
-- Void count per waiter (last 30 days)
SELECT u.id, u.firstName, COUNT(*) as void_count
FROM orders o
JOIN users u ON o.userId = u.id
WHERE o.status = 'VOIDED'
  AND o.createdAt > NOW() - INTERVAL '30 days'
GROUP BY u.id;

-- Discount count per waiter
SELECT u.id, u.firstName, COUNT(*) as discount_count, SUM(d.value) as total_discount
FROM discounts d
JOIN users u ON d.createdById = u.id
WHERE d.createdAt > NOW() - INTERVAL '30 days'
GROUP BY u.id;
```

#### M8 (Accounting) Integration

**GL Posting on Close**:
```typescript
// In closeOrder()
await postingService.postSale(orderId, userId); // Debit Cash/AR, Credit Revenue
await postingService.postCOGS(orderId, userId); // Debit COGS, Credit Inventory
```

**Post-Close Void**:
```typescript
// In postCloseVoid() - Future enhancement
await postingService.reversePostings(orderId, userId);
// Creates reversing entries with negative amounts
```

### Audit Trail

**Every State Transition Creates Audit Event**:
```json
{
  "action": "order.status.sent",
  "resource": "orders",
  "resourceId": "order-123",
  "userId": "user-456",
  "branchId": "branch-001",
  "metadata": {
    "from": "NEW",
    "to": "SENT",
    "reason": null,
    "anomalyFlags": []
  },
  "createdAt": "2025-11-19T14:30:00Z"
}
```

**Table Transfer Audit**:
```json
{
  "action": "order.table_transferred",
  "resource": "orders",
  "resourceId": "order-123",
  "metadata": {
    "oldTableId": "table-001",
    "oldTableLabel": "T1",
    "newTableId": "table-005",
    "newTableLabel": "T5",
    "reason": "Customer requested window seat"
  }
}
```

**Void Audit**:
```json
{
  "action": "order.status.voided",
  "resource": "orders",
  "resourceId": "order-123",
  "metadata": {
    "from": "SENT",
    "to": "VOIDED",
    "reason": "Customer allergic to ingredient",
    "managerPinUsed": true,
    "total": 45000
  }
}
```

### Performance Considerations

**State Machine Overhead**:
- 1 additional DB query per transition (order lookup)
- Audit events created asynchronously (non-blocking)
- Business rule validation uses existing includes
- **Impact**: < 10ms added latency per transition

**Item-Level Status Tracking**:
- Potential N+1 if updating items individually
- **Mitigation**: Use `updateMany` for batch status updates
- Consider denormalizing `Order.allItemsReady` flag

**Indexes**:
- `OrderItem.status` indexed for fast filtering
- `OrderItem.course` indexed for course-based queries
- Existing Order indexes sufficient (branchId, status, updatedAt)

### Troubleshooting

#### "Invalid transition: SENT → CLOSED"
**Cause**: Trying to close order before marking as served (DINE_IN only)

**Solution**:
```bash
# Mark as served first
curl -X POST $API_URL/pos/orders/:id/mark-served \
  -H "Authorization: Bearer $TOKEN"

# Then close
curl -X POST $API_URL/pos/orders/:id/close \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 50000}'
```

**Or** for TAKEAWAY orders, close directly from READY.

#### "Payment incomplete: paid 30000, due 50000"
**Cause**: Payment validation failed (not enough paid)

**Solution**: Ensure payment amount covers order total:
```sql
-- Check order total
SELECT id, total, discount, status FROM orders WHERE id = 'order-123';

-- Check payments
SELECT id, amount, status FROM payments WHERE orderId = 'order-123';
```

#### "Cannot mark order ready: 2 KDS tickets still pending"
**Cause**: Not all KDS tickets marked as ready

**Solution**:
```bash
# Check KDS tickets
curl -X GET $API_URL/kds/tickets?orderId=order-123 \
  -H "Authorization: Bearer $TOKEN"

# Mark tickets ready in KDS
# Then call mark-ready endpoint
```

#### Order stuck in SENT status
**Cause**: No automatic transition to READY (manual sync needed)

**Query**:
```sql
-- Find orders with all tickets ready but order not marked READY
SELECT o.id, o.status, COUNT(k.id) as total_tickets,
       COUNT(k.readyAt) as ready_tickets
FROM orders o
LEFT JOIN kds_tickets k ON k.orderId = o.id
WHERE o.status IN ('SENT', 'IN_KITCHEN')
GROUP BY o.id, o.status
HAVING COUNT(k.id) = COUNT(k.readyAt);
```

**Fix**: Call markReady endpoint for each stuck order.

### Known Limitations

1. **No Auto-Sync KDS → Order.READY**: Manual markReady call required
2. **No Item-Level Void Endpoint**: Can only void entire order
3. **No Split Bill Implementation**: Schema ready, logic pending
4. **No Course Timing Logic**: No automatic delay between courses
5. **No Order.tabName Field**: Bar tabs not formally supported
6. **No Payment.tipAmount Field**: Tips not tracked separately

### Migration Guide

**Existing Orders**:
- All new fields nullable (no data migration needed)
- Old orders continue to work without item-level status
- State machine enforces rules on new transitions only

**Enabling Item Status Tracking**:
```sql
-- Backfill item status based on order status
UPDATE order_items oi
SET status = CASE
  WHEN o.status IN ('NEW') THEN 'PENDING'::orderitemstatus
  WHEN o.status IN ('SENT', 'IN_KITCHEN') THEN 'SENT'::orderitemstatus
  WHEN o.status IN ('READY') THEN 'READY'::orderitemstatus
  WHEN o.status IN ('SERVED', 'CLOSED') THEN 'SERVED'::orderitemstatus
  WHEN o.status = 'VOIDED' THEN 'VOIDED'::orderitemstatus
END
FROM orders o
WHERE oi.orderId = o.id AND oi.status IS NULL;
```

### Testing

**Unit Tests**:
```bash
# State machine tests
pnpm --filter @chefcloud/api test order-state-machine.service.spec.ts

# POS service tests (if updated)
pnpm --filter @chefcloud/api test pos/pos.service.spec.ts
```

**E2E Test Scenarios** (to be implemented):
1. Full order lifecycle: Create → Send → Ready → Serve → Close
2. TAKEAWAY shortcut: Create → Send → Ready → Close (skip serve)
3. Void before kitchen: Create → Void
4. Void after kitchen: Create → Send → Void (requires reason)
5. Table transfer: Create → Transfer → Send → Close
6. Waiter transfer: Create → Transfer → Send → Close
7. Invalid transitions: Attempt CLOSED → NEW (should fail)
8. Payment validation: Attempt close with insufficient payment (should fail)

### Success Metrics

✅ **Implemented**:
- State machine enforces all transitions
- Invalid transitions blocked with clear errors
- All transitions fully audited
- Item-level schema ready for advanced features
- Table/waiter transfers functional
- Backward compatible (no breaking changes)

⚠️ **Pending**:
- Item-level void operations
- Split bill logic
- Payment tip tracking
- Auto-sync KDS → Order.READY
- Course timing logic
- Tab management

---

**Related Documentation**:
- [M1: KDS System](./M1-KDS-SYSTEM.md)
- [M3: Inventory Management](./M3-INVENTORY-MANAGEMENT.md)
- [M5: Staff Performance & Anti-Theft](./M5-STAFF-PERFORMANCE.md)
- [M8: Accounting](./M8-ACCOUNTING.md)
