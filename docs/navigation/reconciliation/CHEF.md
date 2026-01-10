# CHEF Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-10

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | CHEF |
| Total Routes | 9 |
| Total Sidebar Links | 8 |
| Total Actions | 7 |
| Probe OK | 8 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | In pageMeta | Status |
|-------|--------------|------------|---------------|-------------|--------|
| `/workspaces/chef` | ✅ landing | — | — | — | ✅ OK |
| `/kds` | ✅ Kitchen | ✅ KDS | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/dashboard` | ✅ Kitchen | ✅ Dashboard | ✅ ok | — | ✅ OK |
| `/inventory` | ✅ Kitchen | ✅ Inventory | ✅ ok | — | ✅ OK |
| `/workforce/timeclock` | ✅ Workforce | ✅ Timeclock | ✅ ok | — | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | — | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | — | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | — | ✅ OK |
| `/settings` | ✅ Settings | ✅ Settings | ✅ ok | — | ✅ OK |

---

## Action Reconciliation

| Route | Action | Test ID | In pageMeta | data-testid Present | API Call | Status |
|-------|--------|---------|-------------|---------------------|----------|--------|
| `/kds` | Mark In Progress | `kds-in-progress` | ✅ | ✅ | PATCH /kds/tickets/:id/start | ✅ OK |
| `/kds` | Mark Ready | `kds-ready` | ✅ | ✅ | PATCH /kds/tickets/:id/ready | ✅ OK |
| `/kds` | Recall | `kds-recall` | ✅ | ✅ | PATCH /kds/tickets/:id/recall | ✅ OK |
| `/kds` | Mark Served | `kds-served` | ✅ | ✅ | PATCH /kds/tickets/:id/served | ✅ OK |
| `/kds` | Filter Status | `kds-filter` | ✅ | ✅ | — | ✅ OK |
| `/kds` | Refresh | `kds-refresh` | ✅ | ✅ | GET /kds/tickets | ✅ OK |
| `/kds` | Settings | `kds-settings` | ✅ | ✅ | — | ✅ OK |

---

## Fixes Applied This Session

| Item | Issue | Fix Applied |
|------|-------|-------------|
| `/kds` not in CHEF sidebar | KDS page allowed CHEF in pageMeta but wasn't in roleCapabilities | Added `/kds` to CHEF.navGroups in roleCapabilities.ts |
| `kds-in-progress` no data-testid | Button missing data-testid | Added to KdsOrderCard.tsx |
| `kds-ready` no data-testid | Button missing data-testid | Added to KdsOrderCard.tsx |
| `kds-recall` no data-testid | Button missing data-testid | Added to KdsOrderCard.tsx |
| `kds-served` missing | Action not in pageMeta | Added to pageMeta + button |
| `kds-refresh` missing | Action not in pageMeta | Added to pageMeta + button |
| `kds-filter` no data-testid | Container missing data-testid | Added to KDS page |
| `kds-settings` no data-testid | Button missing data-testid | Added to KDS page |

---

## Actions NOT Available to CHEF

| Route | Action | Test ID | Reason |
|-------|--------|---------|--------|
| `/pos` | Void Order | `pos-void-order` | Requires CASHIER or MANAGER role |
| `/pos/cash-sessions` | All cash session actions | — | CASHIER-only page |
| `/finance/journal` | Journal entry actions | — | ACCOUNTANT/OWNER only |
| `/workforce/payroll-runs` | Payroll actions | — | OWNER/MANAGER only |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| Kitchen | 3 | 3 | 0 | 0 |
| Workforce | 1 | 1 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 |
| **Total** | **8** | **8** | **0** | **0** |

---

## API Capture Summary

| Route | Calls | Primary API |
|-------|-------|-------------|
| `/kds` | 1 | GET /kds/tickets |
| **Total** | **1** | — |

---

## Conclusion

✅ **CHEF role is 100% reconciled.**

- All 8 sidebar links accessible and probed OK
- All 7 KDS actions have data-testid and are in pageMeta
- No forbidden or error probe outcomes
- Critical fix: Added `/kds` to CHEF roleCapabilities (was missing)
- All KDS buttons now have proper data-testid for testing
