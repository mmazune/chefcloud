# Frontend Route Map

> Generated: 2026-01-10 | Phase B — Codebase Mapping

---

## Overview

| Metric | Value |
|--------|-------|
| **Total Routes** | 126 |
| **Nav-Linked Routes** | 38 |
| **Unlinked Routes** | 88 |
| **Pages Directory** | `apps/web/src/pages/` |
| **Router** | Next.js Pages Router |

---

## Navigation Structure

Routes are grouped by **NavGroup** as defined in `apps/web/src/config/roleCapabilities.ts`.

### Core Navigation Groups

| NavGroup | Routes | Description |
|----------|--------|-------------|
| `dashboard` | 1 | Role-specific dashboard |
| `orders` | 2 | POS orders + history |
| `tables` | 1 | Floor plan / table view |
| `reservations` | 3 | Reservations, calendar, waitlist |
| `kds` | 1 | Kitchen display |
| `inventory` | 5 | Items, lots, movements, waste, recipes |
| `procurement` | 4 | POs, suppliers, receipts, returns |
| `accounting` | 4 | GL, journals, bank, reconciliation |
| `payables` | 3 | Vendors, bills, payments |
| `receivables` | 2 | Customers, invoices |
| `workforce` | 6 | Employees, shifts, schedules, attendance, leave, awards |
| `payroll` | 4 | Runs, payslips, components, remittances |
| `reports` | 2 | Reports index + subscriptions |
| `settings` | 1 | Settings hub |

---

## Routes by Role Access

Each **JobRole** has access to specific nav groups. Key mappings:

| Role | Primary Routes | Nav Groups |
|------|----------------|------------|
| **OWNER** | `/dashboard/owner`, `/reports/*`, `/settings/*` | All groups |
| **MANAGER** | `/dashboard/manager`, `/workforce/*`, `/reports/*` | Most groups |
| **ACCOUNTANT** | `/dashboard/accountant`, `/accounting/*`, `/payables/*` | Finance-focused |
| **PROCUREMENT** | `/inventory/*`, `/procurement/*` | Supply chain |
| **STOCK_MANAGER** | `/inventory/*`, `/stocktake/*` | Inventory-focused |
| **SUPERVISOR** | `/workforce/*`, `/shifts/*`, `/orders/*` | Operations |
| **CASHIER** | `/orders/*`, `/cash-session/*` | POS-focused |
| **CHEF** | `/kds/*`, `/orders/*` | Kitchen |
| **WAITER** | `/orders/*`, `/tables/*` | Service floor |
| **BARTENDER** | `/orders/*`, `/tables/*` | Bar service |
| **EVENT_MANAGER** | `/reservations/*`, `/events/*` | Events & bookings |

---

## Route Categories

### 1. Authenticated App Routes (38 nav-linked)

```
/dashboard/*          → Role dashboards
/orders/*             → POS and order management
/inventory/*          → Stock and item management
/procurement/*        → Purchasing workflow
/accounting/*         → General ledger
/workforce/*          → Staff management
/payroll/*            → Payroll processing
/reservations/*       → Booking system
/reports/*            → Analytics & reports
/settings/*           → Configuration
```

### 2. Auth Flow Routes (8)

```
/login                → Primary login
/logout               → Logout handler
/auth/callback        → OAuth callback
/auth/verify          → Email verification
/auth/reset-password  → Password reset
/auth/forgot-password → Password recovery
/auth/mfa             → MFA challenge
/auth/error           → Auth error page
```

### 3. Workspace Entry Points (11)

```
/workspaces/owner
/workspaces/manager
/workspaces/accountant
/workspaces/procurement
/workspaces/stock-manager
/workspaces/supervisor
/workspaces/cashier
/workspaces/chef
/workspaces/waiter
/workspaces/bartender
/workspaces/event-manager
```

### 4. Kiosk Mode (8)

```
/kiosk                → Kiosk home
/kiosk/clock          → Time clock
/kiosk/order          → Self-service ordering
/kiosk/menu           → Menu display
/kiosk/checkout       → Payment
/kiosk/receipt        → Receipt view
/kiosk/admin          → Kiosk config
/kiosk/config         → Device setup
```

### 5. Dynamic Routes (~25)

Pattern: `[param].tsx` or `[...slug].tsx`

Examples:
- `/orders/[id]` — Order detail
- `/inventory/items/[id]` — Item detail
- `/employees/[id]` — Employee profile
- `/reports/[slug]` — Dynamic report

### 6. Special Pages (5)

```
/_app.tsx             → App wrapper
/_document.tsx        → Document wrapper
/404.tsx              → Not found
/500.tsx              → Server error
/index.tsx            → Root redirect
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/config/roleCapabilities.ts` | Nav group definitions by role |
| `apps/web/src/components/layout/Sidebar.tsx` | Navigation renderer |
| `apps/web/src/middleware.ts` | Route protection |
| `reports/codebase/frontend-routes.json` | Machine-readable route data |

---

## Orphan Detection

See [reports/codebase/orphans.md](../../reports/codebase/orphans.md) for:
- 88 unlinked routes (most intentional)
- Top 10 potentially orphaned routes
- Cleanup recommendations

---

*This document is part of Phase B Codebase Mapping. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
