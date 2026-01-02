# Feature Dossier: General Ledger Core

> **Status:** `COMPLETE`  
> **Created:** 2026-01-02  
> **Author:** ChefCloud Team  
> **Milestone:** M8.2  

---

## 1. Scope

### 1.1 Feature Summary

The GL Core module provides double-entry bookkeeping with a standardized chart of accounts, journal entries, and automatic posting from operational transactions. All financial data flows through journal entries to ensure auditability and balance.

### 1.2 In Scope

- Chart of Accounts (18 accounts covering Assets, Liabilities, Equity, Revenue, COGS, Expenses)
- Journal entries with balanced lines (debits = credits)
- Automatic posting from operational sources (ORDER, COGS, WASTAGE, VENDOR_PAYMENT, etc.)
- Source tracking (source + sourceId for audit trail)
- Branch-level posting for multi-branch organizations
- Manual journal entry creation (ACCOUNTANT/OWNER only)

### 1.3 Out of Scope

- Multi-currency accounting (M8.3+)
- Intercompany transactions (M8.4+)
- Consolidation reports
- Complex allocations

### 1.4 Nimbus Modules Affected

| Module | Type | Description |
|--------|------|-------------|
| accounting | API | Journal entries, chart of accounts, posting service |
| prisma/demo | Seed | Chart of accounts and journal entries for demo orgs |

### 1.5 Database Tables Affected

| Table | Action | Description |
|-------|--------|-------------|
| accounts | CREATE/READ | Chart of accounts per org |
| journal_entries | CREATE/READ | Header for journal transactions |
| journal_lines | CREATE/READ | Debit/credit lines referencing accounts |

### 1.6 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /accounting/accounts | List chart of accounts |
| POST | /accounting/accounts | Create new account (L5 only) |
| GET | /accounting/journal | List journal entries with filters |
| POST | /accounting/journal | Create manual journal entry (L4+) |
| GET | /accounting/journal/:id | Get journal entry detail |

---

## 2. What Enterprise Systems Do

Based on clean-room study of accounting patterns (bigcapital STUDY-ONLY, hledger concepts):

1. **Immutable Entries**: Journal entries are never modified; corrections are reversal entries
2. **Balanced Validation**: Every entry enforces debits == credits before saving
3. **Source Tracking**: Each posting links back to originating transaction (order, bill, etc.)
4. **Account Types**: Hierarchical types (ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE)
5. **Account Codes**: Numeric codes for quick reference (1000=Cash, 4000=Sales)
6. **Parent-Child Accounts**: Account hierarchy for consolidation
7. **Active/Inactive Accounts**: Soft-disable accounts without deleting
8. **Posting Prevention**: Prevent direct posting to parent accounts
9. **Opening Balances**: Special entry type for initial balances
10. **Audit Fields**: Created by, created at, posted by for compliance
11. **Branch Allocation**: Multi-branch orgs allocate entries to specific branches
12. **Reversal Entries**: Link reversal entries to original for tracking

---

## 3. Current Nimbus State

### 3.1 What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| Account model | ✅ Complete | `packages/db/prisma/schema.prisma` |
| JournalEntry model | ✅ Complete | `packages/db/prisma/schema.prisma` |
| JournalLine model | ✅ Complete | `packages/db/prisma/schema.prisma` |
| PostingService | ✅ Complete | `services/api/src/accounting/posting.service.ts` |
| Posting sources | ⚠️ Partial | ORDER, COGS implemented; WASTAGE, PAYROLL pending |
| Chart of Accounts seed | ⚠️ Missing in demo | Only in `seed.ts`, not `seedDemo.ts` |
| Journal entry endpoint | ❌ Missing | No GET/POST /accounting/journal endpoint |
| Accounts list endpoint | ❌ Missing | No GET /accounting/accounts endpoint |

### 3.2 Gaps and Limitations

- **GAP-1**: Demo orgs lack chart of accounts → seedJournalEntries fails silently
- **GAP-2**: No REST endpoint to list accounts
- **GAP-3**: No REST endpoint to create/list journal entries
- **GAP-4**: Wastage postings not implemented
- **GAP-5**: Service provider payments not linked to journal

### 3.3 Related Features

| Feature | Status | Dependency |
|---------|--------|------------|
| PostingService | Complete | Uses |
| Bank Reconciliation | Partial | Depends on GL |
| Financial Statements | Complete | Reads from GL |

---

## 4. Implementation Plan

| Priority | Gap | Action | Effort |
|----------|-----|--------|--------|
| P0 | GAP-1 | Add seedChartOfAccounts to seedDemo.ts | 1h |
| P0 | GAP-2 | Add GET /accounting/accounts endpoint | 30m |
| P1 | GAP-3 | Add GET/POST /accounting/journal endpoints | 2h |
| P2 | GAP-4 | Implement WASTAGE posting in PostingService | 1h |
| P2 | GAP-5 | Link VendorPayment to journal | 1h |

---

## 5. Acceptance Criteria

### AC-1: Chart of Accounts Exists
- Demo orgs have 18 accounts seeded after E2E setup
- Accounts cover: 1000-1200 (Assets), 2000 (Liabilities), 3000 (Equity), 4000-4100 (Revenue), 5000 (COGS), 6000-6400 (Expenses)

### AC-2: Journal Entries are Balanced
- All seeded journal entries have debits == credits (within 0.01 tolerance)
- Manual journal creation validates balance before save

### AC-3: Source Tracking Works
- Journal entries from ORDER source link back to order ID
- UI can navigate from journal entry to source transaction

### AC-4: API Returns Data
- GET /accounting/accounts returns all active accounts for org
- GET /accounting/journal returns entries with pagination

---

## 6. E2E Test Mapping

| AC | Test | Description |
|----|------|-------------|
| AC-1 | `accounting.e2e-spec.ts` | GET /accounting/accounts returns >= 18 accounts |
| AC-2 | `accounting.e2e-spec.ts` | All journal entries have balanced lines |
| AC-3 | `accounting.e2e-spec.ts` | Journal entries with source=ORDER have valid sourceId |
| AC-4 | `accounting.e2e-spec.ts` | GET /accounting/journal returns paginated list |

---

## 7. Standard Chart of Accounts (18 Accounts)

| Code | Name | Type | Description |
|------|------|------|-------------|
| 1000 | Cash | ASSET | Physical cash and POS receipts |
| 1010 | Bank | ASSET | Bank account balances |
| 1100 | Accounts Receivable | ASSET | Customer credit balances |
| 1200 | Inventory | ASSET | Stock value |
| 1300 | Prepaid Expenses | ASSET | Advance payments |
| 2000 | Accounts Payable | LIABILITY | Vendor credit balances |
| 2100 | Accrued Expenses | LIABILITY | Utility/service accruals |
| 3000 | Owner's Equity | EQUITY | Capital and retained earnings |
| 3100 | Retained Earnings | EQUITY | Accumulated profits |
| 4000 | Sales Revenue | REVENUE | Food and beverage sales |
| 4100 | Service Charges | REVENUE | Service fees and tips |
| 5000 | Cost of Goods Sold | COGS | Food cost |
| 5100 | Wastage | COGS | Spoilage and waste |
| 6000 | Payroll Expense | EXPENSE | Staff wages |
| 6100 | Utilities | EXPENSE | Electricity, water, gas |
| 6200 | Rent | EXPENSE | Lease payments |
| 6300 | Supplies | EXPENSE | Cleaning, packaging |
| 6400 | Marketing | EXPENSE | Advertising |

---

## 8. Files to Modify/Create

| File | Action |
|------|--------|
| `services/api/prisma/demo/seedDemo.ts` | Add seedChartOfAccounts function |
| `services/api/src/accounting/accounting.controller.ts` | Add GET accounts, GET/POST journal |
| `services/api/src/accounting/accounting.service.ts` | Add methods for accounts and journal |
| `services/api/test/e2e/accounting.e2e-spec.ts` | Create E2E tests |
