# M15 – Step 0: Reservations & Booking Portal Current State Review

**Date**: November 20, 2025  
**Purpose**: Inventory current reservations/bookings infrastructure before M15 hardening

---

## Executive Summary

ChefCloud has **functional but incomplete** reservations and event booking infrastructure:

- ✅ **Basic reservations** exist with table assignment and deposit support
- ✅ **Event bookings** with table-based ticketing (E42-s1)
- ✅ **Prepaid credits** system for event deposits
- ⚠️ **Limited state management** - missing NO_SHOW, limited validation
- ⚠️ **No booking portal public API** - all endpoints require internal auth
- ⚠️ **Weak accounting integration** - deposits not properly posted to GL
- ⚠️ **No capacity enforcement** - can overbook beyond table/branch capacity
- ⚠️ **No franchise/multi-branch views** - missing aggregated reporting
- ⚠️ **Limited test coverage** - some E2E tests but no comprehensive unit tests

**M15 Goal**: Elevate to enterprise-grade with full lifecycle management, public booking portal, accounting integration, and comprehensive testing.

---

## Current Database Schema

### Enums

```prisma
enum ReservationStatus {
  HELD        // Initial state - awaiting confirmation
  CONFIRMED   // Deposit captured, reservation confirmed
  SEATED      // Guest has arrived and been seated
  CANCELLED   // Cancelled by guest or venue
  // MISSING: NO_SHOW (critical for deposit forfeiture)
}

enum EventBookingStatus {
  HELD        // Initial booking state
  CONFIRMED   // Payment completed
  CANCELLED   // Booking cancelled
  // MISSING: NO_SHOW, CHECKED_IN, EXPIRED
}
```

### Models

#### Reservation (Standard Table Reservations)

**Location**: `packages/db/prisma/schema.prisma:630`

```prisma
model Reservation {
  id              String            @id @default(cuid())
  orgId           String
  branchId        String
  floorPlanId     String?
  tableId         String?
  name            String
  phone           String?
  partySize       Int
  startAt         DateTime
  endAt           DateTime
  status          ReservationStatus @default(HELD)
  deposit         Decimal           @default(0) @db.Decimal(10, 2)
  depositStatus   String            @default("NONE") // "NONE" | "HELD" | "CAPTURED" | "REFUNDED"
  paymentIntentId String?
  reminderSentAt  DateTime?
  autoCancelAt    DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  org           Org                   @relation(...)
  branch        Branch                @relation(...)
  floorPlan     FloorPlan?            @relation(...)
  table         Table?                @relation(...)
  paymentIntent PaymentIntent?        @relation(...)
  reminders     ReservationReminder[]

  @@index([orgId])
  @@index([branchId])
  @@index([tableId, startAt, endAt])
  @@index([autoCancelAt])
}
```

**Strengths**:

- ✅ Links to org, branch, table, floor plan
- ✅ Time window tracking (startAt, endAt)
- ✅ Deposit support with PaymentIntent linkage
- ✅ Auto-cancellation timer (autoCancelAt)
- ✅ Reminder system (ReservationReminder)

**Weaknesses**:

- ❌ No `guestEmail` field (only phone)
- ❌ No `source` field (WEB, PHONE, WALK_IN)
- ❌ No `notes` field for special requests
- ❌ No `orderId` link for when reservation is seated
- ❌ No `cancelledBy` / `cancelReason` tracking
- ❌ Missing NO_SHOW status in enum
- ❌ `depositStatus` as String instead of enum (inconsistent)

#### Event (Special Events like Brunch)

**Location**: `packages/db/prisma/schema.prisma:2046`

```prisma
model Event {
  id                String   @id @default(cuid())
  orgId             String
  branchId          String
  slug              String   @unique
  title             String
  description       String?
  startsAt          DateTime
  endsAt            DateTime
  isPublished       Boolean  @default(false)
  floorPlanSnapshot Json?    // Historical reference
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tables   EventTable[]
  bookings EventBooking[]

  @@index([orgId, branchId])
  @@index([slug])
  @@index([isPublished, startsAt])
}
```

**Strengths**:

- ✅ Slug-based public URLs
- ✅ Published/draft state
- ✅ Time window tracking
- ✅ Floor plan snapshot for historical reference

**Weaknesses**:

- ❌ No `capacity` field (total event capacity)
- ❌ No `status` enum (DRAFT, PUBLISHED, CANCELLED, COMPLETED)
- ❌ No `createdByUserId` tracking
- ❌ No pricing tiers or ticket types
- ❌ No image/banner URL for marketing

#### EventTable (Ticketed Tables for Events)

**Location**: `packages/db/prisma/schema.prisma:2069`

```prisma
model EventTable {
  id           String  @id @default(cuid())
  eventId      String
  tableId      String? // Optional link to actual table
  label        String  // "VIP Table 1", "Rooftop A"
  capacity     Int
  price        Decimal @db.Decimal(12, 2) // Full table price
  minSpend     Decimal @db.Decimal(12, 2) // Minimum spend requirement
  deposit      Decimal @db.Decimal(12, 2) // Upfront deposit required
  allowPartial Boolean @default(true)     // Allow partial bookings
  isActive     Boolean @default(true)

  event    Event          @relation(...)
  bookings EventBooking[]

  @@index([eventId, isActive])
}
```

**Strengths**:

- ✅ Flexible pricing per table
- ✅ Minimum spend enforcement
- ✅ Deposit requirements
- ✅ Partial booking support

**Weaknesses**:

- ❌ No `bookedCount` / `availableCount` tracking
- ❌ No `sortOrder` for display
- ❌ No `description` field

#### EventBooking (Ticket Purchases)

**Location**: `packages/db/prisma/schema.prisma:2088`

```prisma
model EventBooking {
  id              String             @id @default(cuid())
  eventId         String
  eventTableId    String
  name            String
  phone           String
  email           String?
  status          EventBookingStatus @default(HELD)
  depositIntentId String?            // PaymentIntent ID for deposit
  depositCaptured Boolean            @default(false)
  creditTotal     Decimal            @default(0) @db.Decimal(12, 2)
  ticketCode      String?            @unique // ULID for QR check-in
  checkedInAt     DateTime?          // When guest checked in
  checkedInById   String?            // User who performed check-in
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  metadata        Json?

  event      Event           @relation(...)
  eventTable EventTable      @relation(...)
  credits    PrepaidCredit[]

  @@index([eventId, status])
  @@index([eventTableId])
  @@index([phone])
}
```

**Strengths**:

- ✅ QR code check-in system (ticketCode)
- ✅ Check-in tracking with timestamp and user
- ✅ Prepaid credit linkage
- ✅ Metadata for extensibility

**Weaknesses**:

- ❌ No `quantity` field (always assumes 1 table?)
- ❌ No `cancelledAt` / `cancelReason` tracking
- ❌ `depositIntentId` should link to PaymentIntent model
- ❌ Missing expiration logic for HELD bookings

#### PrepaidCredit (Event Deposit Credits)

**Location**: `packages/db/prisma/schema.prisma:2118`

```prisma
model PrepaidCredit {
  id             String   @id @default(cuid())
  orgId          String
  branchId       String
  eventBookingId String?  // Link to event booking if applicable
  tableId        String?  // Link to actual table when applied
  amount         Decimal  @db.Decimal(12, 2) // Total credit amount
  consumed       Decimal  @default(0) @db.Decimal(12, 2) // Amount used
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  eventBooking EventBooking? @relation(...)

  @@index([orgId, branchId, expiresAt])
  @@index([eventBookingId])
  @@index([tableId])
}
```

**Strengths**:

- ✅ Tracks consumption over time
- ✅ Expiration date
- ✅ Links to event bookings and tables

**Weaknesses**:

- ❌ No `orderId` link to track which order consumed the credit
- ❌ No `status` field (ACTIVE, CONSUMED, EXPIRED, REFUNDED)
- ❌ No GL posting linkage (should reference journal entries)

#### PaymentIntent (Payment Gateway Integration)

**Location**: `packages/db/prisma/schema.prisma:1111`

```prisma
model PaymentIntent {
  id          String   @id @default(cuid())
  orgId       String
  branchId    String
  orderId     String
  provider    String   // "MTN" | "AIRTEL" | "MOMO"
  amount      Decimal  @db.Decimal(12, 2)
  currency    String   @default("UGX")
  status      String   @default("PENDING")
  providerRef String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  reservations Reservation[]

  @@index([orgId, orderId])
  @@index([status, createdAt])
}
```

**Strengths**:

- ✅ Multiple provider support
- ✅ Status tracking
- ✅ Provider reference for reconciliation
- ✅ Links back to reservations

**Weaknesses**:

- ❌ No link to EventBooking model
- ❌ No `refundedAt` / `refundAmount` tracking
- ❌ `status` as String instead of enum

#### ReservationReminder

**Location**: `packages/db/prisma/schema.prisma:664`

```prisma
model ReservationReminder {
  id            String    @id @default(cuid())
  reservationId String
  channel       String    // "SMS" | "EMAIL"
  target        String    // phone or email
  scheduledAt   DateTime
  sentAt        DateTime?
  createdAt     DateTime  @default(now())

  reservation Reservation @relation(...)

  @@index([scheduledAt, sentAt])
}
```

**Strengths**:

- ✅ Multi-channel support (SMS, EMAIL)
- ✅ Scheduled delivery
- ✅ Sent tracking

**Weaknesses**:

- ❌ No `status` field (PENDING, SENT, FAILED)
- ❌ No error tracking
- ❌ No retry mechanism

---

## Current API Endpoints

### Reservations Controller (Internal)

**Location**: `services/api/src/reservations/reservations.controller.ts`

**Auth**: Requires JWT + RolesGuard

| Method | Endpoint                  | Role | Implemented | Notes                          |
| ------ | ------------------------- | ---- | ----------- | ------------------------------ |
| POST   | /reservations             | L2+  | ✅          | Create reservation             |
| GET    | /reservations             | L2+  | ✅          | List with filters              |
| POST   | /reservations/:id/confirm | L2+  | ✅          | HELD → CONFIRMED               |
| POST   | /reservations/:id/cancel  | L2+  | ✅          | Cancel with deposit refund     |
| POST   | /reservations/:id/seat    | L2+  | ✅          | CONFIRMED → SEATED, link order |
| GET    | /reservations/summary     | L3+  | ✅          | Metrics by status/deposit      |

**Missing Endpoints**:

- ❌ POST /reservations/:id/no-show (mark NO_SHOW, forfeit deposit)
- ❌ PATCH /reservations/:id (update guest details, time)
- ❌ GET /reservations/:id (single reservation details)
- ❌ GET /reservations/availability (check capacity)
- ❌ POST /reservations/:id/send-reminder (manual reminder)

### Bookings Controller (Internal - Events)

**Location**: `services/api/src/bookings/bookings.controller.ts`

**Auth**: Requires JWT + RolesGuard

| Method | Endpoint                       | Role | Implemented | Notes                        |
| ------ | ------------------------------ | ---- | ----------- | ---------------------------- |
| POST   | /bookings/events               | L4+  | ✅          | Create/update event + tables |
| POST   | /bookings/events/:id/publish   | L4+  | ✅          | Publish event                |
| POST   | /bookings/events/:id/unpublish | L4+  | ✅          | Unpublish event              |
| GET    | /bookings/events/:id           | L2+  | ✅          | Get event with bookings      |
| POST   | /bookings/check-in             | L2+  | ✅          | Check-in guest by ticketCode |
| GET    | /bookings/check-in/:ticketCode | L2+  | ✅          | Get booking by ticketCode    |

**Missing Endpoints**:

- ❌ GET /bookings/events (list all events with filters)
- ❌ POST /bookings/events/:id/cancel (cancel event, handle refunds)
- ❌ GET /bookings/events/:id/summary (attendance metrics)

### Bookings Public API (NO PUBLIC ENDPOINTS EXIST)

**Missing Entire Surface**:

- ❌ GET /public/events (list published events)
- ❌ GET /public/events/:slug (event details)
- ❌ POST /public/events/:slug/book (create event booking)
- ❌ GET /public/reservations/availability (check table availability)
- ❌ POST /public/reservations (create reservation request)
- ❌ POST /public/reservations/:id/confirm-deposit (confirm payment)

---

## Service Implementation Review

### ReservationsService

**Location**: `services/api/src/reservations/reservations.service.ts` (287 lines)

**Implemented Methods**:

1. `create(orgId, dto)` ✅
   - Creates reservation with optional deposit
   - Checks for table overlap
   - Creates PaymentIntent if deposit > 0
   - Schedules reminder if > 24h away
   - Sets autoCancelAt based on org settings
   - **Issues**: No capacity validation, no source tracking

2. `findAll(orgId, from?, to?, status?)` ✅
   - Lists reservations with filters
   - Includes table and branch details
   - **Issues**: No pagination, no branch filtering

3. `confirm(orgId, id)` ✅
   - Transitions HELD → CONFIRMED
   - Captures deposit if depositStatus = HELD
   - **Issues**: No capacity revalidation, no notification

4. `cancel(orgId, id)` ✅
   - Cancels reservation
   - Handles deposit refund based on depositStatus
   - Creates Refund record if needed
   - **Issues**: No cancellation reason tracking, no cutoff time logic

5. `seat(orgId, id, orderId?)` ✅
   - Transitions to SEATED
   - Links order to table if provided
   - **Issues**: No time window validation (can seat late)

6. `getSummary(orgId, from, to)` ✅
   - Aggregates by status and deposit status
   - **Issues**: No per-branch breakdown, no show-up rate

**Missing Methods**:

- ❌ `noShow(orgId, id)` - mark NO_SHOW, forfeit deposit
- ❌ `update(orgId, id, dto)` - update guest details/time
- ❌ `getById(orgId, id)` - single reservation details
- ❌ `checkAvailability(branchId, date, time, partySize)` - capacity check
- ❌ `sendReminder(id)` - manual reminder trigger

### BookingsService

**Location**: `services/api/src/bookings/bookings.service.ts` (452 lines)

**Implemented Methods**:

1. `getPublicEvent(slug)` ✅
   - Fetches published event by slug
   - Includes active tables
   - **Issues**: No availability calculation

2. `createBooking(data)` ✅
   - Creates HELD booking
   - Calculates credit total
   - **Issues**: No capacity check, no payment intent creation

3. `confirmBooking(id, depositIntentId)` ✅
   - Transitions HELD → CONFIRMED
   - Creates prepaid credits
   - Generates ticket QR code
   - **Issues**: No PaymentIntent validation

4. `checkIn(ticketCode)` ✅
   - Marks guest as checked in
   - **Issues**: No duplicate check-in prevention

5. `applyCredits(orderId, amount)` ✅
   - Applies prepaid credits to order
   - **Issues**: No GL posting integration

6. `upsertEvent(data)` ✅
   - Creates/updates event with tables
   - **Issues**: No validation of time conflicts

7. `publishEvent(id)` / `unpublishEvent(id)` ✅
   - Toggle published status
   - **Issues**: No booking impact validation

8. `generateTicketPDF(bookingId)` ✅
   - Creates PDF with QR code
   - **Issues**: No email delivery integration

**Missing Methods**:

- ❌ `listEvents(filters)` - list events with availability
- ❌ `cancelEvent(id)` - cancel event, refund all bookings
- ❌ `cancelBooking(id)` - cancel single booking with refund
- ❌ `getEventSummary(id)` - attendance and revenue metrics
- ❌ `checkEventCapacity(eventId)` - verify not oversold

---

## Business Logic Gaps

### 1. Reservation Lifecycle

**Current Flow**:

```
HELD → CONFIRMED → SEATED → CANCELLED
```

**Missing**:

- ❌ NO_SHOW status and handling
- ❌ Auto-cancellation for unpaid HELD reservations
- ❌ Deposit forfeiture logic for late cancellations/no-shows
- ❌ Time window validation (can't seat too early/late)
- ❌ Capacity enforcement at creation and confirmation

**Required Logic**:

```
HELD (auto-cancel after X min if no deposit)
  ↓ confirm() + capture deposit
CONFIRMED
  ↓ seat() within time window
SEATED
  ↓ OR ↓
CANCELLED (before cutoff → refund)
NO_SHOW (after cutoff → forfeit deposit)
```

### 2. Deposit & Payment Handling

**Current**:

- Creates PaymentIntent on reservation creation
- Marks depositStatus as HELD/CAPTURED/REFUNDED
- Creates Refund record on cancellation

**Missing**:

- ❌ **No GL posting integration** (deposits not in accounting system)
- ❌ No deposit forfeiture → revenue recognition for no-shows
- ❌ No deposit application to final bill when seated
- ❌ No webhook handling from payment providers
- ❌ No retry logic for failed payment captures

**Required GL Flow** (ref M8):

```
On Deposit Collected:
  Dr: Cash/Bank
  Cr: Reservation Deposit Liability

On Show + Bill Closed:
  Dr: Reservation Deposit Liability
  Cr: Revenue (reduce bill due)

On No-Show:
  Dr: Reservation Deposit Liability
  Cr: No-Show Fee Revenue

On Early Cancellation:
  Dr: Reservation Deposit Liability
  Cr: Cash/Bank (refund)
```

### 3. Capacity Management

**Current**:

- Basic table overlap check for single reservation
- No branch-level capacity validation
- No party size vs table capacity validation

**Missing**:

- ❌ Real-time capacity calculation (sum of partySize for time slot)
- ❌ Table size matching (partySize 6 → should use 6+ seat table)
- ❌ Floor plan integration (respect table layout)
- ❌ Event capacity tracking (sold tickets vs total capacity)
- ❌ Overbooking protection

**Required**:

```typescript
async checkAvailability(branchId, dateTime, partySize) {
  // 1. Find all CONFIRMED/SEATED reservations in time window
  // 2. Sum their partySizes
  // 3. Compare with branch.totalSeats or available tables
  // 4. Return available/waitlist/unavailable
}
```

### 4. Event Booking Lifecycle

**Current Flow**:

```
HELD → CONFIRMED → (checkedInAt set) → CANCELLED
```

**Missing**:

- ❌ EXPIRED status for unpaid HELD bookings
- ❌ NO_SHOW status for confirmed but not checked-in
- ❌ Automatic expiration of HELD bookings after timeout
- ❌ Capacity enforcement (can oversell event tables)
- ❌ Partial booking support (allowPartial=true not enforced)

**Required Flow**:

```
HELD (expire after 15 min if not confirmed)
  ↓ confirmBooking() + payment
CONFIRMED
  ↓ checkIn() before event ends
CHECKED_IN
  ↓ OR ↓
CANCELLED (refund if before cutoff)
NO_SHOW (no refund)
EXPIRED (auto-transition if HELD timeout)
```

### 5. Multi-Branch & Franchise Views

**Current**:

- ReservationsService.getSummary() provides org-level summary
- No branch breakdown
- No franchise aggregation

**Missing**:

- ❌ Per-branch reservation metrics
- ❌ Franchise-wide booking dashboard
- ❌ Show-up rate tracking
- ❌ Deposit revenue reporting
- ❌ Event attendance analytics

**Required** (ref M6 FranchiseOverviewService pattern):

```typescript
async getFranchiseBookingOverview(franchiseId, period) {
  // Aggregate across all branches in franchise:
  // - Total reservations by status
  // - Show-up rate (SEATED / CONFIRMED)
  // - Deposit revenue collected/forfeited/refunded
  // - Event attendance and ticket sales
  // - Capacity utilization %
}
```

---

## Integration Gaps

### 1. Accounting Integration (M8)

**Status**: ❌ **NOT INTEGRATED**

Deposits are tracked in Reservation/EventBooking models but:

- ❌ No GL journal entries created
- ❌ Liability account not established
- ❌ Revenue recognition not automated

**Required**:

- Create PostingService entries for deposit flows
- Reference M8 patterns for journal entry creation
- Integrate with existing chartOfAccounts

### 2. POS Integration (M11-M13)

**Status**: ⚠️ **PARTIAL**

ReservationsService.seat() can link orderId to tableId, but:

- ❌ No automatic order creation when seating
- ❌ Deposit not applied to order total
- ❌ No validation that order is for correct table
- ❌ Event credits (PrepaidCredit) application is manual

**Required**:

- Auto-create POS order when seating reservation
- Apply deposit to order.payments or reduce order.total
- Link EventBooking credits to order for redemption

### 3. Shifts Integration (M2)

**Status**: ❌ **NOT INTEGRATED**

Reservations have no awareness of shift schedules:

- ❌ Can't prevent reservations outside operating hours
- ❌ No shift-level reservation reporting
- ❌ Staff scheduling doesn't account for reservation load

**Required**:

- Validate reservation time against shift schedule
- Aggregate reservations per shift for staffing insights

### 4. Digests Integration (M4)

**Status**: ❌ **NOT INTEGRATED**

Reservation/booking data not in daily/weekly digests:

- ❌ Owner doesn't see reservation trends
- ❌ No alerts for high no-show rates
- ❌ Deposit revenue not in financial summaries

**Required**:

- Add booking section to OwnerDigestService
- Include: reservations created, seated, no-shows, deposit $

### 5. Notification Integration (B1)

**Status**: ⚠️ **PARTIAL**

ReservationReminder exists but:

- ❌ No actual SMS/email sending implementation
- ❌ No confirmation emails for bookings
- ❌ No cancellation notifications
- ❌ Event reminders not implemented

**Required**:

- Integrate with EmailService (B1)
- Send confirmation/cancellation emails
- Send reminder 24h before reservation
- Send event ticket PDFs via email

---

## Testing Status

### Unit Tests

**Reservations**:

- ❌ No unit tests found for ReservationsService

**Bookings**:

- ✅ `bookings-ticket.spec.ts` exists but minimal coverage

**Coverage Estimate**: < 20%

### E2E Tests

**Found**:

- ✅ `test/e2e/bookings.e2e-spec.ts` (event bookings)
- ⚠️ Coverage is basic (happy path only)

**Missing**:

- ❌ Reservation lifecycle E2E tests
- ❌ Deposit capture/refund/forfeiture flows
- ❌ Capacity validation scenarios
- ❌ Public booking portal E2E tests

---

## Security & Authorization Gaps

### 1. Public Booking Portal

**Status**: ❌ **DOES NOT EXIST**

All endpoints require JWT authentication:

- ❌ Public can't view events
- ❌ Public can't create reservations
- ❌ Public can't book event tickets

**Required**:

- Separate public controller (no JWT guard)
- Rate limiting for abuse prevention
- Input validation & sanitization
- CAPTCHA for high-value events

### 2. RBAC Granularity

**Current**:

- Most operations require L2+ (host/manager)
- No distinction between viewing and mutating

**Improvements Needed**:

- L1 (waiter) should view but not create/cancel
- L4+ required for deposit forfeiture
- L5 (owner) required for event cancellation

### 3. Org/Branch Isolation

**Current**:

- Services validate orgId on most operations
- **Issue**: No branchId validation in some methods

**Required**:

- Enforce branchId checks consistently
- Prevent cross-branch reservation manipulation

---

## Documentation Gaps

### DEV_GUIDE.md

**Status**: ❌ **NO M15 SECTION**

No documentation for:

- Reservation API endpoints
- Booking portal usage
- Event management
- Deposit handling
- State transitions

**Required**: Add comprehensive M15 section with:

- Lifecycle diagrams
- Endpoint reference
- Curl examples
- Deposit flows
- Troubleshooting

### Curl Examples

**Status**: ❌ **NO SCRIPT EXISTS**

No `curl-examples-m15-reservations.sh`

**Required**: Create script with 20+ examples covering:

- Create/confirm/seat/cancel reservation
- Check availability
- Create/publish event
- Book event ticket
- Check-in guest
- View summaries

---

## Migration History

**Relevant Migrations**:

1. `20251027092604_add_reservations` - Initial reservation model
2. `20251027092629_add_reservations` - (duplicate or refinement?)
3. `20251027215516_add_reservation_deposits` - Added deposit fields
4. `20251029123049_bookings_portal` - Event/EventTable models
5. `20251029213732_event_booking_tickets` - EventBooking with ticketCode

**Status**: ✅ All applied successfully (54 total migrations)

**Schema Changes Needed for M15**:

- Add `guestEmail`, `source`, `notes`, `orderId`, `cancelledBy`, `cancelReason` to Reservation
- Add NO_SHOW to ReservationStatus enum
- Change `depositStatus` from String to enum
- Add `status` enum to Event (DRAFT/PUBLISHED/CANCELLED/COMPLETED)
- Add EXPIRED, NO_SHOW, CHECKED_IN to EventBookingStatus
- Add `depositIntentId` foreign key to EventBooking → PaymentIntent
- Add `status`, `appliedToOrderId` to PrepaidCredit
- Add indexes for performance

---

## Conclusion & Priorities for M15

### Critical Gaps (Blockers)

1. ❌ **NO_SHOW lifecycle** - Can't forfeit deposits without this status
2. ❌ **GL integration** - Deposits not in accounting system (compliance risk)
3. ❌ **Public booking API** - No way for guests to self-serve
4. ❌ **Capacity enforcement** - Can double-book tables/events
5. ❌ **Test coverage** - < 20% unit test coverage

### High Priority (Enterprise Features)

6. ❌ Franchise/multi-branch reporting
7. ❌ Comprehensive state validation
8. ❌ Email notifications for confirmations/cancellations
9. ❌ Availability checking API
10. ❌ Event capacity management

### Medium Priority (Polish)

11. ❌ Reservation update endpoint
12. ❌ Manual reminder sending
13. ❌ Event cancellation with bulk refunds
14. ❌ Better error messages and validation
15. ❌ Audit trails for deposit actions

### Low Priority (Future)

16. Advanced seating algorithms (party size matching)
17. Waitlist management
18. Dynamic pricing for events
19. Partial event table bookings
20. Integration with external booking platforms (OpenTable)

---

## Recommended M15 Implementation Order

**Phase 1 - Schema Hardening** (Step 1-2):

1. Add missing fields to models
2. Convert String fields to enums
3. Add NO_SHOW status
4. Create migration (non-interactive)
5. Add indexes for performance

**Phase 2 - Core Lifecycle** (Step 3):

1. Implement noShow() method
2. Add state transition validation
3. Implement capacity checking
4. Create update() method
5. Add availability API

**Phase 3 - Public Booking Portal** (Step 3-4):

1. Create public controller (no auth)
2. Add rate limiting
3. Implement public reservation creation
4. Implement event listing/booking
5. Add CAPTCHA for fraud prevention

**Phase 4 - Accounting Integration** (Step 5):

1. Create posting patterns for deposits
2. Integrate with PostingService (M8)
3. Add GL entries for all deposit flows
4. Create liability accounts in chart

**Phase 5 - Multi-Branch Views** (Step 6):

1. Create FranchiseBookingOverviewService
2. Add per-branch summaries
3. Calculate show-up rates
4. Add to digests (M4)

**Phase 6 - Tests & Documentation** (Step 7-8):

1. Write comprehensive unit tests (80%+ coverage)
2. Create E2E test scenarios
3. Add M15 section to DEV_GUIDE.md
4. Create curl examples script
5. Write completion summary

**Estimated Effort**: 12-16 hours (based on M14 ~8 hours, M15 is larger scope)

---

**Next Step**: Proceed to M15-STEP1-DESIGN.md with detailed state machines and accounting flows.
