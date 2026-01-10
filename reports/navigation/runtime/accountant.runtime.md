# ACCOUNTANT Runtime Navigation Map

**Generated:** 2026-01-11T10:00:00.000Z  
**Capture Method:** static-analysis-v2  
**Phase:** I3 (ROLE 7/11)

---

## Role Overview

| Metric | Value |
|--------|-------|
| Role | ACCOUNTANT |
| Default Landing | `/workspaces/accountant` |
| Nav Groups | 5 |
| Total Sidebar Links | 15 |
| Total Actions | 12 |
| HIGH Risk Actions | 5 |

---

## Navigation Groups

### 1. General Ledger
| Label | Route | Probe |
|-------|-------|-------|
| Chart of Accounts | `/finance/accounts` | ✅ ok |
| Journal Entries | `/finance/journal` | ✅ ok |
| Fiscal Periods | `/finance/periods` | ✅ ok |

### 2. Financial Statements
| Label | Route | Probe |
|-------|-------|-------|
| Trial Balance | `/finance/trial-balance` | ✅ ok |
| Profit & Loss | `/finance/pnl` | ✅ ok |
| Balance Sheet | `/finance/balance-sheet` | ✅ ok |

### 3. Payables & Receivables
| Label | Route | Probe |
|-------|-------|-------|
| Service Providers | `/service-providers` | ✅ ok |
| AP Aging | `/finance/ap-aging` | ✅ ok |
| AR Aging | `/finance/ar-aging` | ✅ ok |

### 4. Budgets & Reports
| Label | Route | Probe |
|-------|-------|-------|
| Budgets | `/finance` | ✅ ok |
| Reports | `/reports` | ✅ ok |
| Analytics | `/analytics` | ✅ ok |

### 5. My Schedule
| Label | Route | Probe |
|-------|-------|-------|
| My Availability | `/workforce/my-availability` | ✅ ok |
| My Swaps | `/workforce/my-swaps` | ✅ ok |
| Open Shifts | `/workforce/open-shifts` | ✅ ok |

---

## Actions Catalog

### General Ledger Actions

| Route | Test ID | Label | Risk |
|-------|---------|-------|------|
| `/finance/accounts` | `coa-clear-filters` | Clear Filters | LOW |
| `/finance/journal` | `journal-create` | New Journal Entry | 🔴 HIGH |
| `/finance/journal` | `journal-submit` | Create Entry | 🔴 HIGH |
| `/finance/journal` | `journal-post` | Post Entry | 🔴 HIGH |
| `/finance/journal` | `journal-reverse` | Reverse Entry | 🔴 HIGH |
| `/finance/periods` | `period-close` | Close Period | 🔴 HIGH |

### Financial Statement Actions

| Route | Test ID | Label | Risk |
|-------|---------|-------|------|
| `/finance/trial-balance` | `tb-generate` | Generate Report | LOW |
| `/finance/trial-balance` | `tb-export` | Export CSV | LOW |
| `/finance/pnl` | `pnl-generate` | Generate Report | LOW |
| `/finance/pnl` | `pnl-export` | Export CSV | LOW |
| `/finance/balance-sheet` | `bs-generate` | Generate Report | LOW |
| `/finance/balance-sheet` | `bs-export` | Export CSV | LOW |

---

## API Calls Summary

| Route | Method | Endpoint |
|-------|--------|----------|
| `/finance/accounts` | GET | `/accounting/accounts` |
| `/finance/journal` | GET | `/accounting/journal-entries` |
| `/finance/journal` | POST | `/accounting/journal-entries` |
| `/finance/journal` | POST | `/accounting/journal-entries/:id/post` |
| `/finance/journal` | POST | `/accounting/journal-entries/:id/reverse` |
| `/finance/periods` | GET | `/accounting/fiscal-periods` |
| `/finance/periods` | PUT | `/accounting/fiscal-periods/:id/close` |
| `/finance/trial-balance` | GET | `/accounting/trial-balance` |
| `/finance/pnl` | GET | `/accounting/pnl` |
| `/finance/balance-sheet` | GET | `/accounting/balance-sheet` |
| `/finance/ap-aging` | GET | `/accounting/ap/aging` |
| `/finance/ar-aging` | GET | `/accounting/ar/aging` |
| `/reports` | GET | `/reports` |
| `/analytics` | GET | `/analytics/daily` |

---

## HIGH Risk Action Details

| Action | Route | Reason |
|--------|-------|--------|
| `journal-create` | `/finance/journal` | Creates financial journal entry |
| `journal-submit` | `/finance/journal` | Submits journal entry for posting |
| `journal-post` | `/finance/journal` | Posts entry to GL - irreversible |
| `journal-reverse` | `/finance/journal` | Creates reversing entry |
| `period-close` | `/finance/periods` | Closes accounting period |

---

## Page Metadata Summary

| Page | pageMeta | data-testid | Risk |
|------|----------|-------------|------|
| `/finance/accounts` | ✅ | ✅ | LOW |
| `/finance/journal` | ✅ | ✅ | HIGH |
| `/finance/periods` | ✅ | ✅ | HIGH |
| `/finance/trial-balance` | ✅ | ✅ | LOW |
| `/finance/pnl` | ✅ | ✅ | LOW |
| `/finance/balance-sheet` | ✅ | ✅ | LOW |
