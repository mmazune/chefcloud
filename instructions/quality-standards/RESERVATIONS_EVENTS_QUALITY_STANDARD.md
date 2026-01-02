# Reservations & Events Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Table Reservations, Waitlist, Events, Floor Plans  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Table reservation booking (online and walk-in)
- Waitlist management
- Table status tracking (available, occupied, reserved)
- Floor plan management
- Party size and seating optimization
- Booking confirmation and reminders
- Event booking (private events, large parties)
- Availability calendar
- No-show tracking

### Out of Scope
- External booking platform integrations (OpenTable, Resy)
- Deposit/prepayment processing
- Event catering management (see separate module)

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| RES-INV-01 | **No double-booking**: One reservation per table per time slot | DB constraint + API validation |
| RES-INV-02 | **Capacity limits**: Party size cannot exceed table capacity | API validation |
| RES-INV-03 | **Lead time enforcement**: Reservations must have minimum lead time | Service validation |
| RES-INV-04 | **Confirmation required**: Online reservations require confirmation (email/SMS) | Service trigger |
| RES-INV-05 | **Waitlist ordering**: FIFO by arrival time unless party size match | Service logic |
| RES-INV-06 | **Floor plan table uniqueness**: Table numbers unique per branch floor | DB constraint |
| RES-INV-07 | **Event duration limits**: Events have maximum duration | API validation |
| RES-INV-08 | **No-show tracking**: No-shows recorded for customer history | Service trigger |
| RES-INV-09 | **Timezone consistency**: All times stored and displayed in branch timezone | Service layer |
| RES-INV-10 | **Cancellation policy**: Cancellations within policy window trigger notification | Service trigger |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | Floor plan with tables; no reservations |
| DEMO_TAPAS | Sample reservations across states; waitlist entries |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch floor plans; branch-specific availability |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All reservations visible to host and manager
- [ ] Floor plan reflects current table status
- [ ] Waitlist feeds into availability suggestions
- [ ] Customer history includes past reservations
- [ ] Analytics reflect reservation patterns

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `GET /reservations/availability` | Returns available slots; real-time accuracy |
| `POST /reservations` | Atomic booking; double-booking prevention |
| `PATCH /reservations/:id` | Reschedule with conflict check |
| `POST /reservations/:id/confirm` | Sends confirmation; updates status |
| `POST /reservations/:id/no-show` | Records no-show; updates customer history |
| `GET /waitlist` | Ordered by arrival; party size filters |
| `POST /waitlist/:id/seat` | Assigns table; removes from waitlist |
| `GET /floor-plan/:branchId` | Returns tables with current status |

### Response Time SLA
- Availability check: < 500ms
- Booking creation: < 1s
- Floor plan query: < 500ms

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| HOST | Full reservation management; table assignment; waitlist |
| WAITER | View assigned tables; see reservation details |
| MANAGER | Full access; capacity settings; analytics |
| EVENT_MANAGER | Event bookings; room setup; special requests |
| CUSTOMER (public) | Online booking widget; confirmation receipt |
| OWNER | Analytics dashboard; no operational access |

### UX Requirements
- Availability calendar shows open/booked slots visually
- Floor plan is interactive (click to assign, drag to move)
- Reservation form validates party size against table capacity
- Waitlist shows estimated wait time
- Confirmation includes date, time, party size, table (if assigned)
- No-show marking requires confirmation dialog
- Event booking shows package options and add-ons
- Cancellation shows policy and any penalties

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| RES-ERR-01 | Double-book same table | 409 error "Table already booked" |
| RES-ERR-02 | Party size exceeds capacity | 400 error "Party too large for table" |
| RES-ERR-03 | Booking with insufficient lead time | 400 error "Minimum lead time not met" |
| RES-ERR-04 | Cancel already-seated reservation | 400 error "Cannot cancel seated party" |
| RES-ERR-05 | Waitlist seat with no tables | Return waiting; no error but status unchanged |
| RES-ERR-06 | Edit reservation for past time | 400 error "Cannot modify past reservation" |
| RES-ERR-07 | Delete table with active reservation | 400 error "Table has reservations" |
| RES-ERR-08 | Confirmation service unavailable | Queue for retry; log warning |
| RES-ERR-09 | Concurrent booking same slot | First wins; second gets 409 |
| RES-ERR-10 | Event exceeds operating hours | 400 error "Outside operating hours" |
| RES-ERR-11 | Invalid customer contact info | 400 error "Valid email/phone required" |
| RES-ERR-12 | Floor plan delete with active floor | 400 error "Floor has tables in use" |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Reservation created | INFO | reservationId, tableId, customerId, time |
| Reservation confirmed | INFO | reservationId, confirmationMethod |
| Reservation cancelled | INFO | reservationId, userId, reason |
| Reservation no-show | WARN | reservationId, customerId |
| Waitlist entry | INFO | waitlistId, customerId, partySize |
| Waitlist seated | INFO | waitlistId, tableId, waitTime |
| Floor plan modified | INFO | floorId, changes, userId |

### Metrics
| Metric | Purpose |
|--------|---------|
| `reservations.booked` | Volume tracking |
| `reservations.no_show_rate` | Customer reliability |
| `waitlist.avg_wait_time` | Operational efficiency |
| `tables.utilization` | Capacity planning |
| `events.booked` | Event revenue tracking |

### Alerts
- No-show rate > 15%: WARN
- Waitlist > 30 min average: WARN
- Double-booking attempt: ERROR (investigate)
- Confirmation delivery failure: WARN

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| View availability | Public (rate-limited) | Yes + Branch scope |
| Create reservation | Public (rate-limited) or HOST | Yes |
| Modify reservation | HOST, MANAGER | Yes |
| Mark no-show | HOST, MANAGER | Yes |
| Manage floor plan | MANAGER | Yes + Branch scope |
| View analytics | MANAGER, OWNER | Yes |

### Input Validation
| Field | Validation |
|-------|------------|
| Party size | Integer; 1-50 |
| Date/time | ISO 8601; future only; within operating hours |
| Customer name | String; 1-100 chars; sanitized |
| Phone | E.164 format or local standard |
| Email | Valid email format |
| Notes | String; max 500 chars; sanitized |

### Idempotency
- `POST /reservations` with idempotency key prevents duplicates
- Confirmation send is idempotent (repeat calls succeed)

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Public availability | 60/min per IP |
| Public booking | 10/min per IP |
| Staff operations | 200/min per user |

---

## I) Acceptance Criteria Checklist

### Reservations (8 items)
- [ ] RES-AC-01: Check availability for date/time/party
- [ ] RES-AC-02: Create reservation with all required fields
- [ ] RES-AC-03: Assign table to reservation
- [ ] RES-AC-04: Confirm reservation (send notification)
- [ ] RES-AC-05: Reschedule reservation
- [ ] RES-AC-06: Cancel reservation
- [ ] RES-AC-07: Mark as no-show
- [ ] RES-AC-08: View customer reservation history

### Waitlist (5 items)
- [ ] RES-AC-09: Add party to waitlist
- [ ] RES-AC-10: View waitlist with wait times
- [ ] RES-AC-11: Seat party from waitlist
- [ ] RES-AC-12: Remove from waitlist
- [ ] RES-AC-13: Notify when table ready

### Floor Plan (5 items)
- [ ] RES-AC-14: Create floor plan
- [ ] RES-AC-15: Add/edit/remove tables
- [ ] RES-AC-16: Set table capacity
- [ ] RES-AC-17: View real-time table status
- [ ] RES-AC-18: Combine tables for large party

### Events (4 items)
- [ ] RES-AC-19: Create event booking
- [ ] RES-AC-20: Set event duration
- [ ] RES-AC-21: Add special requests
- [ ] RES-AC-22: Event calendar view

### Availability (3 items)
- [ ] RES-AC-23: Block time slot (maintenance, private)
- [ ] RES-AC-24: Set operating hours
- [ ] RES-AC-25: Holiday/special hours

---

## J) Minimum E2E Expansion Set

### API Contract Tests (8 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Check availability returns slots | DEMO_TAPAS | 30s |
| Create reservation successfully | DEMO_TAPAS | 30s |
| Prevent double-booking (409) | DEMO_TAPAS | 30s |
| Party size exceeds capacity (400) | DEMO_TAPAS | 30s |
| Cancel reservation | DEMO_TAPAS | 30s |
| Add to waitlist | DEMO_TAPAS | 30s |
| Seat from waitlist | DEMO_TAPAS | 30s |
| Get floor plan with statuses | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| HOST can create and confirm reservation | HOST | DEMO_TAPAS | 30s |
| WAITER can view reservation details | WAITER | DEMO_TAPAS | 30s |
| MANAGER can modify floor plan | MANAGER | DEMO_TAPAS | 30s |
| Public user can book online | PUBLIC | DEMO_TAPAS | 30s |

### Report Validation Tests (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| No-show rate calculation correct | DEMO_TAPAS | 30s |
| Table utilization accurate | DEMO_TAPAS | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Reservations calendar loads | DEMO_TAPAS | 30s |
| Empty floor plan displays | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| TastyIgniter | ✅ MIT | Restaurant reservations, table layouts |
| cal.com | ⚠️ AGPL | Availability engine, booking logic |
| easyappointments | ⚠️ AGPL | Appointment flow, confirmation |

**Note:** TastyIgniter is MIT (adapt allowed); cal.com and easyappointments are AGPL (study-only).
