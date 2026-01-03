# M9.2: Reservations Enterprise Ops - Feature Dossier

**Created:** 2026-01-03  
**Baseline Commit:** `aee2154`  
**Status:** ACTIVE

---

## 1. Scope & Objectives

Transform M9.1 reservations into enterprise-grade operations with:
- **Policy Engine:** Per-branch configurable policies (lead times, party sizes, hold expiration)
- **Deposit Management:** Proper accounting integration (liability → revenue flow)
- **Notification Logging:** Audit trail for all communication attempts
- **Calendar/Timeline Views:** Visual reservation management

---

## 2. Reference Analysis

### 2.1 TastyIgniter (MIT - Adapt Allowed)
- **Reservation Policies:** Admin → Locations → Reservation Settings
  - Lead time configuration per location
  - Party size limits (min/max)
  - Slot duration and intervals
  - Auto-confirmation toggles
- **Deposits:** Not natively integrated; typically handled by extension

### 2.2 cal.com (AGPL - Study Only)
- **Availability Patterns:** Booking windows, buffer times, notice periods
- **Cancellation Policies:** Minimum notice configurable per event type
- **Reminder Workflow:** Automated emails/SMS with event hooks

### 2.3 easyappointments (AGPL - Study Only)
- **Booking Lifecycle:** Pending → Confirmed → Completed → Cancelled
- **Notification Events:** Confirmation, reminder, cancellation emails logged
- **Provider Abstraction:** Email/SMS templates decoupled from delivery

### 2.4 Project Patterns (Existing)
- **JournalEntry:** Used for AP/AR, payroll, sales posting
- **PaymentMethodMapping:** Maps payment methods to GL accounts
- **Account codes:** 1000=Cash, 2000=Liabilities, 4000=Revenue, etc.

---

## 3. Data Model Design

### 3.1 New Models

#### ReservationPolicy
```prisma
model ReservationPolicy {
  id                   String   @id @default(cuid())
  orgId                String
  branchId             String   @unique
  leadTimeMinutes      Int      @default(60)     // Min advance booking
  maxPartySize         Int      @default(20)     // Max guests per reservation
  holdExpiresMinutes   Int      @default(30)     // HELD status expires after
  cancelCutoffMinutes  Int      @default(120)    // No-refund cutoff before start
  depositRequired      Boolean  @default(false)  // Require deposit?
  depositAmountDefault Decimal  @default(0)      // Default deposit amount
  depositPerGuest      Decimal  @default(0)      // OR per-guest deposit
  noShowFeeEnabled     Boolean  @default(false)  // Charge no-show fee?
  noShowFeeAmount      Decimal  @default(0)      // Fee amount (log-only in M9.2)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  branch Branch @relation(...)
}
```

#### ReservationDeposit
```prisma
model ReservationDeposit {
  id                String        @id @default(cuid())
  orgId             String
  reservationId     String
  amount            Decimal       @db.Decimal(10, 2)
  status            DepositStatus @default(REQUIRED)
  paymentMethod     PaymentMethod?
  journalEntryId    String?       // GL link for PAID/REFUNDED/APPLIED
  refundJournalId   String?       // Reversal entry on refund
  applyJournalId    String?       // Revenue recognition entry
  paidAt            DateTime?
  refundedAt        DateTime?
  appliedAt         DateTime?
  refundReason      String?
  createdById       String?
  paidById          String?
  refundedById      String?
  appliedById       String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  reservation  Reservation   @relation(...)
  journalEntry JournalEntry? @relation(...)
}

enum DepositStatus {
  REQUIRED   // Deposit requested but not paid
  PAID       // Deposit captured (posted to liability)
  REFUNDED   // Deposit refunded (reversal posted)
  APPLIED    // Deposit applied to bill (liability → revenue)
  FORFEITED  // No-show deposit kept
}
```

#### NotificationLog
```prisma
model NotificationLog {
  id            String             @id @default(cuid())
  orgId         String
  branchId      String?
  reservationId String?
  waitlistId    String?
  type          NotificationType
  event         NotificationEvent
  toAddress     String?            // Email or phone
  payloadJson   Json?              // Message content/template data
  status        NotificationStatus @default(QUEUED)
  sentAt        DateTime?
  failedReason  String?
  createdAt     DateTime           @default(now())

  reservation Reservation? @relation(...)
  waitlist    WaitlistEntry? @relation(...)
}

enum NotificationType {
  EMAIL
  SMS
  IN_APP
}

enum NotificationEvent {
  CONFIRMED
  CANCELLED
  NO_SHOW
  DEPOSIT_PAID
  DEPOSIT_REFUNDED
  DEPOSIT_APPLIED
  REMINDER
  WAITLIST_READY
}

enum NotificationStatus {
  QUEUED
  SENT
  FAILED
}
```

---

## 4. API Endpoints

### 4.1 Policy Management
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/reservations/policies?branchId=` | Get branch policy | L2+ |
| PUT | `/reservations/policies?branchId=` | Upsert policy | L3+ |

### 4.2 Deposit Operations
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/reservations/:id/deposit/require` | Create REQUIRED deposit | L2+ |
| POST | `/reservations/:id/deposit/pay` | Record deposit payment, post GL | L2+ |
| POST | `/reservations/:id/deposit/refund` | Refund deposit, reversal GL | L2+ |
| POST | `/reservations/:id/deposit/apply` | Apply to bill, recognize revenue | L2+ |
| GET | `/reservations/:id/deposit` | Get deposit status | L1+ |

### 4.3 Notifications
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/notifications/reservations?branchId=&from=&to=` | Audit notification logs | L2+ |

### 4.4 Calendar/Timeline
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/reservations/calendar?branchId=&date=` | Day timeline view data | L1+ |

---

## 5. Accounting Semantics

### 5.1 Deposit Paid (Liability)
```
Dr Cash/Bank           [deposit amount]
  Cr Deposits Held     [deposit amount]
```
- **Source:** `RESERVATION_DEPOSIT`
- **SourceId:** `{depositId}`

### 5.2 Deposit Refunded (Reversal)
```
Dr Deposits Held       [deposit amount]
  Cr Cash/Bank         [deposit amount]
```
- Links to original entry via `reversesEntryId`

### 5.3 Deposit Applied (Revenue Recognition)
```
Dr Deposits Held       [deposit amount]
  Cr Revenue           [deposit amount]
```
- When reservation completes and deposit applied to final bill

### 5.4 Required GL Accounts
- **Account Code 2100:** Deposits Held (LIABILITY)
- **Account Code 1000:** Cash (ASSET) - existing
- **Account Code 4000:** Sales Revenue (REVENUE) - existing

---

## 6. Acceptance Criteria (30 Total)

### Policy Engine (AC1-AC8)
| ID | Criterion | Test Coverage |
|----|-----------|---------------|
| AC1 | ReservationPolicy model created with all fields | Schema migration |
| AC2 | GET /policies returns 404 if none, 200 with data if exists | E2E |
| AC3 | PUT /policies creates new policy if none exists | E2E |
| AC4 | PUT /policies updates existing policy | E2E |
| AC5 | Policy enforced on create: leadTimeMinutes validation | E2E |
| AC6 | Policy enforced on create: maxPartySize validation | E2E |
| AC7 | Hold expiration respects policy holdExpiresMinutes | E2E |
| AC8 | Cancel cutoff respects policy cancelCutoffMinutes | E2E |

### Deposit Management (AC9-AC18)
| ID | Criterion | Test Coverage |
|----|-----------|---------------|
| AC9 | ReservationDeposit model created with all fields | Schema migration |
| AC10 | POST /deposit/require creates deposit with REQUIRED status | E2E |
| AC11 | POST /deposit/pay transitions to PAID, creates journal entry | E2E |
| AC12 | Deposit pay journal: Dr Cash, Cr Deposits Held | E2E |
| AC13 | POST /deposit/refund transitions to REFUNDED, creates reversal | E2E |
| AC14 | Refund journal: Dr Deposits Held, Cr Cash | E2E |
| AC15 | POST /deposit/apply transitions to APPLIED, creates revenue entry | E2E |
| AC16 | Apply journal: Dr Deposits Held, Cr Revenue | E2E |
| AC17 | Cannot pay already-paid deposit (idempotency) | E2E |
| AC18 | Cannot refund already-refunded deposit (idempotency) | E2E |

### Notification Logging (AC19-AC24)
| ID | Criterion | Test Coverage |
|----|-----------|---------------|
| AC19 | NotificationLog model created with all fields | Schema migration |
| AC20 | Confirm creates NotificationLog with event=CONFIRMED | E2E |
| AC21 | Cancel creates NotificationLog with event=CANCELLED | E2E |
| AC22 | No-show creates NotificationLog with event=NO_SHOW | E2E |
| AC23 | Deposit pay creates NotificationLog with event=DEPOSIT_PAID | E2E |
| AC24 | GET /notifications/reservations returns filtered logs | E2E |

### Calendar/Timeline (AC25-AC27)
| ID | Criterion | Test Coverage |
|----|-----------|---------------|
| AC25 | GET /reservations/calendar returns day timeline data | E2E |
| AC26 | Calendar groups by time slots (hour blocks) | E2E |
| AC27 | Calendar filters by branchId | E2E |

### RBAC & Validation (AC28-AC30)
| ID | Criterion | Test Coverage |
|----|-----------|---------------|
| AC28 | Policy PUT requires L3+ (MANAGER/OWNER) | E2E |
| AC29 | Deposit operations require L2+ (CASHIER blocked) | E2E |
| AC30 | Input validation on all DTOs | Unit tests |

---

## 7. Data Invariants

Per `DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md`:

1. **Deposit status transitions are one-way:**
   - REQUIRED → PAID → (REFUNDED | APPLIED | FORFEITED)
   - Cannot go backwards

2. **Journal entries are immutable once posted:**
   - Corrections via reversal entries only

3. **Notification logs are append-only:**
   - Status can update (QUEUED → SENT/FAILED), content is immutable

4. **Policy is 1:1 with Branch:**
   - branchId is unique on ReservationPolicy

5. **All financial amounts use Decimal(10,2)**

---

## 8. UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Policies | `/reservations/policies` | Per-branch policy editor |
| Reservation Detail | `/reservations/[id]` | Deposit panel with actions |
| Notifications | `/reservations/notifications` | Audit log viewer |
| Calendar | `/reservations/calendar` | Day timeline with slots |

---

## 9. Seed Data Requirements

### DEMO_TAPAS
- 1 ReservationPolicy for main branch
- 6+ reservations with deposits (mix of REQUIRED/PAID/APPLIED/REFUNDED)
- 10+ NotificationLog entries across events

### CAFESSERIE_FRANCHISE
- 1 ReservationPolicy per branch (4 total)
- 12+ deposit-related reservations distributed across branches

---

## 10. Risk & Assumptions

| Risk | Mitigation |
|------|------------|
| No-show fee charging is complex | LOG ONLY in M9.2; actual charging deferred |
| Real SMS/email integration | Provider abstraction logs only; no actual sending |
| GL account setup varies | Create Deposits Held account in seed if missing |

---

## 11. Definition of Done Checklist

- [ ] All 30 ACs passing
- [ ] API lint: 0 errors
- [ ] API build: SUCCESS
- [ ] Web lint: 0 errors
- [ ] Web build: SUCCESS
- [ ] E2E tests: ≥20 new tests passing
- [ ] Prisma migrate: SUCCESS
- [ ] Seed verifier: All policies and deposits seeded
- [ ] Parity re-audit: MEETS or EXCEEDS
- [ ] Commit to main with clean tree
