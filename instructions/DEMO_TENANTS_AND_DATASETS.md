# Nimbus POS — Demo Tenants, Accounts, and Seeded Datasets (Source of Truth)

_Last updated: 2025-12-29 (Africa/Kampala)_

This document exists to prevent confusion caused by multiple demo datasets/tenants. **All engineering work, E2E tests, and manual QA must explicitly state which demo dataset is being used.** Do not “implicitly assume” a demo tenant.

---

## 1) The Three Demo Datasets (Canonical)

Nimbus POS intentionally maintains **three** demo datasets:

### A) **DEMO_EMPTY** — “Blank Demo” (No seeded operational data)
**Purpose**
- Onboarding / first-run experience
- “Empty-state” UX validation (no sales, no inventory, no menu)
- Permission prompts and setup flows

**Must NOT be used for**
- Pitch/demo dashboards
- Inventory/FIFO validation
- Financial reporting demos
- “Role workspace” demos (unless explicitly testing empty-state UI)

**Expected characteristics**
- Minimal org + branch + owner user exists
- No (or near-zero) menu items, recipes, purchases, orders, shifts, KPI history

---

### B) **DEMO_TAPAS** — Single restaurant demo (fully seeded; high realism)
**Purpose**
- Primary product demo for hospitality POS
- End-to-end POS → inventory consumption → FIFO COGS → gross margin reporting
- Kitchen/KDS and bar workflows
- Realistic menu + recipe + ingredient costing

**Must be used for**
- Most feature demos
- Most E2E tests that require operational data
- Any test validating menu, recipes, stock movements, FIFO, or sales KPIs

**Expected characteristics**
- Fully seeded menu items with recipes and ingredients
- Inventory SKUs with purchase units, yields, conversion factors
- Realistic procurement, stock movements, consumption events
- Orders, payments, refunds/voids, shifts, anomalies

---

### C) **DEMO_CAFESSERIE_FRANCHISE** — Multi-branch franchise demo (fully seeded; multi-tenant stress)
**Purpose**
- Franchise/Multi-branch executive dashboards
- Cross-branch analytics (KPI rollups, branch comparisons)
- RBAC + multi-location access
- Procurement and inventory across branches

**Must be used for**
- Franchise tier demonstrations
- Multi-branch permission tests
- Any UI that aggregates across branches/orgs

**Expected characteristics**
- One org with multiple branches (e.g., 4 branches)
- Branch-scoped inventory, sales, shifts
- Org-level reporting and branch-level reporting both populated
- Users assigned to specific branches and/or multi-branch roles

---

## 2) Demo Accounts vs Demo Datasets (Do Not Conflate)

A **demo account** (user credentials) is not the same thing as a **demo dataset** (org/branch data).

- A single user may have access to **one** dataset (branch-scoped roles) or **multiple** (owner/executive roles).
- **E2E tests must explicitly select the intended org/branch context** after login (or validate the default selection).

---

## 3) Canonical Source of Truth for IDs, slugs, and credentials

Because seeding is deterministic, the repository must maintain a single canonical mapping for:

- orgSlug / orgId
- branchId(s)
- demo user emails (by jobRole) and password
- register/cash drawer identifiers (if used in tests)

**Rule:** E2E and scripts must **import these values** from one file rather than hard-coding.

### Required file (must exist in repo)
Create/maintain **one** of the following (choose one and standardize):
- `services/api/test/helpers/demo-fixtures.ts`  
or
- `services/api/test/helpers/demo-tenants.ts`

It must export:
- `DEMO_EMPTY`, `DEMO_TAPAS`, `DEMO_CAFESSERIE_FRANCHISE`
- per dataset: `{ orgSlug, orgId, branchIds, defaultBranchId }`
- per role: `{ email, password, jobRole, roleLevel, datasetAccess }`

**If values are unknown at authoring time**, the file must define a small runtime “resolver” that calls `/me` + a deterministic “seed map” endpoint (or DB query) and then caches results during the test run.

---

## 4) E2E Policy: Which dataset is used by default?

### Default rule
- **All E2E tests default to DEMO_TAPAS** unless explicitly testing empty-state or multi-branch behavior.

### Exceptions
- Tests validating empty-state UI: use **DEMO_EMPTY**
- Tests validating org rollups / multi-branch analytics: use **DEMO_CAFESSERIE_FRANCHISE**

### Enforcement mechanism (recommended)
- In the shared E2E login helper, require a `dataset` argument:
  - `loginAs({ role: "MANAGER", dataset: "DEMO_TAPAS" })`
- If omitted, default to `DEMO_TAPAS`.
- If a test tries to run on `DEMO_EMPTY` without explicitly setting `allowEmptyDataset: true`, fail fast with a clear error.

---

## 5) Manual QA / Demo Policy (Human testing)

When someone reports a bug or records a screen capture:
- They must state: **dataset + branch + role**
  - Example: “DEMO_TAPAS / Main Branch / CASHIER”
  - Example: “DEMO_CAFESSERIE_FRANCHISE / Branch 3 / OWNER (org rollup)”

This avoids misdiagnosis caused by empty dashboards in DEMO_EMPTY.

---

## 6) Acceptance Checklist (Must remain true)

- DEMO_EMPTY exists and reliably produces empty-states (not crashes).
- DEMO_TAPAS is fully populated and consistent end-to-end (menu → recipe → inventory → FIFO → margin).
- DEMO_CAFESSERIE_FRANCHISE is fully populated across branches and supports rollup analytics.
- E2E tests and demo scripts do not confuse datasets; default is DEMO_TAPAS.
