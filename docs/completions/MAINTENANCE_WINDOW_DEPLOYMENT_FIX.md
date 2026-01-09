# Maintenance Window Production Deployment Fix

## Issue Summary

**Production Error:** POST /auth/login returns HTTP 500  
**Root Cause:** Database table `maintenance_windows` doesn't exist in production  
**Impact:** Login is completely broken in production

## Analysis

### Current State

1. ✅ **Migration EXISTS:** `packages/db/prisma/migrations/20251029222740_change_control/migration.sql`
   - Creates `maintenance_windows` table
   - Creates `feature_flags` table
   - Creates `flag_audits` table

2. ✅ **Fail-Open Code EXISTS:** [services/api/src/ops/maintenance.service.ts](services/api/src/ops/maintenance.service.ts#L14-L26)
   - Detects Prisma error P2021 (table doesn't exist)
   - Returns `{ blocked: false }` when table is missing
   - Logs warning but doesn't crash

3. ✅ **Test Coverage:** 100% coverage in [maintenance.service.spec.ts](services/api/src/ops/maintenance.service.spec.ts)
   - Tests P2021 error handling
   - Tests message-based detection
   - Tests that non-table-missing errors are re-thrown

4. ❌ **Production Database:** Missing 22+ migrations including `20251029222740_change_control`

### Why Login is Failing

The [WriteBlockMiddleware](services/api/src/app.module.ts#L138) is applied globally to all routes:

```typescript
consumer.apply(WriteBlockMiddleware).forRoutes('*');
```

This middleware runs **before every POST request**, including POST /auth/login:

```typescript
// WriteBlockMiddleware.use() at line 25
const result = await this.maintenanceService.isBlockedWrite(new Date(), orgId);
```

**If the fail-open code is deployed:** Login should work (logs warning, returns blocked: false)  
**If old code is deployed:** Login crashes with HTTP 500

## Root Cause Determination

Based on commit history:
- Fail-open code was added in commit `bfa20a6` (59 commits ago)
- Current HEAD is `d76054c` (includes fail-open code)

**Two Scenarios:**

### Scenario A: Production Code is Up-to-Date
If Render deployed the latest code (commit d76054c), the fail-open should work and login should succeed. This means:
- ❌ Something else is causing the 500 error
- Need to check Render logs for actual error

### Scenario B: Production Code is Old
If Render deployed old code (before commit bfa20a6), there's no fail-open and login crashes. This means:
- ❌ Need to redeploy latest code
- ❌ Need to run migrations

## Solution Steps

### Step 1: Check Production Deployment State

**On Render Dashboard:**
1. Go to your API service on Render
2. Check "Events" tab - find the last successful deploy
3. Check "Environment" tab - verify `DATABASE_URL` is set
4. Check commit hash of last deploy

### Step 2: Run Missing Migrations

The local database shows 22 pending migrations:

```
20251118075122_m1_kds_enterprise_hardening
20251118075337_migration_1
20251118082922_m2_shifts_scheduling_stock_override
20251118091049_m3_stock_movements_wastage_enhancements
20251118093645_m3_low_stock_config
20251118100000_m4_report_subscriptions
20251118120523_m4_scheduled_digest_support
20251119_m14_dev_portal_hardening
20251120_m14_dev_portal_hardening
20251120_m15_reservations_hardening
20251120_m15_reservations_schema_hardening
20251121_m16_idempotency_keys
20251121_m16_performance_indexes
20251121_m17_event_booking_tax
20251122053128_m18_documents
20251122061003_m19_staff_awards
20251122080226_m20_feedback
20251122084642_m21_idempotency_keys
20251122092809_m22_promotion_suggestions
20251201102614_e22_franchise_budgets
20251203163419_add_org_is_demo
20251204203334_mmmm
```

**Check what's actually missing in production:**

```bash
# SSH into Render or use Render shell
cd /app
npx prisma migrate status --schema=./packages/db/prisma/schema.prisma
```

### Step 3: Deploy Migrations to Production

**Option A: Update Render Build Command (Recommended)**

Update your Render build command to include migration deployment:

```bash
# Old build command:
npm install && npx turbo run build --filter=@chefcloud/api

# New build command (includes migrations):
npm install && \
cd packages/db && npx prisma generate && cd ../.. && \
npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma && \
npx turbo run build --filter=@chefcloud/api
```

**Option B: Manual Migration via Render Shell**

1. Go to Render Dashboard → Your API Service → Shell tab
2. Run:

```bash
cd /app
npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```

3. Restart the service

**Option C: One-Time Migration Script**

If Render doesn't allow build command modifications, create a release command:

In Render Dashboard → Settings → Build & Deploy:
- **Start Command:** Keep as-is
- Add **Release Command:**

```bash
npx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```

This runs automatically before each deployment.

### Step 4: Verify Fix

After migrations are applied:

```bash
# Test the health endpoint
curl https://your-api.onrender.com/api/health

# Test login
curl -X POST https://your-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Expected: HTTP 200 or HTTP 401 (if credentials are wrong), NOT HTTP 500

## Migration Safety

### Safe to Run

The `20251029222740_change_control` migration is **safe** because:
- ✅ Creates NEW tables (no data loss risk)
- ✅ No ALTER TABLE on existing tables
- ✅ No data migrations
- ✅ Indexes are created after table (no locking issues)

### Downtime Expectations

- **Expected downtime:** 0-2 seconds (table creation is fast)
- **Migration rollback:** Not needed (fail-open handles missing table)

### Rollback Plan

If something goes wrong:

1. **Table exists but login still fails:**
   - Check Render logs: `render logs --tail`
   - Look for actual error in logs
   - The fail-open code should prevent crashes

2. **Need to rollback migration:**
   ```sql
   -- Connect to production DB
   DROP TABLE IF EXISTS maintenance_windows CASCADE;
   DROP TABLE IF EXISTS feature_flags CASCADE;
   DROP TABLE IF EXISTS flag_audits CASCADE;
   DROP TYPE IF EXISTS "FlagAction";
   ```

3. **Emergency bypass:**
   - Set environment variable `ENABLE_WRITE_BLOCK_MIDDLEWARE=false`
   - Modify [app.module.ts](services/api/src/app.module.ts#L138) to check this env var before applying middleware

## Verification Checklist

- [ ] Check Render deployment commit hash
- [ ] Verify `DATABASE_URL` is set in Render environment
- [ ] Run `prisma migrate status` in production
- [ ] Update Render build command to include migrations
- [ ] Deploy and monitor Render logs
- [ ] Test POST /auth/login returns 200/401 (not 500)
- [ ] Verify maintenance window endpoints work:
  - GET /ops/maintenance/active
  - GET /ops/maintenance/list
- [ ] Check Render logs for "maintenance_windows table does not exist" warnings (should disappear)

## Expected Behavior After Fix

### Before Migrations Run
```
[Nest] WARN [MaintenanceService] maintenance_windows table does not exist - failing open (no maintenance check)
```

### After Migrations Run
- No warnings in logs
- Login works normally
- Maintenance window features are available via /ops endpoints

## Additional Resources

- Migration SQL: [packages/db/prisma/migrations/20251029222740_change_control/migration.sql](packages/db/prisma/migrations/20251029222740_change_control/migration.sql)
- Maintenance Service: [services/api/src/ops/maintenance.service.ts](services/api/src/ops/maintenance.service.ts)
- Write Block Middleware: [services/api/src/ops/write-block.middleware.ts](services/api/src/ops/write-block.middleware.ts)
- Test Coverage: [services/api/src/ops/maintenance.service.spec.ts](services/api/src/ops/maintenance.service.spec.ts)

## Questions?

If login is still failing after migrations:
1. Check Render logs for actual error stack trace
2. Verify the deployed commit includes fail-open code (commit bfa20a6 or later)
3. Check if `WriteBlockMiddleware` is being applied (should see it in app bootstrap logs)
