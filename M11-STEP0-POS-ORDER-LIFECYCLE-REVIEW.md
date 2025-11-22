# M11 – POS Order Lifecycle Hardening: Step 0 Infrastructure Review

**Date**: 2025-11-19  
**Milestone**: M11 – POS Order Lifecycle Hardening  
**Phase**: Step 0 – Comprehensive Review

---

## Executive Summary

This document provides a comprehensive review of ChefCloud's existing POS order lifecycle infrastructure to inform M11 hardening. The goal is to establish an enterprise-grade order lifecycle that is **defensible, auditable, and predictable** with clear state machines, robust approval flows, and seamless integration with KDS (M1), Inventory (M3), Anti-theft (M5), and Accounting (M8).

### Current State Assessment

**Foundation Completeness**: ~70% complete

- ✅ Core POS CRUD operations implemented
- ✅ Basic state tracking (OrderStatus enum with 7 states)
- ✅ Void/discount flows with manager PIN approval
- ✅ Integration with KDS, inventory, costing, and GL
- ⚠️ **Missing**: Explicit state machine with transition rules
- ⚠️ **Missing**: Item-level lifecycle tracking (courses, sent vs ready states)
- ⚠️ **Missing**: Table/waiter transfer flows
- ⚠️ **Missing**: Split bill semantics
- ⚠️ **Missing**: Tab management (bar tabs, named tabs)

**Integration Points**:
- M1 (KDS): ✅ Orders create KDS tickets per station, status updates via event bus
- M3 (Inventory): ✅ Stock movements created on order close (FIFO costing)
- M5 (Anti-theft): ✅ Voids/discounts tracked, anomaly flags (NO_DRINKS)
- M7 (Budgets): ✅ Orders feed revenue/cost metrics
- M8 (Accounting): ✅ GL postings on order close (revenue, COGS)
- M9 (HR): ⚠️ Order linked to userId, but no explicit waiter/server tracking

---

## 1. Database Schema Review

### 1.1 Order Model

**Location**: `packages/db/prisma/schema.prisma` (lines 758-791)

```prisma
model Order {
  id           String      @id @default(cuid())
  branchId     String
  tableId      String?     // ✅ Table assignment
  userId       String      // ✅ Waiter/creator
  orderNumber  String
  status       OrderStatus @default(NEW)
  serviceType  ServiceType @default(DINE_IN)
  subtotal     Decimal     @default(0) @db.Decimal(12, 2)
  tax          Decimal     @default(0) @db.Decimal(12, 2)
  discount     Decimal     @default(0) @db.Decimal(10, 2)
  total        Decimal     @default(0) @db.Decimal(12, 2)
  anomalyFlags String[]
  metadata     Json?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  branch         Branch          @relation(...)
  table          Table?          @relation(...) // ✅ Nullable (no-table mode)
  user           User            @relation(...) // ✅ Creator/waiter
  orderItems     OrderItem[]
  payments       Payment[]
  refunds        Refund[]
  kdsTickets     KdsTicket[]
  discounts      Discount[]
  stockMovements StockMovement[] // M3 integration
}
```

**Strengths**:
- ✅ Clear ownership (userId, branchId)
- ✅ Optional table assignment (tableId nullable)
- ✅ Separate discount tracking (Discount model)
- ✅ Anomaly flags for anti-theft
- ✅ Metadata JSON for extensibility

**Gaps**:
- ⚠️ No `employeeId` link (M9 Employee vs User distinction)
- ⚠️ No `currentWaiterId` (for transfers)
- ⚠️ No `tabName` or `tabType` (for bar tabs)
- ⚠️ No `servedAt` timestamp (distinct from CLOSED)
- ⚠️ No `voidedAt`/`voidedById`/`voidReason` fields (voids are status change only)

### 1.2 OrderStatus Enum

**Location**: `packages/db/prisma/schema.prisma` (lines 42-50)

```prisma
enum OrderStatus {
  NEW         // ✅ Initial state
  SENT        // ✅ Sent to kitchen/bar
  IN_KITCHEN  // ⚠️ Duplicate of SENT? Or KDS-driven?
  READY       // ✅ All items prepared
  SERVED      // ✅ Delivered to guest
  VOIDED      // ✅ Cancelled/voided
  CLOSED      // ✅ Financially closed (paid)
}
```

**Analysis**:
- 7 states total (good granularity)
- `SENT` vs `IN_KITCHEN`: Unclear distinction (redundant?)
- No `DRAFT` state (NEW serves this purpose)
- No `CANCELLED` (VOIDED serves this purpose)
- **State transitions NOT enforced** in code (status can be set arbitrarily)

### 1.3 OrderItem Model

**Location**: `packages/db/prisma/schema.prisma` (lines 1001-1020)

```prisma
model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  menuItemId  String
  quantity    Int      @default(1)
  price       Decimal  @db.Decimal(10, 2)
  subtotal    Decimal  @db.Decimal(10, 2)
  notes       String?
  metadata    Json?    // ✅ Modifiers stored here
  costUnit    Decimal? @db.Decimal(10, 2) // E27 costing
  costTotal   Decimal? @db.Decimal(10, 2)
  marginTotal Decimal? @db.Decimal(10, 2)
  marginPct   Decimal? @db.Decimal(5, 2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Strengths**:
- ✅ Costing fields (E27 integration)
- ✅ Modifiers in metadata
- ✅ Notes for special instructions

**Gaps**:
- ⚠️ No `course` field (STARTER/MAIN/DESSERT)
- ⚠️ No `seat` or `guestNumber` field (for table splitting)
- ⚠️ No item-level status (PENDING/SENT/READY/VOIDED)
- ⚠️ No `voidedAt`/`voidedById` for item-level voids
- ⚠️ Modifiers in JSON (not queryable, not linked to MenuItemOnGroup)

### 1.4 Payment Model

**Location**: `packages/db/prisma/schema.prisma` (lines 1024-1042)

```prisma
model Payment {
  id            String        @id @default(cuid())
  orderId       String
  amount        Decimal       @db.Decimal(10, 2)
  method        PaymentMethod // CASH, CARD, MOMO
  status        String        @default("pending")
  transactionId String?
  metadata      Json?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  order   Order    @relation(...)
  refunds Refund[]
}
```

**Strengths**:
- ✅ Multiple payments per order (split bills)
- ✅ Refund tracking
- ✅ Transaction ID for external references

**Gaps**:
- ⚠️ No `tipAmount` field
- ⚠️ No `tenderedAmount` (for cash overpayment)
- ⚠️ No `changeAmount`
- ⚠️ Status is string (not enum): "pending", "completed", "failed", "refunded"

### 1.5 Discount Model

**Location**: `packages/db/prisma/schema.prisma` (lines 983-1000)

```prisma
model Discount {
  id           String   @id @default(cuid())
  orgId        String
  orderId      String
  createdById  String
  type         String   // "percentage", "fixed"
  value        Decimal  @db.Decimal(10, 2)
  approvedById String?  // ✅ Manager approval tracking
  createdAt    DateTime @default(now())
  metadata     Json?

  order      Order @relation(...)
  createdBy  User  @relation("DiscountCreatedBy", ...)
  approvedBy User? @relation("DiscountApprovedBy", ...)
}
```

**Strengths**:
- ✅ Approval tracking (createdById, approvedById)
- ✅ Org-scoped (for anti-theft analytics)
- ✅ Type differentiation (percentage vs fixed)

**Gaps**:
- ⚠️ No `reason` field (manual reason text)
- ⚠️ No `scope` (ORDER vs ITEM level)
- ⚠️ No link to specific OrderItem (order-level only)
- ⚠️ Type is string (not enum)

### 1.6 Table Model

**Location**: `packages/db/prisma/schema.prisma` (lines 573-597)

```prisma
model Table {
  id          String      @id @default(cuid())
  orgId       String
  branchId    String
  floorPlanId String?
  label       String      // ✅ "T1", "A5", etc.
  capacity    Int         @default(4)
  status      TableStatus @default(AVAILABLE)
  isActive    Boolean     @default(true)
  metadata    Json?       // floor plan position, shape
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  branch       Branch        @relation(...)
  floorPlan    FloorPlan?    @relation(...)
  orders       Order[]       // ✅ Reverse relation
  reservations Reservation[]
}
```

**TableStatus Enum**:
```prisma
enum TableStatus {
  AVAILABLE
  OCCUPIED
  RESERVED
  CLEANING
}
```

**Strengths**:
- ✅ Floor plan support (floorPlanId nullable)
- ✅ Status tracking
- ✅ Capacity tracking

**Gaps**:
- ⚠️ No concept of "tabs" (named bar tabs, open tabs)
- ⚠️ Table status updated manually (not derived from orders)
- ⚠️ No table transfer audit trail

### 1.7 Refund Model

**Location**: `packages/db/prisma/schema.prisma` (lines 1044-1067)

```prisma
model Refund {
  id           String   @id @default(cuid())
  orderId      String
  paymentId    String
  provider     String   // "MOMO" | "CASH" | "CARD" | "MANUAL"
  amount       Decimal  @db.Decimal(10, 2)
  reason       String   // ✅ Reason tracking
  status       String   @default("PENDING")
  createdById  String
  approvedById String?  // ✅ Manager approval
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  order      Order   @relation(...)
  payment    Payment @relation(...)
  createdBy  User    @relation("CreatedRefunds", ...)
  approvedBy User?   @relation("ApprovedRefunds", ...)
}
```

**Strengths**:
- ✅ Reason tracking
- ✅ Approval workflow
- ✅ Status tracking

**Assessment**: Refunds are well-modeled for post-close scenarios.

---

## 2. Service Layer Review

### 2.1 PosService Overview

**Location**: `services/api/src/pos/pos.service.ts` (917 lines)

**Key Methods**:

1. **`createOrder(dto, userId, branchId, clientOrderId?)`** (lines 52-197)
   - ✅ Client-provided order ID support (offline sync)
   - ✅ Tax calculation (via TaxCategory)
   - ✅ KDS ticket creation per station
   - ✅ Event bus publishing
   - ✅ KPIs dirty marking
   - ✅ E42-s2: Prepaid credit detection (event bookings)
   - ⚠️ No state validation (always creates as NEW)
   - ⚠️ No item-level course assignment

2. **`sendToKitchen(orderId, branchId)`** (lines 199-220)
   - ✅ NO_DRINKS anomaly detection
   - ✅ Status change to SENT
   - ⚠️ No validation (can send CLOSED orders)
   - ⚠️ No KDS ticket status update (tickets remain QUEUED)
   - ⚠️ No audit event created

3. **`modifyOrder(orderId, dto, userId, branchId)`** (lines 222-299)
   - ✅ Add items to existing order
   - ✅ Recalculate totals
   - ✅ Audit event created
   - ⚠️ No state validation (can modify CLOSED orders)
   - ⚠️ Cannot remove items (only add)
   - ⚠️ No KDS ticket creation for new items

4. **`voidOrder(orderId, dto, userId, branchId)`** (lines 301-354)
   - ✅ Threshold-based manager PIN requirement (>50,000 UGX)
   - ✅ PIN validation via AuthHelpers
   - ✅ Status change to VOIDED
   - ✅ Audit event created
   - ⚠️ No state validation (can void CLOSED orders)
   - ⚠️ No reason field (not captured)
   - ⚠️ No voidedById tracking (inferred from audit event only)

5. **`closeOrder(orderId, dto, userId, branchId)`** (lines 524-735)
   - ✅ **E27**: Costing integration (costUnit, costTotal, marginTotal)
   - ✅ **E37**: Promotions evaluation (daypart, coupon, exclusive logic)
   - ✅ **M3**: Stock movements via StockMovementsService
   - ✅ **M8**: GL posting (revenue, COGS)
   - ✅ Payment stub creation
   - ✅ Status change to CLOSED
   - ✅ E42-s2: Prepaid credit consumption
   - ⚠️ No state validation (can close VOIDED orders)
   - ⚠️ Payment amount not validated against total
   - ⚠️ No split bill support (only single payment)
   - ⚠️ dto.amount is not linked to Payment.amount correctly
   - ⚠️ Missing servedAt timestamp

6. **`applyDiscount(orderId, dto, userId, branchId, orgId)`** (lines 737-828)
   - ✅ Threshold-based approval (OrgSettings.discountApprovalThreshold)
   - ✅ Manager PIN validation
   - ✅ Discount record creation
   - ✅ Order total update
   - ⚠️ No state validation (can discount CLOSED orders)
   - ⚠️ No reason field capture

7. **`postCloseVoid(orderId, reason, managerPin, userId, orgId)`** (lines 876-917)
   - ✅ L4+ manager PIN requirement
   - ✅ Reason capture
   - ✅ Audit event with voidedBy and originalTotal
   - ✅ Metadata update (postCloseVoid flag)
   - ⚠️ Order status NOT changed to VOIDED (only metadata)
   - ⚠️ No GL reversal (revenue/COGS postings not undone)

### 2.2 Integration Services

**CostingService** (E27):
- ✅ Called in closeOrder
- ✅ Calculates costUnit, costTotal, marginTotal, marginPct
- ✅ Uses RecipeIngredient for ingredient costs

**StockMovementsService** (M3):
- ✅ Called in closeOrder
- ✅ Creates SALE movements for each menu item
- ✅ FIFO costing logic
- ✅ Anomaly detection (NEGATIVE_STOCK)

**PostingService** (M8):
- ✅ Called in closeOrder
- ✅ Creates GL entries for revenue and COGS
- ✅ Org and branch scoped

**PromotionsService** (E37):
- ✅ Optional injection (best-effort)
- ✅ Evaluates promotions by priority
- ✅ Exclusive promotion support
- ✅ Daypart, coupon, scope filtering
- ✅ Metadata tracking (promotionsApplied array)

**EventBusService**:
- ✅ Publishes KDS events on order creation
- ⚠️ Not used for order state changes (SENT, READY, CLOSED)

---

## 3. Controller Layer Review

### 3.1 PosController Endpoints

**Location**: `services/api/src/pos/pos.controller.ts` (86 lines)

**Endpoints**:

1. **POST /pos/orders** (L1+)
   - Creates new order
   - ✅ RBAC: Any authenticated user
   - ⚠️ No branchId validation (user.branchId trusted)

2. **PATCH /pos/orders/:id/send** (L1+)
   - Sends order to kitchen
   - ✅ RBAC: Any authenticated user
   - ⚠️ No state validation

3. **PATCH /pos/orders/:id/modify** (L1+)
   - Adds items to order
   - ✅ RBAC: Any authenticated user
   - ⚠️ No state validation

4. **POST /pos/orders/:id/void** (L2+)
   - Voids order
   - ✅ RBAC: L2+ (Cashier/Supervisor)
   - ✅ Manager PIN override for high-value voids

5. **POST /pos/orders/:id/close** (L1+)
   - Closes order (payment)
   - ✅ RBAC: Any authenticated user
   - ⚠️ Should be L2+ (Cashier)

6. **POST /pos/orders/:id/discount** (L2+)
   - Applies discount
   - ✅ RBAC: L2+
   - ✅ Manager PIN override for large discounts

7. **POST /pos/orders/:id/post-close-void** (L4+)
   - Voids closed order
   - ✅ RBAC: L4+ (Manager)
   - ✅ Reason capture

**Missing Endpoints**:
- ⚠️ GET /pos/orders (list orders)
- ⚠️ GET /pos/orders/:id (get single order)
- ⚠️ POST /pos/orders/:id/transfer-table
- ⚠️ POST /pos/orders/:id/transfer-waiter
- ⚠️ POST /pos/orders/:id/serve (mark as SERVED)
- ⚠️ POST /pos/orders/:id/items/:itemId/void (item-level void)
- ⚠️ POST /pos/orders/:id/split (split bill logic)

---

## 4. Integration Analysis

### 4.1 M1 (KDS) Integration

**Touchpoints**:
- Order creation: Creates KdsTicket per station
- Status mapping: Order.SENT → KdsTicket.QUEUED
- Event bus: Publishes kds events on ticket creation

**Gaps**:
- ⚠️ No Order.READY update when all tickets marked ready
- ⚠️ KdsTicket.status not synced back to Order
- ⚠️ sendToKitchen() doesn't update KdsTicket.status

**Expected Flow**:
1. Order created (NEW) → KdsTickets created (QUEUED)
2. sendToKitchen() → Order.status = SENT, KdsTicket.sentAt updated
3. KDS marks ticket ready → KdsTicket.status = COMPLETED, KdsTicket.readyAt updated
4. All tickets ready → Order.status = READY
5. Waiter serves → Order.status = SERVED
6. Payment → Order.status = CLOSED

**Current Flow**:
1. Order created (NEW) → KdsTickets created (QUEUED)
2. sendToKitchen() → Order.status = SENT (KdsTickets unchanged)
3. ❌ No automatic transition to READY
4. ❌ No SERVED tracking
5. closeOrder() → Order.status = CLOSED

### 4.2 M3 (Inventory) Integration

**Touchpoints**:
- closeOrder(): Calls StockMovementsService.createFromOrder()
- Movement type: SALE
- FIFO costing
- Anomaly detection: NEGATIVE_STOCK flag

**Assessment**:
- ✅ Stock movements created at right time (order close)
- ✅ FIFO logic correct
- ✅ Anomaly detection works
- ⚠️ Voids don't reverse stock movements (if order already closed)
- ⚠️ Item-level voids don't adjust stock (only order-level voids)

### 4.3 M5 (Anti-Theft) Integration

**Touchpoints**:
- Order.anomalyFlags (NO_DRINKS)
- Discount model tracks createdById, approvedById
- Void audit events
- WaiterMetricsService queries Discount table

**Gaps**:
- ⚠️ Voids not tracked in separate model (status change only)
- ⚠️ No void count aggregation
- ⚠️ No late-void detection (time between SENT and VOIDED)
- ⚠️ Item-level voids not tracked

### 4.4 M8 (Accounting) Integration

**Touchpoints**:
- closeOrder(): Calls PostingService.postOrderRevenue()
- GL accounts: Revenue, COGS
- Source tracking: "POS_SALE", sourceId=orderId

**Gaps**:
- ⚠️ Post-close voids don't reverse GL postings
- ⚠️ Refunds create separate GL entries (good) but not linked to original order posting
- ⚠️ Discounts not posted to separate GL account (embedded in revenue)

### 4.5 M9 (HR) Integration

**Touchpoints**:
- Order.userId → User (waiter/creator)
- User.employeeProfile → EmployeeProfile → Employee

**Gaps**:
- ⚠️ No direct Order.employeeId link
- ⚠️ No waiter transfer tracking
- ⚠️ No shift attribution (which shift was order created in?)

---

## 5. Enterprise Spec Comparison

### 5.1 Spec Requirements (ChefCloud_Enterprise_Grade_Backend_Spec_v1.md)

**Section 3.1: POS Order Lifecycle** (lines 88-108)

**Requirement**: "Every state change (create, send, pay, close, void, discount) is atomic and audit-logged (who, when, where, what)."

**Current Status**:
- ✅ createOrder: Implicit (order.createdAt, order.userId)
- ⚠️ sendToKitchen: No audit event
- ⚠️ modifyOrder: ✅ Audit event created
- ✅ voidOrder: ✅ Audit event created
- ⚠️ closeOrder: No audit event
- ⚠️ applyDiscount: No audit event (Discount model has timestamps)
- ✅ postCloseVoid: ✅ Audit event created

**Requirement**: "Any void or discount requires: Appropriate role/permission, Reason code or free-text reason."

**Current Status**:
- Void: ⚠️ Role check via RBAC guard, but no reason capture
- Discount: ⚠️ Role check + threshold approval, but no reason capture

**Requirement**: "Voids/discounts are tracked per staff member and exposed to anti-theft analytics."

**Current Status**:
- ✅ Discount.createdById, Discount.approvedById tracked
- ⚠️ Voids tracked via audit events only (no Void model)

### 5.2 Spec Status

From spec line 764:
> "POS order lifecycle: Implemented – Needs QA"

**Assessment**: Accurate. Core flows exist but need hardening.

---

## 6. Known Issues & Technical Debt

### 6.1 State Machine Issues

**Problem**: No explicit state machine enforcement

**Evidence**:
- All status changes are direct Prisma updates
- No `canTransitionTo(currentStatus, newStatus)` logic
- Any endpoint can set any status (if bypassing controller)

**Impact**:
- Orders can be modified after close
- Orders can be closed after void
- Inconsistent state transitions

**Recommendation**: Implement `OrderStateMachine` class with:
- Allowed transitions matrix
- Validation logic
- Audit event creation on transitions

### 6.2 Item-Level Operations

**Problem**: No item-level lifecycle tracking

**Evidence**:
- OrderItem has no status field
- Cannot void individual items
- Cannot track which items are sent vs ready vs served

**Impact**:
- Partial order voids difficult
- KDS integration limited
- Course timing not supported

**Recommendation**: Add `OrderItem.status` enum (PENDING, SENT, READY, SERVED, VOIDED)

### 6.3 Table/Waiter Transfers

**Problem**: No transfer functionality

**Evidence**:
- No transfer endpoints
- No audit trail for transfers
- Order.tableId and Order.userId are immutable post-creation

**Impact**:
- Cannot reassign orders between tables
- Cannot reassign orders between waiters
- No cross-table order consolidation

**Recommendation**: Add transfer endpoints with audit events

### 6.4 Split Bills

**Problem**: No explicit split bill support

**Evidence**:
- Payment model supports multiple payments per order (good)
- closeOrder() creates single payment stub (bad)
- No UI/API for partial payments

**Impact**:
- Guests cannot split bills
- Manual workaround: create multiple orders

**Recommendation**: Add `POST /pos/orders/:id/payments` endpoint for partial payments

### 6.5 Tabs

**Problem**: No tab concept

**Evidence**:
- No Tab model
- No Order.tabName or Order.tabType
- Bar tabs must use table assignments

**Impact**:
- Bar tabs difficult to manage
- Named tabs not supported
- Open tabs vs table orders conflated

**Recommendation**: Add optional `Order.tabName` field or separate `Tab` model

### 6.6 Courses

**Problem**: No course support

**Evidence**:
- No OrderItem.course field
- No course timing logic
- All items sent to kitchen at once

**Impact**:
- Fine dining courses not supported
- Starters and mains sent simultaneously

**Recommendation**: Add `OrderItem.course` enum (STARTER, MAIN, DESSERT, DRINK)

### 6.7 Void/Discount Reasons

**Problem**: No reason capture

**Evidence**:
- Discount model has no reason field
- voidOrder() doesn't capture reason
- postCloseVoid() captures reason (inconsistent)

**Impact**:
- Anti-theft analysis limited
- Audit trail incomplete

**Recommendation**: Add `Discount.reason` and `Order.voidReason` fields

---

## 7. Positive Findings

### 7.1 Strong Foundations

**What Works Well**:

1. **Integration Architecture**:
   - ✅ Clean service separation (PosService, CostingService, PostingService, etc.)
   - ✅ Optional dependencies (@Optional() PromotionsService)
   - ✅ Event bus for cross-module communication

2. **Costing & Margin Tracking** (E27):
   - ✅ Comprehensive cost tracking
   - ✅ Real-time margin calculation
   - ✅ Recipe-based costing

3. **Promotions Integration** (E37):
   - ✅ Sophisticated evaluation logic
   - ✅ Daypart, coupon, scope filtering
   - ✅ Exclusive promotion support
   - ✅ Metadata tracking for audit

4. **Approval Workflows**:
   - ✅ Threshold-based manager PIN requirements
   - ✅ Org-configurable thresholds (discountApprovalThreshold)
   - ✅ PIN validation via AuthHelpers

5. **Anomaly Detection**:
   - ✅ NO_DRINKS flag
   - ✅ NEGATIVE_STOCK flag (from inventory)
   - ✅ anomalyFlags array extensible

6. **Offline Support**:
   - ✅ Client-provided order IDs (clientOrderId)
   - ✅ Idempotent order creation

7. **Refund Handling**:
   - ✅ Post-close void logic
   - ✅ Refund model with approval tracking

### 7.2 Code Quality

**Observations**:
- ✅ TypeScript strict mode
- ✅ Prisma type safety
- ✅ Consistent error handling (BadRequestException, UnauthorizedException)
- ✅ Comprehensive comments
- ✅ RBAC guards on all endpoints

---

## 8. M11 Implementation Strategy

### 8.1 Phased Approach

**Phase 1: State Machine & Transitions** (Step 1)
- Define canonical state machine
- Implement transition validation
- Add audit events for all transitions

**Phase 2: Order Shape Enhancement** (Step 2)
- Add item-level status tracking
- Add course field
- Normalize monetary fields (tips, tenders)
- Enhance modifiers (link to MenuItemOnGroup)

**Phase 3: Tabs & Tables** (Step 3)
- Add Order.tabName (optional)
- Implement table transfer endpoints
- Implement waiter transfer endpoints
- Add transfer audit events

**Phase 4: Voids/Discounts/Comps** (Step 4)
- Add reason fields
- Create Void model (explicit tracking)
- Add item-level void support
- Enhance approval rules

**Phase 5: Payments & Closing** (Step 5)
- Add Payment.tipAmount, Payment.tenderedAmount
- Add split bill endpoints
- Validate payment totals
- Add servedAt timestamp

**Phase 6: Integration Hardening** (Step 6)
- Sync Order.status with KDS
- Handle item-level voids in inventory
- Add GL reversal for post-close voids
- Link orders to shifts (M9)

**Phase 7: Documentation** (Step 7)
- DEV_GUIDE.md M11 section
- State machine diagram
- API examples

**Phase 8: Testing** (Step 8)
- Unit tests for state machine
- E2E tests for full order lifecycle
- Build checks

### 8.2 Backward Compatibility

**Priorities**:
1. Maintain existing API contracts (no breaking changes)
2. Existing orders continue to work (nullable new fields)
3. Graceful degradation (e.g., no course = null)

**Migration Strategy**:
- Add new fields as nullable
- Default new enums to sensible values
- Backfill via data migration (optional)

### 8.3 Risk Assessment

**High Risk**:
- State machine changes breaking existing flows
- GL reversal logic (accounting integrity)

**Medium Risk**:
- Item-level status tracking (KDS sync complexity)
- Split bill logic (payment validation)

**Low Risk**:
- Table/waiter transfers (additive feature)
- Reason fields (nullable)

---

## 9. Recommendations

### 9.1 Immediate Actions (Step 1)

1. **Create OrderStateMachine class**:
   ```typescript
   class OrderStateMachine {
     static canTransition(from: OrderStatus, to: OrderStatus): boolean
     static validateTransition(order: Order, newStatus: OrderStatus): void
     static transition(order: Order, newStatus: OrderStatus, metadata): Promise<Order>
   }
   ```

2. **Audit all state changes**:
   - Add audit events to sendToKitchen, closeOrder
   - Ensure who/when/what captured

3. **Add integration tests**:
   - Test valid transitions (NEW → SENT → READY → SERVED → CLOSED)
   - Test invalid transitions (CLOSED → NEW should throw)

### 9.2 Quick Wins

1. **Add reason fields**:
   - `Discount.reason: String?`
   - `Order.voidReason: String?`

2. **Add servedAt timestamp**:
   - `Order.servedAt: DateTime?`
   - Set when status changes to SERVED

3. **Add Order.employeeId link**:
   - `Order.employeeId: String?`
   - Populated from User.employeeProfile

4. **Normalize IN_KITCHEN**:
   - Remove IN_KITCHEN status (merge with SENT)
   - Or clarify distinction (SENT = fired, IN_KITCHEN = acknowledged by KDS)

### 9.3 Future Enhancements

1. **Tab Model**:
   - Separate Tab model with tabName, tabType (NAMED, ANONYMOUS)
   - Order.tabId foreign key

2. **Item-Level Discounts**:
   - Add Discount.orderItemId (nullable)
   - Support both order-level and item-level discounts

3. **Surcharges**:
   - Add Surcharge model (e.g., service charge, delivery fee)
   - Link to Order

4. **Tips**:
   - Add Payment.tipAmount
   - Add tip distribution logic (M9 payroll integration)

---

## 10. Conclusion

ChefCloud's POS order lifecycle has a **solid foundation** (70% complete) but requires hardening to meet enterprise-grade standards:

### Strengths
- ✅ Core CRUD operations implemented
- ✅ Strong integration with KDS, Inventory, Accounting
- ✅ Approval workflows (manager PIN, thresholds)
- ✅ Costing and margin tracking
- ✅ Promotions integration

### Critical Gaps
- ⚠️ No explicit state machine
- ⚠️ No item-level lifecycle tracking
- ⚠️ No table/waiter transfers
- ⚠️ No split bill support
- ⚠️ No void/discount reason capture
- ⚠️ No tab management

### M11 Goals
1. **Canonical state machine** with enforced transitions
2. **Item-level enhancements** (status, course, voids)
3. **Transfer flows** (table, waiter)
4. **Payment hardening** (split bills, tips, tenders)
5. **Reason capture** (voids, discounts)
6. **Integration alignment** (KDS sync, GL reversals, HR shifts)

### Success Criteria
- ✅ All state transitions validated and audited
- ✅ Item-level operations supported
- ✅ Table/waiter transfers functional
- ✅ Split bills work correctly
- ✅ Voids/discounts fully auditable
- ✅ Zero "magic" flows (everything explicit)

**Next Step**: Proceed to **Step 1 – Canonical Order State Machine**

---

**Document Status**: ✅ COMPLETE  
**Next Action**: Create `OrderStateMachine` class and transition validation logic
