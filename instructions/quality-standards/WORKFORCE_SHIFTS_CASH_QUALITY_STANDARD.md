# Workforce, Shifts & Cash Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Workforce, Shift Management, Cash Drawer Operations  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Staff roster management (employees, roles, assignments)
- Shift scheduling (templates, recurring, manual)
- Punch clock (clock in/out, break tracking)
- Timesheet management and approval
- Cash drawer operations (open, close, reconciliation)
- End-of-day (EOD) procedures
- Labor cost tracking and reporting
- Tip pooling and distribution

### Out of Scope
- Payroll calculation and payment processing
- Tax withholding calculations
- External HR system integrations
- Benefits administration

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| WRK-INV-01 | **One active punch per employee**: Employee cannot clock in while already clocked in | DB constraint + API validation |
| WRK-INV-02 | **Drawer balance = opening + sales - payouts**: Cash drawer must reconcile | EOD calculation |
| WRK-INV-03 | **No future punch-ins**: Cannot clock in with future timestamp | API validation |
| WRK-INV-04 | **Shift assignment within availability**: Shifts must respect employee availability | Service validation |
| WRK-INV-05 | **Break duration limits**: Breaks cannot exceed shift duration | Service validation |
| WRK-INV-06 | **EOD must close all drawers**: End-of-day cannot complete with open drawers | API validation |
| WRK-INV-07 | **Tip pool = sum of contributions**: Tip pool total equals individual tips | Service validation |
| WRK-INV-08 | **Labor cost = hours × rate**: Labor cost calculation must be deterministic | Service calculation |
| WRK-INV-09 | **Schedule conflicts prevented**: Employee cannot have overlapping shifts | Service validation |
| WRK-INV-10 | **Punch edit audit trail**: All punch edits logged with before/after values | Audit trigger |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | Employees seeded; no shifts, no punches, no drawers |
| DEMO_TAPAS | Active shift schedule; sample punches; EOD history |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch schedules; branch-specific labor costs |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All employees visible to HR/manager roles
- [ ] Shift schedules reflect in manager calendar
- [ ] Punch data feeds into timesheet calculations
- [ ] Cash drawer reconciliation matches POS transactions
- [ ] Labor cost reports consistent with timesheets

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `POST /shifts/punch` | Atomic clock in/out; validates no existing active punch |
| `GET /shifts/timesheets` | Paginated; accurate hour calculations |
| `POST /shifts/schedules` | Conflict detection; availability validation |
| `POST /cash/drawers/:id/open` | Records opening balance; assigns to user |
| `POST /cash/drawers/:id/close` | Calculates variance; requires count input |
| `POST /eod/close` | Validates all drawers closed; generates EOD report |
| `GET /workforce/labor-cost` | Accurate labor cost by period |

### Response Time SLA
- Punch operation: < 500ms
- Schedule query: < 1s for month view
- EOD close: < 10s (may involve multiple validations)

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| CASHIER | Punch clock; assigned drawer only; no schedule editing |
| WAITER | Punch clock; see own schedule; request time off |
| SUPERVISOR | Punch oversight for team; approve punches; drawer assignment |
| MANAGER | Full schedule control; timesheet approval; EOD |
| HR | Employee management; labor reports; overtime tracking |
| OWNER | Labor cost dashboard; no operational access |

### UX Requirements
- Punch clock shows current status prominently (clocked in/out)
- Schedule calendar shows color-coded assignments by employee
- Break timer visible when on break
- Drawer close shows expected vs counted with variance
- EOD checklist shows completion status of each step
- Overtime hours highlighted differently from regular hours
- Shift swap requests show pending status clearly

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| WRK-ERR-01 | Clock in while already clocked in | 400 error "Already clocked in" |
| WRK-ERR-02 | Clock out without clock in | 400 error "Not clocked in" |
| WRK-ERR-03 | Future clock-in time | 400 error "Cannot punch in future" |
| WRK-ERR-04 | Overlapping shift assignment | 409 error "Schedule conflict" |
| WRK-ERR-05 | EOD with open drawers | 400 error "Close all drawers first" |
| WRK-ERR-06 | Drawer close without count | 400 error "Cash count required" |
| WRK-ERR-07 | Large drawer variance (>$50) | Warn but allow; log for review |
| WRK-ERR-08 | Break longer than shift | 400 error "Break exceeds shift duration" |
| WRK-ERR-09 | Delete employee with active shift | 400 error "Employee has active assignments" |
| WRK-ERR-10 | Concurrent punch edits | Optimistic locking; 409 on conflict |
| WRK-ERR-11 | Timesheet approval for future period | 400 error "Cannot approve future period" |
| WRK-ERR-12 | Drawer already assigned to another user | 409 error "Drawer already in use" |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Clock in | INFO | employeeId, timestamp, location |
| Clock out | INFO | employeeId, timestamp, hoursWorked |
| Punch edited | WARN | punchId, before, after, editorId, reason |
| Shift scheduled | INFO | employeeId, shiftId, times, schedulerId |
| Drawer opened | INFO | drawerId, userId, openingBalance |
| Drawer closed | INFO | drawerId, userId, expectedBalance, countedBalance, variance |
| EOD completed | INFO | branchId, userId, timestamp, summary |

### Metrics
| Metric | Purpose |
|--------|---------|
| `workforce.punch.count` | Volume tracking |
| `workforce.hours.total` | Labor tracking |
| `workforce.overtime.hours` | Cost tracking |
| `cash.drawer.variance` | Loss prevention |
| `eod.completion.time` | Operational efficiency |

### Alerts
- Drawer variance > $50: WARN
- Punch edit without manager approval: WARN
- Overtime threshold exceeded: INFO
- EOD not completed by deadline: WARN

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| Clock in/out | All staff | Yes + Self only |
| View own schedule | All staff | Yes + Self only |
| Edit schedules | SUPERVISOR, MANAGER, HR | Yes + Branch scope |
| Approve timesheets | MANAGER, HR | Yes + Branch scope |
| Manage employees | HR, MANAGER | Yes |
| Open/close drawer | CASHIER, SUPERVISOR, MANAGER | Yes + Branch scope |
| Run EOD | MANAGER | Yes + Branch scope |

### Input Validation
| Field | Validation |
|-------|------------|
| Punch times | ISO 8601; not future; reasonable range |
| Cash amounts | Decimal(19,2); non-negative |
| Shift durations | Integer minutes; 0-1440 |
| Employee IDs | Valid UUID; exists in tenant |

### Idempotency
- Punch operations use optimistic locking
- EOD close is idempotent (repeat calls return same result)
- Drawer close with same count is idempotent

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Punch operations | 10/min per user |
| Schedule queries | 100/min per user |
| EOD operations | 5/hour per branch |

---

## I) Acceptance Criteria Checklist

### Punch Clock (6 items)
- [ ] WRK-AC-01: Clock in starts shift
- [ ] WRK-AC-02: Clock out ends shift
- [ ] WRK-AC-03: Start break during shift
- [ ] WRK-AC-04: End break returns to shift
- [ ] WRK-AC-05: View punch history
- [ ] WRK-AC-06: Edit punch with approval

### Scheduling (6 items)
- [ ] WRK-AC-07: Create shift template
- [ ] WRK-AC-08: Assign employee to shift
- [ ] WRK-AC-09: Detect and prevent conflicts
- [ ] WRK-AC-10: Publish schedule
- [ ] WRK-AC-11: Request time off
- [ ] WRK-AC-12: Swap shift with colleague

### Timesheets (4 items)
- [ ] WRK-AC-13: Generate timesheet from punches
- [ ] WRK-AC-14: Calculate regular and overtime hours
- [ ] WRK-AC-15: Submit timesheet for approval
- [ ] WRK-AC-16: Approve/reject timesheet

### Cash Drawer (5 items)
- [ ] WRK-AC-17: Open drawer with starting balance
- [ ] WRK-AC-18: Track sales into drawer
- [ ] WRK-AC-19: Record paid-out
- [ ] WRK-AC-20: Close drawer with count
- [ ] WRK-AC-21: Calculate and display variance

### End of Day (4 items)
- [ ] WRK-AC-22: EOD checklist display
- [ ] WRK-AC-23: Validate all drawers closed
- [ ] WRK-AC-24: Generate EOD report
- [ ] WRK-AC-25: Lock day from further transactions

---

## J) Minimum E2E Expansion Set

### API Contract Tests (8 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Clock in starts punch | DEMO_TAPAS | 30s |
| Clock out while clocked in | DEMO_TAPAS | 30s |
| Clock in while already clocked in (400) | DEMO_TAPAS | 30s |
| Schedule shift for employee | DEMO_TAPAS | 30s |
| Detect schedule conflict (409) | DEMO_TAPAS | 30s |
| Open cash drawer | DEMO_TAPAS | 30s |
| Close drawer with variance | DEMO_TAPAS | 30s |
| EOD with open drawer (400) | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| CASHIER can punch in/out | CASHIER | DEMO_TAPAS | 30s |
| MANAGER can create schedule | MANAGER | DEMO_TAPAS | 30s |
| SUPERVISOR can approve punches | SUPERVISOR | DEMO_TAPAS | 30s |
| WAITER can view own schedule | WAITER | DEMO_TAPAS | 30s |

### Report Validation Tests (3 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Labor hours match punches | DEMO_TAPAS | 30s |
| Drawer reconciliation correct | DEMO_TAPAS | 30s |
| EOD summary accurate | DEMO_TAPAS | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Schedule calendar loads | DEMO_TAPAS | 30s |
| Empty schedule displays correctly | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| kimai | ⚠️ AGPL | Time tracking, punch in/out, timesheets |

**Note:** kimai is AGPL — study-only, clean-room implementation required.
