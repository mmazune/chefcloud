# SUPERVISOR Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-10

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | SUPERVISOR |
| Total Routes | 13 |
| Total Sidebar Links | 10 |
| Total Actions | 14 |
| Probe OK | 10 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | In pageMeta | Status |
|-------|--------------|------------|---------------|-------------|--------|
| `/workspaces/supervisor` | ✅ landing | — (workspace) | — | — | ✅ OK |
| `/pos` | ✅ Operations | ✅ POS | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/pos/checkout/[orderId]` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/pos/cash-sessions` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/reservations` | ✅ Operations | ✅ Reservations | ✅ ok | — | ✅ OK |
| `/staff` | ✅ Operations | ✅ Staff | ✅ ok | — | ✅ OK |
| `/workforce/timeclock` | ✅ Workforce | ✅ Timeclock | ✅ ok | — | ✅ OK |
| `/workforce/swaps` | ✅ Workforce | ✅ Swap Approvals | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/dashboard` | ✅ Overview | ✅ Dashboard | ✅ ok | — | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | — | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | — | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | — | ✅ OK |
| `/settings` | ✅ Settings | ✅ Settings | ✅ ok | — | ✅ OK |

---

## Action Reconciliation

| Route | Action | Test ID | In pageMeta | data-testid Present | API Call | Status |
|-------|--------|---------|-------------|---------------------|----------|--------|
| `/pos` | New Order | `pos-new-order` | ✅ | ✅ | POST /pos/orders | ✅ OK |
| `/pos` | Add Item | `pos-add-item` | ✅ | ✅ | POST /pos/orders/:id/lines | ✅ OK |
| `/pos` | Send to Kitchen | `pos-send-kitchen` | ✅ | ✅ | POST /pos/orders/:id/send | ✅ OK |
| `/pos` | Take Payment | `pos-checkout` | ✅ | ✅ | — (modal) | ✅ OK |
| `/pos` | Void Order | `pos-void-order` | ✅ | ✅ | POST /pos/orders/:id/void | ✅ OK |
| `/pos` | Split Bill | `pos-split-bill` | ✅ | ✅ | — | ✅ OK |
| `/pos/checkout` | Back to POS | `checkout-back` | ✅ | ✅ | — | ✅ OK |
| `/pos/checkout` | Pay Cash | `checkout-pay-cash` | ✅ | ✅ | POST /pos/orders/:id/payments | ✅ OK |
| `/pos/checkout` | Pay Card | `checkout-pay-card` | ✅ | ✅ | POST /pos/orders/:id/payments | ✅ OK |
| `/pos/checkout` | Complete Sale | `checkout-complete` | ✅ | ✅ | POST /pos/orders/:id/complete | ✅ OK |
| `/pos/cash-sessions` | Open Session | `cash-session-open` | ✅ | ✅ | POST /pos/cash-sessions/open | ✅ OK |
| `/pos/cash-sessions` | Close Session | `cash-session-close` | ✅ | ✅ | POST /pos/cash-sessions/:id/close | ✅ OK |
| `/workforce/swaps` | Approve Swap | `swap-approve` | ✅ | ✅ | POST /workforce/swaps/:id/approve | ✅ OK |
| `/workforce/swaps` | Reject Swap | `swap-reject` | ✅ | ✅ | POST /workforce/swaps/:id/reject | ✅ OK |

---

## Fixes Applied This Session

| File | Issue | Fix |
|------|-------|-----|
| `/workforce/swaps.tsx` | Missing pageMeta | Added pageMeta with allowedRoles and primaryActions |
| `/workforce/swaps.tsx` | Missing data-testid on buttons | Added `swap-approve`, `swap-reject` data-testid |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| Operations | 3 | 3 | 0 | 0 |
| Workforce | 2 | 2 | 0 | 0 |
| Overview | 1 | 1 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 |
| **Total** | **10** | **10** | **0** | **0** |

---

## API Capture Summary

| Route | Calls | Primary API |
|-------|-------|-------------|
| `/pos` | 6 | GET /pos/open, POST /pos/orders |
| `/pos/checkout/[orderId]` | 3 | POST /pos/orders/:id/payments |
| `/pos/cash-sessions` | 3 | POST /pos/cash-sessions/open |
| `/workforce/swaps` | 4 | POST /workforce/swaps/:id/approve |
| **Total** | **16** | — |

---

## Notes

- SUPERVISOR role bridges floor operations and management
- Has full POS access including void (unlike WAITER/BARTENDER)
- Has cash session management (shared with CASHIER, MANAGER, OWNER)
- Unique responsibility: approving/rejecting staff swap requests
- Dashboard provides shift oversight metrics
- Also maintains personal schedule management capabilities
