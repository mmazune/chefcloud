# M15 – Reservations & Booking Portal Design Document

**Date**: November 20, 2025  
**Purpose**: Define enterprise-grade reservation lifecycle, state machines, and accounting integration

---

## Table of Contents

1. [Reservation Lifecycle & State Machine](#reservation-lifecycle--state-machine)
2. [Event Booking Lifecycle](#event-booking-lifecycle)
3. [Deposit Behavior & Accounting Integration](#deposit-behavior--accounting-integration)
4. [Capacity Management](#capacity-management)
5. [Public Booking Portal API](#public-booking-portal-api)
6. [Multi-Branch & Franchise Views](#multi-branch--franchise-views)
7. [Integration Points](#integration-points)
8. [Security & Authorization](#security--authorization)

---

## Reservation Lifecycle & State Machine

### States

```prisma
enum ReservationStatus {
  HELD        // Created but not confirmed, awaiting deposit/confirmation
  CONFIRMED   // Deposit captured (if required), allocation locked
  SEATED      // Guest arrived and seated at table
  CANCELLED   // Cancelled by guest or venue
  NO_SHOW     // Guest did not arrive by cutoff time
}
```

### State Diagram

```
                    ┌──────────────────────────────────────┐
                    │         RESERVATION CREATED          │
                    └───────────────┬──────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │     HELD     │◄──────────┐
                            │              │           │
                            │ • Deposit=0: │           │
                            │   Auto-expire│     Auto-cancel
                            │   after X min│     timer if no
                            │ • Deposit>0: │     deposit paid
                            │   Awaiting   │           │
                            │   payment    │           │
                            └──────┬───────┘           │
                                   │                   │
                    ┌──────────────┼──────────────────┐│
                    │              │                  ││
              confirm()      cancel()           timeout│
           (capture deposit)  (refund)                 │
                    │              │                   │
                    ▼              ▼                   │
            ┌──────────────┐  ┌──────────────┐        │
            │  CONFIRMED   │  │  CANCELLED   │        │
            │              │  │              │        │
            │ • Table      │  │ • Deposit    │        │
            │   allocated  │  │   refunded   │        │
            │ • Ready to   │  │   (if before │        │
            │   seat       │  │   cutoff)    │        │
            └──────┬───────┘  └──────────────┘        │
                   │                                   │
         ┌─────────┼────────────┐                     │
         │         │            │                     │
    seat()    cancel()      noShow()                  │
  (guest      (late         (after                    │
   arrives)   cancel)       cutoff)                   │
         │         │            │                     │
         ▼         ▼            ▼                     │
  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
  │  SEATED  │ │CANCELLED │ │ NO_SHOW  │             │
  │          │ │          │ │          │             │
  │ • Linked │ │ • Partial│ │ • Deposit│             │
  │   to POS │ │   or no  │ │   forfeit│             │
  │   order  │ │   refund │ │ • Revenue│             │
  │ • Deposit│ │ • Forfeit│ │   recogn-│             │
  │   applied│ │   deposit│ │   ized   │             │
  └──────────┘ └──────────┘ └──────────┘             │
                                                       │
                    Auto-transitions:                  │
                    • HELD → CANCELLED (if timeout)────┘
                    • CONFIRMED → NO_SHOW (if past cutoff + grace period)
```

### State Transition Rules

#### 1. Create Reservation → HELD

**Preconditions**:

- Valid branch, date/time, partySize
- No overlapping reservation for same table (if tableId specified)
- Capacity available for time slot (if enforced)

**Actions**:

- Create Reservation record with status = HELD
- If deposit > 0:
  - Create PaymentIntent with status = PENDING
  - Set depositStatus = HELD
  - Set autoCancelAt = now + reservationHoldMinutes (from org settings)
- If deposit = 0:
  - Set depositStatus = NONE
  - Set autoCancelAt = now + freeReservationHoldMinutes
- Schedule reminder if startAt > 24h away

**Output**:

- Reservation ID
- PaymentIntent ID (if deposit required)
- autoCancelAt timestamp

**Who**: Public API (no auth) or L2+ staff

---

#### 2. HELD → CONFIRMED (confirm)

**Preconditions**:

- Current status = HELD
- If depositStatus = HELD: payment must be captured
- Capacity still available (revalidate)
- Not past autoCancelAt

**Actions**:

- Update status = CONFIRMED
- If depositStatus = HELD:
  - Capture payment via payment provider
  - Update depositStatus = CAPTURED
  - Post GL entry (Dr: Cash, Cr: Deposit Liability)
- Clear autoCancelAt
- Send confirmation email/SMS
- Allocate table (if not already assigned)

**Output**:

- Updated reservation with status = CONFIRMED
- Confirmation code

**Who**: L2+ staff or auto-trigger on payment success

---

#### 3. CONFIRMED → SEATED (seat)

**Preconditions**:

- Current status = HELD or CONFIRMED
- Within time window (startAt - 30min to endAt + 30min)
- Table available (if tableId specified)

**Actions**:

- Update status = SEATED
- Link to POS order (create or link existing)
- If deposit > 0 and depositStatus = CAPTURED:
  - Apply deposit to order as prepayment
  - Post GL entry (Dr: Deposit Liability, Cr: AR or Revenue offset)
- Update table.status = OCCUPIED (if applicable)
- Record seatedAt timestamp

**Output**:

- Updated reservation with status = SEATED
- Linked orderId

**Who**: L2+ staff (host/waiter)

---

#### 4. HELD → CANCELLED (cancel, early)

**Preconditions**:

- Current status = HELD
- Cancellation before autoCancelAt timeout

**Actions**:

- Update status = CANCELLED
- Set cancelledAt, cancelledBy, cancelReason
- If depositStatus = HELD:
  - Cancel PaymentIntent
  - Update depositStatus = REFUNDED
  - Post GL entry (reverse original: Dr: Deposit Liability, Cr: Cash)
- Send cancellation confirmation

**Output**:

- Updated reservation with status = CANCELLED
- Refund confirmation (if applicable)

**Who**: Guest (public API) or L2+ staff

---

#### 5. CONFIRMED → CANCELLED (cancel, late)

**Preconditions**:

- Current status = CONFIRMED
- Cancellation within cutoff period (e.g., < 24h before startAt)

**Actions**:

- Update status = CANCELLED
- Set cancelledAt, cancelledBy, cancelReason
- Check cancellation policy:
  - **Before cutoff**: Full refund
    - Update depositStatus = REFUNDED
    - Post GL entry (Dr: Deposit Liability, Cr: Cash)
  - **After cutoff**: Forfeit deposit (partial or full)
    - Update depositStatus = FORFEITED
    - Post GL entry (Dr: Deposit Liability, Cr: Cancellation Fee Revenue)
- Send cancellation notification with refund details

**Output**:

- Updated reservation with status = CANCELLED
- Refund amount (may be 0 if after cutoff)

**Who**: L3+ staff (requires approval for late cancellation)

---

#### 6. CONFIRMED → NO_SHOW (noShow)

**Preconditions**:

- Current status = CONFIRMED
- Current time > startAt + noShowGracePeriod (e.g., 15 minutes)
- Not already SEATED

**Actions**:

- Update status = NO_SHOW
- Set noShowAt timestamp
- Forfeit deposit:
  - Update depositStatus = FORFEITED
  - Post GL entry (Dr: Deposit Liability, Cr: No-Show Revenue)
- Release table allocation
- Send notification to guest (optional)
- Update guest history (no-show count for future reservations)

**Output**:

- Updated reservation with status = NO_SHOW
- Deposit forfeited amount

**Who**: L2+ staff or automated job (cron)

---

#### 7. HELD → CANCELLED (auto-timeout)

**Preconditions**:

- Current status = HELD
- Current time > autoCancelAt
- depositStatus != CAPTURED

**Actions** (automated job):

- Update status = CANCELLED
- Set cancelReason = 'auto_timeout'
- If PaymentIntent exists:
  - Update PaymentIntent.status = CANCELLED
- Release capacity

**Output**:

- Updated reservation with status = CANCELLED

**Who**: Automated background job (every 1 minute)

---

### New Fields Required

Add to `Reservation` model:

```prisma
model Reservation {
  // ... existing fields ...

  guestEmail      String?           // Email for confirmation
  source          ReservationSource @default(PHONE) // WEB, PHONE, WALK_IN
  notes           String?           // Special requests
  orderId         String?           // Link to POS order when seated
  cancelledBy     String?           // User ID who cancelled
  cancelReason    String?           // GUEST_REQUEST, VENUE_CAPACITY, AUTO_TIMEOUT, etc.
  noShowAt        DateTime?         // Timestamp when marked no-show
  seatedAt        DateTime?         // Timestamp when seated

  order           Order?            @relation(fields: [orderId], references: [id])
}

enum ReservationSource {
  WEB         // booking.chefcloud.com
  PHONE       // Phone call
  WALK_IN     // Guest walked in
  APP         // Mobile app
  THIRD_PARTY // OpenTable, etc.
}
```

Change `depositStatus` from String to enum:

```prisma
enum DepositStatus {
  NONE      // No deposit required
  HELD      // Payment authorized but not captured
  CAPTURED  // Payment captured, funds held
  REFUNDED  // Full refund issued
  FORFEITED // Deposit kept as no-show/cancellation fee
}
```

---

## Event Booking Lifecycle

### States

```prisma
enum EventBookingStatus {
  HELD        // Initial state, awaiting payment
  CONFIRMED   // Payment successful, ticket issued
  CHECKED_IN  // Guest checked in at event
  CANCELLED   // Booking cancelled
  NO_SHOW     // Confirmed but didn't check in
  EXPIRED     // HELD booking expired without payment
}
```

### State Diagram

```
                    ┌──────────────────────────────────────┐
                    │      EVENT BOOKING CREATED           │
                    └───────────────┬──────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │     HELD     │
                            │              │
                            │ • Awaiting   │──────────┐
                            │   payment    │          │
                            │ • 15min      │     Auto-expire
                            │   timeout    │     after 15min
                            └──────┬───────┘          │
                                   │                  │
                    ┌──────────────┼─────────────┐    │
                    │              │             │    │
            confirmBooking()  cancel()      timeout  │
         (payment success)   (refund)               │    │
                    │              │             │    │
                    ▼              ▼             ▼    │
            ┌──────────────┐  ┌──────────┐  ┌──────────┐
            │  CONFIRMED   │  │CANCELLED │  │ EXPIRED  │◄─┘
            │              │  │          │  │          │
            │ • Ticket     │  │ • Full   │  │ • Payment│
            │   code gen.  │  │   refund │  │   never  │
            │ • QR code    │  │          │  │   captured│
            │ • Email sent │  └──────────┘  └──────────┘
            └──────┬───────┘
                   │
         ┌─────────┼────────────┐
         │         │            │
    checkIn()  cancel()      Auto-transition
  (at event)  (before       (after event ends
               event)         + grace period)
         │         │            │
         ▼         ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │CHECKED_IN│ │CANCELLED │ │ NO_SHOW  │
  │          │ │          │ │          │
  │ • Entry  │ │ • Partial│ │ • No     │
  │   logged │ │   refund │ │   refund │
  │ • Credits│ │   (based │ │ • Credit │
  │   active │ │   on     │ │   expires│
  │          │ │   policy)│ │          │
  └──────────┘ └──────────┘ └──────────┘
```

### Event Status

Add to `Event` model:

```prisma
enum EventStatus {
  DRAFT       // Being created, not visible
  PUBLISHED   // Live and accepting bookings
  SOLD_OUT    // All capacity booked
  CANCELLED   // Event cancelled (refund all)
  COMPLETED   // Event finished
}

model Event {
  // ... existing fields ...

  status          EventStatus @default(DRAFT)
  capacity        Int?        // Total event capacity (optional)
  bookingDeadline DateTime?   // Last time to book
  createdByUserId String?
  cancelledAt     DateTime?
  cancelReason    String?

  createdBy       User?       @relation(fields: [createdByUserId], references: [id])
}
```

### Event Booking Transitions

#### 1. Create Booking → HELD

**Preconditions**:

- Event is PUBLISHED
- EventTable is active
- Capacity available (bookings < table.capacity or event.capacity)

**Actions**:

- Create EventBooking with status = HELD
- Calculate creditTotal based on pricing
- Set expiration = now + 15 minutes
- Create PaymentIntent for deposit

**Output**:

- Booking ID
- PaymentIntent ID
- Expiration time

---

#### 2. HELD → CONFIRMED (confirmBooking)

**Preconditions**:

- Current status = HELD
- Payment successfully captured
- Not expired

**Actions**:

- Update status = CONFIRMED
- Set depositCaptured = true
- Generate unique ticketCode (ULID)
- Create PrepaidCredit records
- Post GL entry (Dr: Cash, Cr: Deposit Liability)
- Generate PDF ticket with QR code
- Send confirmation email with PDF

**Output**:

- Ticket code
- QR code
- PDF download link

---

#### 3. CONFIRMED → CHECKED_IN (checkIn)

**Preconditions**:

- Current status = CONFIRMED
- ticketCode matches
- Event has started (after startsAt - 30min)
- Not already checked in

**Actions**:

- Update status = CHECKED_IN
- Set checkedInAt = now
- Set checkedInById = staff user ID
- Activate prepaid credits for use

**Output**:

- Booking details
- Available credits

---

#### 4. Cancel Booking

**Before Event**:

- HELD/CONFIRMED → CANCELLED
- Full refund if > 48h before event
- Partial refund if < 48h (policy dependent)
- Post GL reversal or partial

**After Event**:

- Not allowed (event completed)

---

## Deposit Behavior & Accounting Integration

### Deposit Policies

**When is deposit required?**

```typescript
interface DepositPolicy {
  minPartySize?: number; // Require deposit if partySize >= X
  minAdvanceHours?: number; // Require deposit if booking > X hours ahead
  peakTimes?: TimeRange[]; // Require deposit for peak periods
  specialEvents?: boolean; // Always require for special events
  amount: 'FIXED' | 'PER_PERSON' | 'PERCENTAGE';
  value: number; // Amount in currency or %
}
```

**Example Policies**:

- Parties of 8+: $50 deposit
- Weekend evenings (Fri-Sun, 6pm-10pm): $20/person
- Special events: Full prepayment
- Advance bookings (>7 days): $25 deposit

### GL Posting Patterns (Reference M8)

#### Scenario 1: Deposit Collected

**When**: Reservation confirmed or event booking paid

```typescript
// Dr: Cash / Bank Account
// Cr: Reservation Deposit Liability (2200)

await postingService.post({
  orgId,
  branchId,
  date: new Date(),
  entries: [
    {
      accountCode: '1010', // Cash/Bank
      debit: depositAmount,
      credit: 0,
      description: `Deposit for reservation ${reservationId}`,
    },
    {
      accountCode: '2200', // Reservation Deposit Liability
      debit: 0,
      credit: depositAmount,
      description: `Deposit liability for reservation ${reservationId}`,
    },
  ],
  reference: `RESERVATION-DEPOSIT-${reservationId}`,
  metadata: {
    reservationId,
    depositType: 'reservation',
  },
});
```

---

#### Scenario 2: Guest Shows Up & Pays Bill

**When**: Reservation seated and order closed

```typescript
// Apply deposit to final bill:
// Dr: Reservation Deposit Liability (2200)
// Cr: Revenue (4000) or reduce AR

const depositToApply = reservation.deposit;
const orderTotal = order.total;
const amountDue = orderTotal - depositToApply;

// First: Recognize deposit as revenue
await postingService.post({
  orgId,
  branchId,
  date: new Date(),
  entries: [
    {
      accountCode: '2200', // Deposit Liability
      debit: depositToApply,
      credit: 0,
      description: `Apply deposit to order ${orderId}`,
    },
    {
      accountCode: '4000', // Revenue
      debit: 0,
      credit: depositToApply,
      description: `Revenue from applied deposit`,
    },
  ],
  reference: `DEPOSIT-APPLY-${reservationId}`,
  metadata: {
    reservationId,
    orderId,
  },
});

// Then: Record remaining payment normally (existing M12 logic)
// Dr: Cash, Cr: Revenue for amountDue
```

---

#### Scenario 3: No-Show (Forfeit Deposit)

**When**: Guest doesn't arrive, deposit forfeited

```typescript
// Dr: Reservation Deposit Liability (2200)
// Cr: No-Show Fee Revenue (4900)

await postingService.post({
  orgId,
  branchId,
  date: new Date(),
  entries: [
    {
      accountCode: '2200', // Deposit Liability
      debit: depositAmount,
      credit: 0,
      description: `Forfeit deposit for no-show ${reservationId}`,
    },
    {
      accountCode: '4900', // No-Show Revenue / Other Income
      debit: 0,
      credit: depositAmount,
      description: `No-show fee revenue ${reservationId}`,
    },
  ],
  reference: `NO-SHOW-${reservationId}`,
  metadata: {
    reservationId,
    reason: 'no_show',
  },
});
```

---

#### Scenario 4: Cancellation (Full Refund)

**When**: Guest cancels before cutoff, entitled to full refund

```typescript
// Reverse original entry:
// Dr: Reservation Deposit Liability (2200)
// Cr: Cash / Bank (1010)

await postingService.post({
  orgId,
  branchId,
  date: new Date(),
  entries: [
    {
      accountCode: '2200', // Deposit Liability
      debit: depositAmount,
      credit: 0,
      description: `Refund deposit for cancelled reservation ${reservationId}`,
    },
    {
      accountCode: '1010', // Cash/Bank
      debit: 0,
      credit: depositAmount,
      description: `Deposit refund issued`,
    },
  ],
  reference: `REFUND-${reservationId}`,
  metadata: {
    reservationId,
    refundReason: 'early_cancellation',
  },
});
```

---

#### Scenario 5: Late Cancellation (Partial Forfeit)

**When**: Guest cancels after cutoff, policy says 50% forfeit

```typescript
const forfeitAmount = depositAmount * 0.5;
const refundAmount = depositAmount * 0.5;

// Split the deposit:
// 1. Forfeit portion → Revenue
// 2. Refund portion → Cash

await postingService.post({
  orgId,
  branchId,
  date: new Date(),
  entries: [
    {
      accountCode: '2200', // Deposit Liability
      debit: depositAmount,
      credit: 0,
      description: `Settle deposit for late cancellation ${reservationId}`,
    },
    {
      accountCode: '4900', // Cancellation Fee Revenue
      debit: 0,
      credit: forfeitAmount,
      description: `Cancellation fee (50%)`,
    },
    {
      accountCode: '1010', // Cash/Bank
      debit: 0,
      credit: refundAmount,
      description: `Partial refund (50%)`,
    },
  ],
  reference: `LATE-CANCEL-${reservationId}`,
  metadata: {
    reservationId,
    forfeitPercent: 50,
  },
});
```

---

### Chart of Accounts Update

Add to default chart (if not exists):

```typescript
{
  code: '2200',
  name: 'Reservation Deposit Liability',
  type: 'LIABILITY',
  category: 'CURRENT_LIABILITIES',
  description: 'Deposits collected from guests for reservations and events',
},
{
  code: '4900',
  name: 'Other Income',
  type: 'REVENUE',
  category: 'OTHER_REVENUE',
  subaccounts: [
    {
      code: '4901',
      name: 'No-Show Fees',
      description: 'Revenue from forfeited reservation deposits',
    },
    {
      code: '4902',
      name: 'Cancellation Fees',
      description: 'Revenue from late cancellation penalties',
    },
  ],
},
```

---

## Capacity Management

### Capacity Types

1. **Table Capacity**: Physical seats at a table
2. **Branch Capacity**: Total seats across all tables
3. **Time-Slot Capacity**: Max concurrent reservations for a time window
4. **Event Capacity**: Total tickets available for an event

### Availability Check Algorithm

```typescript
async function checkAvailability(params: {
  branchId: string;
  dateTime: Date;
  duration: number; // minutes
  partySize: number;
}): Promise<AvailabilityResult> {
  const { branchId, dateTime, duration, partySize } = params;

  // 1. Get branch total capacity
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { totalSeats: true },
  });

  // 2. Find all active reservations in overlapping time window
  const startWindow = new Date(dateTime.getTime() - duration * 60 * 1000);
  const endWindow = new Date(dateTime.getTime() + duration * 60 * 1000);

  const overlappingReservations = await prisma.reservation.findMany({
    where: {
      branchId,
      status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
      OR: [
        { startAt: { gte: startWindow, lt: endWindow } },
        { endAt: { gt: startWindow, lte: endWindow } },
        {
          AND: [{ startAt: { lte: startWindow } }, { endAt: { gte: endWindow } }],
        },
      ],
    },
    select: { partySize: true },
  });

  // 3. Calculate occupied seats
  const occupiedSeats = overlappingReservations.reduce((sum, res) => sum + res.partySize, 0);

  // 4. Calculate available seats
  const availableSeats = (branch.totalSeats || 0) - occupiedSeats;

  // 5. Check if party can be accommodated
  if (availableSeats >= partySize) {
    return {
      available: true,
      availableSeats,
      occupiedSeats,
      totalSeats: branch.totalSeats,
    };
  } else {
    // 6. Suggest alternative times
    const alternatives = await findAlternativeTimes({
      branchId,
      dateTime,
      partySize,
      searchRange: 2, // hours before/after
    });

    return {
      available: false,
      availableSeats,
      occupiedSeats,
      totalSeats: branch.totalSeats,
      alternatives,
    };
  }
}
```

### Table Assignment Algorithm

```typescript
async function assignBestTable(params: {
  branchId: string;
  partySize: number;
  startAt: Date;
  endAt: Date;
}): Promise<Table | null> {
  // 1. Find available tables (not reserved in time window)
  const availableTables = await prisma.table.findMany({
    where: {
      branchId: params.branchId,
      isActive: true,
      // Not reserved in overlapping window
      reservations: {
        none: {
          status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
          OR: [
            { startAt: { gte: params.startAt, lt: params.endAt } },
            { endAt: { gt: params.startAt, lte: params.endAt } },
            {
              AND: [{ startAt: { lte: params.startAt } }, { endAt: { gte: params.endAt } }],
            },
          ],
        },
      },
    },
    orderBy: { seats: 'asc' }, // Prefer smallest suitable table
  });

  // 2. Find best fit (smallest table >= partySize)
  const bestFit = availableTables.find((table) => table.seats >= params.partySize);

  if (bestFit) return bestFit;

  // 3. If no exact fit, find largest table (for partial seating)
  const largest = availableTables[availableTables.length - 1];
  return largest || null;
}
```

---

## Public Booking Portal API

### New Controller: `PublicBookingController`

**No JWT authentication required**  
**Rate limiting applied** (100 req/min per IP)

```typescript
@Controller('public')
export class PublicBookingController {
  /**
   * GET /public/availability
   * Check table availability for given date/time
   */
  @Get('availability')
  @UseGuards(RateLimitGuard)
  async checkAvailability(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Query('time') time: string,
    @Query('partySize') partySize: number,
  ) {
    return this.reservationsService.checkAvailability({
      branchId,
      dateTime: new Date(`${date}T${time}`),
      partySize: Number(partySize),
      duration: 120, // 2 hour default
    });
  }

  /**
   * POST /public/reservations
   * Create reservation request (HELD status)
   */
  @Post('reservations')
  @UseGuards(RateLimitGuard)
  async createReservation(@Body() dto: CreatePublicReservationDto) {
    return this.reservationsService.createPublic(dto);
  }

  /**
   * GET /public/events
   * List published events
   */
  @Get('events')
  async listPublishedEvents(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.listPublishedEvents({
      branchId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * GET /public/events/:slug
   * Get event details with availability
   */
  @Get('events/:slug')
  async getPublicEvent(@Param('slug') slug: string) {
    return this.bookingsService.getPublicEventWithAvailability(slug);
  }

  /**
   * POST /public/events/:slug/book
   * Create event booking
   */
  @Post('events/:slug/book')
  @UseGuards(RateLimitGuard, RecaptchaGuard)
  async bookEvent(@Param('slug') slug: string, @Body() dto: CreateEventBookingDto) {
    return this.bookingsService.createPublicBooking(slug, dto);
  }
}
```

### Rate Limiting Strategy

```typescript
// Per-IP limits for public endpoints
const rateLimits = {
  '/public/availability': { window: 60, max: 30 }, // 30/min
  '/public/reservations': { window: 60, max: 5 }, // 5/min
  '/public/events': { window: 60, max: 60 }, // 60/min
  '/public/events/:slug/book': { window: 60, max: 3 }, // 3/min
};
```

### CAPTCHA Integration

Add reCAPTCHA verification for high-value operations:

- Creating reservations with deposits
- Booking event tickets
- Bulk operations

```typescript
@Injectable()
export class RecaptchaGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.body.recaptchaToken;

    if (!token) {
      throw new BadRequestException('CAPTCHA token required');
    }

    const verified = await this.recaptchaService.verify(token);

    if (!verified) {
      throw new UnauthorizedException('CAPTCHA verification failed');
    }

    return true;
  }
}
```

---

## Multi-Branch & Franchise Views

### Branch Booking Summary

```typescript
interface BranchBookingSummary {
  branchId: string;
  branchName: string;
  period: { from: Date; to: Date };

  reservations: {
    total: number;
    byStatus: Record<ReservationStatus, number>;
    showUpRate: number; // SEATED / CONFIRMED %
    noShowRate: number;
    avgPartySize: number;
    capacityUtilization: number; // % of available seats used
  };

  deposits: {
    collected: number;
    applied: number;
    forfeited: number;
    refunded: number;
  };

  events: {
    total: number;
    ticketsSold: number;
    ticketsUsed: number;
    revenue: number;
  };
}
```

### Franchise Booking Overview Service

```typescript
@Injectable()
export class FranchiseBookingOverviewService {
  async getFranchiseBookingOverview(params: {
    franchiseId: string;
    period: { from: Date; to: Date };
  }): Promise<FranchiseBookingOverview> {
    // 1. Get all branches in franchise
    const branches = await this.prisma.branch.findMany({
      where: { franchise: { id: params.franchiseId } },
      select: { id: true, name: true },
    });

    // 2. Aggregate reservations per branch
    const branchSummaries = await Promise.all(
      branches.map((branch) =>
        this.getBranchBookingSummary({
          branchId: branch.id,
          period: params.period,
        }),
      ),
    );

    // 3. Calculate franchise totals
    return {
      franchiseId: params.franchiseId,
      period: params.period,
      branches: branchSummaries,
      totals: this.aggregateSummaries(branchSummaries),
    };
  }
}
```

### Integration with Digests (M4)

Add to `OwnerDigestService`:

```typescript
// In daily/weekly digest generation:
const bookingSection = await this.generateBookingSection({
  orgId,
  period: digestPeriod,
});

function generateBookingSection(params) {
  return {
    reservations: {
      created: 45,
      seated: 38,
      noShows: 3,
      cancelled: 4,
      showUpRate: 84.4, // 38/45
    },
    deposits: {
      collected: 1250,
      applied: 950,
      forfeited: 150,
      refunded: 150,
    },
    insights: [
      'Show-up rate down 5% vs last week',
      '3 no-shows cost $150 in lost revenue',
      'Peak booking time: Friday 7pm-9pm',
    ],
  };
}
```

---

## Integration Points

### 1. POS Integration (M11-M13)

**Auto-Create Order on Seat**:

```typescript
async function seatReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { table: true },
  });

  // Create POS order
  const order = await posService.createOrder({
    orgId: reservation.orgId,
    branchId: reservation.branchId,
    tableId: reservation.tableId,
    serviceType: 'DINE_IN',
    metadata: {
      reservationId: reservation.id,
      guestName: reservation.name,
      partySize: reservation.partySize,
    },
  });

  // Link reservation to order
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status: 'SEATED',
      orderId: order.id,
      seatedAt: new Date(),
    },
  });

  return order;
}
```

**Apply Deposit to Order**:

```typescript
async function closeOrderWithDeposit(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      reservation: true,
    },
  });

  if (order.reservation && order.reservation.deposit > 0) {
    // Apply deposit as prepayment
    const depositAmount = Number(order.reservation.deposit);
    const remainingDue = Number(order.total) - depositAmount;

    // Post GL entries (see deposit flows above)
    await postingService.applyReservationDeposit({
      reservationId: order.reservation.id,
      orderId: order.id,
      depositAmount,
    });

    // Update order payments
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'PREPAID',
        amount: depositAmount,
        status: 'COMPLETED',
        reference: `DEPOSIT-${order.reservation.id}`,
      },
    });

    // Update reservation
    await prisma.reservation.update({
      where: { id: order.reservation.id },
      data: {
        depositStatus: 'APPLIED',
      },
    });
  }

  // Continue with normal order close logic (M12)
  return posService.closeOrder(orderId);
}
```

### 2. Shifts Integration (M2)

**Validate Reservation Time Against Shifts**:

```typescript
async function validateReservationTime(params: {
  branchId: string;
  dateTime: Date;
}): Promise<{ valid: boolean; reason?: string }> {
  // Find shift covering the reservation time
  const shift = await prisma.shiftSchedule.findFirst({
    where: {
      branchId: params.branchId,
      date: params.dateTime.toISOString().split('T')[0],
      startTime: { lte: params.dateTime },
      endTime: { gte: params.dateTime },
    },
  });

  if (!shift) {
    return {
      valid: false,
      reason: 'No shift scheduled for this time',
    };
  }

  return { valid: true };
}
```

**Shift-Level Reservation Reporting**:

```typescript
async function getShiftReservations(shiftId: string) {
  const shift = await prisma.shiftSchedule.findUnique({
    where: { id: shiftId },
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      branchId: shift.branchId,
      startAt: {
        gte: shift.startTime,
        lte: shift.endTime,
      },
    },
  });

  return {
    shiftId,
    expectedCovers: reservations.reduce((sum, r) => sum + r.partySize, 0),
    actualSeated: reservations.filter((r) => r.status === 'SEATED').length,
    noShows: reservations.filter((r) => r.status === 'NO_SHOW').length,
  };
}
```

### 3. Notifications Integration (B1)

**Confirmation Email**:

```typescript
async function sendReservationConfirmation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { branch: true },
  });

  await emailService.send({
    to: reservation.guestEmail,
    template: 'reservation-confirmation',
    data: {
      guestName: reservation.name,
      branchName: reservation.branch.name,
      dateTime: reservation.startAt,
      partySize: reservation.partySize,
      confirmationCode: reservation.id.slice(0, 8).toUpperCase(),
      depositAmount: reservation.deposit,
    },
  });
}
```

**Reminder (24h Before)**:

```typescript
// Cron job runs hourly
async function sendPendingReminders() {
  const reminderTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const reminders = await prisma.reservationReminder.findMany({
    where: {
      scheduledAt: {
        gte: new Date(reminderTime.getTime() - 60 * 60 * 1000),
        lte: new Date(reminderTime.getTime() + 60 * 60 * 1000),
      },
      sentAt: null,
    },
    include: {
      reservation: {
        include: { branch: true },
      },
    },
  });

  for (const reminder of reminders) {
    if (reminder.channel === 'SMS') {
      await smsService.send({
        to: reminder.target,
        message: `Reminder: Your reservation at ${reminder.reservation.branch.name} tomorrow at ${formatTime(reminder.reservation.startAt)}`,
      });
    } else if (reminder.channel === 'EMAIL') {
      await emailService.send({
        to: reminder.target,
        template: 'reservation-reminder',
        data: { reservation: reminder.reservation },
      });
    }

    await prisma.reservationReminder.update({
      where: { id: reminder.id },
      data: { sentAt: new Date() },
    });
  }
}
```

---

## Security & Authorization

### RBAC Matrix

| Operation                     | Public   | L1 (Waiter)    | L2 (Host) | L3 (Manager) | L4+ (Owner) |
| ----------------------------- | -------- | -------------- | --------- | ------------ | ----------- |
| View availability             | ✅       | ✅             | ✅        | ✅           | ✅          |
| Create reservation (web)      | ✅       | ❌             | ❌        | ❌           | ❌          |
| Create reservation (internal) | ❌       | ❌             | ✅        | ✅           | ✅          |
| List reservations             | ❌       | ✅ (view only) | ✅        | ✅           | ✅          |
| Confirm reservation           | ❌       | ❌             | ✅        | ✅           | ✅          |
| Seat reservation              | ❌       | ✅             | ✅        | ✅           | ✅          |
| Cancel reservation (early)    | ✅ (own) | ❌             | ✅        | ✅           | ✅          |
| Cancel reservation (late)     | ❌       | ❌             | ❌        | ✅           | ✅          |
| Mark no-show                  | ❌       | ❌             | ❌        | ✅           | ✅          |
| View deposit status           | ❌       | ❌             | ✅        | ✅           | ✅          |
| Create event                  | ❌       | ❌             | ❌        | ✅           | ✅          |
| Publish event                 | ❌       | ❌             | ❌        | ✅           | ✅          |
| Cancel event                  | ❌       | ❌             | ❌        | ❌           | ✅          |
| Check-in guest                | ❌       | ✅             | ✅        | ✅           | ✅          |

### Validation & Sanitization

**Public Input Validation**:

```typescript
class CreatePublicReservationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  guestEmail: string;

  @IsPhoneNumber('UG') // Uganda format
  phone: string;

  @IsInt()
  @Min(1)
  @Max(50)
  partySize: number;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsString()
  recaptchaToken: string; // Required for high-value bookings
}
```

### Org/Branch Isolation

```typescript
// Enforce in all service methods
async function getReservation(id: string, orgId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation || reservation.orgId !== orgId) {
    throw new NotFoundException('Reservation not found');
  }

  return reservation;
}

// For franchise users, verify branch belongs to franchise
async function canAccessBranch(userId: string, branchId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      franchise: {
        include: { branches: true },
      },
    },
  });

  if (!user.franchise) return false;

  return user.franchise.branches.some((b) => b.id === branchId);
}
```

---

## Summary

This design document defines:

✅ **Reservation Lifecycle**: 6 states (HELD/CONFIRMED/SEATED/CANCELLED/NO_SHOW) with clear transitions  
✅ **Event Booking Lifecycle**: 6 states with ticket generation and check-in  
✅ **Deposit Flows**: 5 GL posting scenarios integrated with M8 accounting  
✅ **Capacity Management**: Algorithms for availability checking and table assignment  
✅ **Public Booking Portal**: New controller with rate limiting and CAPTCHA  
✅ **Multi-Branch Views**: Franchise-level aggregation and digest integration  
✅ **Integration Points**: POS (M11-M13), Shifts (M2), Accounting (M8), Notifications (B1)  
✅ **Security**: RBAC matrix, validation, org isolation

**Next Step**: Proceed to M15-STEP2 (Schema Changes + Migration) using non-interactive workflow.
