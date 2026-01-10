# BARTENDER Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-10

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | BARTENDER |
| Total Routes | 7 |
| Total Sidebar Links | 6 |
| Total Actions | 8 |
| Probe OK | 6 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | In pageMeta | Status |
|-------|--------------|------------|---------------|-------------|--------|
| `/pos` | ✅ Operations | ✅ POS | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/pos/checkout/[orderId]` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/inventory` | ✅ Operations | ✅ Inventory | ✅ ok | — | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | — | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | — | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | — | ✅ OK |
| `/settings` | ✅ Settings | ✅ Settings | ✅ ok | — | ✅ OK |

---

## Action Reconciliation

| Route | Action | Test ID | In pageMeta | data-testid Present | API Call | Status |
|-------|--------|---------|-------------|---------------------|----------|--------|
| `/pos` | New Order | `pos-new-order` | ✅ | ✅ | POST /pos/orders | ✅ OK |
| `/pos` | Send to Kitchen | `pos-send-kitchen` | ✅ | ✅ | POST /pos/orders/:id/send | ✅ OK |
| `/pos` | Take Payment | `pos-checkout` | ✅ | ✅ | — (modal) | ✅ OK |
| `/pos` | Split Bill | `pos-split-bill` | ✅ | ✅ | — | ✅ OK |
| `/pos/checkout` | Back to POS | `checkout-back` | ✅ | ✅ | — | ✅ OK |
| `/pos/checkout` | Pay Cash | `checkout-pay-cash` | ✅ | ✅ | POST /pos/orders/:id/payments | ✅ OK |
| `/pos/checkout` | Pay Card | `checkout-pay-card` | ✅ | ✅ | POST /pos/orders/:id/payments | ✅ OK |
| `/pos/checkout` | Complete Sale | `checkout-complete` | ✅ | ✅ | POST /pos/orders/:id/complete | ✅ OK |

---

## Actions NOT Available to BARTENDER

| Route | Action | Test ID | Reason |
|-------|--------|---------|--------|
| `/pos` | Void Order | `pos-void-order` | Requires CASHIER or MANAGER role |
| `/pos/cash-sessions` | All cash session actions | — | CASHIER-only page |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| Operations | 2 | 2 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 |
| **Total** | **6** | **6** | **0** | **0** |

---

## API Capture Summary

| Route | Calls | Primary API |
|-------|-------|-------------|
| `/pos` | 2 | GET /pos/open, GET /pos/menu |
| `/pos/checkout/[orderId]` | 1 | GET /pos/orders/:id |
| **Total** | **3** | — |

---

## BARTENDER vs WAITER Comparison

| Feature | BARTENDER | WAITER |
|---------|-----------|--------|
| POS Access | ✅ | ✅ |
| Checkout Access | ✅ | ✅ |
| Void Order | ❌ | ❌ |
| Reservations | ❌ | ✅ |
| Inventory View | ✅ | ❌ |
| Schedule Access | ✅ | ✅ |

---

## Conclusion

✅ **BARTENDER role is 100% reconciled.**

- All 6 sidebar links accessible and probed OK
- All 8 POS/checkout actions have data-testid and are in pageMeta
- No forbidden or error probe outcomes
- BARTENDER has similar POS access to WAITER (minus void-order)
- BARTENDER has inventory view access (WAITER does not)
- BARTENDER does NOT have reservations access (WAITER does)
