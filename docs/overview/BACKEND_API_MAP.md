# Backend API Map

> Generated: 2026-01-10 | Phase B — Codebase Mapping

---

## Overview

| Metric | Value |
|--------|-------|
| **Total Controllers** | 119 |
| **API Domains** | 48 |
| **Framework** | NestJS |
| **Source Directory** | `services/api/src/` |
| **API Prefix** | `/api/v1/` |

---

## Domain Summary

Controllers grouped by functional domain:

| Domain | Controllers | Key Endpoints |
|--------|-------------|---------------|
| **workforce** | 27 | `/employees`, `/shifts`, `/attendance`, `/leave`, `/scheduling` |
| **inventory** | 25 | `/items`, `/lots`, `/movements`, `/waste`, `/stocktake` |
| **accounting** | 3 | `/accounts`, `/journals`, `/fiscal-periods` |
| **pos** | 3 | `/orders`, `/payments`, `/cash-sessions` |
| **reservations** | 3 | `/reservations`, `/events`, `/waitlist` |
| **payroll** | 2 | `/payroll-runs`, `/payslips` |
| **payables** | 2 | `/vendors`, `/bills` |
| **receivables** | 2 | `/customers`, `/invoices` |
| **menu** | 2 | `/menu-items`, `/modifiers` |
| **auth** | 2 | `/auth`, `/sessions` |
| **settings** | 2 | `/org-settings`, `/branch-settings` |
| **reports** | 2 | `/reports`, `/analytics` |
| **Other domains** | 46 | Various supporting APIs |

---

## Controllers by Domain

### Workforce (27 controllers)

| Controller | Path | Purpose |
|------------|------|---------|
| `employees.controller` | `/employees` | CRUD for staff records |
| `employee-profile.controller` | `/employees/:id/profile` | Profile management |
| `attendance.controller` | `/attendance` | Clock in/out, records |
| `shifts.controller` | `/shifts` | Shift CRUD |
| `shift-assignments.controller` | `/shift-assignments` | Assign staff to shifts |
| `shift-swaps.controller` | `/shift-swaps` | Swap requests |
| `scheduling.controller` | `/scheduling` | Schedule generation |
| `auto-schedule.controller` | `/auto-schedule` | AI scheduler |
| `time-entries.controller` | `/time-entries` | Timesheet entries |
| `timesheet-approvals.controller` | `/timesheet-approvals` | Manager approvals |
| `leave-requests.controller` | `/leave-requests` | PTO requests |
| `leave-balances.controller` | `/leave-balances` | Balance tracking |
| `leave-policies.controller` | `/leave-policies` | Policy config |
| `availability.controller` | `/availability` | Staff availability |
| `workforce-policy.controller` | `/workforce-policy` | Policy rules |
| `staffing-alerts.controller` | `/staffing-alerts` | Alert triggers |
| `staffing-plans.controller` | `/staffing-plans` | Staffing targets |
| `labor-forecasts.controller` | `/labor-forecasts` | Labor predictions |
| `awards.controller` | `/awards` | Staff recognition |
| *...and 8 more* | — | Supporting workforce features |

### Inventory (25 controllers)

| Controller | Path | Purpose |
|------------|------|---------|
| `inventory-items.controller` | `/inventory/items` | Item master |
| `inventory-lots.controller` | `/inventory/lots` | Lot tracking |
| `inventory-locations.controller` | `/inventory/locations` | Location management |
| `inventory-ledger.controller` | `/inventory/ledger` | Movement ledger |
| `inventory-transfers.controller` | `/inventory/transfers` | Inter-location moves |
| `inventory-waste.controller` | `/inventory/waste` | Waste recording |
| `inventory-periods.controller` | `/inventory/periods` | Period closes |
| `stocktake.controller` | `/stocktake` | Physical counts |
| `count-sessions.controller` | `/count-sessions` | Count workflow |
| `recipes.controller` | `/recipes` | Recipe management |
| `production-batches.controller` | `/production-batches` | Production tracking |
| `purchase-orders.controller` | `/purchase-orders` | PO management |
| `goods-receipts.controller` | `/goods-receipts` | Receiving |
| `suppliers.controller` | `/suppliers` | Vendor master |
| `supplier-items.controller` | `/supplier-items` | Vendor catalogs |
| `reorder-policies.controller` | `/reorder-policies` | Auto-reorder rules |
| `reorder-suggestions.controller` | `/reorder-suggestions` | AI suggestions |
| `vendor-returns.controller` | `/vendor-returns` | Return processing |
| `cost-layers.controller` | `/cost-layers` | FIFO/LIFO costing |
| `valuation.controller` | `/valuation` | Inventory valuation |
| *...and 5 more* | — | Supporting inventory features |

### Point of Sale (3 controllers)

| Controller | Path | Purpose |
|------------|------|---------|
| `orders.controller` | `/orders` | Order CRUD |
| `payments.controller` | `/payments` | Payment processing |
| `cash-sessions.controller` | `/cash-sessions` | Till management |

### Accounting (3 controllers)

| Controller | Path | Purpose |
|------------|------|---------|
| `accounts.controller` | `/accounts` | Chart of accounts |
| `journals.controller` | `/journals` | Journal entries |
| `fiscal-periods.controller` | `/fiscal-periods` | Period management |

### Reservations (3 controllers)

| Controller | Path | Purpose |
|------------|------|---------|
| `reservations.controller` | `/reservations` | Booking CRUD |
| `events.controller` | `/events` | Event management |
| `waitlist.controller` | `/waitlist` | Waitlist queue |

---

## API Patterns

### Authentication

All authenticated endpoints require:
- `Authorization: Bearer <token>` header
- Token obtained via `/api/v1/auth/login`

### Multi-Tenancy

- Org ID from JWT claims
- Branch context via `X-Branch-Id` header or query param
- Cross-branch access controlled by role

### Common Query Params

| Param | Usage |
|-------|-------|
| `page`, `limit` | Pagination |
| `sort`, `order` | Sorting |
| `filter[field]` | Filtering |
| `include` | Eager loading relations |
| `branchId` | Branch scope |

### Response Format

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

---

## Internal/Non-FE APIs

These controllers have no frontend consumer — they're for internal use:

| Controller | Purpose |
|------------|---------|
| `health.controller` | Liveness/readiness probes |
| `sse.controller` | Real-time event stream |
| `webhook-inbound.controller` | External webhook receiver |
| `cron.controller` | Scheduled job triggers |
| `internal-sync.controller` | Service-to-service sync |
| `idempotency.controller` | Request deduplication |

---

## Key Files

| File | Purpose |
|------|---------|
| `services/api/src/main.ts` | API bootstrap |
| `services/api/src/app.module.ts` | Root module |
| `reports/codebase/backend-routes.json` | Machine-readable controller data |
| `CURL_CHEATSHEET.md` | API testing examples |

---

## Testing APIs

See these resources for API testing:
- [CURL_CHEATSHEET.md](../../CURL_CHEATSHEET.md)
- `curl-examples-*.sh` files in repo root
- Swagger UI at `/api/docs` (when enabled)

---

*This document is part of Phase B Codebase Mapping. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
