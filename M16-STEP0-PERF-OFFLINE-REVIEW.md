# M16 – Step 0: Performance & Offline Inventory

**Date**: 2025-11-21  
**Status**: READ-ONLY ANALYSIS  
**Purpose**: Identify high-traffic endpoints, existing performance mitigations, weak spots, and offline/sync mechanisms.

---

## 1. Top 10 "Hot Paths" by Expected Traffic

### 1.1 POS Order Lifecycle (CRITICAL - 80% of API traffic)

**Endpoints**:
- `POST /pos/orders` - Create new order
- `POST /pos/orders/:id/send-to-kitchen` - Send order to KDS
- `POST /pos/orders/:id/close` - Apply payment and close order
- `POST /pos/orders/:id/modify` - Add/remove items
- `POST /pos/orders/:id/void` - Void order (L2+ manager approval)

**Traffic Pattern**: 
- Peak: Friday/Saturday nights, 200-500 orders/hour per branch
- Burst scenario: Multiple waiters creating orders simultaneously
- Expected 5-15 API calls per order lifecycle

**Current Implementation**:
- **File**: `services/api/src/pos/pos.service.ts` (1,600+ lines)
- **Key Methods**: 
  - `createOrder()`: Calculates totals, creates orderItems, generates KDS tickets per station, checks prepaid credits
  - `sendToKitchen()`: Updates status, checks for NO_DRINKS anomaly
  - `closeOrder()`: Records payments, posts GL entries, triggers eFris, creates stock movements (FIFO), marks KPIs dirty

**Data Dependencies**:
- MenuItem lookups (with taxCategory join)
- Table lookup (optional)
- User lookup
- Branch → Org lookup (for orgId)
- EventBooking check (for prepaid credits)
- StockBatch queries (FIFO costing on close)
- Recipe ingredients (for stock movement calculations)

**Performance Concerns**:
- ❌ **N+1 risk**: Menu item lookups in `createOrder()` - currently batched ✅
- ❌ **Heavy JOIN**: `closeOrder()` includes StockBatch FIFO calculation for every ingredient
- ❌ **Synchronous GL posting**: Blocks order close response
- ⚠️ **No idempotency**: Duplicate requests will create duplicate orders

---

### 1.2 KDS Queue & Ticket Updates (HIGH - 50 requests/min per station)

**Endpoints**:
- `GET /kds/queue?station=GRILL&since=<ISO>` - Get pending tickets (polling every 3-5 sec)
- `POST /kds/tickets/:id/mark-ready` - Mark ticket done
- `POST /kds/tickets/:id/bump` - Clear ticket from screen

**Traffic Pattern**:
- Continuous polling from 2-6 KDS stations per branch
- 12-20 requests/minute per station during service
- Incremental sync via `since` parameter

**Current Implementation**:
- **File**: `services/api/src/kds/kds.service.ts`
- **Incremental Sync**: ✅ Supports `since` parameter filtering on `updatedAt`
- **SLA Calculation**: Calculates elapsed time and color-codes (GREEN/ORANGE/RED) inline
- **Waiter name resolution**: Joins Order → User for every ticket

**Query Pattern**:
```prisma
findMany({
  where: {
    station: "GRILL",
    status: { in: ["QUEUED", "IN_PROGRESS"] },
    updatedAt: { gte: since }  // If since provided
  },
  include: {
    order: {
      include: {
        table: true,
        user: true,  // For waiter name
        orderItems: {
          include: { menuItem: true }
        }
      }
    }
  },
  orderBy: [{ sentAt: 'asc' }]
})
```

**Performance Concerns**:
- ✅ **Existing index**: `@@index([station, status, sentAt])` on KdsTicket
- ⚠️ **Missing index**: No composite index on `updatedAt` for incremental sync
- ❌ **Deep nesting**: 3-level include (order → table/user → orderItems → menuItem) on every poll
- ⚠️ **Inline SLA calc**: Recalculates elapsed time on every request (could be cached or precomputed)

---

### 1.3 Reservations & Booking Portal (MEDIUM - 100-200/day per branch)

**Endpoints**:
- `POST /public/reservations` - Public booking (unauthenticated, rate-limited)
- `GET /public/availability` - Check available time slots (30/min limit)
- `GET /public/events/:slug` - Browse event details (60/min limit)
- `POST /reservations/:id/confirm` - Capture deposit (staff)
- `POST /reservations/:id/seat` - Link reservation to order (staff)

**Traffic Pattern**:
- Public endpoints: Burst traffic from marketing campaigns or event launches
- Staff endpoints: Moderate usage during service hours

**Current Implementation**:
- **Files**: 
  - `services/api/src/reservations/reservations.service.ts` (543 lines)
  - `services/api/src/bookings/bookings.service.ts` (600+ lines)
  - `services/api/src/public-booking/public-booking.controller.ts` (150 lines)
- **Availability check**: O(n) loop over reservations to calculate capacity (brute-force)
- **Deposit accounting**: Synchronous GL posting on confirm/forfeit/refund

**Query Pattern** (availability check):
```prisma
findMany({
  where: {
    branchId,
    startAt: { gte: startWindow },
    endAt: { lte: endWindow },
    status: { in: ["CONFIRMED", "SEATED"] }
  }
})
// Then manual overlap calculation
```

**Performance Concerns**:
- ❌ **No indexes** on Reservation `startAt`/`endAt` for time-range queries
- ⚠️ **Capacity calculation**: O(n) overlap detection on every availability check
- ❌ **Synchronous GL**: Deposit capture blocks response while posting to JournalEntry
- ⚠️ **No idempotency**: Public reservation creation can duplicate if retried

---

### 1.4 Inventory Reconciliation (LOW FREQUENCY - HIGH COST)

**Endpoints**:
- `GET /inventory/reconciliation?branchId=<id>&shiftId=<id>` - Full reconciliation report
- `GET /inventory/reconciliation/summary` - Dashboard metrics only

**Traffic Pattern**:
- 1-2 times per day per branch (shift-close + manual audits)
- Extremely heavy query load (processes all inventory items)

**Current Implementation**:
- **File**: `services/api/src/inventory/reconciliation.service.ts` (370 lines)
- **Algorithm**: For each inventory item:
  1. Opening stock: Query StockBatch (< periodStart)
  2. Purchases: Query StockMovement (type=PURCHASE) + GoodsReceipt fallback
  3. Theoretical usage: Query StockMovement (type=SALE)
  4. Wastage: Query StockMovement (type=WASTAGE)
  5. Closing stock: Query StockCount (JSON) or StockBatch (current)
  6. Calculate variance and tolerance

**Performance Concerns**:
- ❌ **No batch optimization**: Sequential queries for EACH item (potential 100+ items)
- ✅ **Existing index**: `@@index([orgId, branchId, createdAt])` on StockMovement
- ⚠️ **Missing indexes**: No index on `itemId` + `type` + date range for targeted filtering
- ❌ **N+1 antipattern**: One reconciliation query triggers 5+ DB queries per item

**Estimated Load**:
- 50 items × 5 queries = 250 DB queries per reconciliation
- 2 reconciliations/day × 10 branches = 5,000 queries/day from this endpoint alone

---

### 1.5 Owner Digests & Scheduled Reports (BACKGROUND - CRON)

**Worker Jobs**:
- `owner-digest-run` - Daily/weekly/monthly sales digests
- `shift-end-report` - Triggered on shift close
- `period-digest` - DAILY_SUMMARY, WEEKLY_SUMMARY, MONTHLY_SUMMARY

**Traffic Pattern**:
- Scheduled: Every minute cron checker + report generation
- Batch queries: Aggregate sales, anomalies, inventory across all branches

**Current Implementation**:
- **File**: `services/worker/src/index.ts` (digest worker @ line 746)
- **Data aggregation**: 
  ```typescript
  // Aggregates salesToday, sales7d, anomalies for org
  const salesToday = await prisma.order.aggregate({
    where: { branchId: { in: branchIds }, createdAt: { gte: startOfToday } },
    _sum: { total: true }
  })
  ```
- **PDF generation**: pdfkit (synchronous, blocks worker)
- **Email delivery**: nodemailer with SMTP (localhost:1025 in dev)

**Performance Concerns**:
- ✅ **Batched aggregation**: Uses `aggregate()` instead of findMany + manual sum
- ⚠️ **No caching**: Recalculates same metrics multiple times if multiple digests configured
- ⚠️ **Cron checker**: Runs every 60 seconds, queries ALL OwnerDigest records (inefficient trigger mechanism)
- ⚠️ **No retry logic**: Failed email sends are not retried

---

### 1.6 Low-Stock Alerts (BACKGROUND - DAILY)

**Worker Jobs**:
- Calculates current stock levels vs thresholds
- Creates/updates alerts

**Query Pattern** (from worker):
```prisma
// For each item:
const usageMovements = await prisma.stockMovement.findMany({
  where: {
    itemId,
    type: 'SALE',
    createdAt: { gte: 30DaysAgo }
  }
})
// Calculate daily average, project days of cover
```

**Performance Concerns**:
- ❌ **Sequential processing**: One item at a time
- ✅ **Index exists**: `@@index([itemId])` on StockMovement
- ⚠️ **Date range filter**: 30-day window could return thousands of movements per item

---

### 1.7 Franchise Overview & Multi-Branch Reporting

**Endpoints**:
- `GET /franchise/overview?from=<date>&to=<date>` - Aggregate all branches
- `GET /franchise/booking-overview` - Reservation/event stats across branches

**Current Implementation**:
- **File**: `services/api/src/franchise/franchise-overview.service.ts` (300+ lines)
- **Pattern**: Loop over all branches, run same query for each, merge results

**Performance Concerns**:
- ❌ **N+1 branch loop**: Fetches branch list, then runs separate query per branch
- ⚠️ **No pagination**: Returns all branches (could be 50+ for large franchises)
- ⚠️ **Date range queries**: `createdAt >= from AND createdAt <= to` without composite indexes

---

### 1.8 Service Reminders & Background Workers (DAILY CRON)

**Worker Jobs**:
- `service-reminders` - Checks upcoming contract payments (daily 08:00)
- `accounting-reminders` - Bill due dates (daily 08:00)
- `subscription-reminders` - Renewal warnings (daily 09:00)

**Performance Concerns**:
- ⚠️ **Full table scan**: Queries all contracts, calculates due dates in-memory
- ⚠️ **No indexes** on `ServiceContract.endDate` or `dueDay` for date-based filtering

---

### 1.9 Webhook Deliveries (DEV PORTAL)

**Endpoints**:
- `POST /webhooks/test` - Manual test delivery
- Background: Event dispatcher queues deliveries

**Current Implementation**:
- **File**: `services/api/src/dev-portal/webhook-dispatcher.service.ts` (300+ lines)
- **Pattern**: Finds subscriptions matching event type, creates delivery record, makes HTTP POST

**Performance Concerns**:
- ✅ **Async delivery**: Uses BullMQ queue (non-blocking)
- ⚠️ **No batch delivery**: One HTTP request per webhook, sequential
- ⚠️ **Retry storms**: Failed webhooks retry 3× immediately (could overload recipients)

---

### 1.10 Auth Sessions & Badge Swipes (FREQUENT)

**Endpoints**:
- `POST /auth/msr-swipe` - Badge swipe for timeclock (100-200/day per branch)
- `POST /auth/login` - JWT token generation
- Background: Idle session invalidation

**Current Implementation**:
- **File**: `services/api/src/auth/sessions.service.ts` (400+ lines)
- **Session lookup**: `findFirst({ where: { userId, revokedAt: null, expiresAt: { gt: now } } })`

**Performance Concerns**:
- ✅ **Multiple indexes**: `@@index([userId])`, `@@index([expiresAt])`, `@@index([revokedAt])`
- ⚠️ **Badge lookup**: `cardToken` index exists but token hashing on every swipe (bcrypt compare)
- ⚠️ **Idle invalidation**: Runs periodically, scans ALL active sessions

---

## 2. Existing Performance Mitigations

### 2.1 Database Indexes

**Migration**: `20251029211614_perf_indexes/migration.sql`

```sql
CREATE INDEX "anomaly_events_occurredAt_idx" ON "anomaly_events"("occurredAt");
CREATE INDEX "orders_updatedAt_idx" ON "orders"("updatedAt");
CREATE INDEX "orders_status_updatedAt_idx" ON "orders"("status", "updatedAt");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");
```

**Schema-Level Indexes** (from grep analysis):
- Order: `@@index([branchId])`, `@@index([updatedAt])`, `@@index([status, updatedAt])`
- KdsTicket: `@@index([station, status, sentAt])`
- StockMovement: `@@index([orgId, branchId, createdAt])`, `@@index([itemId])`, `@@index([shiftId])`, `@@index([orderId])`
- Session: `@@index([userId])`, `@@index([expiresAt])`, `@@index([revokedAt])`, `@@index([badgeId])`, `@@index([lastActivityAt])`
- BadgeAsset (MSR cards): `@@index([cardToken])`, `@@index([employeeId])`, `@@index([status])`
- Reservation: **NO INDEXES** on startAt/endAt 🚨
- EventBooking: **NO INDEXES** on status/event 🚨

### 2.2 Batching

**Current Patterns**:
- ✅ POS `createOrder()`: Batch fetches menuItems via `findMany({ where: { id: { in: menuItemIds } } })`
- ✅ Owner digest: Uses `aggregate()` for totals instead of findMany + reduce
- ❌ Reconciliation: Sequential per-item queries (needs batch optimization)

### 2.3 Incremental Sync

**Existing "since" Parameters**:
- ✅ KDS queue: `GET /kds/queue?since=<ISO>` filters by `updatedAt >= since`
- ❌ POS orders: No incremental fetch (clients must poll all open orders)
- ❌ Reservations: No incremental endpoint

### 2.4 Background Workers

**Async Processing** (via BullMQ):
- ✅ eFris fiscal code submission (retries on failure)
- ✅ Webhook deliveries (non-blocking)
- ✅ Owner digests (scheduled)
- ✅ Anomaly detection (post-order)
- ❌ GL posting: Still synchronous on order close (blocks response)

### 2.5 Rate Limiting

**Current Implementation**:
- ✅ Plan-based rate limiting: `PlanRateLimiterGuard` from E24 (dev portal API keys)
- ⚠️ Public booking endpoints: **NOT ENFORCED** in code (M15 spec mentions nginx-level rate limiting required)
- ⚠️ No per-IP throttling for unauthenticated endpoints

---

## 3. Weak Spots & Performance Bottlenecks

### 3.1 Missing Indexes

**Critical**:
1. **Reservation** `startAt`, `endAt` (time-range queries for availability)
2. **StockMovement** `(type, createdAt)` composite (reconciliation date filtering)
3. **KdsTicket** `updatedAt` (incremental sync queries)
4. **EventBooking** `(eventId, status)` (capacity checks)
5. **ServiceContract** `endDate` (reminder calculations)

**Medium Priority**:
6. **Order** `(branchId, createdAt)` composite (shift-end aggregations)
7. **JournalEntry** `(accountId, postedAt)` (balance sheet queries)
8. **TimeEntry** `(employeeId, date)` (attendance reports)

### 3.2 N+1 Query Antipatterns

**Identified Locations**:
1. **Inventory reconciliation**: 5 queries × 50+ items = 250+ queries per run
2. **Franchise overview**: 1 query per branch × 10-50 branches
3. **KDS queue with nested includes**: 3-level join on every ticket (order → table/user → orderItems → menuItem)
4. **Service reminders**: Loops over all contracts, calculates due dates in-memory

**Solutions Needed**:
- Batch queries with `IN` clauses
- Use database aggregations instead of application-level loops
- Precompute calculated fields (e.g., days until contract due)

### 3.3 Synchronous Heavy Work on Request Thread

**Blocking Operations**:
1. **GL posting** on order close (creates 2-4 JournalEntry + 4-8 JournalEntryLine records)
2. **Stock movement calculation** on order close (FIFO batch consumption)
3. **eFris submission** on order close (makes external HTTP call - already has retry queue but initial attempt is sync)
4. **Deposit accounting** on reservation confirm/forfeit (creates journal entries)

**Impact**: Order close can take 500-1000ms, blocks waiter from taking next order

**Recommendation**: Move GL posting and stock movements to background worker, return order close immediately

### 3.4 Absence of Idempotency

**Risky Endpoints** (duplicate on retry):
1. `POST /pos/orders` - Creates duplicate orders if network fails after DB write
2. `POST /public/reservations` - Creates duplicate bookings from public form double-submit
3. `POST /events/:id/bookings` - Duplicate ticket bookings
4. `POST /reservations/:id/confirm` - Could capture deposit twice

**Current Partial Mitigation**:
- ✅ POS `createOrder()` accepts optional `clientOrderId` parameter (E42 prepaid credits feature)
- ❌ No generic idempotency key mechanism

### 3.5 Lack of Query Limits & Pagination

**Endpoints Returning Unbounded Results**:
1. `/franchise/overview` - Returns all branches (could be 100+)
2. `/inventory/reconciliation` - Returns all items (50-200+)
3. `/kds/queue` - Returns all pending tickets (could be 50+ during dinner rush)
4. `/reservations?from=<date>&to=<date>` - Returns all reservations in range (no limit)

**Risk**: Large result sets cause:
- High memory usage (Node.js heap overflow on 1000+ record responses)
- Slow JSON serialization
- Client-side rendering lag

---

## 4. Existing Offline/Sync Mechanisms

### 4.1 Incremental Sync (Partial)

**Implemented**:
- ✅ KDS queue: `since` parameter filters tickets by `updatedAt >= since`

**Pattern**:
```typescript
// Client stores lastSyncAt = "2025-11-20T14:30:00Z"
GET /kds/queue?station=GRILL&since=2025-11-20T14:30:00Z
// Returns only tickets updated after that time
```

**Missing**:
- ❌ POS orders: No incremental endpoint (clients must fetch all NEW/SENT orders repeatedly)
- ❌ Reservations: No sync endpoint
- ❌ Inventory: No change tracking

### 4.2 Client-Provided IDs (Partial Idempotency)

**POS Order Creation**:
```typescript
async createOrder(dto, userId, branchId, clientOrderId?: string) {
  if (clientOrderId) {
    const existing = await prisma.order.findUnique({ where: { id: clientOrderId } });
    if (existing) return existing; // Return cached result
  }
  // ... create new order
}
```

**Usage**: E42 prepaid credits feature passes `clientOrderId` to link booking to order

**Limitations**:
- Only works if client generates ULID/UUID before API call
- No request fingerprint validation (different payload with same ID returns wrong data)
- Not used for other write operations

### 4.3 Background Workers (Retry Logic)

**Resilient Patterns**:
- ✅ eFris worker: Retries failed fiscal code submissions (3 attempts with exponential backoff)
- ✅ Webhook dispatcher: Retries failed deliveries (3 attempts)
- ⚠️ Owner digest: No retry on email send failure (logs error, job marked complete)

### 4.4 Local State & Cache

**Current State**:
- ❌ No client-side caching documented
- ❌ No Redis cache for frequent reads (menu items, tax categories)
- ❌ No service-level memoization

**Opportunity**: Cache static data (menu items, categories, org settings) with short TTL (60s)

---

## 5. Traffic & Load Estimates

### 5.1 Typical Friday Night (per branch)

- **Orders**: 200 orders × 4 API calls (create, send, mark-ready, close) = **800 requests**
- **KDS polling**: 4 stations × 12 req/min × 180 min service = **8,640 requests**
- **Reservations**: 20 reservations × 3 API calls (create, confirm, seat) = **60 requests**
- **Staff actions**: Voids, discounts, modifications = **100 requests**
- **Auth**: Badge swipes, logins = **50 requests**

**Total per branch**: ~9,650 requests over 3 hours = **53 req/min average, 150 req/min peak**

### 5.2 Multi-Branch Org (10 locations)

- **Peak load**: 1,500 req/min across all branches
- **Database**: Postgres handling 25 req/sec sustained, 80 req/sec burst

### 5.3 Background Worker Load

- **Digest cron checker**: 1 query/minute (checking all digests)
- **Service reminders**: 1 query/day (all contracts)
- **Reconciliation**: 5,000 queries/day (10 branches × 2 times × 250 queries)

**Observation**: Reconciliation is 70% of non-user-facing query load

---

## 6. Existing Mitigations Summary

| Mitigation | Status | Coverage |
|------------|--------|----------|
| Indexes on hot tables | 🟡 Partial | Orders, KdsTicket, StockMovement (missing: Reservation time-range, EventBooking) |
| Batched queries | 🟡 Partial | POS order creation (good), Reconciliation (bad - N+1) |
| Incremental sync | 🟢 Exists | KDS queue only |
| Async background work | 🟢 Exists | eFris, webhooks, digests |
| Rate limiting | 🟡 Partial | Dev portal API keys (no public endpoint protection) |
| Idempotency | 🔴 Missing | Only partial client-provided ID in POS |
| Query pagination | 🔴 Missing | All list endpoints return unbounded results |
| Offline queue | 🔴 Missing | No client-side retry queue documented |
| Caching | 🔴 Missing | No Redis or in-memory cache |

---

## 7. Recommended Focus Areas for M16

### Tier 1 (CRITICAL - Must Fix)

1. **Idempotency keys** for POS orders, reservations, bookings
2. **Missing indexes** on Reservation (startAt/endAt), StockMovement (type, createdAt)
3. **Async GL posting** - move journal entry creation to background worker
4. **Reconciliation batch optimization** - single query per movement type instead of N+1

### Tier 2 (HIGH - Improve Resilience)

5. **Offline-first design** for POS (local queue, replay on reconnect)
6. **Rate limiting** for public booking endpoints (per-IP throttling)
7. **Query pagination** for franchise overview, reconciliation, reservations list
8. **KDS incremental sync index** on `updatedAt`

### Tier 3 (MEDIUM - Performance Polish)

9. **Worker job batching** (digest cron, service reminders)
10. **Caching layer** for menu items, org settings (Redis with 60s TTL)
11. **Observability** - structured logs with latency tracking

---

## 8. Known Gaps in Current System

### Offline Behavior (None Defined)

- ❌ No offline queue on POS clients
- ❌ No conflict resolution strategy
- ❌ No sync status UI/indicators
- ❌ No local storage fallback

### Idempotency Strategy (Absent)

- ❌ No `IdempotencyKey` table
- ❌ No header/body key convention
- ❌ No request fingerprint validation

### Observability (Minimal)

- ✅ Structured logs exist (pino logger)
- ❌ No metrics emission (latency, error rates)
- ❌ No distributed tracing
- ❌ No dashboard for query slow-log

### Rate Limiting (Partial)

- ✅ Plan-based limits for dev portal
- ❌ No IP-based throttling
- ❌ No circuit breaker for external services (eFris, Flutterwave)

---

## Conclusion

ChefCloud has **solid foundations** (indexes on key tables, background workers, incremental KDS sync) but lacks:

1. **Idempotency** - Retries create duplicates
2. **Offline resilience** - No client-side queue or conflict resolution
3. **Performance indexes** - Missing critical indexes on time-range queries
4. **Async heavy work** - GL posting blocks order close
5. **Observability** - No metrics for detecting performance regressions

**Next Steps**: Proceed to M16 Steps 1-7 to address these gaps systematically.
