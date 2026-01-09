# ChefCloud Demo Data & UI Coverage Playbook (Claude Execution Guide)

**Purpose:** Ensure ChefCloud is fully populated with deterministic, realistic demo data and that **every UI route/button** is backed by a working endpoint and displays non-empty, correct information for **all roles** across **Tapas** and **Cafesserie** (multi-branch).

This playbook is written to be used by an AI coding assistant (Claude Sonnet) working inside the ChefCloud repo.

---

## 0) Non‑Negotiable Principles

1) **Deterministic + Idempotent**
- Running the seed twice MUST produce identical counts and identical results (no duplicates).
- Any “randomness” MUST be seeded with a fixed seed string.
- Avoid real-time `Date.now()` drift; anchor demo timelines to a deterministic reference date (or compute relative but deterministically).

2) **No Fake UI Data**
- Do not fill charts with placeholder arrays or static mock data.
- If a screen is empty, fix the endpoint/wiring/seed logic—do not “fake” it.

3) **Single Source of Truth for Context**
- All pages must use the same active context:
  - `activeOrgId`
  - `activeBranchId` (Cafesserie must be switchable)
  - `dateRange` (from/to + presets)
- Do not hardcode branch IDs anywhere in UI pages.

4) **Role‑Correct Visibility**
- Keep RBAC credible: not every role sees everything.
- But no role should land on a blank experience. If RBAC hides a metric, show a permitted substitute (e.g., revenue/orders but hide margin/COGS).

5) **Consistency Over Cleverness**
- Prefer straightforward, auditable generation and simple SQL/Prisma queries.
- Add verification scripts and docs for every major patch.

---

## 1) Definition of “Complete”

ChefCloud is considered “fully populated” ONLY when:

### A. UI Coverage
- Every navigation item, page tab, button, and “View all” CTA leads to a screen that loads data.
- No page shows “No data for this period” if the selected range overlaps seeded data (unless it is a deliberately empty state and explained).

### B. Endpoint Coverage
- Every API endpoint referenced by the frontend has data behind it for Tapas and Cafesserie.
- Endpoints respect org/branch scope, date ranges, and RBAC.

### C. Data Realism
- Inventory: not all items are “critical”. Distribution must feel real.
- Orders: include OPEN + CLOSED orders; include void/refund edge cases.
- Purchases/wastage/consumption: inventory movements match sales patterns.
- Finance: payable aging has due/overdue mix; budgets exist where UI expects them.
- Feedback: NPS trends exist; branch differences exist for Cafesserie.

### D. Verification
- A scriptable verification output exists and passes:
  - seed run #1 counts
  - seed run #2 counts identical
  - sanity checks for common “wrong-but-nonzero” failures (see §8).

---

## 2) Required Repo Structure: Instructions Folder

Create and maintain:

```
/instructions/
  DEMO_DATA_PLAYBOOK.md              (this file)
  UI_ENDPOINT_MATRIX.md              (generated coverage matrix)
  SEEDING_REFERENCE.md               (data generation rules, distributions)
  RBAC_VISIBILITY_MATRIX.md          (which roles see which metrics)
  VERIFY_RUNBOOK.md                  (how to verify locally)
```

**Rule:** Every time you change seeding, endpoints, or a major screen, update these docs.

---

## 3) The Systematic Workflow (No Skipping)

### Phase 1 — UI Action Tree (Buttons/Routes Inventory)
For EACH of these major sections:
- Dashboard
- POS
- Analytics
- Reports
- Inventory
- Finance
- Service Providers
- Reservations
- Feedback
- Staff
- Settings

Perform a code-based inspection and list:
- routes
- tabs
- “View all” links
- CTAs
- filters
- downloads/exports
- drilldowns

**Deliverable:** populate `/instructions/UI_ENDPOINT_MATRIX.md` with:
- Page/Route
- Button/Tab/CTA
- Expected user outcome
- API endpoint(s) used
- Required query params (orgId/branchId/from/to)
- RBAC notes (roles allowed)
- Expected minimum data counts (Tapas, Cafesserie)
- Seed source module (which seeder produces it)

> If unsure what buttons exist: scan the React route component and associated child components for `<Button>`, `<Link>`, `tabs`, menu items, etc.

### Phase 2 — Endpoint Mapping (Networking Tree Coverage)
For each UI element, confirm:
- the endpoint exists
- the frontend calls it with auth
- it includes correct org/branch/date filters
- response structure matches UI expectations

If the UI calls an outdated endpoint:
- Prefer updating UI to use the correct “new” analytics endpoints, OR
- Add a small compatibility endpoint (only if lower risk).

### Phase 3 — Data Requirements + Realism Rules
Define “what data should exist” per screen:
- Which entities (orders, bills, employees, movements, etc.)
- Which statuses must exist
- Which date coverage is required
- Which “distributions” must exist (not all critical stock)

### Phase 4 — Seed Implementation / Corrections
Implement minimal, deterministic seed changes that:
- fill missing data categories
- correct unrealistic distributions
- create records required by screens (e.g., OPEN orders for POS)

### Phase 5 — Verification + Regression Guards
Implement:
- strict validation scripts
- “UI sanity checks” script (counts + distributions)
- Document evidence in `/instructions/VERIFY_RUNBOOK.md`

---

## 4) Data Realism Standards (Important)

### Inventory Stock Status Distribution
**Target distribution per branch (guideline):**
- Healthy (OK): 70–85%
- Low Stock (warning): 10–20%
- Critical: 2–8%

**Rules:**
- “Critical” should be driven by `onHand <= reorderLevel` or your domain rule.
- Ensure `reorderLevel` is realistic per item type (spirits vs produce vs packaging).
- Do not set reorderLevel too high globally (common cause of “everything critical”).

### Purchases / Goods Receipts
- Weekly or biweekly receipts per branch.
- Costs drift mildly over time (0–3% over demo window).
- FIFO batches should exist and match consumption.

### Orders
- Must include:
  - CLOSED orders (majority)
  - OPEN orders (small number, last 24h)
  - occasional void/refund
- Payment mix: cash/card/mobile money should be non-zero.

### Recipes / Consumption / COGS
- 100% menu items must have recipe ingredients.
- Consumption must be created from actual sales (or deterministic approximation) and should not force constant backfills.

### Feedback
- Total volume non-trivial.
- Trend: improvement over time for one branch, slight decline for another (for storytelling).

### Finance
- AP aging: mix of paid, due soon, overdue.
- Budgets: exist if UI shows “Total Budget / Actual / Variance”.

---

## 5) Multi‑Org + Multi‑Branch Consistency (Cafesserie)

Cafesserie MUST demonstrate:
- branch selector affects all pages, not only dashboard
- rankings and comparisons update correctly
- branch-scoped inventory and sales match branch performance

Implementation requirement:
- Maintain `activeBranchId` in one shared context/store (localStorage or global store).
- All hooks read from that single source (not `useAuth().branchId` alone).

---

## 6) RBAC Visibility Matrix (All Roles)

Create `/instructions/RBAC_VISIBILITY_MATRIX.md` listing roles and what they see.

**Rule:** If a role cannot access a page, the navigation should hide it OR show a clear permission message (not a silent empty screen).

---

## 7) UI Layout Quality Rules (Avoid Truncation)

For KPI cards and “big numbers”:
- Use `tabular-nums` for aligned digits.
- Prevent truncation:
  - `whitespace-nowrap`
  - `min-w-[220px]` (or auto-fit grid) for cards
  - compact formatting with tooltip for full value:
    - `USh 2.50M` display, tooltip shows `USh 2,500,000`
- Cards should not shrink below their content width.

Grid guidance:
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6`
- OR `repeat(auto-fit, minmax(220px, 1fr))`

---

## 8) Sanity Checks (Catch “Wrong But Non‑Zero”)

Add verification assertions such as:
- Orders count > 0 for selected date range
- Revenue > 0 for selected date range
- Inventory:
  - criticalPct <= 10%
  - lowStockPct between 5% and 25%
- Top items list length >= 10
- Payment mix includes >= 2 payment types
- COGS present but not > revenue
- Payables due includes both due-soon and overdue

If any fails: fix seed logic or query logic.

---

## 9) Required Deliverables Per Patch

Every patch must include:
1) UI_ENDPOINT_MATRIX.md updated
2) Seed changes documented
3) Verification output
4) Idempotency proof (run seed twice)

---

## 10) Starting Task List for the Current “Inconsistent Data” Problem

### Task 10.1 — Generate UI Endpoint Matrix (Top Priority)
- Scan routes/components.
- List every tab/button/CTA.
- Map to endpoints.
- Identify which endpoints are returning empty.

### Task 10.2 — Fix Context + Filters
- Unify org/branch/date range across all pages and hooks.

### Task 10.3 — Fix Seed Distributions
- Inventory critical status distribution.
- Ensure open orders exist for POS.
- Ensure finance budgets and AP aging align with finance UI.

### Task 10.4 — Add Verification Scripts
- Validate distributions and non-empty endpoints.

---

## Appendix — UI Endpoint Matrix Template

| Section | Route | UI Element (Tab/Button/CTA) | Expected Output | Endpoint(s) | Required Params | Roles | Seed Source | Min Data (Tapas/Caf) | Status |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard | /dashboard | KPI: Revenue | Non-zero total + delta | /analytics/daily-metrics | branchId, from, to | L2+ | seedTransactions.ts | >0 / >0 | TBD |
| POS | /pos | Menu list | Categories + items visible | (TBD) | branchId | L1+ | seedCatalog.ts | >50 / >50 | TBD |

---

**End of Playbook**
