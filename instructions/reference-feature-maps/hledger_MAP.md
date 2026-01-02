# hledger MAP

> **Repository:** https://github.com/simonmichael/hledger  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Accounting (Plain-text ledger)  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Plain-text double-entry accounting tool. Best reference for:
- Ledger file format/grammar design
- Transaction parsing and validation
- Multi-currency/commodity accounting
- Report generation algorithms
- Balance assertions and verification
- Command-line accounting workflows

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Haskell |
| Parser | Megaparsec |
| CLI | optparse-applicative |
| Reports | Text-based / CSV / JSON |
| Web UI | Yesod (optional) |

---

## (iii) High-Level Directory Map

```
hledger/
├── hledger/               # Core CLI tool
│   ├── Hledger/
│   │   ├── Cli/          # CLI commands
│   │   └── Read/         # Journal parsing
├── hledger-lib/          # Core library
│   ├── Hledger/
│   │   ├── Data/         # Data types
│   │   ├── Query/        # Query language
│   │   ├── Reports/      # Report generation
│   │   └── Read/         # File parsing
├── hledger-ui/           # Terminal UI
└── hledger-web/          # Web interface
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Transaction types | `hledger-lib/Hledger/Data/Types.hs` |
| Journal parsing | `hledger-lib/Hledger/Read/JournalReader.hs` |
| Balance calculation | `hledger-lib/Hledger/Data/Balancing.hs` |
| Query language | `hledger-lib/Hledger/Query.hs` |
| Balance report | `hledger-lib/Hledger/Reports/BalanceReport.hs` |
| Register report | `hledger-lib/Hledger/Reports/RegisterReport.hs` |
| Multi-currency | `hledger-lib/Hledger/Data/Amount.hs` |

---

## (v) Key Flows

### Transaction Parsing Flow
- Read journal file → `JournalReader.hs`
- Parse transaction directives with date, description, postings
- Validate balanced postings (sum of amounts = 0)
- Store in `Journal` data structure

### Balance Calculation Flow
- Query transactions by date range / account pattern
- Sum postings per account → running balance
- Handle multi-commodity balances separately

### Balance Assertion Flow
- `= 100 USD` after a posting asserts account balance
- Parser validates assertion at transaction date
- Fails loudly if assertion doesn't match

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

Clean-room implementation required. Learn concepts only.

---

## (vii) What Nimbus Should Learn

1. **Transaction grammar** — How to design a DSL for accounting entries

2. **Balance assertions** — Inline balance checks that catch errors early

3. **Commodity vs currency** — Generic "amount" model that works for stock, crypto, currencies

4. **Query language** — Account pattern matching (e.g., `expenses:food:*`)

5. **Virtual postings** — Non-real postings for budgeting/forecasting

6. **Period directives** — Year-start, periodic transactions, auto-postings

7. **Price history** — Historical exchange rates for valuations

8. **Report pivoting** — Grouping by account, time period, tags

9. **Strict vs permissive mode** — Validation strictness levels

10. **Idempotent imports** — Handling duplicate transaction detection
