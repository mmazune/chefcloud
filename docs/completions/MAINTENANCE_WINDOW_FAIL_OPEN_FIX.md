# Maintenance Window Fail-Open Fix - Production Emergency Resolution

## Executive Summary

**Problem:** POST `/auth/login` returns HTTP 500 in production  
**Root Cause:** `maintenanceWindow.findFirst()` query crashes when `maintenance_windows` table doesn't exist  
**Impact:** All user authentication blocked  
**Status:** ✅ **RESOLVED** - Fail-open logic implemented and tested

---

## Problem Analysis

### Production Failure
- **Endpoint:** POST `/auth/login`
- **Status Code:** HTTP 500 Internal Server Error
- **Error:** Prisma query fails with "table maintenance_windows does not exist"
- **Location:** `services/api/src/ops/maintenance.service.ts:13`
- **Impact:** Complete authentication failure for all users

### Root Cause
The authentication flow calls `MaintenanceService.isBlockedWrite()` to check for active maintenance windows. When the `maintenance_windows` table doesn't exist in the database:

1. Prisma throws error code **P2021** (table does not exist)
2. Error propagates unhandled through the auth middleware
3. Login endpoint returns HTTP 500
4. All users locked out

### Why Table Might Be Missing
- Migration not run on production database (`prisma migrate deploy` not executed)
- Database restored from backup before migration was created
- Manual database changes/rollbacks
- Migration drift between environments

---

## Solution Implemented

### 1. Fail-Open Error Handling ✅

**File:** [`services/api/src/ops/maintenance.service.ts`](services/api/src/ops/maintenance.service.ts)

**Changes:**
- Added `isMissingMaintenanceWindowsTable()` helper method
- Wrapped all Prisma queries in try-catch blocks
- Detect missing table via Prisma error code **P2021**
- Fallback detection via error message matching
- Return safe defaults when table missing:
  - `isBlockedWrite()` → `{ blocked: false }`
  - `getActive()` → `[]`
  - `findAll()` → `[]`
- Structured logging (warn level) when fail-open triggers
- Re-throw all other database errors (don't silently swallow)

**Error Detection Logic:**
```typescript
private isMissingMaintenanceWindowsTable(error: any): boolean {
  // Primary: Prisma error code P2021
  if (error?.code === 'P2021') {
    return true;
  }

  // Fallback: message matching
  const errorMessage = error?.message || String(error);
  return (
    errorMessage.includes('maintenance_windows') &&
    (errorMessage.includes('does not exist') || errorMessage.includes("doesn't exist"))
  );
}
```

**Fail-Open Behavior:**
```typescript
async isBlockedWrite(now: Date, orgId?: string): Promise<{ blocked: boolean; message?: string }> {
  try {
    const window = await this.prisma.client.maintenanceWindow.findFirst({...});
    // ... normal logic
  } catch (error) {
    if (this.isMissingMaintenanceWindowsTable(error)) {
      this.logger.warn(
        'maintenance_windows table does not exist - failing open (no maintenance check)',
        { orgId }
      );
      return { blocked: false }; // Safe default: allow writes
    }
    throw error; // Re-throw non-missing-table errors
  }
}
```

### 2. Comprehensive Test Coverage ✅

**File:** [`services/api/src/ops/maintenance.service.spec.ts`](services/api/src/ops/maintenance.service.spec.ts) (NEW)

**Test Suite:** 14 tests, 100% passing

**Coverage:**
- ✅ Normal operation (active window, no window)
- ✅ Fail-open: Prisma error code P2021
- ✅ Fail-open: Error message matching
- ✅ Error handling: Non-missing-table errors thrown
- ✅ Error handling: Connection errors thrown
- ✅ `getActive()` fail-open returns empty array
- ✅ `findAll()` fail-open returns empty array
- ✅ Structured logging verification

**Test Output:**
```
PASS  src/ops/maintenance.service.spec.ts
  MaintenanceService
    isBlockedWrite
      ✓ should return blocked: true when active maintenance window exists
      ✓ should return blocked: false when no active maintenance window exists
      ✓ should use default message when maintenance window has no message
      fail-open behavior
        ✓ should return blocked: false when table does not exist (Prisma error P2021)
        ✓ should return blocked: false when table does not exist (message matching)
        ✓ should throw error for non-missing-table database errors
        ✓ should throw error for connection errors
    getActive
      ✓ should return active maintenance windows
      ✓ should return empty array when table does not exist (fail-open)
      ✓ should throw error for non-missing-table errors
    findAll
      ✓ should return all maintenance windows with createdBy relation
      ✓ should return empty array when table does not exist (fail-open)
      ✓ should throw error for non-missing-table errors
    create
      ✓ should create a new maintenance window

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### 3. Migration Verification ✅

**Migration:** `20251029222740_change_control`  
**Location:** `packages/db/prisma/migrations/20251029222740_change_control/migration.sql`  
**Status:** ✅ Exists and creates `maintenance_windows` table

**Table Schema:**
```sql
CREATE TABLE "maintenance_windows" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "blockWrites" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);
```

---

## Deployment Instructions

### For Render.com Production

#### 1. Update Build Command

**Current (likely):**
```bash
pnpm install && pnpm -C services/api build
```

**Required:**
```bash
pnpm install && pnpm -C packages/db prisma generate && pnpm -C packages/db prisma migrate deploy && pnpm -C services/api build
```

**Breakdown:**
1. `pnpm install` - Install dependencies
2. `pnpm -C packages/db prisma generate` - Generate Prisma Client
3. **`pnpm -C packages/db prisma migrate deploy`** - Run migrations (creates maintenance_windows table)
4. `pnpm -C services/api build` - Build NestJS app

#### 2. Verify Start Command

**Should be:**
```bash
pnpm -C services/api start:prod
```

Or:
```bash
node services/api/dist/src/main
```

#### 3. Environment Variables

Ensure `DATABASE_URL` is set in Render dashboard:
```
postgresql://user:password@host:port/database?sslmode=require
```

#### 4. Deploy Process

**Option A: Re-deploy (triggers build):**
1. Go to Render dashboard
2. Select API service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Monitor logs for migration execution

**Option B: Push code changes:**
1. Commit the fail-open changes:
   ```bash
   git add services/api/src/ops/maintenance.service.ts
   git add services/api/src/ops/maintenance.service.spec.ts
   git commit -m "fix: add fail-open handling for missing maintenance_windows table"
   git push
   ```
2. Render auto-deploys if connected to GitHub
3. Monitor deployment logs

### For Local Development

#### 1. Apply Migration
```bash
cd /workspaces/chefcloud
pnpm -C packages/db prisma migrate deploy
```

#### 2. Verify Table Created
```bash
pnpm -C packages/db prisma studio
# Navigate to maintenance_windows table
```

#### 3. Run Tests
```bash
pnpm -C services/api test maintenance.service.spec.ts
```

#### 4. Start API
```bash
pnpm -C services/api start:dev
```

#### 5. Test Login Endpoint
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected:** Should NOT return HTTP 500 (even if table missing, fail-open returns 401/200)

### Docker Compose (if applicable)

If using `infra/docker/docker-compose.yml`:

1. **Rebuild containers:**
   ```bash
   cd /workspaces/chefcloud/infra/docker
   docker-compose down
   docker-compose up --build
   ```

2. **Run migration inside container:**
   ```bash
   docker-compose exec api sh -c "cd /app && pnpm -C packages/db prisma migrate deploy"
   ```

---

## Monitoring & Verification

### 1. Check Logs for Fail-Open Trigger

If you see this warning in production logs:
```
[MaintenanceService] WARN: maintenance_windows table does not exist - failing open (no maintenance check)
```

**Action Required:**
- Migration not run yet
- Execute `prisma migrate deploy` immediately
- Verify table created with `SELECT * FROM maintenance_windows LIMIT 1;`

### 2. Database Health Check

**SQL Query:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'maintenance_windows'
);
```

**Expected:** `true`  
**If false:** Run `prisma migrate deploy`

### 3. API Health Check

**Request:**
```bash
curl -I https://your-api.onrender.com/health
```

**Expected:** HTTP 200  
**If 500:** Check logs for database connection issues

### 4. Login Smoke Test

**Request:**
```bash
curl -X POST https://your-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"invalid"}'
```

**Expected:** HTTP 401 (invalid credentials) or HTTP 200 (valid credentials)  
**Not Expected:** HTTP 500 (would indicate fail-open not working)

---

## Files Modified

### 1. `services/api/src/ops/maintenance.service.ts`
**Changes:**
- ➕ Import `Logger` from `@nestjs/common`
- ➕ Import `Prisma` from `@prisma/client`
- ➕ Added `private readonly logger` instance
- ➕ Added `isMissingMaintenanceWindowsTable()` helper
- 🔧 Modified `isBlockedWrite()` with try-catch and fail-open
- 🔧 Modified `getActive()` with try-catch and fail-open
- 🔧 Modified `findAll()` with try-catch and fail-open

**Lines Changed:** ~60 lines (refactored 3 methods, added 1 helper)

### 2. `services/api/src/ops/maintenance.service.spec.ts` (NEW)
**Changes:**
- ➕ Created comprehensive test suite
- ✅ 14 tests covering all scenarios
- ✅ Fail-open behavior validated
- ✅ Error handling verified
- ✅ Logging assertions included

**Lines Added:** ~350 lines

---

## Technical Details

### Prisma Error Codes
- **P2021:** "The table `{table}` does not exist in the current database."
- **P2002:** Unique constraint failed
- **P2025:** Record not found
- Reference: https://www.prisma.io/docs/reference/api-reference/error-reference

### Error Detection Strategy
1. **Primary:** Check error code === 'P2021' (fastest, most reliable)
2. **Fallback:** Pattern match error message (handles raw SQL errors)
3. **Conditions:**
   - Message contains "maintenance_windows" AND
   - Message contains "does not exist" or "doesn't exist"

### Logging Format
```typescript
this.logger.warn(
  'maintenance_windows table does not exist - failing open (no maintenance check)',
  { orgId: 'org-123' }  // Structured metadata
);
```

**Output:**
```
[MaintenanceService] WARN: maintenance_windows table does not exist - failing open (no maintenance check) {"orgId":"org-123"}
```

### Fail-Open vs Fail-Closed
- **Fail-Open:** When feature infrastructure missing, allow operation (chosen approach)
- **Fail-Closed:** When feature infrastructure missing, block operation

**Rationale for Fail-Open:**
- Maintenance windows are a **protective feature**, not core business logic
- Blocking all logins due to missing table is worse than allowing logins
- Missing table = "no maintenance configured" is semantically correct
- Fail-open prevents cascading failures
- Structured logging provides visibility

---

## Rollback Plan

If fail-open logic causes issues:

### 1. Revert Code Changes
```bash
git revert <commit-sha>
git push
```

### 2. Emergency: Disable Maintenance Check
Edit `services/api/src/ops/maintenance.service.ts`:
```typescript
async isBlockedWrite(now: Date, orgId?: string): Promise<{ blocked: boolean; message?: string }> {
  return { blocked: false }; // Emergency bypass
}
```

### 3. Re-enable After Migration
```bash
pnpm -C packages/db prisma migrate deploy
# Then revert emergency bypass
```

---

## Future Improvements

### 1. Add Migration Check on Startup
```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Check if critical tables exist
  const prisma = app.get(PrismaService);
  try {
    await prisma.client.maintenanceWindow.findFirst();
  } catch (error) {
    logger.warn('maintenance_windows table missing - migrations may not be up to date');
  }
  
  await app.listen(3000);
}
```

### 2. Add Healthcheck for Migrations
```typescript
// src/health/health.controller.ts
@Get('/health/migrations')
async checkMigrations() {
  const tablesExist = await this.healthService.checkRequiredTables();
  return {
    status: tablesExist ? 'ok' : 'degraded',
    tables: {
      maintenance_windows: tablesExist.maintenanceWindows,
    },
  };
}
```

### 3. CI/CD Migration Verification
```yaml
# .github/workflows/deploy.yml
- name: Verify Migrations
  run: |
    pnpm -C packages/db prisma migrate status
    pnpm -C packages/db prisma migrate deploy --dry-run
```

---

## Summary

### ✅ Problem Resolved
- Login endpoint no longer crashes when table missing
- Fail-open returns safe default: no maintenance = allow writes
- Structured logging provides visibility
- Comprehensive test coverage (14 tests)

### ✅ Production Ready
- Migration exists: `20251029222740_change_control`
- Fail-open logic tested and validated
- Deployment commands documented
- Monitoring guidance provided

### 🚀 Next Steps
1. Deploy code changes to production
2. Verify migration runs during build: `prisma migrate deploy`
3. Monitor logs for fail-open warnings (should disappear after migration)
4. Validate login endpoint returns non-500 status codes
5. (Optional) Test maintenance window creation via API

### 📞 Support
If issues persist after deployment:
1. Check Render logs for migration execution
2. Verify `DATABASE_URL` environment variable
3. Run `SELECT * FROM maintenance_windows LIMIT 1;` in database console
4. Check fail-open logging output
5. Escalate with logs and error details

---

**Document Version:** 1.0  
**Last Updated:** {{ current_date }}  
**Status:** ✅ Resolution Complete - Ready for Production Deployment
