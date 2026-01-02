# Feature Dossier: Accounting Enterprise Parity (M8.2b)

> **Status:** `IN_PROGRESS`  
> **Created:** 2026-01-02  
> **Author:** Lead Engineer  
> **Milestone:** M8.2b  

---

## 1. Scope

### 1.1 Feature Summary

Enterprise-grade accounting hardening to achieve parity with best-in-class accounting systems. Focuses on document lifecycle enforcement, period lock validation, journal posting controls, and export capabilities.

### 1.2 In Scope

- Journal entry lifecycle (DRAFT → POSTED → REVERSED)
- Period lock enforcement at API layer
- Reversal mechanism for posted journals
- Trial Balance/P&L filtering by POSTED entries only
- CSV export endpoints for Chart of Accounts, Journals, Trial Balance
- E2E test expansion proving all behaviors

### 1.3 Out of Scope

- AP/AR automatic journal posting (future M8.3)
- Multi-currency handling
- Banking reconciliation
- Full audit trail (beyond what exists)

### 1.4 Nimbus Modules Affected

| Module | Type | Description |
|--------|------|-------------|
| `services/api/src/accounting/` | API | Accounting service and controller |
| `packages/db/prisma/schema.prisma` | Shared | JournalEntry model (already has status) |
| `apps/web/src/pages/finance/` | UI | Journal and reports pages |

### 1.5 Database Tables Affected

| Table | Action | Description |
|-------|--------|-------------|
| journal_entries | READ/UPDATE | Use status field for lifecycle |
| fiscal_periods | READ | Enforce lock for all posting operations |

### 1.6 API Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /accounting/accounts | Get chart of accounts | ✅ Exists |
| POST | /accounting/accounts | Create account | ✅ Exists |
| GET | /accounting/journal | List journal entries | ✅ Exists |
| POST | /accounting/journal | Create draft journal | ✅ Exists |
| POST | /accounting/journal/:id/post | Post a draft entry | 🔴 MISSING |
| POST | /accounting/journal/:id/reverse | Reverse a posted entry | 🔴 MISSING |
| GET | /accounting/trial-balance | Trial balance | ✅ Exists (needs status filter) |
| GET | /accounting/pnl | Profit & Loss | ✅ Exists (needs status filter) |
| GET | /accounting/balance-sheet | Balance sheet | ✅ Exists (needs status filter) |
| GET | /accounting/export/accounts | Export CoA to CSV | 🔴 MISSING |
| GET | /accounting/export/journal | Export journals to CSV | 🔴 MISSING |
| GET | /accounting/export/trial-balance | Export TB to CSV | 🔴 MISSING |

### 1.7 UI Components

| Component | Route | Description |
|-----------|-------|-------------|
| Journal list | /finance/journal | Shows entry status, post/reverse actions |
| Trial Balance | /finance/trial-balance | CSV export button |

---

## 2. Current Nimbus State

### 2.1 What Exists Today

**Schema:**
- JournalEntry has `status` enum: DRAFT, POSTED, REVERSED
- JournalEntry has `postedAt`, `postedById`, `reversedAt`, `reversedById`, `reversesEntryId`
- FiscalPeriod has `status`: OPEN, CLOSED, LOCKED

**API:**
- Chart of accounts CRUD
- Journal entry creation (but no lifecycle)
- Trial balance, P&L, Balance sheet (but include all entries regardless of status)
- Period create/close/lock

**UI:**
- All finance pages exist
- Export buttons present but non-functional

### 2.2 Gaps and Limitations

1. **No POST endpoint**: Journals created as DRAFT but can't be posted
2. **No REVERSE endpoint**: Can't reverse posted entries
3. **Reports include DRAFT**: TB/P&L include non-posted entries
4. **No exports**: CSV export endpoints missing
5. **Period lock partial**: Only checked in createJournalEntry, not for post/reverse

### 2.3 Related Features

| Feature | Status | Dependency |
|---------|--------|------------|
| Chart of Accounts | Complete | None |
| Fiscal Periods | Complete | Uses |
| AP/AR Aging | Complete | None |

---

## 3. Reference Repos

### 3.1 Selected References

| Repo | Domain | License | Tag | Rationale |
|------|--------|---------|-----|-----------|
| bigcapital | Accounting | ⚠️ AGPL-3.0 | Study only | Full accounting lifecycle patterns |
| hledger | Accounting | ⚠️ AGPL-3.0 | Study only | Double-entry validation |
| killbill | Billing | ✅ Apache-2.0 | Can adapt | Document lifecycle patterns |

### 3.2 Key Patterns from References

**bigcapital** (AGPL - study only):
- Journal entries have explicit post action
- Posted entries immutable
- Reversal creates opposite entry with link
- Reports query only posted entries
- Export to CSV/PDF

**hledger** (AGPL - study only):
- Balance assertions validate after each transaction
- Strict mode rejects unbalanced entries
- Date-based filtering for reports

**killbill** (Apache):
- Document state machine (DRAFT → ACTIVE → VOID)
- Idempotent state transitions
- Audit trail on all changes

---

## 4. Gap Analysis

| Priority | Gap | Severity | Implementation |
|----------|-----|----------|----------------|
| P0 | Journal POST endpoint | Critical | Add POST /journal/:id/post |
| P0 | Journal REVERSE endpoint | Critical | Add POST /journal/:id/reverse |
| P0 | Reports filter by POSTED | Critical | Add status filter to queries |
| P1 | CSV export endpoints | High | Add 3 export endpoints |
| P1 | Period lock for post/reverse | High | Add period check in post/reverse |
| P2 | E2E test expansion | High | Add 10+ test cases |

---

## 5. Implementation Plan

### Phase 1: Lifecycle Endpoints (P0)

1. Add `POST /accounting/journal/:id/post`
   - Validate entry is DRAFT
   - Check period not LOCKED
   - Set status=POSTED, postedAt, postedById

2. Add `POST /accounting/journal/:id/reverse`
   - Validate entry is POSTED
   - Check period not LOCKED (for both original and reversal date)
   - Create new entry with opposite lines
   - Set reversesEntryId, mark original as REVERSED

### Phase 2: Report Filtering (P0)

1. Update getTrialBalance to filter `status: 'POSTED'`
2. Update getProfitAndLoss to filter `status: 'POSTED'`
3. Update getBalanceSheet to filter `status: 'POSTED'`

### Phase 3: Exports (P1)

1. Add GET /accounting/export/accounts → CSV
2. Add GET /accounting/export/journal → CSV
3. Add GET /accounting/export/trial-balance → CSV

### Phase 4: E2E Tests (P1)

- Draft journal doesn't affect reports
- Posted journal affects reports
- Posting blocked in LOCKED period
- Reversal creates balanced opposite
- Export returns valid CSV
- RBAC enforcement

---

## 6. Acceptance Criteria

| ID | Criterion | Test |
|----|-----------|------|
| AC-01 | Creating journal sets status=DRAFT | E2E: create returns status DRAFT |
| AC-02 | POST /journal/:id/post changes status to POSTED | E2E: post returns status POSTED |
| AC-03 | POSTED entries cannot be modified | E2E: PATCH on posted returns 403 |
| AC-04 | POST /journal/:id/reverse creates opposite entry | E2E: reversal sum = 0 |
| AC-05 | Trial Balance only includes POSTED entries | E2E: draft doesn't change TB |
| AC-06 | Posting in LOCKED period returns 409 | E2E: expect 409 |
| AC-07 | Export returns valid CSV with headers | E2E: check Content-Type and headers |

---

## 7. Parity Re-Audit Checklist

After implementation, verify:

- [ ] Journal lifecycle matches bigcapital pattern
- [ ] Period lock enforced at API level (not just UI)
- [ ] Reports derive from POSTED only
- [ ] Exports functional
- [ ] E2E tests prove all behaviors

---

## 8. License Compliance

- **bigcapital**: AGPL-3.0 → Study only, clean-room implementation
- **hledger**: AGPL-3.0 → Study only, clean-room implementation  
- **killbill**: Apache-2.0 → Can adapt with attribution

All implementation is original code based on understanding patterns, not copying.
