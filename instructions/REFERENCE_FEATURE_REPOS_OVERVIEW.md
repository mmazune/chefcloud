# Reference Feature Repos Overview

> **Last updated:** 2026-01-02  
> **Purpose:** Architecture study and clean-room pattern extraction for Nimbus POS feature development

---

## Purpose

This document provides guidance on using feature-level open-source reference repositories to accelerate Nimbus POS development without introducing:
- **License risk** (GPL/AGPL contamination)
- **Architectural drift** (mismatched patterns from different domains)
- **Low-quality copy/paste** (untested, context-free code)

## Quick Reference

| Domain | Repo | License | Status |
|--------|------|---------|--------|
| Accounting | bigcapital | AGPL-3.0 | ⚠️ Study only |
| Accounting | hledger | AGPL-3.0 | ⚠️ Study only |
| Accounting | beancount | GPL-2.0 | ⚠️ Study only |
| Inventory | InvenTree | MIT | ✅ Adapt allowed |
| Inventory | medusa | MIT | ✅ Adapt allowed |
| Reservations | TastyIgniter | MIT | ✅ Adapt allowed |
| Reservations | easyappointments | AGPL-3.0 | ⚠️ Study only |
| Reservations | cal.com | AGPL-3.0 | ⚠️ Study only |
| Workforce | kimai | AGPL-3.0 | ⚠️ Study only |
| Billing | killbill | Apache-2.0 | ✅ Adapt allowed |
| Billing | lago | AGPL-3.0 | ⚠️ Study only |
| UI | appsmith | Apache-2.0 | ✅ Adapt allowed |
| UI | tremor | Apache-2.0 | ✅ Adapt allowed |
| QA | playwright | Apache-2.0 | ✅ Adapt allowed |
| QA | cypress | MIT | ✅ Adapt allowed |
| Security | CheatSheetSeries | CC-BY-4.0 | ✅ Use with attribution |
| Security | ASVS | CC-BY-4.0 | ✅ Use with attribution |
| Security | juice-shop | MIT | ✅ Adapt allowed |

---

## Strict License Rules

### ✅ Permissive (MIT, Apache-2.0, BSD, CC-BY)
- Pattern adaptation allowed
- Keep attribution in code comments
- Preserve original license notices where applicable

### ⚠️ Copyleft (GPL-*, AGPL-*)
- **Architecture study ONLY**
- NO code copying or line-by-line translation
- Clean-room implementation required:
  1. Study the concept/pattern
  2. Close the reference files
  3. Implement from memory/notes
  4. Different team member reviews

### ❌ Unknown
- View-only
- Do not reference in implementations
- Escalate for legal review if needed

---

## Recommended Study Order

### Phase 1: Core Business Logic (Weeks 1-2)
**Goal:** Understand double-entry accounting, inventory flows, and transaction patterns

1. **Accounting patterns** (all are copyleft — study only):
   - `bigcapital`: Full-stack accounting platform (TypeScript/Node)
     - Focus: Chart of accounts, journal entries, AP/AR flows
   - `beancount`: Pure double-entry logic (Python)
     - Focus: Transaction grammar, balance assertions
   - `hledger`: Plain-text accounting (Haskell)
     - Focus: Report generation, multi-currency

2. **Inventory patterns** (both permissive):
   - `InvenTree`: Stock management system
     - Focus: Part/stock models, stock adjustments, purchase orders
   - `medusa`: E-commerce platform
     - Focus: Product variants, inventory levels, order fulfillment

### Phase 2: Scheduling & Workforce (Weeks 3-4)
**Goal:** Table reservations, time tracking, shift management

3. **Reservation patterns**:
   - `TastyIgniter` (MIT): Restaurant-specific reservations
     - Focus: Table layouts, booking slots, waitlist
   - `cal.com` (AGPL): Modern scheduling infrastructure
     - Focus: Availability engine, booking logic (study only)
   - `easyappointments` (AGPL): Appointment scheduling
     - Focus: Provider/service/customer models (study only)

4. **Workforce patterns**:
   - `kimai` (AGPL): Time tracking application
     - Focus: Timesheet models, project/activity tracking (study only)

### Phase 3: Billing & Subscriptions (Weeks 5-6)
**Goal:** Subscription management, usage-based billing, entitlements

5. **Billing patterns**:
   - `killbill` (Apache): Enterprise billing platform
     - Focus: Subscription lifecycles, invoicing, payment retries
   - `lago` (AGPL): Usage-based billing
     - Focus: Event ingestion, aggregation, metering (study only)

### Phase 4: Frontend & Testing (Weeks 7-8)
**Goal:** Dashboard components, E2E testing patterns

6. **UI patterns** (both Apache):
   - `tremor`: React dashboard components
     - Focus: Chart components, KPI cards, data visualization
   - `appsmith`: Low-code admin panels
     - Focus: Form builders, data binding, widget patterns

7. **QA patterns** (both permissive):
   - `playwright`: E2E testing framework
     - Focus: Page object models, fixtures, parallel execution
   - `cypress`: Component + E2E testing
     - Focus: Custom commands, intercepts, retry patterns

### Phase 5: Security Hardening (Ongoing)
**Goal:** Security controls, verification checklists

8. **Security patterns** (all permissive/CC):
   - `CheatSheetSeries`: OWASP security cheat sheets
     - Focus: Input validation, authentication, session management
   - `ASVS`: Application Security Verification Standard
     - Focus: L1/L2/L3 verification requirements
   - `juice-shop`: Intentionally vulnerable app
     - Focus: Vulnerability patterns to avoid

---

## Clean-Room Implementation Workflow

When implementing a feature based on copyleft reference code:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. STUDY PHASE (with reference open)                        │
│    • Read the data models                                   │
│    • Trace the state machine / flow                         │
│    • Note the key invariants and edge cases                 │
│    • Document concepts in YOUR OWN WORDS                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ISOLATION PHASE (reference CLOSED)                       │
│    • Close all reference files and browser tabs             │
│    • Work only from your notes                              │
│    • Implement from scratch                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. REVIEW PHASE (different person)                          │
│    • Another team member reviews your implementation        │
│    • Verify no line-by-line translation                     │
│    • Confirm tests pass independently                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
reference-feature-repos/
├── README.md              # Quick reference
├── MANIFEST.json          # Machine-readable metadata
├── accounting/
│   ├── bigcapital/
│   ├── hledger/
│   └── beancount/
├── inventory-procurement/
│   ├── InvenTree/
│   └── medusa/
├── reservations/
│   ├── TastyIgniter/
│   ├── easyappointments/
│   └── cal.com/
├── workforce/
│   └── kimai/
├── billing-subscriptions/
│   ├── killbill/
│   └── lago/
├── ui-systems/
│   ├── appsmith/
│   └── tremor/
├── qa-testing/
│   ├── playwright/
│   └── cypress/
└── security/
    ├── CheatSheetSeries/
    ├── ASVS/
    └── juice-shop/
```

---

## Scripts

### Clone/Update All Repos

```bash
# Linux/macOS
./scripts/reference/clone-reference-feature-repos.sh

# Windows PowerShell
.\scripts\reference\clone-reference-feature-repos.ps1
```

### Check License for a Repo

```bash
cat reference-feature-repos/MANIFEST.json | jq '.repos[] | select(.name=="bigcapital")'
```

---

## MAP Documents

For each repo, detailed navigation guides are available in:
```
instructions/reference-feature-maps/<repo>_MAP.md
```

These include:
- What the repo is best for
- Tech stack
- Directory structure
- Key flows (path-linked)
- What Nimbus can learn

---

## Related Documents

- [REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md](REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md) - Feature-by-feature mapping to Nimbus modules
- [OPEN_SOURCE_REFERENCE_WORKFLOW.md](../OPEN_SOURCE_REFERENCE_WORKFLOW.md) - Original workflow document
- [OPEN_SOURCE_POS_COMPARISON_MATRIX.md](../OPEN_SOURCE_POS_COMPARISON_MATRIX.md) - Comparison matrix

---

**Remember: We study patterns, not copy code. License compliance is mandatory.**
