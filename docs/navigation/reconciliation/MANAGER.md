# MANAGER Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-10

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | MANAGER |
| Total Routes | 28 |
| Total Sidebar Links | 21 |
| Total Actions | 21 |
| Probe OK | 21 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | In pageMeta | Status |
|-------|--------------|------------|---------------|-------------|--------|
| `/workspaces/manager` | ✅ landing | — (workspace) | — | — | ✅ OK |
| `/dashboard` | ✅ Overview | ✅ Dashboard | ✅ ok | — | ✅ OK |
| `/analytics` | ✅ Overview | ✅ Analytics | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/reports` | ✅ Overview | ✅ Reports | ✅ ok | — | ✅ OK |
| `/pos` | ✅ Operations | ✅ POS | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/pos/checkout/[orderId]` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/pos/cash-sessions` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/reservations` | ✅ Operations | ✅ Reservations | ✅ ok | — | ✅ OK |
| `/inventory` | ✅ Operations | ✅ Inventory | ✅ ok | — | ✅ OK |
| `/inventory/items` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/inventory/purchase-orders` | — (sub-route) | — | — | ✅ allowedRoles | ✅ OK |
| `/staff` | ✅ Team | ✅ Staff | ✅ ok | — | ✅ OK |
| `/feedback` | ✅ Team | ✅ Feedback | ✅ ok | — | ✅ OK |
| `/workforce/schedule` | ✅ Workforce | ✅ Schedule | ✅ ok | — | ✅ OK |
| `/workforce/timeclock` | ✅ Workforce | ✅ Timeclock | ✅ ok | — | ✅ OK |
| `/workforce/approvals` | ✅ Workforce | ✅ Approvals | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/workforce/swaps` | ✅ Workforce | ✅ Swap Approvals | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/workforce/labor` | ✅ Workforce | ✅ Labor Reports | ✅ ok | — | ✅ OK |
| `/workforce/labor-targets` | ✅ Workforce | ✅ Labor Targets | ✅ ok | — | ✅ OK |
| `/workforce/staffing-planner` | ✅ Workforce | ✅ Staffing Planner | ✅ ok | — | ✅ OK |
| `/workforce/staffing-alerts` | ✅ Workforce | ✅ Staffing Alerts | ✅ ok | — | ✅ OK |
| `/workforce/auto-scheduler` | ✅ Workforce | ✅ Auto-Scheduler | ✅ ok | — | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | — | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | — | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | — | ✅ OK |
| `/settings` | ✅ Settings | ✅ Settings | ✅ ok | — | ✅ OK |
| `/kds` | — (oversight) | — | — | ✅ allowedRoles | ✅ OK |

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
| `/workforce/approvals` | Approve Shift | `shift-approve` | ✅ | ✅ | POST /workforce/scheduling/shifts/:id/approve | ✅ OK |
| `/workforce/swaps` | Approve Swap | `swap-approve` | ✅ | ✅ | POST /workforce/swaps/:id/approve | ✅ OK |
| `/workforce/swaps` | Reject Swap | `swap-reject` | ✅ | ✅ | POST /workforce/swaps/:id/reject | ✅ OK |
| `/inventory/items` | Add Item | `create-item-btn` | ✅ | ✅ | POST /inventory/items | ✅ OK |
| `/inventory/items` | Edit Item | `edit-item-btn` | ✅ | ✅ | PATCH /inventory/items/:id | ✅ OK |
| `/kds` | Mark Ready | `kds-ready` | ✅ | ✅ | POST /kitchen/orders/:id/ready | ✅ OK |
| `/kds` | Bump Order | `kds-bump` | ✅ | ✅ | POST /kitchen/orders/:id/bump | ✅ OK |
| `/analytics` | Export CSV | `analytics-export-csv` | ✅ | ✅ | — | ✅ OK |
| `/analytics` | Date Filter | `analytics-date-filter` | ✅ | ✅ | — | ✅ OK |

---

## Fixes Applied This Session

| File | Issue | Fix |
|------|-------|-----|
| `/workforce/approvals.tsx` | Missing pageMeta | Added pageMeta with allowedRoles and primaryActions |
| `/workforce/approvals.tsx` | Missing data-testid on button | Added `shift-approve` data-testid |
| `/analytics/index.tsx` | Missing pageMeta | Added pageMeta with allowedRoles and primaryActions |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| Overview | 3 | 3 | 0 | 0 |
| Operations | 3 | 3 | 0 | 0 |
| Team | 2 | 2 | 0 | 0 |
| Workforce | 9 | 9 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 |
| **Total** | **21** | **21** | **0** | **0** |

---

## API Capture Summary

| Route | Calls | Primary API |
|-------|-------|-------------|
| `/dashboard` | 1 | GET /dashboard/manager |
| `/analytics` | 4 | GET /analytics/daily, GET /analytics/branches |
| `/pos` | 6 | GET /pos/open, POST /pos/orders |
| `/pos/checkout/[orderId]` | 3 | POST /pos/orders/:id/payments |
| `/pos/cash-sessions` | 3 | POST /pos/cash-sessions/open |
| `/workforce/approvals` | 2 | POST /workforce/scheduling/shifts/:id/approve |
| `/workforce/swaps` | 4 | POST /workforce/swaps/:id/approve |
| `/inventory/items` | 3 | POST /inventory/items |
| `/inventory/purchase-orders` | 2 | GET /inventory/purchase-orders |
| `/kds` | 3 | GET /kitchen/orders |
| **Total** | **31** | — |

---

## MANAGER Role Differentiators vs SUPERVISOR

| Capability | MANAGER | SUPERVISOR |
|------------|---------|------------|
| Sidebar Links | 21 | 10 |
| Nav Groups | 6 | 5 |
| Analytics Access | ✅ Full | ❌ No |
| Reports Hub | ✅ Yes | ❌ No |
| Labor Reports | ✅ Yes | ❌ No |
| Labor Targets | ✅ Yes | ❌ No |
| Staffing Planner | ✅ Yes | ❌ No |
| Staffing Alerts | ✅ Yes | ❌ No |
| Auto-Scheduler | ✅ Yes | ❌ No |
| Shift Approvals | ✅ Yes | ❌ No |
| Feedback | ✅ Yes | ❌ No |
| Inventory Management | ✅ Full | ❌ No |

---

## Notes

- MANAGER is the most comprehensive operational role
- Has full workforce management suite (9 pages)
- Analytics dashboard with franchise-wide visibility
- Can void orders (HIGH risk action)
- Shift approval is MANAGER-specific (not available to SUPERVISOR)
- Labor targets and staffing are management-level tools
