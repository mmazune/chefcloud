# Integration Chain Backlog

> **Phase H2** — Issues discovered during integration chain verification  
> Generated: 2026-01-10

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0** | 0 | Critical blockers (must fix for chains to pass) |
| **P1** | 0 | High-priority issues affecting reliability |
| **P2** | 1 | Medium-priority improvements |
| **Resolved** | 3 | Fixed in Phase H3 |

---

## Open Issues

### IC-001: Tapas Org Slug Mismatch in E2E Helpers

| Field | Value |
|-------|-------|
| **ID** | IC-001 |
| **Severity** | P1 |
| **Chain** | All |
| **Status** | ✅ Resolved |
| **Discovered** | 2026-01-10 |
| **Resolved** | 2026-01-10 |

**Description:**
E2E test helpers (e.g., `requireTapasOrg`) look for `org.slug = 'tapas-demo'` but the seed.ts creates the org with a different slug format.

**Resolution:**
Created `test/helpers/e2e-demo-constants.ts` as single source of truth. Updated `require-preconditions.ts` to import `TAPAS_ORG_SLUG` and `CAFESSERIE_ORG_SLUG` from centralized constants.

**File Changes:**
- NEW: `services/api/test/helpers/e2e-demo-constants.ts`
- MODIFIED: `services/api/test/helpers/require-preconditions.ts`

---

### IC-002: InventoryPostingMapping Required for GL Posting

| Field | Value |
|-------|-------|
| **ID** | IC-002 |
| **Severity** | P2 |
| **Chain** | A, C |
| **Status** | ✅ Resolved |
| **Discovered** | 2026-01-10 |
| **Resolved** | 2026-01-10 |

**Description:**
GL posting (COGS journal entries) only occurs if an `InventoryPostingMapping` exists for the item's category. Without mapping, inventory movements are recorded in the ledger but no GL entries are created.

**Resolution:**
Created `seedPostingMappings.ts` that seeds org-level default InventoryPostingMapping for both Tapas and Cafesserie. Also extended Chart of Accounts with required GL accounts (GRNI, Waste Expense, Shrink Expense, Inventory Gain).

**File Changes:**
- NEW: `services/api/prisma/demo/seedPostingMappings.ts`
- MODIFIED: `services/api/prisma/demo/seedDemo.ts` (extended CoA)
- MODIFIED: `services/api/prisma/seed.ts` (extended CoA)
- MODIFIED: `services/api/prisma/demo/seedComprehensive.ts` (orchestration)

---

### IC-003: Seed Missing InventoryLocation for Tapas

| Field | Value |
|-------|-------|
| **ID** | IC-003 |
| **Severity** | P2 |
| **Chain** | B, C |
| **Status** | ✅ Resolved |
| **Discovered** | 2026-01-10 |
| **Resolved** | 2026-01-10 |

**Description:**
The seed.ts does not create an `InventoryLocation` for the Tapas demo org. Some inventory operations (waste, transfers, receipts) require a location.

**Resolution:**
Created `seedLocations.ts` that seeds default InventoryLocation records for both orgs. Tapas gets 3 locations (MAIN, KITCHEN, BAR), Cafesserie gets 1 MAIN per branch. All location IDs are deterministic and exported from constants.

**File Changes:**
- NEW: `services/api/prisma/demo/seedLocations.ts`
- MODIFIED: `services/api/prisma/demo/constants.ts` (added LOC_*_ID exports)
- MODIFIED: `services/api/prisma/demo/seedComprehensive.ts` (orchestration)
- MODIFIED: `services/api/test/helpers/e2e-demo-constants.ts` (re-exports)

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

### IC-001: Tapas Org Slug Mismatch in E2E Helpers ✅

Resolved 2026-01-10. See above for details.

### IC-002: InventoryPostingMapping Required for GL Posting ✅

Resolved 2026-01-10. See above for details.

### IC-003: Seed Missing InventoryLocation for Tapas ✅

Resolved 2026-01-10. See above for details.

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
