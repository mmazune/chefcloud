# BARTENDER Runtime Navigation Map

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Overview

| Metric | Value |
|--------|-------|
| Role | BARTENDER |
| Capture Method | static-analysis-v2 |
| Total Routes | 7 |
| Sidebar Links | 6 |
| Total Actions | 8 |
| API Calls Total | 3 |
| Probe OK | 6 |
| Probe Forbidden | 0 |
| Probe Error | 0 |

---

## Routes Visited

| Route | Status |
|-------|--------|
| `/pos` | ✅ Landing / Primary |
| `/pos/checkout/[orderId]` | ✅ Accessible (via modal) |
| `/inventory` | ✅ Accessible |
| `/workforce/my-availability` | ✅ Accessible |
| `/workforce/my-swaps` | ✅ Accessible |
| `/workforce/open-shifts` | ✅ Accessible |
| `/settings` | ✅ Accessible |

---

## Sidebar Links (with Probe Outcome)

| Nav Group | Label | Route | Probe |
|-----------|-------|-------|-------|
| Operations | POS | `/pos` | ✅ ok |
| Operations | Inventory | `/inventory` | ✅ ok |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok |
| Settings | Settings | `/settings` | ✅ ok |

---

## Actions by Route

### /pos — Point of Sale

| Test ID | Label | Element | Intent |
|---------|-------|---------|--------|
| `pos-new-order` | New Order | button | create |
| `pos-send-kitchen` | Send to Kitchen | button | update |
| `pos-checkout` | Take Payment | button | modal |
| `pos-split-bill` | Split Bill | button | update |

> **Note:** `pos-checkout` opens an in-page payment modal, not navigation.
> **Note:** `pos-void-order` is NOT available to BARTENDER (CASHIER/MANAGER only).

### /pos/checkout/[orderId] — Checkout Page

| Test ID | Label | Element | Intent |
|---------|-------|---------|--------|
| `checkout-back` | Back to POS | button | navigate |
| `checkout-pay-cash` | Pay Cash | button | create |
| `checkout-pay-card` | Pay Card | button | create |
| `checkout-complete` | Complete Sale | button | update |

---

## API Calls by Route

### /pos

| Method | Path | Phase |
|--------|------|-------|
| GET | `/pos/open` | page-load |
| GET | `/pos/menu` | page-load |

### /pos/checkout/[orderId]

| Method | Path | Phase |
|--------|------|-------|
| GET | `/pos/orders/:id` | page-load |

---

## Actions NOT Available to BARTENDER

| Route | Test ID | Reason |
|-------|---------|--------|
| `/pos` | `pos-void-order` | CASHIER/MANAGER only |
| `/pos/cash-sessions` | All | CASHIER only - page not in sidebar |

---

## Notes

- **Primary Workspace**: POS (`/pos`) for bar orders
- **Checkout Access**: BARTENDER can access checkout via modal
- **Void Restriction**: BARTENDER cannot void orders (CASHIER/MANAGER privilege)
- **Cash Sessions**: Not accessible to BARTENDER (CASHIER only)
- **Inventory View**: Read access to inventory for stock awareness
