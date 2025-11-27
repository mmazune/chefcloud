# M8 Step 0: Existing Accounting Implementation Review

**Date:** November 18, 2024  
**Reviewed by:** GitHub Copilot (Sonnet 4.5)

---

## Executive Summary

ChefCloud already has a **substantial accounting foundation** implemented in **E40-S1** (Accounting Core) and **E40-S2** (Fiscal Periods & Bank Reconciliation). The system includes:

✅ Double-entry GL with balanced journal entries  
✅ Chart of Accounts (CoA) with 11+ standard accounts  
✅ Trial Balance, P&L, and Balance Sheet APIs  
✅ Fiscal period locking  
✅ Automated postings from POS sales, COGS, refunds, and cash movements  
✅ Vendor bill management and AP/AR aging reports  
✅ Bank reconciliation

**Key Gap:** Not all operational flows fully post to GL yet (wastage, payroll, service providers need review/completion).

---

## 1. Database Schema (Prisma)

### Existing Models (Well-Designed)

#### 1.1 Account Model

```prisma
model Account {
  id        String      @id @default(cuid())
  orgId     String
  code      String      // Unique within org (e.g., "1000", "4000")
  name      String      // e.g., "Cash", "Sales Revenue"
  type      AccountType // ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE
  isActive  Boolean     @default(true)
  parentId  String?     // ✅ Supports hierarchy
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  parent       Account?      @relation("AccountHierarchy", fields: [parentId], references: [id])
  children     Account[]     @relation("AccountHierarchy")
  journalLines JournalLine[]

  @@unique([orgId, code])
  @@index([orgId, type])
}
```

**Assessment:** ✅ **Excellent**

- Hierarchical structure supported (parentId)
- Proper indexing for performance
- Account types match standard accounting categories
- Missing: `currency` field (for multi-currency), `costCenterId` link

---

#### 1.2 JournalEntry Model

```prisma
model JournalEntry {
  id         String   @id @default(cuid())
  orgId      String
  date       DateTime @default(now())
  memo       String?
  source     String?  // e.g., "POS_SALE", "REFUND", "PAYROLL", "MANUAL"
  sourceId   String?  // Reference to source entity ID
  postedById String?
  createdAt  DateTime @default(now())

  lines JournalLine[]

  @@index([orgId, date])
  @@index([source, sourceId])
}
```

**Assessment:** ✅ **Solid**

- Captures audit trail (source, sourceId, postedById)
- Indexed for reporting queries
- Missing: `branchId` field (important for multi-branch orgs)
- Missing: `description` vs `memo` (spec says description, code uses memo - minor naming inconsistency)

---

#### 1.3 JournalLine Model

```prisma
model JournalLine {
  id        String   @id @default(cuid())
  entryId   String
  accountId String
  branchId  String?  // ✅ Good: Allows branch-level cost tracking
  debit     Decimal  @default(0) @db.Decimal(12, 2)
  credit    Decimal  @default(0) @db.Decimal(12, 2)
  meta      Json?    // Additional context
  createdAt DateTime @default(now())

  entry   JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  account Account      @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([entryId])
  @@index([accountId])
}
```

**Assessment:** ✅ **Well-designed**

- Separate debit/credit columns (standard practice)
- Branch tracking at line level (good for franchise reporting)
- Meta field for flexible context storage
- Missing: Explicit check constraint to enforce debit/credit balance (should add in service layer)

---

#### 1.4 FiscalPeriod Model (from E40-S2)

```prisma
model FiscalPeriod {
  id         String             @id @default(cuid())
  orgId      String
  name       String
  startsAt   DateTime
  endsAt     DateTime
  status     FiscalPeriodStatus @default(OPEN) // OPEN | LOCKED
  lockedById String?
  lockedAt   DateTime?
  createdAt  DateTime           @default(now())

  @@index([orgId, status])
  @@index([orgId, startsAt, endsAt])
}

enum FiscalPeriodStatus {
  OPEN
  LOCKED
}
```

**Assessment:** ✅ **Good, but could be enhanced**

- Supports OPEN/LOCKED states
- Missing: `CLOSED` state (spec requires OPEN/CLOSED/LOCKED progression)
- Missing: `closedById`, `closedAt` fields (only has lockedBy/At)
- Missing: `branchId` for branch-specific periods

**Recommendation:** Add CLOSED state and closedBy/At fields to match spec requirements.

---

### Existing Enums

```prisma
enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  COGS
  EXPENSE
}
```

**Assessment:** ✅ **Standard and correct**

---

## 2. Existing Services & Controllers

### 2.1 PostingService (`services/api/src/accounting/posting.service.ts`)

**Current Posting Methods:**

1. ✅ **`postSale(orderId, userId)`**
   - Creates: Dr Cash/AR → Cr Sales
   - Triggered: When order is CLOSED
   - Status: Working (E40-S1 complete)

2. ✅ **`postCOGS(orderId, userId)`**
   - Creates: Dr COGS → Cr Inventory
   - Triggered: After sale (separate call)
   - Status: Working (E40-S1 complete)

3. ✅ **`postRefund(refundId, userId)`**
   - Creates: Dr Sales → Cr Cash (reversal)
   - Triggered: When refund is issued
   - Status: Working (E40-S1 complete)

4. ✅ **`postCashMovement(movementId, userId)`**
   - Creates: Dr/Cr based on cash safe operations
   - Triggered: Cash drops, withdrawals
   - Status: Working (E40-S1 complete)

5. ❓ **`checkPeriodLock(orgId, date)`**
   - Validates posting date against fiscal periods
   - Prevents posting to locked periods
   - Status: Implemented (E40-S2)

**Missing/Incomplete Postings:**

- ❌ **Wastage** → Should post: Dr Wastage Expense → Cr Inventory
  - Current status: M3 tracks wastage in `StockAdjustment` but doesn't call PostingService
- ❌ **Payroll** → Should post: Dr Payroll Expense → Cr Payroll Payable
  - Current status: PayrollService has `postToGL()` method but may not be fully integrated
- ❌ **Service Providers** → Should post: Dr Utilities/Rent Expense → Cr Service Provider Payable
  - Current status: M7 tracks contracts/reminders but no GL posting mentioned

- ❌ **Tax** → Should post separately if needed: Cr Tax Payable
  - Current status: Tax might be bundled in sales, need to verify

---

### 2.2 AccountingService (`services/api/src/accounting/accounting.service.ts`)

**Existing Methods:**

1. ✅ **Vendor Management**
   - `createVendor(orgId, data)`
   - `getVendors(orgId)`

2. ✅ **Vendor Bill Management**
   - `createVendorBill(orgId, data)` → DRAFT status
   - `openVendorBill(billId)` → Move to OPEN (approved)

3. ✅ **Payment Tracking**
   - `createVendorPayment(orgId, data)` → Records payment, posts to GL

4. ✅ **Aging Reports**
   - `getAPAging(orgId)` → Accounts Payable aging (0-30, 31-60, 61-90, 90+)
   - `getARAging(orgId)` → Accounts Receivable aging

5. ✅ **Financial Statements**
   - `getTrialBalance(orgId, asOf?)` → All accounts with debit/credit balances
   - `getProfitAndLoss(orgId, from, to)` → Revenue, COGS, Expenses, Net Profit
   - `getBalanceSheet(orgId, asOf?)` → Assets, Liabilities, Equity

**Assessment:** ✅ **Core statements are implemented and functional**

---

### 2.3 PeriodsService (`services/api/src/accounting/periods.service.ts`)

**From E40-S2:**

1. ✅ `getFiscalPeriods(orgId)` → List periods
2. ✅ `createFiscalPeriod(orgId, data)` → Create new period
3. ✅ `lockPeriod(periodId, userId)` → Lock period (prevents new postings)

**Missing from spec:**

- ❌ `closePeriod(periodId)` → Should mark period as CLOSED (intermediate state before LOCKED)
- ❌ Period status should have OPEN → CLOSED → LOCKED progression

---

### 2.4 Existing API Endpoints

**AccountingController:**

```typescript
POST   /accounting/vendors
GET    /accounting/vendors
POST   /accounting/vendor-bills
GET    /accounting/vendor-bills
POST   /accounting/vendor-bills/:id/approve
POST   /accounting/vendor-payments
GET    /accounting/ap/aging
GET    /accounting/ar/aging
GET    /accounting/trial-balance
GET    /accounting/pnl
GET    /accounting/balance-sheet
```

**PeriodsController:**

```typescript
GET    /accounting/periods
POST   /accounting/periods
POST   /accounting/periods/:id/lock
```

**BankRecController (E40-S2):**

```typescript
POST   /accounting/bank/accounts
GET    /accounting/bank/accounts
POST   /accounting/bank/:accountId/import-csv
POST   /accounting/bank/match
POST   /accounting/bank/:accountId/auto-match
GET    /accounting/bank/unreconciled
```

**Assessment:** ✅ **Good coverage, RBAC enforced (L4+/L5 roles)**

---

## 3. Chart of Accounts (CoA)

### Seeded Accounts (from `prisma/seed.ts` and E40-S1 docs)

| Code | Name                | Type      | Purpose                   |
| ---- | ------------------- | --------- | ------------------------- |
| 1000 | Cash                | ASSET     | Cash on hand              |
| 1010 | Bank                | ASSET     | Bank deposits             |
| 1100 | Accounts Receivable | ASSET     | Customer receivables      |
| 1200 | Inventory           | ASSET     | Stock value (ingredients) |
| 2000 | Accounts Payable    | LIABILITY | Vendor bills              |
| 3000 | Equity              | EQUITY    | Owner capital             |
| 4000 | Sales Revenue       | REVENUE   | Food/beverage sales       |
| 4100 | Service Charges     | REVENUE   | Service fees              |
| 5000 | Cost of Goods Sold  | COGS      | Ingredient costs          |
| 6000 | Operating Expenses  | EXPENSE   | General expenses          |
| 6100 | Utilities           | EXPENSE   | Power/water/internet (M7) |

**Assessment:** ✅ **Adequate starter CoA, but needs expansion for M8:**

**Missing Accounts (Should Add):**

- `6200` - Payroll Expense
- `2100` - Payroll Payable
- `6300` - Rent Expense
- `2200` - Service Provider Payables (or reuse 2000)
- `6400` - Wastage Expense
- `6500` - Marketing Expense
- `2300` - Tax Payable (if separated from sales)

---

## 4. Operational Flow Integration

### 4.1 POS / Sales Flow

**Current Implementation:**

- ✅ POS closes order → `PostingService.postSale()` called
- ✅ Creates: Dr Cash/AR → Cr Sales
- ✅ Tracks payment method in order.payments

**Gaps:**

- ❓ Tax posting: Currently included in sales total, may need separate Tax Payable line
- ❓ Service charges: Code mentions ACCOUNT_SERVICE (4100) but posting logic unclear

**Status:** ✅ **Working, may need tax enhancement**

---

### 4.2 COGS & Inventory Flow

**Current Implementation:**

- ✅ After sale → `PostingService.postCOGS()` called
- ✅ Creates: Dr COGS → Cr Inventory
- ✅ Calculates cost from order items

**Gaps:**

- ❓ Timing: COGS posted immediately after sale (perpetual) or end-of-period?
- ❓ Cost calculation: Uses item.cost from menu items, need to verify alignment with M3 reconciliation

**Status:** ✅ **Working, verify cost accuracy**

---

### 4.3 Wastage Flow (M3)

**Current Implementation:**

- ✅ M3 `ReconciliationService` tracks wastage in `StockAdjustment` model
- ✅ `WastageService` provides wastage reporting

**Gaps:**

- ❌ **No GL posting**: Wastage adjustments don't call `PostingService`
- ❌ Need to add: Dr Wastage Expense → Cr Inventory

**Status:** ❌ **Missing GL integration**

---

### 4.4 Payroll Flow (E43)

**Current Implementation:**

- ✅ `PayrollService.postToGL()` method exists
- ✅ Creates: Dr Payroll Expense → Cr Payroll Payable (net)
- ✅ Uses account codes: `5100-PAYROLL-EXPENSE`, `2100-PAYROLL-PAYABLE`

**Gaps:**

- ❓ Verify: Is `postToGL()` called automatically when payroll is approved?
- ❓ Tax and deductions: Are employer taxes posted separately?

**Status:** ⚠️ **Partially implemented, needs verification**

---

### 4.5 Service Providers Flow (M7)

**Current Implementation:**

- ✅ M7 tracks service providers, contracts, and payment reminders
- ✅ `BudgetService.updateBudgetActuals()` aggregates service provider costs

**Gaps:**

- ❌ **No GL posting**: When reminder is marked PAID, should post:
  - Dr Rent/Utilities/Marketing Expense → Cr Service Provider Payable
  - Then: Dr Service Provider Payable → Cr Cash (when paid)

**Status:** ❌ **Missing GL integration**

---

### 4.6 Manual Journals

**Current Implementation:**

- ❓ No clear "ManualJournalService" or controller found

**Gaps:**

- ❌ Need endpoint: `POST /accounting/journals` (L4+/Accountant only)
- ❌ Need validation: Ensure balanced entries (debits = credits)
- ❌ Need audit logging: Who posted, when, why

**Status:** ❌ **Not implemented**

---

## 5. Fiscal Period Management

**Current State (E40-S2):**

- ✅ `FiscalPeriod` model with OPEN/LOCKED states
- ✅ `PeriodsService.lockPeriod()` prevents postings to locked periods
- ✅ `PostingService.checkPeriodLock()` enforces lock

**Gaps:**

- ❌ Missing CLOSED state (spec requires OPEN → CLOSED → LOCKED)
- ❌ No `closePeriod()` method
- ❌ No period-end closing entries (e.g., close revenue/expense accounts to retained earnings)

**Recommendations:**

1. Add `FiscalPeriodStatus.CLOSED` enum value
2. Add `closedById` and `closedAt` fields
3. Implement `PeriodsService.closePeriod()`:
   - Calculate period net income
   - Create closing entry (Dr Revenue, Cr Expenses, Dr/Cr Retained Earnings)
   - Mark period as CLOSED
4. `lockPeriod()` should only work on CLOSED periods

---

## 6. Financial Statements Quality

### 6.1 Trial Balance

**Implementation:** `AccountingService.getTrialBalance()`

```typescript
// For each account:
// - Sum all journal line debits
// - Sum all journal line credits
// - Calculate balance based on account type
```

**Assessment:** ✅ **Functional**

**Enhancements needed:**

- Add opening balance support (currently starts from zero)
- Add date range filtering (from/to, not just asOf)

---

### 6.2 Profit & Loss

**Implementation:** `AccountingService.getProfitAndLoss()`

```typescript
{
  from: Date,
  to: Date,
  revenue: [...],      // Credit balance for REVENUE accounts
  cogs: [...],         // Debit balance for COGS accounts
  expenses: [...],     // Debit balance for EXPENSE accounts
  totalRevenue: number,
  totalCOGS: number,
  totalExpenses: number,
  grossProfit: number, // Revenue - COGS
  netProfit: number    // GrossProfit - Expenses
}
```

**Assessment:** ✅ **Functional and well-structured**

**Enhancements needed:**

- Add account hierarchy (parent/child grouping)
- Add branch filtering (per-branch P&L)

---

### 6.3 Balance Sheet

**Implementation:** `AccountingService.getBalanceSheet()`

```typescript
{
  asOf: Date,
  assets: [...],
  liabilities: [...],
  equity: [...],
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number
}
```

**Assessment:** ✅ **Functional**

**Enhancements needed:**

- Add current vs non-current classification
- Add retained earnings calculation (net income YTD)
- Add branch filtering

---

## 7. Alignment with Other Modules

### 7.1 M4 Owner Digests

**Current State:**

- M4 generates franchise digests with revenue, COGS, expenses
- Source: Calculated from orders/inventory, not from GL

**Issue:** ⚠️ **Potential divergence**

- If M4 calculates metrics independently, numbers may not match P&L
- Need consistency tests

**Recommendation:**

- M4 should either:
  a) Use GL data as source of truth, OR
  b) Have reconciliation tests to ensure operational metrics = GL

---

### 7.2 M6 Franchise Management

**Current State:**

- M6 provides franchise overview with per-branch metrics
- Includes revenue, COGS, margins by branch

**Issue:** ⚠️ **Potential divergence**

- M6 likely aggregates from operational tables (Order, StockAdjustment, etc.)
- May not match GL if postings are incomplete

**Recommendation:**

- Add `branchId` to `JournalEntry` (currently only on JournalLine)
- M6 should query GL for financial metrics, not operational tables

---

### 7.3 M7 Budgets

**Current State:**

- M7 `BudgetService.updateBudgetActuals()` computes:
  - STOCK: From purchase orders
  - PAYROLL: From payroll postings
  - SERVICE_PROVIDERS: From paid reminders

**Issue:** ⚠️ **Mixed sources**

- STOCK uses PO data (not GL)
- PAYROLL may use GL if postings work
- SERVICE_PROVIDERS doesn't post to GL yet

**Recommendation:**

- All budget actuals should derive from GL accounts
- This ensures one source of truth

---

## 8. Known Gaps & Issues

### Critical Gaps

1. ❌ **Wastage not posted to GL** (M3)
   - Need: `PostingService.postWastage(adjustmentId, userId)`
   - Entry: Dr Wastage Expense → Cr Inventory

2. ❌ **Service providers not posted to GL** (M7)
   - Need: `PostingService.postServiceProviderExpense(reminderId, userId)`
   - Entry: Dr Rent/Utilities Expense → Cr Service Provider Payable

3. ❌ **Manual journals not supported**
   - Need: Controller + endpoint for accountants to post adjusting entries

4. ❌ **Period closing entries missing**
   - Need: Close revenue/expense accounts to retained earnings at period end

5. ⚠️ **Tax posting unclear**
   - May need separate Tax Payable account if tax is collected separately

### Non-Critical Enhancements

1. Opening balances for trial balance
2. Multi-currency support (account.currency field)
3. Cost center tracking (explicit costCenterId on JournalLine)
4. Account hierarchy in reports (indent sub-accounts)
5. CSV/PDF export for statements (CsvGeneratorService exists, extend it)
6. Strict double-entry validation (CHECK constraint on journal entry balance)

---

## 9. Test Coverage

**Existing Tests:**

- ✅ `services/api/test/e2e/accounting.e2e-spec.ts` exists
- ✅ Unit tests in `services/api/src/workforce/payroll.service.spec.ts` (GL posting balance test)

**Coverage Status:**

- ✅ Sales posting tested
- ✅ COGS posting tested
- ✅ Financial statements tested
- ❌ Wastage posting not tested (doesn't exist)
- ❌ Service provider posting not tested (doesn't exist)
- ❌ Period closing not tested (doesn't exist)
- ❌ Consistency tests (GL vs operational metrics) not found

---

## 10. Documentation

**Existing Docs:**

- ✅ E40-S1-COMPLETION.md (comprehensive accounting core docs)
- ✅ E40-S2-COMPLETION.md (fiscal periods & bank rec)
- ❓ DEV_GUIDE.md section: Need to check if accounting section exists

**Assessment:** Accounting module is well-documented in completion reports.

---

## 11. Summary & Recommendations for M8

### What's Already Good ✅

1. **Solid foundation:** Chart of Accounts, JournalEntry/Line models are well-designed
2. **Core postings work:** Sales, COGS, refunds, cash movements post to GL
3. **Statements implemented:** Trial Balance, P&L, Balance Sheet APIs exist and work
4. **Period locking:** Fiscal periods with OPEN/LOCKED states
5. **Vendor management:** AP bills and payments tracked
6. **Bank reconciliation:** E40-S2 added bank rec features

### Critical Work Needed for M8 ❌

1. **Complete GL integration:**
   - Add wastage posting (M3)
   - Add service provider posting (M7)
   - Verify payroll posting triggers (E43)

2. **Add period closing logic:**
   - Implement CLOSED state
   - Add closing entries (revenue/expense → retained earnings)
   - Add `closePeriod()` method

3. **Add manual journal entry API:**
   - Controller endpoint for accountants
   - Validation: balanced entries
   - Audit logging

4. **Alignment tests:**
   - Ensure GL numbers match M4 digests
   - Ensure GL numbers match M6 franchise overview
   - Ensure GL numbers match M7 budget actuals

5. **Expand CoA:**
   - Add missing expense accounts (Payroll, Rent, Wastage, Marketing)
   - Add missing liability accounts (Payroll Payable, Service Provider Payables)

6. **Enhance statements:**
   - Add branch filtering (per-branch P&L, Balance Sheet)
   - Add account hierarchy support
   - Add opening balance support

### Nice-to-Have Enhancements 💡

1. Multi-currency support
2. Cost center explicit tracking
3. PDF/Excel export for statements
4. Automated reconciliation job (find unposted transactions)
5. CHECK constraint for journal entry balance

---

## Next Steps

**Proceed to Step 1:** Harden CoA and GL model (add missing accounts, enhance FiscalPeriod)

**Then Step 2:** Complete posting integration for all flows (wastage, service providers, manual journals)

**Then Step 3:** Implement period closing with CLOSED state

**Then Step 4:** Enhance financial statements (branch filtering, hierarchy)

**Then Step 5:** Build alignment tests to ensure consistency across modules

**Then Steps 6-7:** Document and test everything

---

**End of Review**
