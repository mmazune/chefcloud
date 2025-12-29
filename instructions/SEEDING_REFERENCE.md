# ChefCloud — Demo Seeding Reference (M7.2/M7.3)

**Purpose:** A deterministic, idempotent reference for *what* must be seeded and *how* it should look so the entire UI and all API endpoints are populated for **Tapas** and **Cafesserie** across **all roles**.

Place this file in the repo at: `/instructions/SEEDING_REFERENCE.md`

---

## 1) Determinism & Idempotency Rules

### 1.1 Stable IDs and Keys
- Use deterministic IDs for:
  - orgs, branches, demo users
  - menu items and inventory SKUs
- Seed-generated documents (orders, bills, reservations) should have stable *business keys*:
  - `orderNumber` unique per branch
  - `billNumber` unique per org/vendor/month
  - `grNumber` unique per branch/day/sequence

### 1.2 Seed RNG
- If you need randomness, use a seeded PRNG with a fixed seed string per milestone.
- Never use `Math.random()` directly.

### 1.3 Anchor Date
- Compute seeded dates relative to a deterministic anchor:
  - Recommended: `ANCHOR = 2025-12-23T12:00:00Z`
- Always ensure seeded data overlaps UI default ranges:
  - Tapas: last **90** days
  - Cafesserie: last **180** days

---

## 2) Branch & User Assignment (Critical for “Empty Charts”)

### 2.1 Every Demo User Must Have a branchId
- Assign a valid `branchId` to every demo user who is not explicitly “global”.
- Do not rely on `req.user.branchId` being present unless you enforce it via seed.

### 2.2 Orders Have No orgId
- Orders must be scoped via relations:
  - org filtering: `order.branch.orgId`

### 2.3 Active Branch Must Be Single Source of Truth
- Frontend must use ActiveBranchContext (localStorage + `/branches`).
- Backend endpoints should accept `branchId` query param; if omitted, use a deterministic default branch.

---

## 3) Core Entities That Must Exist (for every endpoint)

### 3.1 Catalog (Menu + Categories)
Per branch:
- Categories: >= 12
- MenuItems: >= 80 per branch
- Items must be active/available and visible to POS filters.

### 3.2 Orders (CLOSED + OPEN)
Per branch over window:
- CLOSED/SERVED orders: majority
- OPEN orders: small count in last 24h (POS should feel “live”)
- Each order must include:
  - >= 1 `orderItem`
  - >= 1 `payment` for CLOSED orders

### 3.3 Inventory & Stock Movements
Per branch:
- Inventory items: >= 70 (Tapas may be 150+)
- FIFO batches + movements exist (purchases, wastage, sale consumption)

### 3.4 Finance / AP
Per org:
- Bills/invoices non-trivial volume
- Payables aging includes paid + due soon + overdue

### 3.5 Staff / HR
- Tapas: 30–45 employees
- Cafesserie: 15–25 per branch + org roles

### 3.6 Reservations (Tapas)
- 8–25 reservations/week
- Mix of statuses and deposits for larger parties

### 3.7 Feedback (NPS)
- Volume non-trivial + trends + branch differences

---

## 4) Inventory “Everything Critical” — How to Prevent It

### 4.1 Target Distribution Per Branch
- OK: 70–85%
- Low: 10–20%
- Critical: 2–8%

### 4.2 Root Causes
- reorderLevel too high globally
- onHand computed wrong (batches/movements not aligned)

### 4.3 Implementation Strategy
1) Choose reorderLevel by category type.
2) Seed stock so most items are 1.5×–6× reorderLevel.
3) Validate using same logic as `/inventory/low-stock/alerts`.
4) Fail verification if criticalPct > 10%.

---

## 5) Analytics Endpoint Expectations

- `/analytics/daily`: non-zero totals
- `/analytics/daily-metrics`: >= 7 points for 7-day range
- `/analytics/top-items`: >= 10 items
- `/analytics/category-mix`: >= 6 categories
- `/analytics/payment-mix`: >= 2 payment types
- `/analytics/peak-hours`: meaningful distribution
- `/analytics/financial-summary`: non-zero where permitted
- Franchise analytics: real per-branch rankings (no frontend fallbacks)

---

## 6) Verification Gates (Automated)

Verifier must fail if:
- Any endpoint used in UI_ENDPOINT_MATRIX is empty unexpectedly
- Inventory criticalPct > 10%
- Orders missing orderItems or payments
- Demo users expected to be branch-scoped have NULL branchId
- Seed dates don’t overlap UI default ranges

---

## 7) Role-by-Role “Non-Empty” Guarantee

Minimum non-empty pages per role:
- Owner (L5): everything
- Manager (L4): dashboard, POS, staff, reservations, inventory alerts, analytics (may hide cost)
- Accountant (L4): finance/AP, financial summary, dashboards
- Stock/Procurement (L3): inventory, receipts, vendors
- Cashier/Waiter (L2/L1): POS + open orders + limited stats

If RBAC blocks a page: hide navigation or show explicit permission UI—never a blank page.

---

**End of reference**
