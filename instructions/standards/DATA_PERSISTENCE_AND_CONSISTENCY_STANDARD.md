# Nimbus POS — Data Persistence & Cross-Role Consistency Standard

_Last updated: 2025-12-29 (Africa/Kampala)_

This is a **non-negotiable** standard: **any feature, seed, or demo data must be persistent and consistent across the entire system**—including every role, every dashboard, every report, and every API that references the entity.

This document exists to prevent partial/fragmented implementations that “work in one screen” but break or disappear elsewhere.

---

## 1) Core Principle: One Truth, Everywhere

Nimbus POS is a multi-tenant, RBAC-driven system. For credibility and correctness:

- **All UI must reflect persistent backend state**, not frontend fallbacks.
- **All seeded entities must be fully connected** (menu → recipe → ingredient → stock → COGS → margin).
- **Every role that should see a fact must see the same fact**, filtered only by RBAC and scope (org/branch).

---

## 2) Non-Negotiable Invariants (Must Always Hold)

### A) Menu item completeness (if an item is sellable)
For every sellable menu item:
- Has a stable identifier (seeded deterministically if demo)
- Has a category + tax rules (if applicable)
- Has pricing rules (base price, variants/modifiers if supported)
- Has a recipe definition (even if “no inventory impact” is explicit)
- If recipe consumes inventory:
  - ingredient SKUs exist
  - units and conversion factors are defined
  - yield/waste assumptions are defined where relevant
  - cost basis is computable (FIFO batches or configured costing method)

**Validation:** “Sell item” must always be able to compute COGS path (or explicitly show why it is non-inventory).

---

### B) Inventory SKU completeness (if it can appear in stock)
For every inventory SKU:
- Has purchase UOM and (if needed) consumption UOM
- Has conversion factors
- Has supplier/vendor metadata (or explicit “generic” vendor)
- Has reorder levels and storage location (or explicit “unknown”)
- Has costing method compatibility (FIFO lots/batches or equivalent)
- Has initial stock position (or explicit zero with empty-state UX)

---

### C) Reporting consistency across roles
If a KPI exists (sales, COGS, margin, stock valuation, shrinkage):
- The same KPI must match across:
  - Owner/Executive dashboard (org/branch rollups)
  - Manager dashboards
  - Accountant/Finance reports (where applicable)
  - Stock manager inventory valuation and movement logs

Differences may exist only due to:
- Role scope (branch-only vs org-wide)
- Time range selection
- Rounding rules (must be documented)

---

### D) Deterministic seeding and idempotency
For demo datasets (DEMO_TAPAS, DEMO_CAFESSERIE_FRANCHISE, DEMO_EMPTY):
- Seed runs are idempotent (safe to re-run)
- IDs are deterministic (same across machines and resets)
- Relationships remain stable and complete

---

## 3) “No Partial Features” Rule

A feature is not “done” unless it is complete in ALL required layers:

1) **Database** schema and constraints
2) **API** endpoints + RBAC + validation
3) **Service logic** (business rules)
4) **Seed/demo alignment** (if feature is demo-visible)
5) **UI** for the roles that own the workflow
6) **Reports/KPIs** affected by the feature
7) **E2E coverage** (or verifier coverage) for the workflow

If any layer is missing, the deliverable must be tagged explicitly as:
- `SCAFFOLD_ONLY` (placeholder UI)  
or
- `INCOMPLETE_DO_NOT_DEMO`

---

## 4) Cross-Role Persistence Checklist (Used for Every Milestone)

When adding or modifying an entity, answer “YES” to all that apply:

### Menu/Recipe changes
- [ ] Item appears for cashier/FOH ordering
- [ ] Item appears in manager menu management
- [ ] Item appears in kitchen/KDS (if relevant)
- [ ] Item has recipe/ingredient mapping
- [ ] Consumption logs reflect sales (if inventory-linked)
- [ ] COGS and margin update in reports

### Inventory changes
- [ ] SKU appears in procurement/purchasing
- [ ] SKU appears in stock counts and valuation
- [ ] SKU affects recipe consumption correctly
- [ ] Stock movements have correct audit trail
- [ ] FIFO batches close correctly without negative stock (unless explicitly allowed)

### Finance/reporting changes
- [ ] Owner rollups reconcile to branch-level totals
- [ ] Accountant reports reconcile to operational events
- [ ] Date-range boundaries consistent (end-of-day inclusive standard)

---

## 5) Enforcement Mechanisms (Recommended)

### A) Seed verifier
Add/maintain a verifier script that asserts:
- Every sellable menu item has a recipe or is marked non-inventory
- Every recipe ingredient SKU exists and has UOM conversions
- COGS is computable for all seeded sales events
- Cross-report reconciliation checks pass within rounding tolerances

### B) E2E gates
E2E must include at least:
- POS sale → inventory consumption → COGS generated
- Dashboard KPIs reflect that sale
- Stock valuation changes appropriately
- RBAC scoping does not “hide” core data incorrectly

### C) No fallback by default
Frontend fallback demo data must remain OFF by default. Demo experience comes from seeded backend truth.

---

## 6) How Prompts Must Reference This Document

Every implementation prompt to an LLM must include:

- “Read `/instructions/DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md`”
- Acceptance criteria must include at least one cross-role persistence check from §4.

This ensures no new work breaks the “persistent truth everywhere” contract.
