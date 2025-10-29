# E22-s2 Completion Summary

**Status**: ✅ OK

**Build**: 11/11 packages successful  
**Tests**: 154/154 tests passing (23 suites)

## Implementation Details

### 1. Database Schema ✅

- Added `franchiseWeights` Json? field to `OrgSettings` model
- Migration: `20251029_add_franchise_weights/migration.sql`
- Default: `null` (service uses default weights: revenue 0.4, margin 0.3, waste -0.2, sla 0.1)

### 2. Franchise Service (services/api/src/franchise/) ✅

**Methods Implemented:**

- `getOverview(orgId, period)` → Branch sales, margin, waste%, SLA aggregation
- `getRankings(orgId, period)` → Ranked branches with custom weights support
- `upsertBudget(orgId, branchId, period, data)` → Create/update budgets
- `getBudgets(orgId, period)` → List budgets for period
- `getForecastItems(orgId, period, method)` → Retrieve forecast points
- `getProcurementSuggestions(orgId, branchId?)` → Items below safety stock
- `calculateMovingAverage(orgId, branchId, itemId, days)` → Helper for workers

**Custom Weights Logic:**

- Fetches `org_settings.franchiseWeights` if present
- Falls back to defaults: `{revenue: 0.4, margin: 0.3, waste: -0.2, sla: 0.1}`
- Normalizes scores using max values per metric

### 3. Franchise Controller (services/api/src/franchise/) ✅

**Endpoints:**

- `GET /franchise/overview?period=YYYY-MM` (L5) → Branch metrics
- `GET /franchise/rankings?period=YYYY-MM` (L5) → Ranked branches
- `POST /franchise/budgets` (L5) → Upsert budget
- `GET /franchise/budgets?period=YYYY-MM` (L5) → List budgets
- `GET /franchise/forecast/items?period=YYYY-MM&method=MA14` (L4+) → Forecasts
- `GET /franchise/procurement/suggest?branchId=xxx` (L4+) → Reorder suggestions

**Guards:** `AuthGuard('jwt')`, `RolesGuard`, `@Roles('L4')` or `@Roles('L5')`

### 4. Worker Jobs (services/worker/src/index.ts) ✅

**forecast-build (Nightly @ 02:30 via `30 2 * * *` cron)**

- Fetches `ForecastProfile` records
- Calculates MA7/MA14/MA30 based on `method` field
- Applies weekend uplift (Sat/Sun) and month-end uplift (last 3 days)
- Upserts 7 days of `ForecastPoint` records
- Uses simplified consumption tracking via `stockBatch` aggregation

**rank-branches (Monthly @ 01:00 on 1st via `0 1 1 * *` cron)**

- Calculates metrics for all branches per org
- Fetches custom weights from `org_settings.franchiseWeights`
- Computes scores: `(revenue_norm * w.revenue + margin_norm * w.margin + waste_pct * w.waste + sla_norm * w.sla) * 100`
- Sorts by score (desc), assigns ranks
- Upserts `FranchiseRank` records with `meta` JSON

### 5. Tests ✅

**Unit Tests (franchise.service.spec.ts):**

- ✅ Default weights when `franchiseWeights` is null
- ✅ Custom weights from `org_settings`
- ✅ MA14 calculation with synthetic data
- ✅ Zero consumption edge case
- ✅ Budget upsert
- ✅ Procurement suggestions below safety stock

**E2E Tests (e22-franchise.e2e-spec.ts):**

- ✅ Budget POST/GET with upsert behavior
- ✅ Rankings with deterministic ordering (Branch Alpha #1, Branch Beta #2)
- ✅ Procurement suggestions for items below reorder level
- ✅ Invalid period format rejection

**Results:** 154/154 tests passing

### 6. Documentation ✅

**DEV_GUIDE.md Section Added:**

- Architecture overview
- 6 endpoint examples with curl commands
- Custom weights configuration SQL examples
- Worker job descriptions (forecast-build, rank-branches)
- Database inspection queries
- Troubleshooting guide

**Topics Covered:**

- Ranking formula explanation
- Weekend/month-end uplift logic
- Manual worker triggers
- Use cases (quality-focused, revenue-focused, service-focused)

## Files Modified

**Schema:**

- `packages/db/prisma/schema.prisma` (+1 line: franchiseWeights)
- `packages/db/prisma/migrations/20251029_add_franchise_weights/migration.sql` (new)

**API:**

- `services/api/src/franchise/franchise.service.ts` (enhanced getRankings, calculateMovingAverage)
- `services/api/src/franchise/franchise.controller.ts` (already existed, verified)
- `services/api/src/franchise/franchise.service.spec.ts` (new: 6 tests)

**Worker:**

- `services/worker/src/index.ts` (updated cron schedules, added custom weights support)

**Tests:**

- `services/api/test/e22-franchise.e2e-spec.ts` (new: 4 test cases)

**Docs:**

- `DEV_GUIDE.md` (+280 lines: Franchise Management section)

## Verification

```bash
# Build
$ pnpm -w build
✅ Tasks: 11 successful, 11 total

# Test
$ cd services/api && pnpm test
✅ Test Suites: 23 passed, 23 total
✅ Tests: 154 passed, 154 total
```

## Rollback Plan

If issues arise:

1. Remove `franchiseWeights` field: `ALTER TABLE org_settings DROP COLUMN "franchiseWeights";`
2. Revert worker schedule changes (restore `0 1 * * *` and `0 3 1 * *`)
3. No breaking changes — all endpoints already existed or are new L5-only routes

---

**Completion Date:** 2025-10-29  
**Story:** E22-s2 — Franchise workers + APIs  
**Changes:** Minimal and idempotent ✅
