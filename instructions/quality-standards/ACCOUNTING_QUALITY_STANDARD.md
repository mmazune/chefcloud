# Accounting Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Accounting & Finance  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Chart of Accounts (CoA) management
- Journal entry creation and posting
- General Ledger (GL) maintenance
- Accounts Payable (AP) tracking
- Accounts Receivable (AR) tracking
- Financial period management (open/close)
- Trial balance and financial statements
- Multi-currency support (where applicable)
- Integration with POS sales, inventory COGS, and payroll

### Out of Scope
- External tax filing integrations
- Payroll calculation engine (see Workforce domain)
- Banking reconciliation (future roadmap)

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| ACC-INV-01 | **Double-entry balance**: Every journal entry must have debits = credits | DB trigger + API validation |
| ACC-INV-02 | **Immutable posted entries**: Posted journal entries cannot be modified, only reversed | API enforcement + audit |
| ACC-INV-03 | **Sequential numbering**: Journal entry numbers must be sequential with no gaps | DB sequence + gap detection |
| ACC-INV-04 | **Period locking**: Entries cannot be posted to closed accounting periods | API validation |
| ACC-INV-05 | **Account type rules**: Debits increase assets/expenses, credits increase liabilities/equity/revenue | Service logic |
| ACC-INV-06 | **CoA hierarchy integrity**: Child accounts must have valid parent references | DB FK constraint |
| ACC-INV-07 | **No orphan entries**: Every journal line must reference a valid account | DB FK constraint |
| ACC-INV-08 | **Currency consistency**: Multi-currency entries must have exchange rates recorded at posting time | API validation |
| ACC-INV-09 | **Audit trail immutability**: Accounting audit logs cannot be deleted or modified | DB trigger + no DELETE API |
| ACC-INV-10 | **COGS derivation consistency**: COGS from inventory must match accounting journal entries | Reconciliation check |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | CoA seeded with standard hospitality accounts; no journal entries |
| DEMO_TAPAS | Full accounting period with sample journal entries; trial balance computes |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch accounting with consolidation entries |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All sales events generate corresponding revenue journal entries
- [ ] All inventory consumption generates COGS journal entries
- [ ] All AP invoices generate liability entries
- [ ] Trial balance equals sum of all posted entries
- [ ] Financial statements derive from GL without external adjustments

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `POST /accounting/journal-entries` | Atomic creation; debits = credits or 400 error |
| `POST /accounting/journal-entries/:id/post` | Idempotent posting; returns same result on retry |
| `GET /accounting/trial-balance` | Always balanced (debits = credits); returns date-range filtered |
| `GET /accounting/accounts/:id/ledger` | Paginated transaction history with running balance |
| `POST /accounting/periods/:id/close` | Prevents future postings; idempotent |
| `GET /accounting/financial-statements/*` | Derived from GL; deterministic for same date range |

### Response Time SLA
- Trial balance: < 2s for up to 10,000 entries
- Financial statements: < 5s for standard reports

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| ACCOUNTANT | Full access to CoA, journal entries, reports; batch entry capability |
| OWNER | Read-only financial statements; high-level P&L dashboard |
| MANAGER | Limited to branch-level expense visibility (if configured) |
| CASHIER | No accounting access; sales auto-generate entries invisibly |

### UX Requirements
- Journal entry form must validate balance before enabling submit
- Unbalanced entries must show clear error with difference amount
- Posted entries must be visually distinct (locked icon, gray background)
- Reversal creates linked entry with clear reference to original
- Financial statements must export to PDF/Excel with consistent formatting

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| ACC-ERR-01 | Unbalanced journal entry submitted | 400 error with difference amount |
| ACC-ERR-02 | Post to closed period | 400 error "Period is closed" |
| ACC-ERR-03 | Delete posted entry | 403 error "Posted entries cannot be deleted" |
| ACC-ERR-04 | Modify posted entry | 403 error "Posted entries cannot be modified" |
| ACC-ERR-05 | Invalid account reference | 400 error "Account not found" |
| ACC-ERR-06 | Concurrent period close | Only first request succeeds; second returns 409 |
| ACC-ERR-07 | Duplicate journal number | 409 error "Duplicate entry number" |
| ACC-ERR-08 | Multi-currency without rate | 400 error "Exchange rate required" |
| ACC-ERR-09 | Parent account deletion with children | 400 error "Account has children" |
| ACC-ERR-10 | Account deletion with transactions | 400 error "Account has transactions" |
| ACC-ERR-11 | Zero-amount line item | 400 error "Line amount cannot be zero" |
| ACC-ERR-12 | Inactive account posting | 400 error "Account is inactive" |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Journal entry created | INFO | entryId, userId, timestamp, amounts |
| Journal entry posted | INFO | entryId, userId, timestamp, period |
| Journal entry reversed | WARN | originalId, reversalId, userId, reason |
| Period closed | WARN | periodId, userId, timestamp |
| Account created/modified | INFO | accountId, userId, changes |

### Metrics
| Metric | Purpose |
|--------|---------|
| `accounting.entries.created` | Entry volume tracking |
| `accounting.entries.posted` | Posting activity |
| `accounting.balance.drift` | Trial balance discrepancy detection |
| `accounting.period.close.duration` | Performance monitoring |

### Alerts
- Trial balance out-of-balance: CRITICAL
- Gap detected in journal numbering: WARN
- Period close failure: ERROR

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| View CoA | ACCOUNTANT, OWNER, MANAGER | Yes |
| Create journal entry | ACCOUNTANT | Yes |
| Post journal entry | ACCOUNTANT (L3+) | Yes |
| Close period | ACCOUNTANT (L4+) or OWNER | Yes |
| View financial statements | ACCOUNTANT, OWNER | Yes |

### Input Validation
| Field | Validation |
|-------|------------|
| Amounts | Decimal(19,4); no NaN/Infinity; positive or zero |
| Account codes | Alphanumeric; 3-20 chars; unique per tenant |
| Descriptions | String; max 500 chars; sanitized |
| Dates | ISO 8601; within valid period range |

### Idempotency
- `POST /journal-entries` with idempotency key prevents duplicates
- Period close is idempotent (repeat calls succeed silently)

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Journal entry creation | 100/min per user |
| Report generation | 10/min per user |

---

## I) Acceptance Criteria Checklist

### Chart of Accounts (5 items)
- [ ] ACC-AC-01: Create account with all required fields
- [ ] ACC-AC-02: Create child account with valid parent
- [ ] ACC-AC-03: Prevent deletion of account with transactions
- [ ] ACC-AC-04: Activate/deactivate account
- [ ] ACC-AC-05: List accounts with hierarchy display

### Journal Entries (10 items)
- [ ] ACC-AC-06: Create balanced journal entry
- [ ] ACC-AC-07: Reject unbalanced entry with clear error
- [ ] ACC-AC-08: Post journal entry (state change)
- [ ] ACC-AC-09: Prevent modification of posted entry
- [ ] ACC-AC-10: Reverse posted entry (creates linked reversal)
- [ ] ACC-AC-11: Sequential numbering enforced
- [ ] ACC-AC-12: Multi-line entry with many accounts
- [ ] ACC-AC-13: Search/filter entries by date, account, amount
- [ ] ACC-AC-14: Pagination of entry list (1000+ entries)
- [ ] ACC-AC-15: Idempotency key prevents duplicate creation

### Periods (5 items)
- [ ] ACC-AC-16: Close accounting period
- [ ] ACC-AC-17: Prevent posting to closed period
- [ ] ACC-AC-18: Reopen period (with elevated permission)
- [ ] ACC-AC-19: List periods with status indicators
- [ ] ACC-AC-20: Period boundary validation (date range)

### Reports (7 items)
- [ ] ACC-AC-21: Generate trial balance (debits = credits)
- [ ] ACC-AC-22: Trial balance date-range filtering
- [ ] ACC-AC-23: Account ledger with running balance
- [ ] ACC-AC-24: Income statement generation
- [ ] ACC-AC-25: Balance sheet generation
- [ ] ACC-AC-26: Cash flow statement (where applicable)
- [ ] ACC-AC-27: Export reports to PDF/Excel

### Integration (3 items)
- [ ] ACC-AC-28: POS sales auto-generate revenue entries
- [ ] ACC-AC-29: Inventory consumption auto-generates COGS entries
- [ ] ACC-AC-30: COGS reconciles between inventory and accounting

---

## J) Minimum E2E Expansion Set

### API Contract Tests (8 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Create balanced journal entry | DEMO_TAPAS | 30s |
| Reject unbalanced entry (400) | DEMO_TAPAS | 30s |
| Post entry and verify state change | DEMO_TAPAS | 30s |
| Prevent posting to closed period (400) | DEMO_TAPAS | 30s |
| Generate trial balance (balanced) | DEMO_TAPAS | 30s |
| Reverse posted entry | DEMO_TAPAS | 30s |
| Sequential numbering enforcement | DEMO_TAPAS | 30s |
| Multi-branch consolidation trial balance | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| ACCOUNTANT can create and post entry | ACCOUNTANT | DEMO_TAPAS | 30s |
| OWNER can view (not edit) financial statements | OWNER | DEMO_TAPAS | 30s |
| CASHIER cannot access accounting module | CASHIER | DEMO_TAPAS | 30s |
| MANAGER sees branch-only data | MANAGER | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Report Validation Tests (4 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Trial balance debits = credits | DEMO_TAPAS | 30s |
| Income statement totals match GL | DEMO_TAPAS | 30s |
| Balance sheet assets = liabilities + equity | DEMO_TAPAS | 30s |
| Multi-branch P&L rollup consistent | DEMO_CAFESSERIE_FRANCHISE | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Accounting dashboard loads without errors | DEMO_TAPAS | 30s |
| Empty state displays correctly | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| bigcapital | ⚠️ AGPL | CoA structure, journal entry workflow |
| hledger | ⚠️ AGPL | Transaction grammar, balance assertions |
| beancount | ⚠️ GPL | Double-entry logic, report generation |

**Note:** All accounting repos are copyleft — study-only, clean-room implementation required.
