# M9.1 Reservations & Bookings Core – Feature Dossier

**Module**: M9.1 – Reservations & Bookings Core  
**Category**: Core  
**Status**: Implementation Ready  
**Date**: 2025-01-15

---

## Executive Summary

M9.1 delivers a production-grade Reservations & Bookings system for restaurant/cafe operations. It enhances the existing reservation infrastructure with:
- Complete lifecycle management (HELD → CONFIRMED → SEATED → COMPLETED | CANCELLED | NO_SHOW)
- Table availability checking with time-slot awareness
- Walk-in and waitlist support
- Multi-branch, multi-floor-plan support
- Full audit trail with status history
- Enterprise RBAC

---

## Pre-Implementation Audit

### Existing Infrastructure ✓

| Component | Status | Details |
|-----------|--------|---------|
| **Prisma Model** | ✓ Exists | `Reservation` with basic fields |
| **ReservationStatus Enum** | ⚠️ Partial | Has: HELD, CONFIRMED, SEATED, CANCELLED. Missing: COMPLETED, NO_SHOW |
| **ReservationReminder** | ✓ Exists | SMS/Email reminder scheduling |
| **Reservations Module** | ✓ Exists | `services/api/src/reservations/` |
| **Waitlist Model** | ✗ Missing | Need to create `WaitlistEntry` |

### Existing Endpoints

| Endpoint | Method | Status | RBAC |
|----------|--------|--------|------|
| `/reservations` | POST | ✓ Exists | L2 |
| `/reservations` | GET | ✓ Exists | L2 |
| `/reservations/:id/confirm` | POST | ✓ Exists | L2 |
| `/reservations/:id/cancel` | POST | ✓ Exists | L2 |
| `/reservations/:id/seat` | POST | ✓ Exists | L2 |
| `/reservations/summary` | GET | ✓ Exists | L3 |
| `/reservations/:id` | GET | ✗ Missing | - |
| `/reservations/:id` | PATCH | ✗ Missing | - |
| `/reservations/:id/complete` | POST | ✗ Missing | - |
| `/reservations/:id/no-show` | POST | ✗ Missing | - |
| `/reservations/:id/assign-tables` | POST | ✗ Missing | - |
| `/reservations/availability` | GET | ✗ Missing | - |
| `/waitlist/*` | ALL | ✗ Missing | - |

### Existing Features

| Feature | Status | Notes |
|---------|--------|-------|
| Table overlap detection | ✓ Exists | On create only |
| Deposit handling | ✓ Exists | HELD/CAPTURED/REFUNDED flow |
| Payment intent integration | ✓ Exists | MOMO provider |
| Reminder scheduling | ✓ Exists | 24h before start |
| Auto-cancel timer | ✓ Exists | Based on orgSettings.reservationHoldMinutes |

---

## Gap Analysis

### Schema Enhancements Required

```prisma
// Add to ReservationStatus enum
enum ReservationStatus {
  HELD       // ✓ Exists
  CONFIRMED  // ✓ Exists
  SEATED     // ✓ Exists
  CANCELLED  // ✓ Exists
  COMPLETED  // ✗ ADD
  NO_SHOW    // ✗ ADD
}

// Add new enum
enum ReservationSource {
  PHONE
  WALK_IN
  ONLINE
  INTERNAL
}

// Add fields to Reservation model
model Reservation {
  // ... existing fields ...
  source            ReservationSource @default(PHONE)  // ✗ ADD
  notes             String?                             // ✗ ADD
  cancellationReason String?                            // ✗ ADD
  seatedAt          DateTime?                           // ✗ ADD
  completedAt       DateTime?                           // ✗ ADD
  createdById       String?                             // ✗ ADD
  updatedById       String?                             // ✗ ADD
  cancelledById     String?                             // ✗ ADD
}

// NEW model
model WaitlistEntry {
  id          String   @id @default(cuid())
  orgId       String
  branchId    String
  name        String
  phone       String?
  partySize   Int
  notes       String?
  quotedWaitMinutes Int?
  status      WaitlistStatus @default(WAITING)
  addedById   String?
  seatedById  String?
  seatedAt    DateTime?
  droppedAt   DateTime?
  droppedReason String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  org    Org    @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
}

enum WaitlistStatus {
  WAITING
  SEATED
  DROPPED
}
```

---

## Acceptance Criteria (≥25 Testable)

### Reservation Lifecycle (AC01-AC10)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC01 | POST /reservations creates reservation with status HELD and all required fields | Integration |
| AC02 | POST /reservations/:id/confirm transitions HELD → CONFIRMED and captures deposit | Integration |
| AC03 | POST /reservations/:id/seat transitions HELD/CONFIRMED → SEATED and sets seatedAt | Integration |
| AC04 | POST /reservations/:id/complete transitions SEATED → COMPLETED and sets completedAt | Integration |
| AC05 | POST /reservations/:id/cancel transitions any non-COMPLETED state → CANCELLED with reason | Integration |
| AC06 | POST /reservations/:id/no-show transitions CONFIRMED → NO_SHOW with reason | Integration |
| AC07 | Invalid state transitions return 409 Conflict | Integration |
| AC08 | GET /reservations/:id returns reservation with all relations (table, branch, reminders) | Integration |
| AC09 | PATCH /reservations/:id updates allowed fields (name, phone, partySize, notes) | Integration |
| AC10 | PATCH /reservations/:id rejects updates to SEATED/COMPLETED/CANCELLED reservations | Integration |

### Availability & Overlap (AC11-AC15)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC11 | GET /reservations/availability returns available tables for given time range | Integration |
| AC12 | GET /reservations/availability excludes tables with HELD/CONFIRMED/SEATED reservations | Integration |
| AC13 | POST /reservations/:id/assign-tables assigns multiple tables and validates capacity | Integration |
| AC14 | Overlapping table reservation create returns 409 Conflict | Integration |
| AC15 | Overlapping table assignment on update returns 409 Conflict | Integration |

### Waitlist (AC16-AC20)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC16 | POST /waitlist creates entry with status WAITING | Integration |
| AC17 | GET /waitlist returns entries filtered by branchId and status | Integration |
| AC18 | POST /waitlist/:id/seat transitions WAITING → SEATED with seatedAt | Integration |
| AC19 | POST /waitlist/:id/drop transitions WAITING → DROPPED with reason | Integration |
| AC20 | Waitlist returns entries ordered by createdAt (FIFO) | Integration |

### RBAC & Multi-Tenancy (AC21-AC25)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC21 | All reservation endpoints require authenticated user with L2+ | Integration |
| AC22 | Summary endpoint requires L3+ (Manager/Owner) | Integration |
| AC23 | Org isolation prevents cross-org data access | Integration |
| AC24 | Branch filter works correctly for multi-branch orgs | Integration |
| AC25 | createdById/updatedById/cancelledById track user actions | Integration |

### UI (AC26-AC30)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC26 | /reservations page lists reservations with filters (date, status, branch) | E2E |
| AC27 | Reservation detail page shows full info and lifecycle actions | E2E |
| AC28 | Lifecycle action buttons update status and reflect changes | E2E |
| AC29 | /waitlist page lists entries with seat/drop actions | E2E |
| AC30 | Availability grid shows table availability for selected time | E2E |

---

## API Endpoints (Full Specification)

### Reservations

| Method | Path | Description | RBAC |
|--------|------|-------------|------|
| POST | /reservations | Create new reservation | L2 |
| GET | /reservations | List reservations with filters | L2 |
| GET | /reservations/:id | Get reservation detail | L2 |
| PATCH | /reservations/:id | Update reservation | L2 |
| POST | /reservations/:id/confirm | Confirm and capture deposit | L2 |
| POST | /reservations/:id/seat | Mark as seated | L2 |
| POST | /reservations/:id/complete | Mark as completed | L2 |
| POST | /reservations/:id/cancel | Cancel with reason | L2 |
| POST | /reservations/:id/no-show | Mark as no-show | L2 |
| POST | /reservations/:id/assign-tables | Assign tables | L2 |
| GET | /reservations/availability | Check table availability | L2 |
| GET | /reservations/summary | Statistics for date range | L3 |

### Waitlist

| Method | Path | Description | RBAC |
|--------|------|-------------|------|
| POST | /waitlist | Add to waitlist | L2 |
| GET | /waitlist | List waitlist entries | L2 |
| GET | /waitlist/:id | Get entry detail | L2 |
| POST | /waitlist/:id/seat | Seat from waitlist | L2 |
| POST | /waitlist/:id/drop | Remove from waitlist | L2 |

---

## UI Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| /reservations | ReservationsPage | List with filters, calendar view toggle |
| /reservations/:id | ReservationDetailPage | Detail with lifecycle actions |
| /reservations/new | CreateReservationPage | New reservation form |
| /waitlist | WaitlistPage | Live waitlist with actions |

---

## Data Model Summary

### Reservation (Enhanced)
- **Core**: id, orgId, branchId, floorPlanId, tableId, name, phone, partySize
- **Time**: startAt, endAt, seatedAt, completedAt
- **Status**: status (enum), source (enum)
- **Deposit**: deposit, depositStatus, paymentIntentId
- **Content**: notes, cancellationReason
- **Audit**: createdById, updatedById, cancelledById, createdAt, updatedAt
- **Relations**: org, branch, floorPlan, table, paymentIntent, reminders, documents, feedback

### WaitlistEntry (New)
- **Core**: id, orgId, branchId, name, phone, partySize, notes
- **Wait**: quotedWaitMinutes, status (enum)
- **Audit**: addedById, seatedById, seatedAt, droppedAt, droppedReason, createdAt, updatedAt
- **Relations**: org, branch

---

## Implementation Order

1. **Schema**: Add enums, fields, WaitlistEntry model
2. **Migration**: Generate and apply Prisma migration
3. **DTOs**: Add UpdateReservationDto, availability DTOs, waitlist DTOs
4. **Service**: Add new methods (findOne, update, complete, noShow, availability)
5. **Controller**: Add new endpoints
6. **Waitlist Module**: Create full module
7. **Seed Data**: Add test reservations and waitlist entries
8. **UI Pages**: Implement all 4 pages
9. **E2E Tests**: Jest API tests + Playwright UI tests
10. **Documentation**: Update curl examples

---

## Dependencies

- **M7 Floor Plans & Tables**: Table model for assignments
- **M15 Existing Reservations**: Base module being enhanced
- **M8 Finance**: Deposit handling via PaymentIntent

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Overlap detection performance | Add composite index on tableId+startAt+endAt |
| Status transition bugs | Comprehensive state machine tests |
| Multi-branch confusion | Strict branchId filtering, UI branch selector |
| Deposit edge cases | Keep existing HELD/CAPTURED/REFUNDED flow |

---

## Parity Targets Checklist

- [x] Reservation model exists
- [x] Basic CRUD operations
- [x] Deposit handling
- [ ] COMPLETED status
- [ ] NO_SHOW status
- [ ] Source tracking (PHONE/WALK_IN/ONLINE)
- [ ] Notes field
- [ ] Cancellation reason
- [ ] Audit fields (createdById, etc.)
- [ ] GET /:id endpoint
- [ ] PATCH /:id endpoint
- [ ] POST /:id/complete endpoint
- [ ] POST /:id/no-show endpoint
- [ ] GET /availability endpoint
- [ ] Waitlist model
- [ ] Waitlist CRUD
- [ ] Reservations UI page
- [ ] Waitlist UI page
- [ ] E2E tests

---

## Sign-off

- [ ] Feature Dossier Complete
- [ ] Schema Migration Applied
- [ ] API Endpoints Implemented
- [ ] UI Pages Complete
- [ ] E2E Tests Pass
- [ ] Parity Re-Audit Complete
- [ ] Committed to Main
