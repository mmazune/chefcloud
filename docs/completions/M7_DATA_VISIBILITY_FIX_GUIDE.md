# ChefCloud V2 — Data Visibility & Consistency Fix Guide (M7)

**Purpose:** Ensure seeded demo data is visible across the entire product (Dashboard, POS, Analytics, Reports, Inventory, Finance, Staff, Reservations, Service Providers, Feedback) for **all roles** and for **both orgs** (Tapas + Cafesserie), with no “empty” pages and no misleading frontend fallbacks.

This guide is designed to be placed in the repo at: `/instructions/M7_DATA_VISIBILITY_FIX_GUIDE.md`.

---

## 1) Non‑Negotiable Rules

1. **No silent fallbacks.** Any frontend hook that returns fake data on error must:
   - either throw and show an error UI, or
   - return `{ error: true, message, requestId }` and render an explicit “API error” banner.

2. **Never hardcode branch IDs.**
   - Use the authenticated user + branches list + ActiveBranchContext.
   - If the active branch is invalid, auto-correct.

3. **Deterministic demo only.**
   - All demo records must be reproducible across machines.
   - IDs must be stable.
   - Seeds must be idempotent (delete+recreate or upsert strategy with stable keys).

4. **Every screen must have a seeded story.**
   - Every route/tab/button must be backed by an endpoint and non-empty demo data.

---

## 2) Likely Root Causes (Ranked)

1. **Active branch mismatch**
   - UI uses `activeBranchId` that does not match the branch where orders were seeded.
   - Symptoms: Inventory might show data (org-scoped) but analytics shows zero (branch-scoped).

2. **User branchId is NULL**
   - Backend endpoints filtering by `req.user.branchId` return empty.
   - Fix by assigning a default branchId at seed time for all non-L5 users (and optionally L5).

3. **Date range mismatch**
   - Seeded `createdAt` outside UI default range (7/30/90 days).
   - Or backend uses `lt: to` while frontend expects inclusive end-of-day.

4. **Endpoint path mismatch / versioning**
   - Frontend calling `/franchise/rankings` while backend exposes `/franchise/analytics/rankings` (or `/api/v2/...`).
   - Symptoms: Some widgets show “fallback demo data” only.

5. **Orders missing orderItems / payments**
   - Category mix, top items, payment mix show empty even if orders exist.

---

## 3) Required Deliverables for M7.1

### 3.1 UI Endpoint Matrix (must be created)
Create: `/instructions/UI_ENDPOINT_MATRIX.md`

For each route/tab/widget/CTA:
- UI file path(s)
- Data hook / query key
- Endpoint(s) called
- Required params (orgId, branchId, from, to, date, period)
- Role access
- Expected non-empty demo data
- Known issues / fixes

### 3.2 Debug Endpoint in API
Add an authenticated debug endpoint:
- `GET /debug/demo-health?from=...&to=...&branchId=...`

Return:
- `orgId`, `branchId`, `branchCount`
- Orders count by status
- Earliest/latest `createdAt`
- orderItems count
- payments count
- feedback count
- inventory items count + low/critical counts
- any mismatched IDs (e.g., activeBranchId not present in branches list)

### 3.3 Verification Scripts
Add scripts that can be run locally and in CI:
- `/scripts/verify-demo-health.ts` (or `.sh`)
- It should login as demo owners and call all major endpoints:
  - analytics daily, daily-metrics, top-items, category-mix, payment-mix, peak-hours, financial-summary, risk-summary
  - inventory low-stock alerts
  - HR employees listing
  - finance budgets summary and AP aging
  - franchise rankings/overview
- Output PASS/FAIL with counts.

### 3.4 Remove (or clearly surface) Frontend Fallbacks
For each hook with `try/catch` returning fake arrays:
- Remove fallback, OR keep it behind explicit flag `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false`
- UI must show a banner if fallback is used.

---

## 4) Seed Quality Requirements

### 4.1 Orders
- Must exist for *each branch* being demoed (Tapas: 1 branch, Cafesserie: 4 branches).
- Must include `orderItems` linked to real menu items.
- Must include at least 1 payment per order with realistic method distribution.
- Must include status distribution but ensure **enough CLOSED** orders for revenue.

### 4.2 Inventory realism
Avoid “everything critical”.
Target distribution:
- ~10% critical (<= min)
- ~20% low (<= reorder)
- ~70% OK

### 4.3 Roles
Each demo role must have:
- A branchId (unless explicitly global)
- At least one meaningful screen they can access with non-empty data
- RBAC must not silently return 200 with empty arrays because of missing branch context

---

## 5) Acceptance Checklist (M7)

1. **Dashboard**: all cards + charts show non-empty real API data (not fallback).
2. **POS**: menu loads; search works; creating an order works.
3. **Analytics**: overview chart, financial, risk, franchise tabs all show data.
4. **Reports**: each report tile leads to populated data.
5. **Inventory**: mix of OK/low/critical; movements show purchases/wastage/consumption.
6. **Finance**: payables due shows non-empty for accountant/manager/owner.
7. **Staff**: staff list non-empty; filters work.
8. **Both orgs**: Tapas + Cafesserie pass the above.

---

## 6) Implementation Sequence (Do Not Skip)

**M7.1** — Build UI Endpoint Matrix + debug endpoint + remove fallbacks.  
**M7.2** — Fix branch selection + user.branchId + endpoint version mismatches.  
**M7.3** — Patch seeders to ensure every endpoint has data (orderItems/payments/feedback/budgets).  
**M7.4** — Role-by-role walkthrough; ensure no empty permitted pages.

---

## 7) Notes on Order ↔ Org Filtering

Orders do NOT have orgId.
To filter by org, always use:
- `where: { branch: { orgId } }`

To filter by branch:
- `where: { branchId }`

If endpoints currently depend on `req.user.branchId`, they must:
- validate branchId exists
- or accept explicit branchId query param
- or resolve a default branchId for the org (first branch or branch with most recent activity)

