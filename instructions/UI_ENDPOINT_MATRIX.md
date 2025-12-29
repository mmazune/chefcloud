# UI Endpoint Matrix

> **Generated:** 2025-12-22  
> **Last Updated:** 2025-12-23 (M7.1 - Gated Fallbacks)  
> **Purpose:** Map every frontend UI element to its backend endpoint and identify gaps  
> **Milestone:** 7.1 - Data Visibility Fix

---

## M7.1 Updates (2025-12-23)

### ✅ Backend Changes
1. **Created `/debug/demo-health` endpoint** (RBAC: L4+)
   - Returns comprehensive org health: orders, payments, inventory, feedback, etc.
   - Filters by `branchId` with per-branch breakdown
   - Warns if dates don't match seeded data ranges
   - File: [services/api/src/debug/debug.controller.ts](../services/api/src/debug/debug.controller.ts)

### ✅ Frontend Changes
2. **Gated all demo fallbacks behind env var**
   - `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false` by default
   - All hooks now throw errors properly when API fails
   - Fallbacks ONLY return if env var is explicitly set to `true`
   - File: [apps/web/src/hooks/useDashboardData.ts](../apps/web/src/hooks/useDashboardData.ts)
   - Hooks updated:
     - `useDashboardKPIs`
     - `useRevenueTimeseries`
     - `useTopItems`
     - `useCategoryMix`
     - `usePaymentMix`
     - `usePeakHours`
     - `useBranchRankings`
     - `useDashboardAlerts`
     - `useBranchTimeseries`

### 🔍 Remaining Known Issues (Pre-M7.1)
1. **3 missing endpoints** (category-mix, payment-mix, peak-hours) - Created in M7.2
2. **Finance page missing params** - Fixed in M7.2  
3. **No feedback/staff seed data** - Shows empty (not fallback)

---

## Summary

| Section | UI Elements | Working | Broken/Missing | Fallback Demo (Gated) | Seed Missing |
|---------|-------------|---------|----------------|----------------------|--------------|
| Dashboard | 14 | 10 | 0 | 4 (now gated) | 0 |
| POS | 8 | 7 | 0 | 1 | 0 |
| Analytics | 10 | 10 | 0 | 0 | 0 |
| Reports | 9 | 9 | 0 | 0 | 0 |
| Inventory | 4 | 4 | 0 | 0 | 0 |
| Finance | 3 | 3 | 0 | 0 | 0 |
| Service Providers | 4 | 4 | 0 | 0 | 0 |
| Reservations | 4 | 4 | 0 | 0 | 0 |
| Feedback | 4 | 4 | 0 | 0 | **0** ✅ |
| Staff | 3 | 3 | 0 | 0 | 0 |
| Staff Insights | 3 | 3 | 0 | 0 | **0** ✅ |
| Settings | 1 | 1 | 0 | 0 | 0 |
| **TOTAL** | **67** | **62** | **0** | **5 (gated)** | **0** |

---

## 0. Debug Endpoints (M7.1 - Diagnostics)

**File:** [services/api/src/debug/debug.controller.ts](../services/api/src/debug/debug.controller.ts)  
**Purpose:** Diagnostic endpoints to verify demo data exists and is accessible

| Endpoint | Params | RBAC | Returns | Notes |
|----------|--------|------|---------|-------|
| `GET /debug/demo-health` | `from` (ISO), `to` (ISO), `branchId?` | L4+ | Full org health JSON | Orders (via branch.orgId), payments, inventory, feedback, anomalies, etc. Per-branch breakdown if no branchId specified |

**Sample Response:**
```json
{
  "timestamp": "2025-12-23T...",
  "orgId": "...",
  "orgName": "Tapas Restaurant",
  "branchCount": 1,
  "orders": { "total": 862, "byStatus": {"CLOSED": 862}, "inDateRange": 862 },
  "orderItems": {"count": 1724},
  "payments": {"count": 862, "byMethod": {"CASH": 287, "CARD": 288, "MOBILE_MONEY": 287}},
  "diagnostics": { "warnings": [] }
}
```

---

**Phase 1 (Critical Fixes):**
1. ✅ Finance page now passes `branchId`, `year`, `month` params
2. ✅ `useTopItems` hook now passes `from`, `to`, `branchId` params
3. ✅ Backend `getTopItems` updated to accept date range

**Phase 2 (Missing Endpoints Created):**
1. ✅ `GET /analytics/category-mix` - Created
2. ✅ `GET /analytics/payment-mix` - Created
3. ✅ `GET /analytics/peak-hours` - Created

**Phase 3 (Missing Seed Data Added):**
1. ✅ `seedEmployees()` - 8 Employee records for StaffAward
2. ✅ `seedStaffAwards()` - 10+ monthly awards (TOP_PERFORMER, HIGHEST_SALES, etc.)
3. ✅ `seedFeedback()` - 200 NPS feedback entries (60% promoters, 25% passives, 15% detractors)

---

## 1. Dashboard (`/dashboard`)

**File:** [apps/web/src/pages/dashboard.tsx](../apps/web/src/pages/dashboard.tsx)  
**Hooks:** [apps/web/src/hooks/useDashboardData.ts](../apps/web/src/hooks/useDashboardData.ts)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **KPI Cards (7)** | `GET /analytics/daily` | `date`, `branchId` | L3+ | ⚠️ FALLBACK | Returns demo data on error |
| Revenue KPI → Click | `→ /analytics` | — | — | ✅ NAV | Navigation link |
| Gross Margin KPI → Click | `→ /analytics?view=financial` | — | — | ✅ NAV | Navigation link |
| Low Stock KPI → Click | `→ /inventory?filter=low-stock` | — | — | ✅ NAV | Navigation link |
| Payables Due KPI → Click | `→ /finance/payables` | — | — | ✅ NAV | Navigation link |
| **Revenue Chart** | `GET /analytics/daily-metrics` | `from`, `to`, `branchId` | L4+ | ⚠️ FALLBACK | Has demo data fallback |
| **Top Items Chart** | `GET /analytics/top-items` | `limit` | L3+ | ⚠️ FALLBACK | **MISSING: from/to/branchId params** |
| **Category Mix Chart** | `GET /analytics/category-mix` | `from`, `to`, `branchId` | — | ❌ MISSING | **Endpoint does NOT exist** |
| **Payment Mix Chart** | `GET /analytics/payment-mix` | `from`, `to`, `branchId` | — | ❌ MISSING | **Endpoint does NOT exist** |
| **Peak Hours Chart** | `GET /analytics/peak-hours` | `from`, `to`, `branchId` | — | ❌ MISSING | **Endpoint does NOT exist** |
| **Branch Leaderboard** | `GET /franchise/rankings` | `period` (YYYY-MM) | L4+ | ⚠️ FALLBACK | Has demo data fallback |
| **Branch Compare Chart** | `GET /analytics/daily-metrics` | `from`, `to`, `branchId` (per branch) | L4+ | ⚠️ FALLBACK | Has demo data fallback |
| **Alerts Panel** | `GET /inventory/low-stock/alerts` | `branchId` | L3+ | ⚠️ FALLBACK | Has demo alert fallback |
| Alerts → View All | `→ /reports?view=alerts` | — | — | ✅ NAV | Navigation link |

### Dashboard Root Causes
1. **`/analytics/category-mix` does NOT exist** → Frontend falls back to hardcoded demo data
2. **`/analytics/payment-mix` does NOT exist** → Frontend falls back to hardcoded demo data  
3. **`/analytics/peak-hours` does NOT exist** → Frontend falls back to hardcoded demo data
4. **`useTopItems` hook missing `from`, `to`, `branchId` params** → [useDashboardData.ts#L196](../apps/web/src/hooks/useDashboardData.ts#L196)
5. **All hooks catch errors and return demo data** → Masks real API failures

---

## 2. POS (`/pos`)

**File:** [apps/web/src/pages/pos/index.tsx](../apps/web/src/pages/pos/index.tsx)  
**Hooks:** [usePosCachedMenu.ts](../apps/web/src/hooks/usePosCachedMenu.ts), [usePosCachedOpenOrders.ts](../apps/web/src/hooks/usePosCachedOpenOrders.ts)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Menu Items Grid** | `GET /menu/items` | — | Auth | ✅ OK | Uses IndexedDB cache for offline |
| **Open Orders List** | `GET /pos/orders?status=OPEN` | — | Auth | ✅ OK | Uses IndexedDB cache for offline |
| **Order Details** | `GET /pos/orders/:id` | — | Auth | ✅ OK | |
| Create Order | `POST /pos/orders` | `serviceType`, `items` | Auth | ✅ OK | Idempotency key supported |
| Add Item | `POST /pos/orders/:id/modify` | `items[]` | Auth | ✅ OK | Offline queue supported |
| Send to Kitchen | `POST /pos/orders/:id/send-to-kitchen` | — | Auth | ✅ OK | Offline queue supported |
| Close Order | `POST /pos/orders/:id/close` | `amount` | Auth | ✅ OK | Offline queue supported |
| Void Order | `POST /pos/orders/:id/void` | `reason` | Auth | ✅ OK | Offline queue supported |

### POS Root Causes
- **None identified** - POS is well-implemented with offline support

---

## 3. Analytics (`/analytics`)

**File:** [apps/web/src/pages/analytics/index.tsx](../apps/web/src/pages/analytics/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Overview: Sales Chart** | `GET /analytics/daily-metrics` | `from`, `to`, `branchId` | L4+ | ✅ OK | |
| **Branches: Comparison Table** | `GET /franchise/branch-metrics` | `from`, `to` | L4+ | ✅ OK | |
| **Financial: P&L Summary** | `GET /analytics/financial-summary` | `from`, `to`, `branchId` | L4+ | ✅ OK | |
| **Risk: Summary Cards** | `GET /analytics/risk-summary` | `from`, `to`, `branchId` | L4+ | ✅ OK | |
| **Risk: Events Table** | `GET /analytics/risk-events` | `from`, `to`, `branchId`, `severity` | L4+ | ✅ OK | |
| **Franchise: Variance** | `useFranchiseBudgetVariance` | `year`, `month` | L4+ | ⚠️ HOOK | Uses hook abstraction |
| **Franchise: Forecast** | `useFranchiseForecast` | `year`, `month`, `lookbackMonths` | L4+ | ⚠️ HOOK | Uses hook abstraction |
| **Franchise: Multi-Month** | `useFranchiseMultiMonthSeries` | `startYear`, `startMonth`, `months` | L4+ | ⚠️ HOOK | Uses hook abstraction |
| Tab: Overview | — | — | — | ✅ NAV | |
| Tab: Branches | — | — | — | ✅ NAV | |

### Analytics Root Causes
- **None critical** - All endpoints exist, gated behind billing upsell

---

## 4. Reports (`/reports`)

**File:** [apps/web/src/pages/reports/index.tsx](../apps/web/src/pages/reports/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| Franchise Analytics | `→ /analytics` | — | — | ✅ NAV | Link |
| Budgets & Variance | `→ /reports/budgets` | — | — | ✅ NAV | Link |
| Inventory & Stock | `→ /inventory` | — | — | ✅ NAV | Link |
| Staff Insights | `→ /staff/insights` | — | — | ✅ NAV | Link |
| Customer Feedback & NPS | `→ /feedback` | — | — | ✅ NAV | Link |
| Report Subscriptions | `→ /reports/subscriptions` | — | — | ✅ NAV | Link |
| Reservations & Events | `→ /reservations` | — | — | ✅ NAV | Link |
| API Usage & Webhooks | `→ /dev/usage` | — | — | ✅ NAV | Link (requires dev-portal plan) |
| Finance Overview | `→ /finance` | — | — | ✅ NAV | Link |

### Reports Root Causes
- **None** - Reports hub is just navigation links

---

## 5. Inventory (`/inventory`)

**File:** [apps/web/src/pages/inventory/index.tsx](../apps/web/src/pages/inventory/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Items Table** | `GET /inventory/items` | — | Auth | ✅ OK | |
| **Stock Levels** | `GET /inventory/levels` | — | Auth | ✅ OK | |
| **Low Stock Alerts** | `GET /inventory/low-stock/alerts` | `branchId` | L3+ | ✅ OK | |
| Edit Item | `PATCH /inventory/items/:id` | — | Auth | ✅ OK | |

### Inventory Root Causes
- **None identified** - Endpoints exist and are working

---

## 6. Finance (`/finance`)

**File:** [apps/web/src/pages/finance/index.tsx](../apps/web/src/pages/finance/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Budget Summary Stats** | `GET /finance/budgets/summary` | `branchId`, `year`, `month` | L3+ | ❌ BROKEN | **Frontend calls without required params** |
| Total Budget Card | ↑ same | — | — | ❌ BROKEN | Returns 400 Bad Request |
| Actual Spending Card | ↑ same | — | — | ❌ BROKEN | Returns 400 Bad Request |
| Variance Card | ↑ same | — | — | ❌ BROKEN | Returns 400 Bad Request |

### Finance Root Causes
1. **Frontend calls `/finance/budgets/summary` without required `branchId`, `year`, `month` params**
   - Backend: [budget.controller.ts#L84-87](../services/api/src/finance/budget.controller.ts#L84-87) throws `BadRequestException`
   - Frontend: [pages/finance/index.tsx#L21](../apps/web/src/pages/finance/index.tsx#L21) - no params passed

---

## 7. Service Providers (`/service-providers`)

**File:** [apps/web/src/pages/service-providers/index.tsx](../apps/web/src/pages/service-providers/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Providers List** | `GET /service-providers` | `branchId` | Auth | ✅ OK | |
| **Contracts List** | `GET /service-providers/contracts` | `branchId` | Auth | ✅ OK | |
| **Reminders Summary** | `GET /finance/service-reminders/summary` | `branchId` | L3+ | ✅ OK | |
| **Reminders List** | `GET /finance/service-reminders` | `branchId` | L3+ | ✅ OK | |

### Service Providers Root Causes
- **None identified** - Endpoints exist and are working

---

## 8. Reservations (`/reservations`)

**File:** [apps/web/src/pages/reservations/index.tsx](../apps/web/src/pages/reservations/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Reservations Table** | `GET /reservations` | `from`, `to`, `branchId`, `status` | Auth | ✅ OK | |
| **Event Bookings** | `GET /bookings/list` | — | Auth | ✅ OK | |
| Confirm Reservation | `POST /reservations/:id/confirm` | — | Auth | ✅ OK | |
| Cancel Reservation | `POST /reservations/:id/cancel` | — | Auth | ✅ OK | |

### Reservations Root Causes
- **None identified** - Endpoints exist and are working

---

## 9. Feedback (`/feedback`)

**File:** [apps/web/src/pages/feedback/index.tsx](../apps/web/src/pages/feedback/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **NPS Summary Stats** | `GET /feedback/analytics/nps-summary` | — | Auth | ✅ OK | |
| Current NPS Card | ↑ same | — | — | ✅ OK | |
| Promoters/Passives/Detractors | ↑ same | — | — | ✅ OK | |
| Total Responses | ↑ same | — | — | ✅ OK | |

### Feedback Root Causes
- **None identified** - Endpoint exists

---

## 10. Staff (`/staff`)

**File:** [apps/web/src/pages/staff/index.tsx](../apps/web/src/pages/staff/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Employees Table** | `GET /hr/employees` | `page`, `pageSize`, `search`, `isActive` | Auth | ✅ OK | |
| Create Employee | `POST /hr/employees` | — | Auth | ✅ OK | |
| Update Employee | `PATCH /hr/employees/:id` | — | Auth | ✅ OK | |

### Staff Root Causes
- **None identified** - Endpoints exist and are working

---

## 11. Staff Insights (`/staff/insights`)

**File:** [apps/web/src/pages/staff/insights.tsx](../apps/web/src/pages/staff/insights.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **Top Performers Table** | `GET /staff/insights` | — | Auth | ✅ OK | |
| **Recent Awards** | ↑ same | — | — | ✅ OK | Part of insights response |
| **Promotion Suggestions** | ↑ same | — | — | ✅ OK | Part of insights response |

### Staff Insights Root Causes
- **None identified** - Endpoint exists

---

## 12. Settings (`/settings`)

**File:** [apps/web/src/pages/settings/index.tsx](../apps/web/src/pages/settings/index.tsx)

| UI Element | Endpoint | Params | RBAC | Status | Notes |
|------------|----------|--------|------|--------|-------|
| **User Info** | `GET /auth/me` | — | Auth | ✅ OK | From AuthContext |

### Settings Root Causes
- **None** - Uses auth context, no additional API calls

---

## Top 10 Root Causes (Ranked by Impact)

| Rank | Issue | Impact | File Reference | Fix Effort |
|------|-------|--------|----------------|------------|
| 1 | **`/analytics/category-mix` endpoint missing** | Dashboard shows hardcoded demo data | [useDashboardData.ts#L221](../apps/web/src/hooks/useDashboardData.ts#L221) | Medium - Create endpoint |
| 2 | **`/analytics/payment-mix` endpoint missing** | Dashboard shows hardcoded demo data | [useDashboardData.ts#L248](../apps/web/src/hooks/useDashboardData.ts#L248) | Medium - Create endpoint |
| 3 | **`/analytics/peak-hours` endpoint missing** | Dashboard shows hardcoded demo data | [useDashboardData.ts#L275](../apps/web/src/hooks/useDashboardData.ts#L275) | Medium - Create endpoint |
| 4 | **Finance page missing required params** | Finance page shows 400 error, no data | [pages/finance/index.tsx#L21](../apps/web/src/pages/finance/index.tsx#L21) | Small - Add year/month/branchId params |
| 5 | **`useTopItems` missing branchId param** | Top items not filtered by branch | [useDashboardData.ts#L196](../apps/web/src/hooks/useDashboardData.ts#L196) | Small - Add param |
| 6 | **All dashboard hooks have fallback demo data** | Masks API errors in production | [useDashboardData.ts](../apps/web/src/hooks/useDashboardData.ts) | Medium - Remove fallbacks or add error boundary |
| 7 | **`useTopItems` missing from/to params** | Top items not date-filtered | [useDashboardData.ts#L196](../apps/web/src/hooks/useDashboardData.ts#L196) | Small - Add params |
| 8 | **Franchise hooks have demo fallbacks** | Masks API errors | [useDashboardData.ts#L316-345](../apps/web/src/hooks/useDashboardData.ts#L316-345) | Small - Make fallbacks dev-only |
| 9 | **Date filter defaults to today** | Some endpoints may return empty for "today" when seed data is historical | Multiple files | Small - Consider default range |
| 10 | **No unified error handling** | Different pages handle errors differently | Various | Medium - Implement error boundary |

---

## Milestone 7.2 Plan: Smallest Safe Patches

### Phase 1: Critical Fixes (Estimated: 2-4 hours)

1. **Fix Finance Page Params** ([pages/finance/index.tsx](../apps/web/src/pages/finance/index.tsx))
   - Add `branchId`, `year`, `month` params to API call
   - Use user context for branchId, current date for year/month

2. **Fix `useTopItems` Params** ([useDashboardData.ts#L196](../apps/web/src/hooks/useDashboardData.ts#L196))
   - Add `from`, `to`, `branchId` to API call
   - Match other dashboard hooks pattern

### Phase 2: Missing Endpoints (Estimated: 4-6 hours)

3. **Create `/analytics/category-mix` endpoint**
   - Aggregate order items by category
   - Return `{ name, value, count }[]`

4. **Create `/analytics/payment-mix` endpoint**
   - Aggregate payments by method
   - Return `{ method, amount, count }[]`

5. **Create `/analytics/peak-hours` endpoint**
   - Aggregate orders by hour
   - Return `{ hour, orders, revenue }[]`

### Phase 3: Hardening (Estimated: 2-4 hours)

6. **Conditional Demo Fallbacks**
   - Only show fallback data in development/demo mode
   - In production, show proper error states

7. **Error Boundary Component**
   - Create unified error handling for data fetching
   - Show user-friendly error messages

---

## Seed Data Coverage Check

| Section | Required Data | Seeded? | Min Records |
|---------|--------------|---------|-------------|
| Dashboard KPIs | Orders with payments | ✅ | 288 orders |
| Revenue Chart | Daily metrics | ✅ | 30+ days |
| Top Items | Order items | ✅ | 288 orders |
| Category Mix | Categories with items | ✅ | 10+ categories |
| Branch Rankings | Multi-branch sales | ✅ | 2 orgs |
| Inventory | Items + stock levels | ✅ | 50+ items |
| Service Providers | ServiceProvider records | ✅ | 8 providers |
| Reservations | Reservation records | ✅ | 9 reservations |
| Feedback | CustomerFeedback records | ❌ MISSING | Not seeded - will show empty |
| Staff Insights | StaffKpi, StaffAward, PromotionSuggestion | ❌ MISSING | Not seeded - will show empty |
| Staff | Employees + profiles | ✅ | 17 profiles |

---

## 🔴 Phase 3: Missing Seed Data

These pages will work but show empty data because seed is missing:

| Page | Missing Entities | Impact |
|------|------------------|--------|
| **Feedback** | `CustomerFeedback` | NPS summary shows `—` for all stats |
| **Staff Insights** | `StaffKpi`, `StaffAward`, `PromotionSuggestion` | Top performers, awards, suggestions all empty |

**Recommendation:** Seed these entities or add fallback UI states saying "No data yet".

---

## 🟡 Phase 4: Fallback Demo Data (Development Convenience)

These hooks silently return demo data on ANY error, masking real issues:

| Hook | Location | Risk |
|------|----------|------|
| `useDashboardKPIs` | useDashboardData.ts L130 | Masks API/auth errors |
| `useRevenueTimeseries` | useDashboardData.ts L172 | Masks API/auth errors |
| `useTopItems` | useDashboardData.ts L206 | Masks API/auth errors |
| `useCategoryMix` | useDashboardData.ts L230-241 | Masks API/auth errors |
| `usePaymentMix` | useDashboardData.ts L270 | Masks API/auth errors |
| `usePeakHours` | useDashboardData.ts L297 | Masks API/auth errors |
| `useBranchRankings` | useDashboardData.ts L340 | Masks API/auth errors |
| `useBranchTimeseries` | useDashboardData.ts L423 | Masks API/auth errors |

**Recommendation:** Consider making fallback conditional on `process.env.NODE_ENV === 'development'` so production errors surface properly.

---

*Document generated by Milestone 7.1 scan. Updated 7.2 with deeper investigation.*
