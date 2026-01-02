# beancount MAP

> **Repository:** https://github.com/beancount/beancount  
> **License:** ⚠️ GPL-2.0 (study only — no code copying)  
> **Domain:** Accounting (Double-entry, Python)  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Double-entry bookkeeping system in Python. Best reference for:
- Plain-text ledger format design
- Balance checking algorithms
- Multi-currency accounting
- Plugin architecture for validations
- Report generation patterns

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Python 3 |
| Parser | Custom (Lark-based) |
| Reports | Text / HTML |
| Web UI | Fava (separate project) |

---

## (iii) High-Level Directory Map

```
beancount/
├── beancount/
│   ├── core/             # Core data structures
│   ├── parser/           # Ledger file parser
│   ├── ops/              # Operations (balance, pad)
│   ├── plugins/          # Validation plugins
│   └── reports/          # Report generators
└── examples/             # Sample ledger files
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Data types | `beancount/core/data.py` |
| Parser | `beancount/parser/parser.py` |
| Balance checking | `beancount/ops/balance.py` |
| Padding (auto-balance) | `beancount/ops/pad.py` |
| Plugins system | `beancount/plugins/` |
| Reports | `beancount/reports/` |

---

## (v) Key Flows

### Directive Types
- `open` / `close` — Account lifecycle
- `balance` — Balance assertion at a date
- `transaction` — The core double-entry record
- `pad` — Auto-generate balancing transaction

### Validation Pipeline
- Parse → Build AST → Run plugins → Check balances → Generate reports

---

## (vi) What We Can Adapt

**⚠️ GPL-2.0 = STUDY ONLY**

---

## (vii) What Nimbus Should Learn

1. **Directive-based ledger** — Typed entries (open, close, balance, transaction)

2. **Account lifecycle** — Explicit open/close dates for accounts

3. **Balance padding** — Auto-generate adjustment entries

4. **Plugin architecture** — Extensible validation hooks

5. **Tolerance for rounding** — Configurable precision for balance checks

6. **Tags and links** — Metadata on transactions for querying

7. **Cost basis tracking** — For inventory/lots (FIFO, LIFO)

8. **Booking methods** — How to handle partial sales of commodities

9. **Interpolation** — Infer missing amounts in postings

10. **Document linking** — Attach receipts/docs to transactions
