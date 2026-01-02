# POS, KDS & Front-of-House Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** POS, Kitchen Display System, Front-of-House Operations  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Order creation, modification, and lifecycle management
- Menu item selection with modifiers and variants
- Payment processing (cash, card, split, partial)
- Tip handling and service charges
- Bill splitting (by item, seat, percentage)
- Void and refund workflows
- Kitchen Display System (KDS) ticket lifecycle
- Table management (assign, transfer, merge)
- Receipt printing and digital receipts
- Offline order queue and sync

### Out of Scope
- Payment gateway integrations (external)
- Hardware driver implementations
- Loyalty program logic (see separate module)
- Delivery management

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| POS-INV-01 | **Order total = Σ(line items) + taxes + tips - discounts** | Service calculation |
| POS-INV-02 | **Payment total = order total** for closed orders | API validation |
| POS-INV-03 | **No double-close**: Order cannot be closed twice | State machine enforcement |
| POS-INV-04 | **Void requires reason**: All voids must have reason code and manager approval (if configured) | API validation |
| POS-INV-05 | **Inventory decremented on order send** (not close) | Service trigger |
| POS-INV-06 | **KDS ticket lifecycle**: NEW → IN_PROGRESS → READY → SERVED | State machine |
| POS-INV-07 | **Table assignment uniqueness**: One active order per table (unless configured otherwise) | DB constraint |
| POS-INV-08 | **Payment immutability**: Completed payments cannot be modified, only refunded | API enforcement |
| POS-INV-09 | **Split sum = original total**: Split bill totals must equal original order total | Service validation |
| POS-INV-10 | **Offline queue order**: Offline orders sync in creation order (no reordering) | Sync service |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | No orders, no payments; menu exists but unpurchased |
| DEMO_TAPAS | Sample orders in all states; completed payments; KDS history |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch orders; branch-specific floor plans |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All orders visible to assigned waiter and manager
- [ ] KDS displays only relevant station items
- [ ] Payments reconcile to cash drawer expectations
- [ ] Inventory decrements match order items (recipe consumption)
- [ ] Sales reports reflect all closed orders

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `POST /pos/orders` | Atomic creation; returns orderId; idempotent with key |
| `POST /pos/orders/:id/items` | Add items; updates total; triggers KDS if sent |
| `POST /pos/orders/:id/send` | Sends to kitchen; decrements inventory; idempotent |
| `POST /pos/orders/:id/payments` | Atomic payment record; validates total |
| `POST /pos/orders/:id/close` | Requires payment complete; state transition |
| `POST /pos/orders/:id/void` | Requires reason; optionally requires approval |
| `GET /kds/tickets` | Real-time active tickets for station |
| `POST /kds/tickets/:id/bump` | Advance ticket state; idempotent |

### Response Time SLA
- Order creation: < 200ms
- Item add: < 100ms
- KDS query: < 100ms
- Payment recording: < 500ms

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| CASHIER | Full POS access; item selection, payments, receipts |
| WAITER | Table view; order creation for assigned tables; split bills |
| CHEF | KDS view; bump tickets; no order modification |
| BARTENDER | Bar station KDS; drink-only filters |
| MANAGER | All orders; void approval; shift oversight |
| OWNER | Dashboard only; no direct POS operation |

### UX Requirements
- Order screen shows real-time total as items added
- Modifier selection modal with required/optional indicators
- Payment screen shows remaining balance after partial payments
- Split bill shows visual representation of how bill is divided
- KDS shows timer since order sent (color-coded SLA)
- Void confirmation requires explicit reason selection
- Offline indicator visible when connection lost
- Receipt preview before print/send

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| POS-ERR-01 | Close order with incomplete payment | 400 error "Payment incomplete" |
| POS-ERR-02 | Add item to closed order | 400 error "Order is closed" |
| POS-ERR-03 | Void without reason | 400 error "Reason required" |
| POS-ERR-04 | Void without approval (when configured) | 403 error "Approval required" |
| POS-ERR-05 | Payment exceeds order total | 400 error "Payment exceeds total" (or process as overpayment) |
| POS-ERR-06 | KDS bump on non-existent ticket | 404 error "Ticket not found" |
| POS-ERR-07 | Split bill sum ≠ original | 400 error "Split totals don't match" |
| POS-ERR-08 | Table already has active order | 409 error "Table has active order" |
| POS-ERR-09 | Offline queue full (>1000 orders) | Warn user; oldest orders prioritized |
| POS-ERR-10 | Concurrent order modification | Optimistic locking; 409 on conflict |
| POS-ERR-11 | Menu item not available | 400 error "Item unavailable" |
| POS-ERR-12 | Printer offline | Queue print job; notify user |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Order created | INFO | orderId, tableId, waiterId, timestamp |
| Items added | INFO | orderId, items, userId |
| Order sent to kitchen | INFO | orderId, ticketIds, timestamp |
| Payment received | INFO | orderId, paymentId, method, amount |
| Order closed | INFO | orderId, total, userId, timestamp |
| Order voided | WARN | orderId, reason, approverId, userId |
| Refund processed | WARN | orderId, refundId, amount, reason |

### Metrics
| Metric | Purpose |
|--------|---------|
| `pos.orders.created` | Volume tracking |
| `pos.orders.closed` | Revenue tracking |
| `pos.orders.voided` | Loss tracking |
| `pos.payments.total` | Cash flow |
| `kds.ticket.duration` | Kitchen performance |
| `pos.offline.queue_size` | Sync health |

### Alerts
- Void rate > 5% of orders: WARN
- KDS ticket SLA breach (> 15 min): WARN
- Offline queue growing: WARN
- Payment reconciliation mismatch: ERROR

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| Create order | CASHIER, WAITER | Yes + Branch scope |
| Add/remove items | CASHIER, WAITER | Yes + Order ownership |
| Process payment | CASHIER | Yes + Branch scope |
| Void order | MANAGER (or CASHIER + approval) | Yes |
| View KDS | CHEF, BARTENDER | Yes + Station scope |
| Bump KDS | CHEF, BARTENDER | Yes + Station scope |

### Input Validation
| Field | Validation |
|-------|------------|
| Quantities | Integer; 1-999; positive |
| Prices | Decimal(19,4); non-negative |
| Tips | Decimal(19,4); non-negative |
| Payment amounts | Decimal(19,4); positive; ≤ remaining |
| Reason codes | Enum from predefined list |

### Idempotency
- `POST /pos/orders` with idempotency key prevents duplicate orders
- `POST /pos/orders/:id/send` is idempotent (repeat calls succeed)
- `POST /kds/tickets/:id/bump` is idempotent (repeat calls succeed)

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Order creation | 100/min per user |
| Item modifications | 500/min per user |
| KDS queries | 1000/min per station |

---

## I) Acceptance Criteria Checklist

### Order Lifecycle (8 items)
- [ ] POS-AC-01: Create order with table assignment
- [ ] POS-AC-02: Add items with modifiers
- [ ] POS-AC-03: Edit item quantity
- [ ] POS-AC-04: Remove item from order
- [ ] POS-AC-05: Send order to kitchen
- [ ] POS-AC-06: Apply discount to order
- [ ] POS-AC-07: Close order after full payment
- [ ] POS-AC-08: Cancel/void order with reason

### Payments (6 items)
- [ ] POS-AC-09: Process cash payment
- [ ] POS-AC-10: Process card payment
- [ ] POS-AC-11: Process split payment (multiple methods)
- [ ] POS-AC-12: Handle tips
- [ ] POS-AC-13: Process partial payment
- [ ] POS-AC-14: Refund payment

### Bill Splitting (4 items)
- [ ] POS-AC-15: Split by seat
- [ ] POS-AC-16: Split by item
- [ ] POS-AC-17: Split by percentage
- [ ] POS-AC-18: Validate split totals match original

### KDS (5 items)
- [ ] POS-AC-19: Display tickets by station
- [ ] POS-AC-20: Bump ticket to next state
- [ ] POS-AC-21: Show ticket timer
- [ ] POS-AC-22: Filter by course (appetizer, main, dessert)
- [ ] POS-AC-23: Recall bumped ticket

### Tables (4 items)
- [ ] POS-AC-24: Assign table to order
- [ ] POS-AC-25: Transfer to different table
- [ ] POS-AC-26: Merge tables
- [ ] POS-AC-27: Transfer to different waiter

### Receipts (3 items)
- [ ] POS-AC-28: Print receipt
- [ ] POS-AC-29: Email receipt
- [ ] POS-AC-30: Reprint receipt

---

## J) Minimum E2E Expansion Set

### API Contract Tests (10 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Create order with items | DEMO_TAPAS | 30s |
| Add modifier to item | DEMO_TAPAS | 30s |
| Send order to kitchen | DEMO_TAPAS | 30s |
| Process full payment | DEMO_TAPAS | 30s |
| Close order after payment | DEMO_TAPAS | 30s |
| Void order with reason | DEMO_TAPAS | 30s |
| Split bill by seat | DEMO_TAPAS | 30s |
| Split totals mismatch (400) | DEMO_TAPAS | 30s |
| KDS ticket bump | DEMO_TAPAS | 30s |
| Close without payment (400) | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (5 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| CASHIER can create order and process payment | CASHIER | DEMO_TAPAS | 30s |
| WAITER can create order for table | WAITER | DEMO_TAPAS | 30s |
| CHEF sees only kitchen tickets | CHEF | DEMO_TAPAS | 30s |
| MANAGER can void order | MANAGER | DEMO_TAPAS | 30s |
| OWNER cannot create orders | OWNER | DEMO_TAPAS | 30s |

### Report Validation Tests (3 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Sales total matches order sum | DEMO_TAPAS | 30s |
| Tips total correct | DEMO_TAPAS | 30s |
| Void count accurate | DEMO_TAPAS | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| POS screen loads with menu | DEMO_TAPAS | 30s |
| Empty order state displays | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| medusa | ✅ MIT | Order flow, checkout, payment abstraction |
| TastyIgniter | ✅ MIT | Restaurant order patterns |

**Note:** Both repos are MIT — adaptation allowed with attribution.
