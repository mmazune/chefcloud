# bigcapital MAP

> **Repository:** https://github.com/bigcapitalhq/bigcapital  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Accounting / ERP  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Full-stack cloud accounting and ERP platform. Best reference for:
- Chart of accounts management
- Double-entry journal entries
- Accounts Payable (AP) and Accounts Receivable (AR)
- Financial statements (balance sheet, income statement, cash flow)
- Multi-currency accounting
- Invoice and bill management
- Banking reconciliation

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js / Express / Knex.js |
| Database | PostgreSQL / MySQL |
| Frontend | React / Ant Design |
| API | REST |
| Build | Lerna monorepo |
| Queue | Bull (Redis) |
| Testing | Jest |

---

## (iii) High-Level Directory Map

```
bigcapital/
├── packages/
│   ├── server/              # Backend API
│   │   ├── src/
│   │   │   ├── api/         # REST endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── models/      # Data models (Objection.js)
│   │   │   ├── jobs/        # Background jobs
│   │   │   └── subscribers/ # Event handlers
│   │   └── database/
│   │       └── migrations/  # Schema migrations
│   └── webapp/              # Frontend React app
│       ├── src/
│       │   ├── containers/  # Page components
│       │   ├── components/  # Reusable UI
│       │   ├── services/    # API clients
│       │   └── store/       # Redux state
├── docker/                  # Docker configs
└── e2e/                     # End-to-end tests
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Chart of Accounts | `packages/server/src/services/Accounts/` |
| Journal Entries | `packages/server/src/services/ManualJournals/` |
| Invoices | `packages/server/src/services/Sales/Invoices/` |
| Bills (AP) | `packages/server/src/services/Purchases/Bills/` |
| Payments | `packages/server/src/services/Sales/Payments/` |
| Financial Reports | `packages/server/src/services/FinancialStatements/` |
| Multi-currency | `packages/server/src/services/Currencies/` |
| Banking | `packages/server/src/services/Banking/` |
| Account models | `packages/server/src/models/Account.js` |
| Transaction models | `packages/server/src/models/AccountTransaction.js` |

---

## (v) Key Flows

### Chart of Accounts Flow
- Account CRUD: `services/Accounts/CreateAccount.ts` → validates account type hierarchy
- Account tree: Supports parent-child relationships for grouping
- System accounts: Locked accounts for core accounting (Cash, AR, AP)

### Journal Entry Flow
- Manual journal: `services/ManualJournals/CreateManualJournal.ts`
- Validation: Debits must equal credits
- Posting: Creates `AccountTransaction` records

### Invoice → Payment Flow
- Create invoice: `services/Sales/Invoices/CreateSaleInvoice.ts`
- Records AR entry automatically
- Payment receipt: `services/Sales/Payments/CreatePaymentReceive.ts`
- Closes invoice, clears AR balance

### Financial Reports Flow
- Balance Sheet: `services/FinancialStatements/BalanceSheet/`
- P&L: `services/FinancialStatements/ProfitLoss/`
- Trial Balance: `services/FinancialStatements/TrialBalance/`
- Reports query transactions and aggregate by account type

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

We cannot copy or adapt code from this repository. Any implementation must be:
1. Clean-room (close the repo, implement from notes)
2. Written independently without line-by-line translation
3. Reviewed by a different team member

**Concepts we CAN learn:**
- Data model design patterns
- Report generation architecture
- Multi-currency handling approach
- Journal entry validation logic

---

## (vii) What Nimbus Should Learn

1. **Chart of accounts hierarchy** — How to model account types (Asset, Liability, Equity, Revenue, Expense) with parent-child relationships

2. **Double-entry enforcement** — Every transaction creates balanced debit/credit entries; validation before commit

3. **Automatic GL entries** — How invoices/bills auto-create receivable/payable entries

4. **Multi-currency handling** — Exchange rate at transaction time, unrealized gain/loss calculation

5. **Period closing** — How to implement month-end / year-end closing with retained earnings rollover

6. **Report materialization** — Pre-computed report snapshots vs real-time aggregation tradeoffs

7. **Account locking** — System accounts that cannot be deleted or modified

8. **Audit trail** — Every accounting action logged with before/after state

9. **Banking reconciliation** — Matching bank transactions to journal entries

10. **Tenant isolation** — How multi-tenant accounting data is segregated

11. **Background job patterns** — Report generation, recurring invoice creation via Bull queues

12. **API design for accounting** — REST endpoints for GL operations, bulk imports
