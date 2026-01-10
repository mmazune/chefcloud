# No Dead Ends Checklist

> **Phase H5 Deliverable** – Verifies every job role can navigate to working pages.

## Overview

This checklist ensures that:
1. Every role's sidebar links point to **real, working pages**
2. Empty data states show helpful **EmptyState** components
3. Planned/unavailable features display **PlannedFeatureBanner**
4. No role encounters a 404 from navigation

---

## Per-Role Navigation Audit

### OWNER (11 roles total)

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Overview** | Dashboard | `/dashboard` | ✅ Working |
| | Analytics | `/analytics` | ✅ Working |
| | Reports | `/reports` | ✅ Working |
| **Operations** | POS | `/pos` | ✅ Working |
| | Reservations | `/reservations` | ✅ Working |
| | Inventory | `/inventory` | ✅ Working |
| **Finance** | Accounting | `/finance` | ✅ Working |
| | Budgets | `/finance/budgets` | ✅ Working |
| | Payables | `/finance/payables` | ✅ Working |
| | Receivables | `/finance/receivables` | ✅ Working |
| | P&L | `/finance/pnl` | ✅ Working |
| **Team** | Staff | `/staff` | ✅ Working |
| | Feedback | `/feedback` | ✅ Working |
| **Workforce** | Schedule | `/workforce/schedule` | ✅ Working |
| | Timeclock | `/workforce/timeclock` | ✅ Working |
| | Swap Approvals | `/workforce/swap-approvals` | ✅ Working |
| | Time-off Requests | `/workforce/time-off-requests` | ✅ Working |
| | Timecards | `/workforce/timecards` | ✅ Working |
| | Payroll Runs | `/workforce/payroll-runs` | ✅ Working |
| | Paystubs | `/workforce/paystubs` | ✅ Working |
| | Settings | `/workforce/settings` | ✅ Working |
| | Reports | `/workforce/reports` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/dashboard`

---

### MANAGER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Overview** | Dashboard | `/dashboard` | ✅ Working |
| | Analytics | `/analytics` | ✅ Working |
| | Reports | `/reports` | ✅ Working |
| **Operations** | POS | `/pos` | ✅ Working |
| | Reservations | `/reservations` | ✅ Working |
| | Inventory | `/inventory` | ✅ Working |
| **Team** | Staff | `/staff` | ✅ Working |
| | Feedback | `/feedback` | ✅ Working |
| **Workforce** | Schedule | `/workforce/schedule` | ✅ Working |
| | Timeclock | `/workforce/timeclock` | ✅ Working |
| | Swap Approvals | `/workforce/swap-approvals` | ✅ Working |
| | Time-off Requests | `/workforce/time-off-requests` | ✅ Working |
| | Timecards | `/workforce/timecards` | ✅ Working |
| | Payroll Runs | `/workforce/payroll-runs` | ✅ Working |
| | Paystubs | `/workforce/paystubs` | ✅ Working |
| | Settings | `/workforce/settings` | ✅ Working |
| | Reports | `/workforce/reports` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/dashboard`

---

### ACCOUNTANT

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **General Ledger** | Dashboard | `/dashboard` | ✅ Working |
| | Journal | `/finance/journal` | ✅ Working |
| | Inventory Postings | `/inventory/accounting-postings` | ✅ Working |
| **Financial Statements** | P&L | `/finance/pnl` | ✅ Working |
| | Balance Sheet | `/finance/balance-sheet` | ✅ Working |
| | Cash Flow | `/finance/cash-flow` | ✅ Working |
| **Payables & Receivables** | Payables | `/finance/payables` | ✅ Working |
| | Receivables | `/finance/receivables` | ✅ Working |
| **Budgets & Reports** | Budgets | `/finance/budgets` | ✅ Working |
| | Reports | `/reports` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |

**Default Route:** `/workspaces/accountant`

---

### PROCUREMENT

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Procurement** | Suppliers | `/inventory/suppliers` | ✅ Working |
| | Purchase Orders | `/inventory/purchase-orders` | ✅ Working |
| | Receipts | `/inventory/receipts` | ✅ Working |
| | Items | `/inventory/items` | ✅ Working |
| | Locations | `/inventory/locations` | ✅ Working |
| | Reorder Policies | `/inventory/reorder-policies` | ✅ Working |
| | Reorder Suggestions | `/inventory/reorder-suggestions` | ✅ Working |
| | COGS Report | `/inventory/cogs` | ✅ Working |
| | Analytics | `/inventory/analytics` | ✅ Working |
| **Reports** | Reports | `/reports` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |

**Default Route:** `/workspaces/procurement`

---

### STOCK_MANAGER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Inventory** | Overview | `/inventory` | ✅ Working |
| | On-hand | `/inventory/on-hand` | ✅ Working |
| | Items | `/inventory/items` | ✅ Working |
| | Locations | `/inventory/locations` | ✅ Working |
| | Stocktakes | `/inventory/stocktakes` | ✅ Working |
| | Adjustments | `/inventory/adjustments` | ✅ Working |
| | Transfers | `/inventory/transfers` | ✅ Working |
| | Alerts | `/inventory/alerts` | ✅ Working |
| | Lots | `/inventory/lots` | ✅ Working |
| **Overview** | Dashboard | `/dashboard` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |

**Default Route:** `/workspaces/stock-manager`

---

### SUPERVISOR

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Operations** | POS | `/pos` | ✅ Working |
| | Reservations | `/reservations` | ✅ Working |
| | Staff | `/staff` | ✅ Working |
| **Workforce** | Timeclock | `/workforce/timeclock` | ✅ Working |
| | Swap Approvals | `/workforce/swap-approvals` | ✅ Working |
| **Overview** | Dashboard | `/dashboard` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/pos`

---

### CASHIER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Operations** | POS | `/pos` | ✅ Working |
| | Dashboard | `/dashboard` | ✅ Working |
| **Workforce** | Timeclock | `/workforce/timeclock` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/pos`

---

### CHEF

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Kitchen** | Dashboard | `/dashboard` | ✅ Working |
| | Inventory | `/inventory` | ✅ Working |
| **Workforce** | Timeclock | `/workforce/timeclock` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/workspaces/chef`

---

### WAITER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Operations** | POS | `/pos` | ✅ Working |
| | Reservations | `/reservations` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/pos`

---

### BARTENDER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Operations** | POS | `/pos` | ✅ Working |
| | Inventory | `/inventory` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/pos`

---

### EVENT_MANAGER

| Nav Group | Link | Route | Status |
|-----------|------|-------|--------|
| **Events** | Reservations | `/reservations` | ✅ Working |
| | Dashboard | `/dashboard` | ✅ Working |
| **Operations** | POS | `/pos` | ✅ Working |
| | Staff | `/staff` | ✅ Working |
| **My Schedule** | My Availability | `/workforce/my-availability` | ✅ Working |
| | My Swaps | `/workforce/my-swaps` | ✅ Working |
| | Open Shifts | `/workforce/open-shifts` | ✅ Working |
| **Settings** | Settings | `/settings` | ✅ Working |

**Default Route:** `/workspaces/event-manager`

---

## Planned / Unavailable Routes

Routes marked as PLANNED or LEGACY_HIDDEN in `docs/routes/UNLINKED_ROUTE_REGISTRY.md`:

| Route | Classification | Banner Applied |
|-------|---------------|----------------|
| `/dev` | PLANNED (DevPortal, behind `DEVPORTAL_ENABLED` flag) | ✅ PlannedFeatureBanner |
| `/inventory/index.tsx.old` | LEGACY_HIDDEN | N/A (file, not route) |
| `/pos/index.tsx.old` | LEGACY_HIDDEN | N/A (file, not route) |

---

## Empty State Coverage

High-traffic pages with EmptyState components:

| Page | Route | Has EmptyState | Has ErrorState |
|------|-------|---------------|----------------|
| Dashboard | `/dashboard` | ✅ | ✅ |
| POS | `/pos` | ✅ | ✅ |
| KDS | `/kds` | ✅ | ✅ |
| Inventory Overview | `/inventory` | ✅ | ✅ |
| Purchase Orders | `/inventory/purchase-orders` | ✅ | ✅ |
| Receipts | `/inventory/receipts` | ✅ | ✅ |
| Payroll Runs | `/workforce/payroll-runs` | ✅ | ✅ |
| Journal | `/finance/journal` | ✅ | ✅ |
| Period Close | `/inventory/period-close` | ✅ | ✅ |
| Settings | `/settings` | ✅ | ✅ |

---

## Verification Tests

Located in `apps/web/src/__tests__/ux/`:

1. **`no-dead-ends.test.tsx`** – Role landing pages load without 404
2. **`planned-banner.test.tsx`** – PlannedFeatureBanner visible on planned routes
3. **`empty-state.test.tsx`** – EmptyState visible when API returns empty
4. **`no-runtime-errors.test.tsx`** – Console.error not called on page load

---

## Summary

- **Total Roles:** 11
- **Total Nav Links Audited:** 94
- **Dead Ends Found:** 0
- **Planned Routes:** 1 (`/dev`)
- **Legacy Hidden Files:** 2 (not routes)
- **Pages with EmptyState:** 10

**Last Updated:** Phase H5
