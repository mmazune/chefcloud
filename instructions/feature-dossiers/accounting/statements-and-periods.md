# Feature Dossier: Financial Statements and Periods

> **Status:** `COMPLETE`  
> **Created:** 2026-01-02  
> **Author:** ChefCloud Team  
> **Milestone:** M8.2  

---

## 1. Scope

### 1.1 Feature Summary

Financial statements module provides Trial Balance, P&L (Income Statement), and Balance Sheet derived from the general ledger. Fiscal periods allow closing and locking of accounting periods to prevent backdated entries.

### 1.2 In Scope

- Trial Balance (as-of date, optional branch filter)
- Profit & Loss Statement (date range, optional branch filter)
- Balance Sheet (as-of date, optional branch filter)
- Fiscal Period management (create, close, lock)
- Period validation (block entries in locked periods)
- CSV export for all statements

### 1.3 Out of Scope

- Cash Flow Statement (M8.4+)
- Comparative statements (prior period comparison)
- PDF export (infrastructure TBD)
- Budget vs Actual variance (separate endpoint)

### 1.4 Nimbus Modules Affected

| Module | Type | Description |
|--------|------|-------------|
| accounting | API | Statement endpoints, periods controller |
| finance | API | Budgets and variance |

### 1.5 Database Tables Affected

| Table | Action | Description |
|-------|--------|-------------|
| journal_entries | READ | Source data for statements |
| journal_lines | READ | Line-level aggregation |
| accounts | READ | Account metadata for grouping |
| fiscal_periods | CREATE/UPDATE | Period management |

### 1.6 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /accounting/trial-balance | Trial balance as of date |
| GET | /accounting/pnl | P&L for date range |
| GET | /accounting/balance-sheet | Balance sheet as of date |
| GET | /accounting/periods | List fiscal periods |
| POST | /accounting/periods | Create fiscal period |
| PATCH | /accounting/periods/:id/close | Close period |
| PATCH | /accounting/periods/:id/lock | Lock period |

---

## 2. What Enterprise Systems Do

Based on clean-room study of accounting patterns:

1. **Trial Balance**: Lists all accounts with debit/credit totals; debits must equal credits
2. **P&L Statement**: Revenue minus expenses for a period; shows operating profit
3. **Balance Sheet**: Assets = Liabilities + Equity at a point in time
4. **Period Close**: Soft lock that warns but allows entries (for adjustments)
5. **Period Lock**: Hard lock that blocks any new entries
6. **Close Entry**: System-generated entry to move P&L to Retained Earnings at period end
7. **Branch Filtering**: Multi-location orgs filter statements by branch
8. **Comparative View**: Show current vs prior period side by side
9. **Drill-Down**: Click a line item to see underlying journal entries
10. **Rounding Tolerance**: Allow sub-penny differences (0.01) due to floating point
11. **Zero-Balance Suppression**: Option to hide accounts with zero balance
12. **Export Formats**: CSV (standard), PDF (formatted), Excel (full data)

---

## 3. Current Nimbus State

### 3.1 What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| Trial Balance endpoint | ✅ Complete | `accounting.controller.ts` GET /trial-balance |
| P&L endpoint | ✅ Complete | `accounting.controller.ts` GET /pnl |
| Balance Sheet endpoint | ✅ Complete | `accounting.controller.ts` GET /balance-sheet |
| FiscalPeriod model | ✅ Complete | `packages/db/prisma/schema.prisma` |
| PeriodsController | ✅ Complete | `periods.controller.ts` |
| PeriodsService | ✅ Complete | `periods.service.ts` |
| Branch filter on statements | ⚠️ Partial | Query param exists, needs validation |
| Period lock validation | ⚠️ Partial | Lock implemented, entry validation pending |
| Seeded fiscal periods | ❌ Missing | No demo fiscal periods |

### 3.2 Gaps and Limitations

- **GAP-1**: No fiscal periods seeded for demo orgs
- **GAP-2**: Journal entry creation doesn't check period lock
- **GAP-3**: Branch filter on statements not tested
- **GAP-4**: No CSV export for statements

### 3.3 Related Features

| Feature | Status | Dependency |
|---------|--------|------------|
| GL Core | Complete | Uses |
| Bank Reconciliation | Partial | Separate |
| Budgets | Complete | Parallel |

---

## 4. Implementation Plan

| Priority | Gap | Action | Effort |
|----------|-----|--------|--------|
| P0 | GAP-1 | Add seedFiscalPeriods to demo | 30m |
| P1 | GAP-2 | Validate period lock before journal entry | 1h |
| P1 | GAP-3 | Add E2E tests for branch filtering | 1h |
| P2 | GAP-4 | Add CSV export endpoints | 2h |

---

## 5. Acceptance Criteria

### AC-1: Trial Balance Balances
- GET /accounting/trial-balance returns rows with debit/credit totals
- Sum of all debits == Sum of all credits (within 0.01 tolerance)

### AC-2: P&L Shows Revenue and Expenses
- GET /accounting/pnl returns revenue accounts (4xxx) and expense accounts (5xxx, 6xxx)
- Net income = Total Revenue - Total COGS - Total Expenses

### AC-3: Balance Sheet Equation
- Assets (1xxx) = Liabilities (2xxx) + Equity (3xxx) + Net Income

### AC-4: Period Lock Blocks Entries
- Creating journal entry in locked period returns 403 with clear error message
- Creating journal entry in open period succeeds

### AC-5: Branch Filter Works
- Same statement with different branchId returns different totals (Cafesserie)
- Statement without branchId returns org-wide totals

---

## 6. E2E Test Mapping

| AC | Test | Description |
|----|------|-------------|
| AC-1 | `accounting.e2e-spec.ts` | Trial balance debits == credits |
| AC-2 | `accounting.e2e-spec.ts` | P&L has revenue and expense totals |
| AC-3 | `accounting.e2e-spec.ts` | Balance sheet equation holds |
| AC-4 | `accounting.e2e-spec.ts` | Journal in locked period fails |
| AC-5 | `accounting.e2e-spec.ts` | Branch filter changes totals |

---

## 7. Statement Calculation Logic

### Trial Balance
```
For each account:
  - Sum all journal_lines.debit where accountId = account.id AND date <= asOf
  - Sum all journal_lines.credit where accountId = account.id AND date <= asOf
  - Net balance = debits - credits (for assets/expenses) or credits - debits (for liabilities/equity/revenue)
```

### P&L
```
Revenue (4xxx):
  - Sum credits - debits for revenue accounts where date BETWEEN from AND to

COGS (5xxx):
  - Sum debits - credits for COGS accounts where date BETWEEN from AND to

Expenses (6xxx):
  - Sum debits - credits for expense accounts where date BETWEEN from AND to

Net Income = Revenue - COGS - Expenses
```

### Balance Sheet
```
Assets (1xxx):
  - Sum debits - credits for asset accounts where date <= asOf

Liabilities (2xxx):
  - Sum credits - debits for liability accounts where date <= asOf

Equity (3xxx):
  - Sum credits - debits for equity accounts where date <= asOf

YTD Net Income:
  - Calculate P&L from period start to asOf
  
Verify: Assets = Liabilities + Equity + YTD Net Income
```

---

## 8. Files to Modify/Create

| File | Action |
|------|--------|
| `services/api/prisma/demo/seedDemo.ts` | Add seedFiscalPeriods function |
| `services/api/src/accounting/posting.service.ts` | Add period lock validation |
| `services/api/src/accounting/accounting.service.ts` | Add branch filter validation |
| `services/api/test/e2e/accounting.e2e-spec.ts` | Add statement E2E tests |

---

## 9. Fiscal Period Seed Data

| Period | Name | Start | End | Status |
|--------|------|-------|-----|--------|
| FY2025-Q4 | Q4 2025 | 2025-10-01 | 2025-12-31 | LOCKED |
| FY2026-Q1 | Q1 2026 | 2026-01-01 | 2026-03-31 | OPEN |
