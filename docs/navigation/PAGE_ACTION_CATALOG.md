# Page Action Catalog

> Generated: 2026-01-10 | Phase I2

---

## Overview

| Metric | Value |
|--------|-------|
| Annotated Pages | 8 |
| Total Actions | 37 |
| Total API Calls | 33 |
| HIGH Risk Pages | 5 |
| MEDIUM Risk Pages | 2 |
| LOW Risk Pages | 1 |

---

## Risk Legend

| Risk | Meaning |
|------|---------|
| 🔴 HIGH | Money/stock/audit sensitive operations |
| 🟡 MEDIUM | Creates/modifies data, limited financial impact |
| 🟢 LOW | Read-only, no financial impact |

---

## Pages by Risk Level

### 🔴 HIGH Risk Pages

- [`/finance/journal`](#financejournal) — Journal Entries
- [`/pos`](#pos) — POS - Point of Sale
- [`/pos/cash-sessions`](#poscash-sessions) — Cash Sessions
- [`/pos/checkout/[orderId]`](#poscheckoutorderId) — POS Checkout
- [`/workforce/payroll-runs`](#workforcepayroll-runs) — Payroll Runs

### 🟡 MEDIUM Risk Pages

- [`/inventory/items`](#inventoryitems) — Inventory Items
- [`/inventory/purchase-orders`](#inventorypurchase-orders) — Purchase Orders

### 🟢 LOW Risk Pages

- [`/kds`](#kds) — Kitchen Display System

---

## Page Details

### Journal Entries

- **Route**: `/finance/journal`
- **Risk**: 🔴 HIGH
- **Roles**: OWNER, ACCOUNTANT
- **Source**: `apps\web\src\pages\finance\journal.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Create Entry | `journal-create` | create |
| Post Entry | `journal-post` | update |
| Reverse Entry | `journal-reverse` | update |
| View Details | `journal-view` | view |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/accounting/journal-entries` |
| POST | `/accounting/journal-entries` |
| POST | `/accounting/journal-entries/:id/post` |
| POST | `/accounting/journal-entries/:id/reverse` |

---

### Inventory Items

- **Route**: `/inventory/items`
- **Risk**: 🟡 MEDIUM
- **Roles**: OWNER, MANAGER, PROCUREMENT, STOCK_MANAGER
- **Source**: `apps\web\src\pages\inventory\items.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Add Item | `inventory-add-item` | create |
| Edit Item | `inventory-edit-item` | update |
| Toggle Active | `inventory-toggle-active` | update |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/inventory/items` |
| POST | `/inventory/items` |
| PATCH | `/inventory/items/:id` |

---

### Purchase Orders

- **Route**: `/inventory/purchase-orders`
- **Risk**: 🟡 MEDIUM
- **Roles**: OWNER, MANAGER, PROCUREMENT, STOCK_MANAGER
- **Source**: `apps\web\src\pages\inventory\purchase-orders\index.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Create PO | `po-create` | create |
| Submit for Approval | `po-submit` | update |
| Approve | `po-approve` | approve |
| Reject | `po-reject` | reject |
| View Details | `po-view` | navigate |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/inventory/purchase-orders` |
| POST | `/inventory/purchase-orders` |
| POST | `/inventory/purchase-orders/:id/submit` |
| POST | `/inventory/purchase-orders/:id/approve` |
| POST | `/inventory/purchase-orders/:id/reject` |

---

### Kitchen Display System

- **Route**: `/kds`
- **Risk**: 🟢 LOW
- **Roles**: OWNER, MANAGER, SUPERVISOR, CHEF
- **Source**: `apps\web\src\pages\kds\index.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Mark In Progress | `kds-in-progress` | update |
| Mark Ready | `kds-ready` | update |
| Recall Order | `kds-recall` | update |
| Filter Status | `kds-filter` | view |
| Settings | `kds-settings` | view |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/kds/tickets` |
| PATCH | `/kds/tickets/:id/start` |
| PATCH | `/kds/tickets/:id/ready` |
| PATCH | `/kds/tickets/:id/recall` |

---

### POS - Point of Sale

- **Route**: `/pos`
- **Risk**: 🔴 HIGH
- **Roles**: OWNER, MANAGER, SUPERVISOR, CASHIER, WAITER, BARTENDER
- **Source**: `apps\web\src\pages\pos\index.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| New Order | `pos-new-order` | create |
| Add Item | `pos-add-item` | create |
| Send to Kitchen | `pos-send-kitchen` | update |
| Checkout | `pos-checkout` | navigate |
| Void Order | `pos-void-order` | delete |
| Split Bill | `pos-split-bill` | update |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/pos/open` |
| GET | `/pos/menu` |
| POST | `/pos/orders` |
| POST | `/pos/orders/:id/lines` |
| POST | `/pos/orders/:id/send` |
| POST | `/pos/orders/:id/void` |

---

### Cash Sessions

- **Route**: `/pos/cash-sessions`
- **Risk**: 🔴 HIGH
- **Roles**: OWNER, MANAGER, SUPERVISOR, CASHIER
- **Source**: `apps\web\src\pages\pos\cash-sessions.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Open Session | `cash-open-session` | create |
| Close Session | `cash-close-session` | update |
| Confirm Open | `cash-confirm-open` | create |
| Confirm Close | `cash-confirm-close` | update |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/pos/cash-sessions` |
| POST | `/pos/cash-sessions/open` |
| POST | `/pos/cash-sessions/:id/close` |

---

### POS Checkout

- **Route**: `/pos/checkout/[orderId]`
- **Risk**: 🔴 HIGH
- **Roles**: OWNER, MANAGER, SUPERVISOR, CASHIER, WAITER, BARTENDER
- **Source**: `apps\web\src\pages\pos\checkout\[orderId].tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Pay Cash | `checkout-pay-cash` | create |
| Pay Card | `checkout-pay-card` | create |
| Pay Mobile | `checkout-pay-mobile` | create |
| Complete Sale | `checkout-complete` | update |
| Back to POS | `checkout-back` | navigate |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/pos/orders/:id` |
| POST | `/pos/orders/:id/payments` |
| POST | `/pos/orders/:id/complete` |

---

### Payroll Runs

- **Route**: `/workforce/payroll-runs`
- **Risk**: 🔴 HIGH
- **Roles**: OWNER, MANAGER, ACCOUNTANT
- **Source**: `apps\web\src\pages\workforce\payroll-runs\index.tsx`

**Actions**:

| Label | Test ID | Intent |
|-------|---------|--------|
| Create Payroll Run | `payroll-create` | create |
| Calculate | `payroll-calculate` | update |
| Approve | `payroll-approve` | approve |
| Post | `payroll-post` | update |
| Export | `payroll-export` | export |

**API Calls**:

| Method | Path |
|--------|------|
| GET | `/workforce/payroll-runs` |
| POST | `/workforce/payroll-runs` |
| POST | `/workforce/payroll-runs/:id/calculate` |
| POST | `/workforce/payroll-runs/:id/approve` |
| POST | `/workforce/payroll-runs/:id/post` |

---

*Generated by `pnpm actions:generate`. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*
