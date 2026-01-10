# Integration Chain Backlog

> **Phase H2** — Issues discovered during integration chain verification  
> Generated: 2026-01-10

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 0 | Critical blockers (must fix for chains to pass) |
| **P1** | 1 | High-priority issues affecting reliability |
| **P2** | 3 | Medium-priority improvements |

---

## Open Issues

### IC-001: Tapas Org Slug Mismatch in E2E Helpers

| Field | Value |
|-------|-------|
| **ID** | IC-001 |
| **Severity** | P1 |
| **Chain** | All |
| **Status** | Open |
| **Discovered** | 2026-01-10 |

**Description:**
E2E test helpers (e.g., `requireTapasOrg`) look for `org.slug = 'tapas-demo'` but the seed.ts creates the org with a different slug format.

**Reproduction Steps:**
1. Run `npx tsx prisma/seed.ts`
2. Query: `SELECT slug FROM organizations WHERE name LIKE '%Tapas%'`
3. Observe slug may differ from 'tapas-demo'

**Expected vs Actual:**
- Expected: `slug = 'tapas-demo'`
- Actual: Slug may be auto-generated differently

**Suspected Cause:**
Seed.ts may generate slug dynamically or use a different value.

**File Pointers:**
- `services/api/prisma/seed.ts`
- `services/api/test/helpers/require-preconditions.ts`

**Impact:**
E2E tests using `requireTapasOrg()` may fail to find the org.

**Blocks Fully Functional:** No (workaround: verify slug matches)

---

### IC-002: InventoryPostingMapping Required for GL Posting

| Field | Value |
|-------|-------|
| **ID** | IC-002 |
| **Severity** | P2 |
| **Chain** | A, C |
| **Status** | Open |
| **Discovered** | 2026-01-10 |

**Description:**
GL posting (COGS journal entries) only occurs if an `InventoryPostingMapping` exists for the item's category. Without mapping, inventory movements are recorded in the ledger but no GL entries are created.

**Reproduction Steps:**
1. Create and close a POS order
2. Check JournalEntry table for COGS entries
3. If no mapping exists, journal entry will be null

**Expected vs Actual:**
- Expected: GL posting always occurs for inventory movements
- Actual: GL posting is conditional on mapping configuration

**Suspected Cause:**
Intentional design — allows orgs to configure GL integration optionally.

**File Pointers:**
- `services/api/src/accounting/posting.service.ts`
- `services/api/src/inventory/inventory-gl-posting.service.ts`

**Impact:**
Demo scenarios may not show full GL integration without seed data for mappings.

**Blocks Fully Functional:** No (documented behavior)

---

### IC-003: Seed Missing InventoryLocation for Tapas

| Field | Value |
|-------|-------|
| **ID** | IC-003 |
| **Severity** | P2 |
| **Chain** | B, C |
| **Status** | Open |
| **Discovered** | 2026-01-10 |

**Description:**
The seed.ts does not create an `InventoryLocation` for the Tapas demo org. Some inventory operations (waste, transfers, receipts) require a location.

**Reproduction Steps:**
1. Run seed
2. Query: `SELECT * FROM inventory_locations WHERE org_id = '<tapas-org-id>'`
3. May return empty or minimal locations

**Expected vs Actual:**
- Expected: At least one storage location per branch
- Actual: May be missing

**Suspected Cause:**
Seed.ts focuses on menu/orders, less on inventory foundation.

**File Pointers:**
- `services/api/prisma/seed.ts`

**Impact:**
Waste/receipt posting may fail without location.

**Blocks Fully Functional:** Partial (some chains work, some need location)

---

### IC-004: PayPeriod May Not Exist for Payroll Chain

| Field | Value |
|-------|-------|
| **ID** | IC-004 |
| **Severity** | P2 |
| **Chain** | D |
| **Status** | Open |
| **Discovered** | 2026-01-10 |

**Description:**
The payroll chain requires an unlocked `PayPeriod`. The seed may not create one, or existing periods may be locked.

**Reproduction Steps:**
1. Run seed
2. Query: `SELECT * FROM pay_periods WHERE org_id = '<tapas-org-id>' AND locked = false`
3. May return empty

**Expected vs Actual:**
- Expected: At least one unlocked pay period
- Actual: May need to create manually

**Suspected Cause:**
Seed.ts doesn't include pay period creation for Tapas.

**File Pointers:**
- `services/api/prisma/seed.ts`
- `services/api/test/m106-payroll-runs.e2e-spec.ts` (creates if missing)

**Impact:**
Payroll tests handle this gracefully by creating if missing.

**Blocks Fully Functional:** No (E2E tests self-heal)

---

## Resolved Issues

_No issues resolved yet in this phase._

---

## Issue Template

```markdown
### IC-XXX: [Title]

| Field | Value |
|-------|-------|
| **ID** | IC-XXX |
| **Severity** | P0/P1/P2 |
| **Chain** | A/B/C/D/E |
| **Status** | Open/Resolved |
| **Discovered** | YYYY-MM-DD |

**Description:**
[Detailed description of the issue]

**Reproduction Steps:**
1. Step 1
2. Step 2
3. Step 3

**Expected vs Actual:**
- Expected: [what should happen]
- Actual: [what actually happens]

**Suspected Cause:**
[Root cause analysis]

**File Pointers:**
- `path/to/file1.ts`
- `path/to/file2.ts`

**Impact:**
[Effect on functionality]

**Blocks Fully Functional:** Yes/No
```

---

*Document generated for Phase H2 — Integration Chain Verification*
