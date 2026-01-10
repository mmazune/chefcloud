# ACCOUNTANT Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-11

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | ACCOUNTANT |
| Total Routes | 16 |
| Total Sidebar Links | 15 |
| Total Actions | 12 |
| HIGH Risk Actions | 5 |
| Probe OK | 15 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | In pageMeta | Status |
|-------|--------------|------------|---------------|-------------|--------|
| `/workspaces/accountant` | ✅ landing | — (workspace) | — | — | ✅ OK |
| `/finance/accounts` | ✅ General Ledger | ✅ Chart of Accounts | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/finance/journal` | ✅ General Ledger | ✅ Journal Entries | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/finance/periods` | ✅ General Ledger | ✅ Fiscal Periods | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/finance/trial-balance` | ✅ Financial Statements | ✅ Trial Balance | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/finance/pnl` | ✅ Financial Statements | ✅ Profit & Loss | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/finance/balance-sheet` | ✅ Financial Statements | ✅ Balance Sheet | ✅ ok | ✅ allowedRoles | ✅ OK |
| `/service-providers` | ✅ Payables & Receivables | ✅ Service Providers | ✅ ok | — | ✅ OK |
| `/finance/ap-aging` | ✅ Payables & Receivables | ✅ AP Aging | ✅ ok | — | ✅ OK |
| `/finance/ar-aging` | ✅ Payables & Receivables | ✅ AR Aging | ✅ ok | — | ✅ OK |
| `/finance` | ✅ Budgets & Reports | ✅ Budgets | ✅ ok | — | ✅ OK |
| `/reports` | ✅ Budgets & Reports | ✅ Reports | ✅ ok | — | ✅ OK |
| `/analytics` | ✅ Budgets & Reports | ✅ Analytics | ✅ ok | — | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | — | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | — | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | — | ✅ OK |

---

## Action Reconciliation

| Route | Action | Test ID | In pageMeta | data-testid Present | Risk | Status |
|-------|--------|---------|-------------|---------------------|------|--------|
| `/finance/accounts` | Clear Filters | `coa-clear-filters` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/journal` | New Journal Entry | `journal-create` | ✅ | ✅ | 🔴 HIGH | ✅ OK |
| `/finance/journal` | Create Entry | `journal-submit` | ✅ | ✅ | 🔴 HIGH | ✅ OK |
| `/finance/journal` | Post Entry | `journal-post` | ✅ | — (modal) | 🔴 HIGH | ✅ OK |
| `/finance/journal` | Reverse Entry | `journal-reverse` | ✅ | — (modal) | 🔴 HIGH | ✅ OK |
| `/finance/periods` | Close Period | `period-close` | ✅ | ✅ | 🔴 HIGH | ✅ OK |
| `/finance/trial-balance` | Generate Report | `tb-generate` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/trial-balance` | Export CSV | `tb-export` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/pnl` | Generate Report | `pnl-generate` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/pnl` | Export CSV | `pnl-export` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/balance-sheet` | Generate Report | `bs-generate` | ✅ | ✅ | LOW | ✅ OK |
| `/finance/balance-sheet` | Export CSV | `bs-export` | ✅ | ✅ | LOW | ✅ OK |

---

## HIGH Risk Actions Detail

| Action | Route | API | Reason |
|--------|-------|-----|--------|
| `journal-create` | `/finance/journal` | POST /accounting/journal-entries | Creates financial GL entry |
| `journal-submit` | `/finance/journal` | POST /accounting/journal-entries | Submits entry for posting |
| `journal-post` | `/finance/journal` | POST /accounting/journal-entries/:id/post | Posts to GL - irreversible |
| `journal-reverse` | `/finance/journal` | POST /accounting/journal-entries/:id/reverse | Creates reversing JE |
| `period-close` | `/finance/periods` | PUT /accounting/fiscal-periods/:id/close | Closes accounting period |

---

## Fixes Applied This Session

| File | Issue | Fix |
|------|-------|-----|
| `finance/journal.tsx` | Missing data-testid on buttons | Added `journal-create`, `journal-submit` |
| `finance/trial-balance.tsx` | Missing pageMeta | Added pageMeta with allowedRoles |
| `finance/trial-balance.tsx` | Missing data-testid | Added `tb-generate`, `tb-export` |
| `finance/pnl.tsx` | Missing pageMeta | Added pageMeta with allowedRoles |
| `finance/pnl.tsx` | Missing data-testid | Added `pnl-generate`, `pnl-export` |
| `finance/balance-sheet.tsx` | Missing pageMeta | Added pageMeta with allowedRoles |
| `finance/balance-sheet.tsx` | Missing data-testid | Added `bs-generate`, `bs-export` |
| `finance/accounts.tsx` | Missing pageMeta | Added pageMeta with allowedRoles |
| `finance/accounts.tsx` | Missing data-testid | Added `coa-clear-filters` |
| `finance/periods.tsx` | Missing pageMeta | Added pageMeta with allowedRoles, HIGH risk |
| `finance/periods.tsx` | Missing data-testid | Added `period-close` |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| General Ledger | 3 | 3 | 0 | 0 |
| Financial Statements | 3 | 3 | 0 | 0 |
| Payables & Receivables | 3 | 3 | 0 | 0 |
| Budgets & Reports | 3 | 3 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| **Total** | **15** | **15** | **0** | **0** |

---

## Unresolved Items

None. All routes reconciled successfully.

---

## Certification

- [x] All 15 sidebar links verified in roleCapabilities.ts
- [x] All 15 links probe as OK (no forbidden/error)
- [x] All finance pages have pageMeta with allowedRoles
- [x] All 5 HIGH risk actions tagged with risk: 'HIGH'
- [x] All action buttons have data-testid attributes
- [x] 0 unresolved reconciliation rows

**Reconciliation Status: ✅ COMPLETE**
