# Role Navigation Trees

> Generated: 2026-01-10 | Phase I1

---

## Overview

| Role | Landing Route | Nav Groups | Total Routes |
|------|---------------|------------|--------------|
| ACCOUNTANT | `/workspaces/accountant` | 5 | 15 |
| BARTENDER | `/pos` | 3 | 6 |
| CASHIER | `/pos` | 4 | 7 |
| CHEF | `/workspaces/chef` | 4 | 8 |
| EVENT_MANAGER | `/workspaces/event-manager` | 4 | 8 |
| MANAGER | `/workspaces/manager` | 6 | 21 |
| OWNER | `/workspaces/owner` | 7 | 23 |
| PROCUREMENT | `/workspaces/procurement` | 4 | 15 |
| STOCK_MANAGER | `/workspaces/stock-manager` | 4 | 14 |
| SUPERVISOR | `/workspaces/supervisor` | 5 | 10 |
| WAITER | `/pos` | 3 | 6 |

---

## Route Status Legend

| Status | Meaning |
|--------|---------|
| ACTIVE | Route is linked and functional |
| PLANNED | Feature is planned but not yet implemented |
| GATED | Route exists but not linked in main navigation |
| INTERNAL_ONLY | System/internal route (login, health, etc.) |
| LEGACY_HIDDEN | Deprecated route kept for backward compatibility |

---

## ACCOUNTANT

**Accountant Workspace**

- **Landing Route**: `/workspaces/accountant`
- **Nav Groups**: 5
- **Total Routes**: 15

### General Ledger

| Label | Route | Status |
|-------|-------|--------|
| Chart of Accounts | `/finance/accounts` | ✅ ACTIVE |
| Journal Entries | `/finance/journal` | ✅ ACTIVE |
| Fiscal Periods | `/finance/periods` | ✅ ACTIVE |

### Financial Statements

| Label | Route | Status |
|-------|-------|--------|
| Trial Balance | `/finance/trial-balance` | ✅ ACTIVE |
| Profit & Loss | `/finance/pnl` | ✅ ACTIVE |
| Balance Sheet | `/finance/balance-sheet` | ✅ ACTIVE |

### Payables & Receivables

| Label | Route | Status |
|-------|-------|--------|
| Service Providers | `/service-providers` | ✅ ACTIVE |
| AP Aging | `/finance/ap-aging` | ✅ ACTIVE |
| AR Aging | `/finance/ar-aging` | ✅ ACTIVE |

### Budgets & Reports

| Label | Route | Status |
|-------|-------|--------|
| Budgets | `/finance` | ✅ ACTIVE |
| Reports | `/reports` | ✅ ACTIVE |
| Analytics | `/analytics` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

---

## BARTENDER

**Bartender Station**

- **Landing Route**: `/pos`
- **Nav Groups**: 3
- **Total Routes**: 6

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Inventory | `/inventory` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## CASHIER

**Cashier Station**

- **Landing Route**: `/pos`
- **Nav Groups**: 4
- **Total Routes**: 7

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Dashboard | `/dashboard` | ✅ ACTIVE |

### Workforce

| Label | Route | Status |
|-------|-------|--------|
| Timeclock | `/workforce/timeclock` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## CHEF

**Chef Dashboard**

- **Landing Route**: `/workspaces/chef`
- **Nav Groups**: 4
- **Total Routes**: 8

### Kitchen

| Label | Route | Status |
|-------|-------|--------|
| KDS | `/kds` | ✅ ACTIVE |
| Dashboard | `/dashboard` | ✅ ACTIVE |
| Inventory | `/inventory` | ✅ ACTIVE |

### Workforce

| Label | Route | Status |
|-------|-------|--------|
| Timeclock | `/workforce/timeclock` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## EVENT_MANAGER

**Event Manager Dashboard**

- **Landing Route**: `/workspaces/event-manager`
- **Nav Groups**: 4
- **Total Routes**: 8

### Events

| Label | Route | Status |
|-------|-------|--------|
| Reservations | `/reservations` | ✅ ACTIVE |
| Dashboard | `/dashboard` | ✅ ACTIVE |

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Staff | `/staff` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## MANAGER

**Manager Dashboard**

- **Landing Route**: `/workspaces/manager`
- **Nav Groups**: 6
- **Total Routes**: 21

### Overview

| Label | Route | Status |
|-------|-------|--------|
| Dashboard | `/dashboard` | ✅ ACTIVE |
| Analytics | `/analytics` | ✅ ACTIVE |
| Reports | `/reports` | ✅ ACTIVE |

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Reservations | `/reservations` | ✅ ACTIVE |
| Inventory | `/inventory` | ✅ ACTIVE |

### Team

| Label | Route | Status |
|-------|-------|--------|
| Staff | `/staff` | ✅ ACTIVE |
| Feedback | `/feedback` | ✅ ACTIVE |

### Workforce

| Label | Route | Status |
|-------|-------|--------|
| Schedule | `/workforce/schedule` | ✅ ACTIVE |
| Timeclock | `/workforce/timeclock` | ✅ ACTIVE |
| Approvals | `/workforce/approvals` | ✅ ACTIVE |
| Swap Approvals | `/workforce/swaps` | ✅ ACTIVE |
| Labor Reports | `/workforce/labor` | ✅ ACTIVE |
| Labor Targets | `/workforce/labor-targets` | ✅ ACTIVE |
| Staffing Planner | `/workforce/staffing-planner` | ✅ ACTIVE |
| Staffing Alerts | `/workforce/staffing-alerts` | ✅ ACTIVE |
| Auto-Scheduler | `/workforce/auto-scheduler` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## OWNER

**Owner Dashboard**

- **Landing Route**: `/workspaces/owner`
- **Nav Groups**: 7
- **Total Routes**: 23

### Overview

| Label | Route | Status |
|-------|-------|--------|
| Dashboard | `/dashboard` | ✅ ACTIVE |
| Analytics | `/analytics` | ✅ ACTIVE |
| Reports | `/reports` | ✅ ACTIVE |

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Reservations | `/reservations` | ✅ ACTIVE |
| Inventory | `/inventory` | ✅ ACTIVE |

### Finance

| Label | Route | Status |
|-------|-------|--------|
| Finance | `/finance` | ✅ ACTIVE |
| Service Providers | `/service-providers` | ✅ ACTIVE |

### Team

| Label | Route | Status |
|-------|-------|--------|
| Staff | `/staff` | ✅ ACTIVE |
| Feedback | `/feedback` | ✅ ACTIVE |

### Workforce

| Label | Route | Status |
|-------|-------|--------|
| Schedule | `/workforce/schedule` | ✅ ACTIVE |
| Timeclock | `/workforce/timeclock` | ✅ ACTIVE |
| Approvals | `/workforce/approvals` | ✅ ACTIVE |
| Swap Approvals | `/workforce/swaps` | ✅ ACTIVE |
| Labor Reports | `/workforce/labor` | ✅ ACTIVE |
| Labor Targets | `/workforce/labor-targets` | ✅ ACTIVE |
| Staffing Planner | `/workforce/staffing-planner` | ✅ ACTIVE |
| Staffing Alerts | `/workforce/staffing-alerts` | ✅ ACTIVE |
| Auto-Scheduler | `/workforce/auto-scheduler` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## PROCUREMENT

**Procurement Dashboard**

- **Landing Route**: `/workspaces/procurement`
- **Nav Groups**: 4
- **Total Routes**: 15

### Procurement

| Label | Route | Status |
|-------|-------|--------|
| Inventory | `/inventory` | ✅ ACTIVE |
| Purchase Orders | `/inventory/purchase-orders` | ✅ ACTIVE |
| Receipts | `/inventory/receipts` | ✅ ACTIVE |
| Transfers | `/inventory/transfers` | ✅ ACTIVE |
| Waste | `/inventory/waste` | ✅ ACTIVE |
| Recipes | `/inventory/recipes` | ✅ ACTIVE |
| Depletions | `/inventory/depletions` | ✅ ACTIVE |
| Period Close | `/inventory/period-close` | ✅ ACTIVE |
| Service Providers | `/service-providers` | ✅ ACTIVE |

### Reports

| Label | Route | Status |
|-------|-------|--------|
| Reports | `/reports` | ✅ ACTIVE |
| Dashboard | `/dashboard` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

---

## STOCK_MANAGER

**Stock Manager Dashboard**

- **Landing Route**: `/workspaces/stock-manager`
- **Nav Groups**: 4
- **Total Routes**: 14

### Inventory

| Label | Route | Status |
|-------|-------|--------|
| Inventory | `/inventory` | ✅ ACTIVE |
| Purchase Orders | `/inventory/purchase-orders` | ✅ ACTIVE |
| Receipts | `/inventory/receipts` | ✅ ACTIVE |
| Transfers | `/inventory/transfers` | ✅ ACTIVE |
| Waste | `/inventory/waste` | ✅ ACTIVE |
| Recipes | `/inventory/recipes` | ✅ ACTIVE |
| Depletions | `/inventory/depletions` | ✅ ACTIVE |
| Period Close | `/inventory/period-close` | ✅ ACTIVE |
| Reports | `/reports` | ✅ ACTIVE |

### Overview

| Label | Route | Status |
|-------|-------|--------|
| Dashboard | `/dashboard` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

---

## SUPERVISOR

**Supervisor Dashboard**

- **Landing Route**: `/workspaces/supervisor`
- **Nav Groups**: 5
- **Total Routes**: 10

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Reservations | `/reservations` | ✅ ACTIVE |
| Staff | `/staff` | ✅ ACTIVE |

### Workforce

| Label | Route | Status |
|-------|-------|--------|
| Timeclock | `/workforce/timeclock` | ✅ ACTIVE |
| Swap Approvals | `/workforce/swaps` | ✅ ACTIVE |

### Overview

| Label | Route | Status |
|-------|-------|--------|
| Dashboard | `/dashboard` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

## WAITER

**Waiter Station**

- **Landing Route**: `/pos`
- **Nav Groups**: 3
- **Total Routes**: 6

### Operations

| Label | Route | Status |
|-------|-------|--------|
| POS | `/pos` | ✅ ACTIVE |
| Reservations | `/reservations` | ✅ ACTIVE |

### My Schedule

| Label | Route | Status |
|-------|-------|--------|
| My Availability | `/workforce/my-availability` | ✅ ACTIVE |
| My Swaps | `/workforce/my-swaps` | ✅ ACTIVE |
| Open Shifts | `/workforce/open-shifts` | ✅ ACTIVE |

### Settings

| Label | Route | Status |
|-------|-------|--------|
| Settings | `/settings` | ✅ ACTIVE |

---

*Generated by `pnpm nav:generate`. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*
