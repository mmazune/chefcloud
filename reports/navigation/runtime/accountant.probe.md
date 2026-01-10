# ACCOUNTANT Navigation Probe Report

**Generated:** 2026-01-11T10:00:00.000Z  
**Phase:** I3 (ROLE 7/11)

---

## Summary

| Metric | Value |
|--------|-------|
| Total Links Probed | 15 |
| ✅ OK | 15 |
| ↩️ Redirect | 0 |
| ❌ Error | 0 |
| 🚫 Forbidden | 0 |

**Result: 100% pass rate**

---

## Probe Results by Nav Group

### General Ledger

| # | Label | Route | Outcome |
|---|-------|-------|---------|
| 1 | Chart of Accounts | `/finance/accounts` | ✅ ok |
| 2 | Journal Entries | `/finance/journal` | ✅ ok |
| 3 | Fiscal Periods | `/finance/periods` | ✅ ok |

### Financial Statements

| # | Label | Route | Outcome |
|---|-------|-------|---------|
| 4 | Trial Balance | `/finance/trial-balance` | ✅ ok |
| 5 | Profit & Loss | `/finance/pnl` | ✅ ok |
| 6 | Balance Sheet | `/finance/balance-sheet` | ✅ ok |

### Payables & Receivables

| # | Label | Route | Outcome |
|---|-------|-------|---------|
| 7 | Service Providers | `/service-providers` | ✅ ok |
| 8 | AP Aging | `/finance/ap-aging` | ✅ ok |
| 9 | AR Aging | `/finance/ar-aging` | ✅ ok |

### Budgets & Reports

| # | Label | Route | Outcome |
|---|-------|-------|---------|
| 10 | Budgets | `/finance` | ✅ ok |
| 11 | Reports | `/reports` | ✅ ok |
| 12 | Analytics | `/analytics` | ✅ ok |

### My Schedule

| # | Label | Route | Outcome |
|---|-------|-------|---------|
| 13 | My Availability | `/workforce/my-availability` | ✅ ok |
| 14 | My Swaps | `/workforce/my-swaps` | ✅ ok |
| 15 | Open Shifts | `/workforce/open-shifts` | ✅ ok |

---

## API Health Check

All 15 routes successfully loaded their expected API endpoints.

| Route | Primary API | Status |
|-------|-------------|--------|
| `/finance/accounts` | `/accounting/accounts` | 200 |
| `/finance/journal` | `/accounting/journal-entries` | 200 |
| `/finance/periods` | `/accounting/fiscal-periods` | 200 |
| `/finance/trial-balance` | `/accounting/trial-balance` | 200 |
| `/finance/pnl` | `/accounting/pnl` | 200 |
| `/finance/balance-sheet` | `/accounting/balance-sheet` | 200 |
| `/service-providers` | `/service-providers` | 200 |
| `/finance/ap-aging` | `/accounting/ap/aging` | 200 |
| `/finance/ar-aging` | `/accounting/ar/aging` | 200 |
| `/reports` | `/reports` | 200 |
| `/analytics` | `/analytics/daily` | 200 |
| `/workforce/my-availability` | `/workforce/availability` | 200 |
| `/workforce/my-swaps` | `/workforce/swaps` | 200 |
| `/workforce/open-shifts` | `/workforce/scheduling/open-shifts` | 200 |

---

## Errors & Redirects

None encountered during probe.
