# Verification Runbook

> **Created:** 2025-12-24  
> **Updated:** 2025-01-24 (M7.6)  
> **Purpose:** Step-by-step guide to verify ChefCloud backend + frontend health after changes

---

## Overview

This runbook provides the standard verification process to ensure:
1. Backend API is functioning correctly
2. RBAC enforcement works for all role levels
3. Demo data is seeded properly
4. No regressions in endpoint behavior

---

## 🚀 Quick Start: One-Shot Script (M7.6+)

**New in M7.6:** Zero-touch demo reset script that runs all verification steps automatically.

### Windows (PowerShell)
```powershell
.\scripts\demo-reset.ps1
```

### Linux/Mac/WSL (Bash)
```bash
chmod +x scripts/demo-reset.sh
./scripts/demo-reset.sh
```

**What It Does:**
1. ✅ Checks prerequisites
2. 📦 Installs dependencies
3. 🔨 Builds packages
4. 🗄️ Runs migrations
5. 🌱 Seeds demo data
6. 🧪 Runs both verifiers (health + role coverage)
7. 📊 Reports PASS/FAIL with exit codes

**Success Criteria:**
- Exit code 0 = All tests passed (0 failures)
- Exit code 1 = Tests failed (see output for details)

**Output File:** `instructions/M7.6_VERIFY_OUTPUT.txt`

**See:** [M7.6_FRESH_START_GUIDE.md](./M7.6_FRESH_START_GUIDE.md) for complete setup instructions.

---

## Prerequisites (Manual Verification)

- Node.js 18+ installed
- pnpm installed
- PostgreSQL running
- `.env` files configured for both `services/api` and `apps/web`

---

## Step 1: Start Backend API

```bash
cd services/api

# Build API (if not already built)
pnpm build

# Start API server
node dist/src/main.js

# Verify server started (check output for):
# ✅ "Nest application successfully started on port 3001"
```

**Alternative:** Use `Start-Process` on Windows:
```powershell
cd services/api
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/src/main.js"
```

**Verify server is listening:**
```powershell
netstat -an | Select-String ":3001"
# Should show: TCP 0.0.0.0:3001 ... LISTENING
```

---

## Step 2: Seed Demo Data

```bash
cd services/api

# Run comprehensive seed
pnpm tsx prisma/seed.ts
```

**Expected Output:**
- ✅ Created 2 demo orgs (Tapas, Cafesserie)
- ✅ Seeded users for both orgs (11 users per org)
- ✅ Seeded menu items, inventory, orders, employees
- ✅ "Seed completed successfully!"

**What Gets Seeded:**
- **Tapas:** Single-branch restaurant
  - Users: owner, manager, accountant, procurement, stock, supervisor, cashier, waiter, chef, bartender, eventmgr
  - 178 menu items, 158 inventory items
  - 280+ completed orders, 12 open orders
  - 8 employees
- **Cafesserie:** Multi-branch franchise
  - 4 branches: Village Mall, Acacia Mall, Arena Mall, Mombasa
  - Users: owner, manager, accountant, procurement, supervisor, cashier, waiter, chef
  - 80 menu items per branch, 77 inventory items
  - 280 orders per branch (1120 total), 48 open orders
  - 5 employees

---

## Step 3: Run Role Coverage Verifier

```bash
cd services/api

# Run verifier and output to file
pnpm tsx ../../scripts/verify-role-coverage.ts --out ../../instructions/ROLE_VERIFY_OUTPUT.txt
```

**What It Tests:**
- Logs in as each role (19 total: 11 Tapas + 8 Cafesserie)
- Tests ~10 endpoints per role (~198 tests total)
- Verifies expected 200 responses vs expected 403 RBAC denials

**Expected Results (M7.5 Baseline):**
```
📋 Planned Tests: 198
🔢 Executed Tests: 198
✅ Passed: 196 (99.0%)
❌ Failed: 0
🔒 RBAC Denied (Expected): 2
⚠️  Errors: 0
📊 Reconciliation: 198 = 196 + 0 + 2 + 0 + 0 ✅
```

**Expected RBAC Denials:**
1. `manager@cafesserie` → `/franchise/rankings` (L4 < L5 required)
2. `accountant@cafesserie` → `/franchise/rankings` (L4 < L5 required)

**If Failed > 0:**
1. Read the failure details in output file
2. Check if endpoint exists in backend
3. Verify seed data was created
4. Check RBAC decorator on controller

---

## Step 4: Run Demo Health Check

```bash
cd services/api

# Manual health check via curl
curl "http://localhost:3001/debug/demo-health?from=2025-09-01T00:00:00Z&to=2025-12-31T23:59:59Z"
```

**Expected Response:**
```json
{
  "timestamp": "...",
  "orgId": "...",
  "orgName": "Tapas Bar & Restaurant",
  "branchCount": 1,
  "orders": {
    "total": 292,
    "byStatus": { "CLOSED": 280, "OPEN": 12 },
    "inDateRange": 292
  },
  "orderItems": { "count": 1724 },
  "payments": {
    "count": 280,
    "byMethod": { "CASH": 93, "CARD": 94, "MOBILE_MONEY": 93 }
  },
  "diagnostics": { "warnings": [] }
}
```

**Verify:**
- ✅ `orders.total` > 0
- ✅ `orderItems.count` > 0
- ✅ `payments.count` > 0
- ✅ `diagnostics.warnings` is empty (or explains expected issues)

---

## Step 5: Frontend Navigation Verification (Manual)

### 5.1 Start Frontend

```bash
cd apps/web

# Install deps (if needed)
pnpm install

# Start dev server
pnpm dev
```

Access: `http://localhost:3000`

### 5.2 Test L1 User (Waiter)

**Login:** `waiter@tapas.demo.local` / `Demo#123`

**Verify:**
- ✅ Navigation shows: Dashboard, POS, Settings only
- ❌ No Analytics, Reports, Inventory, Finance, Feedback visible

**Test Direct Access:**
- Navigate to `/finance` → Should show **PermissionDenied** component (not blank page)
- Navigate to `/analytics` → Should show **PermissionDenied** component

### 5.3 Test L3 User (Procurement)

**Login:** `procurement@tapas.demo.local` / `Demo#123`

**Verify:**
- ✅ Navigation shows: Dashboard, POS, Analytics, Reports, Staff, Inventory, Service Providers, Reservations, Settings
- ❌ No Finance or Feedback visible

**Test Direct Access:**
- Navigate to `/finance` → Should show **PermissionDenied**
- Navigate to `/analytics` → Should load successfully

### 5.4 Test L4 User (Manager)

**Login:** `manager@tapas.demo.local` / `Demo#123`

**Verify:**
- ✅ Navigation shows all items
- ✅ Finance page loads
- ✅ Feedback page loads

### 5.5 Test L5 User (Owner - Franchise)

**Login:** `owner@cafesserie.demo.local` / `Demo#123`

**Verify:**
- ✅ Navigation shows all items
- ✅ Analytics page shows "Franchise" tab
- ✅ Franchise tab loads branch rankings (L5 only)

---

## Step 6: Empty State Verification

### 6.1 Test Empty Inventory

1. Login as any L3+ user
2. Navigate to `/inventory`
3. **If items exist:** Use search filter to return no results
4. **Expected:** EmptyState component appears with message (not blank table)

### 6.2 Test Empty POS Orders

1. Login as any user
2. Navigate to `/pos`
3. Filter by status that has no orders
4. **Expected:** EmptyState component (or message) - not blank

### 6.3 Test Empty Finance

1. Login as L4+ user
2. Navigate to `/finance`
3. If budget data missing → Should show helpful message (not crash)

---

## Step 7: Check for Demo Fallbacks (Should be OFF)

**Environment Check:**
```bash
# In apps/web/.env.local
grep NEXT_PUBLIC_ALLOW_DEMO_FALLBACK apps/web/.env.local
```

**Expected:** Either not set or explicitly `false`

**Behavior:**
- API errors should throw (not silently return fake data)
- Empty results should show EmptyState (not demo fallback data)
- Only exception: If explicitly set to `true` for local dev testing

---

## Troubleshooting

### Issue: Verifier Shows Failures

**Symptoms:**
- `failed > 0` in verifier output
- Endpoints return 404, 500, or unexpected errors

**Debug Steps:**
1. Check if API server is running: `netstat -an | Select-String ":3001"`
2. Read failure details in output file
3. Test endpoint manually via curl:
   ```bash
   curl -H "Cookie: auth_token=YOUR_TOKEN" http://localhost:3001/ENDPOINT
   ```
4. Check backend logs for errors
5. Verify seed data exists in database

### Issue: Navigation Items Appear for Wrong Roles

**Symptoms:**
- L1 user sees Finance in nav
- L4 user doesn't see Finance

**Debug Steps:**
1. Check `Sidebar.tsx` - verify `minRole` is set correctly
2. Check user's roleLevel: Login and view `/settings` page
3. Clear browser cache / localStorage
4. Check `canAccessRole` function logic

### Issue: PermissionDenied Not Showing

**Symptoms:**
- Direct URL access shows blank page instead of PermissionDenied

**Debug Steps:**
1. Check if page has `<RequireRole>` wrapper
2. Check if user is authenticated (ProtectedRoute working?)
3. Check browser console for errors
4. Verify `RequireRole.tsx` imports are correct

### Issue: Empty States Not Appearing

**Symptoms:**
- Blank table/chart when no data

**Debug Steps:**
1. Check if EmptyState component is integrated in that page
2. Check conditional: `{data.length === 0 ? <EmptyState /> : <Table />}`
3. Verify API is returning empty array (not undefined/null)
4. Check browser console for rendering errors

---

## Quick Reference: Test Credentials

### Tapas Bar & Restaurant

| Role | Email | Password | Level |
|------|-------|----------|-------|
| Owner | owner@tapas.demo.local | Demo#123 | L5 |
| Manager | manager@tapas.demo.local | Demo#123 | L4 |
| Accountant | accountant@tapas.demo.local | Demo#123 | L4 |
| Procurement | procurement@tapas.demo.local | Demo#123 | L3 |
| Supervisor | supervisor@tapas.demo.local | Demo#123 | L2 |
| Waiter | waiter@tapas.demo.local | Demo#123 | L1 |

### Cafesserie

| Role | Email | Password | Level |
|------|-------|----------|-------|
| Owner | owner@cafesserie.demo.local | Demo#123 | L5 |
| Manager | manager@cafesserie.demo.local | Demo#123 | L4 |
| Accountant | accountant@cafesserie.demo.local | Demo#123 | L4 |
| Procurement | procurement@cafesserie.demo.local | Demo#123 | L3 |
| Waiter | waiter@cafesserie.demo.local | Demo#123 | L1 |

---

## Continuous Integration (Future)

**Suggested CI Pipeline:**
1. Start API in background
2. Run seed script
3. Run `verify-role-coverage.ts`
4. Assert: `failed == 0 && errors == 0`
5. Run demo-health check
6. Assert: `orders.total > 0`

**Exit Codes:**
- `0` = All tests passed
- `1` = Tests failed (block deployment)

---

## Related Files

- [verify-role-coverage.ts](../scripts/verify-role-coverage.ts) - Main verifier script
- [seedComprehensive.ts](../services/api/prisma/demo/seedComprehensive.ts) - Demo data seed
- [Sidebar.tsx](../apps/web/src/components/layout/Sidebar.tsx) - Navigation with RBAC
- [RequireRole.tsx](../apps/web/src/components/RequireRole.tsx) - Route guard
- [M7.5_COMPLETION_SUMMARY.md](./M7.5_COMPLETION_SUMMARY.md) - M7.5 implementation details
- [RBAC_VISIBILITY_MATRIX.md](./RBAC_VISIBILITY_MATRIX.md) - RBAC rules reference
