# Pre-Existing Issues Log

This document tracks issues that predate the current milestone and are not caused by the current work.

---

## PRE-009: no-case-declarations in payroll-calculation.service.ts (FIXED)

**Category**: lint-error  
**First Observed**: M10.9 Baseline (2026-01-04)  
**Impact**: HIGH - Blocks lint pass  
**Status**: FIXED (M10.9)

**Summary**: Line 280 had `const hourlyRate` in case block without braces.

**Evidence**:
```
services/api/src/workforce/payroll-calculation.service.ts
  280:9  error  Unexpected lexical declaration in case block  no-case-declarations
```

**Fix Applied**: Added braces around PER_HOUR case block.

---

## PRE-007: API Lint Warnings (123 total)

**Category**: lint-warning  
**First Observed**: M9.2 Finalization (2026-01-03)  
**Impact**: LOW - Warnings only, no errors  
**Status**: OPEN

**Summary**: 123 ESLint warnings across API codebase, primarily unused imports and variables in test files.

**Evidence**:
```
C:\Users\arman\Desktop\nimbusPOS\nimbuspos\services\api\test\e2e\transfer.invalidation.slice.e2e-spec.ts
  3:10  warning  'Test' is defined but never used
  5:34  warning  'createE2ETestingModuleBuilder' is defined but never used

C:\Users\arman\Desktop\nimbusPOS\nimbuspos\services\api\test\m1-kds-enterprise.e2e-spec.ts
  24:7  warning  'beerMenuItemId' is assigned a value but never used
  26:7  warning  'orgId' is assigned a value but never used

✖ 123 problems (0 errors, 123 warnings)
```

**Root Cause**: Test scaffolding with placeholder imports/variables not yet utilized.

---

## PRE-008: Web Lint Warnings (dashboard.tsx, login.tsx)

**Category**: lint-warning  
**First Observed**: M9.2 Finalization (2026-01-03)  
**Impact**: LOW - Warnings only  
**Status**: OPEN

**Summary**: Unused imports in dashboard.tsx and login.tsx.

**Evidence**:
```
./src/pages/dashboard.tsx
  15:10  Warning: 'useQuery' is defined but never used
  18:10  Warning: 'Card' is defined but never used
  74:7   Warning: 'CAFESSERIE_ORG_ID' is assigned a value but never used

./src/pages/login.tsx
  15:11  Warning: 'autofillTapas' is assigned a value but never used
  15:26  Warning: 'autofillCafesserie' is assigned a value but never used
```

**Root Cause**: Dashboard component refactoring left dead code. Login debug helpers not removed.

---

## PRE-010: M10.13 UI Test Missing displayName (FIXED)

**Category**: lint-error  
**First Observed**: M10.14 Baseline (2026-01-04)  
**Impact**: HIGH - Blocks web build  
**Status**: FIXED (M10.14 baseline fix)

**Summary**: Component definition in m1013-auto-scheduler.test.tsx missing displayName.

**Evidence**:
```
./src/__tests__/pages/workforce/m1013-auto-scheduler.test.tsx
45:10  Error: Component definition is missing display name  react/display-name
```

**Fix Applied**: Added named `Wrapper` component with `.displayName` property in createWrapper().

---

## PRE-011: RateLimitGuard setInterval Open Handle

**Category**: test-infrastructure  
**First Observed**: M10.14 Finalization (2025-01-04)  
**Impact**: LOW - Requires --forceExit flag for E2E tests  
**Status**: RESOLVED (M10.15)

**Summary**: RateLimitGuard creates a setInterval for cleanup that is not stopped on module teardown, causing Jest to detect open handles.

**Evidence (Before Fix)**:
```
services/api/src/common/rate-limit.guard.ts:36
  this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  
Jest output:
  Jest has detected the following 2 open handles potentially keeping Jest from exiting:
    ●  Timeout
      35 |     // Cleanup expired entries every 5 minutes
    > 36 |     this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
```

**Fix Applied (M10.15)**: Replaced background setInterval with on-demand (opportunistic) cleanup.
- Removed the timer entirely
- Added `maybeCleanup()` that runs during each request
- Cleanup triggers when store exceeds 100 entries OR 5 minutes have passed
- No background timers = no open handles

**Evidence (After Fix)**:
```
# Test completes and exits cleanly without --forceExit
npx jest --detectOpenHandles --testPathPatterns="workforce-m1014"
...
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        61.172 s
# No "open handles" warning - process exits normally
```

**Commit**: M10.15 (pending)

---

## PRE-012: transfer.invalidation.slice.e2e-spec.ts - CacheInvalidationService dependency missing

**Category**: test-failure  
**First Observed**: M11.8 Post-fix Gate (2026-01-06)  
**Impact**: MEDIUM - 5 slice tests fail, blocks strict gate 100%  
**Status**: OPEN

**Summary**: TransferEventsTestModule fails to compile because CacheInvalidationService is not provided in the test module context.

**Command Run**:
```bash
timeout 30m pnpm -C services/api test:e2e -- --runInBand --detectOpenHandles --testPathPatterns="slice"
```

**Error Snippet** (first 15 lines):
```
FAIL  test/e2e/transfer.invalidation.slice.e2e-spec.ts (5.564 s)
  ● Transfer Invalidation (Slice E2E) — E22.D › POST /transfer-test/event -> 401 without token
    Nest can't resolve dependencies of the TransferEventsTestController (?). 
    Please make sure that the argument CacheInvalidationService at index [0] 
    is available in the TransferEventsTestModule context.
    
    Potential solutions:
    - If CacheInvalidationService is a provider, is it part of the current TransferEventsTestModule?
    - If CacheInvalidationService is exported from a separate @Module, is that module imported?
      @Module({
        imports: [ /* the Module containing CacheInvalidationService */ ]
      })
```

**Tests Affected** (all 5 in suite):
1. POST /transfer-test/event -> 401 without token
2. POST /transfer-test/event -> 200 {ok:false} on invalid payload
3. HIT → transfer.changed → MISS (forecast cache proves invalidation)
4. Idempotency: repeating same event still returns ok:true
5. Deterministic rate limit: >= one 429 on /forecast-test/sales

**Why Pre-Existing**: This test file uses E22.D feature (cache invalidation) infrastructure that predates M11.8. M11.8 only modified inventory-vendor-returns, inventory-recalls, and inventory-expiry controllers - no changes to transfer events or cache invalidation modules.

**Suggested Next Action**:
- Import CacheInvalidationModule into TransferEventsTestModule
- Or mock CacheInvalidationService in test setup

---

## PRE-013: devportal.prod.slice.e2e-spec.ts - Missing dev-portal/ports module

**Category**: test-failure  
**First Observed**: M11.8 Post-fix Gate (2026-01-06)  
**Impact**: LOW - 1 test suite fails to run, blocks strict gate  
**Status**: OPEN

**Summary**: Test file imports from `../../src/dev-portal/ports/devportal.port` but this module does not exist (dev-portal was moved to dev-portal.disabled).

**Command Run**:
```bash
timeout 30m pnpm -C services/api test:e2e -- --runInBand --detectOpenHandles --testPathPatterns="slice"
```

**Error Snippet**:
```
FAIL  test/e2e/devportal.prod.slice.e2e-spec.ts
  ● Test suite failed to run

    Cannot find module '../../src/dev-portal/ports/devportal.port' from 'e2e/devportal.prod.slice.e2e-spec.ts'

      15 | import { SuperDevGuard } from '../../src/dev-portal.disabled/guards/super-dev.guard';
      16 | import { signBody } from '../payments/webhook.hmac';
    > 17 | import { DevPortalKeyRepo } from '../../src/dev-portal/ports/devportal.port';
         | ^
```

**Why Pre-Existing**: The dev-portal module was disabled/moved prior to M11.8. This test file has stale imports that reference the old path. M11.8 did not touch any dev-portal files.

**Suggested Next Action**:
- Update import to use `dev-portal.disabled` path
- Or skip/disable this test file until dev-portal feature is re-enabled

---

## PRE-014: Web Lint Error - no-var-requires in m115-inventory-costing-pages.test.tsx

**Discovered**: M12.3 Baseline (2026-01-07)  
**Severity**: Error (exits with code 1)  
**Impact**: Web lint gate fails due to pre-existing test file using require() instead of import

**Command**:
```bash
pnpm --filter web lint
```

**Output**:
```
./src/__tests__/pages/inventory/m115-inventory-costing-pages.test.tsx
  251:16  Error: Require statement not part of import statement.  
@typescript-eslint/no-var-requires
```

**Why Pre-Existing**: This error was already present before M12.3. The file `m115-inventory-costing-pages.test.tsx` was created as part of M11.5 (inventory costing) and uses CommonJS `require()` syntax at line 251 which violates the ESLint `no-var-requires` rule. M12.3 does not touch this test file.

**Fix**: Convert `require()` to ES6 `import` syntax in the test file.

---

## PRE-015: E2E Test Failure - M12.1 Tests Use Removed `type` Field

**Discovered**: M12.3 Verification (2026-01-07)  
**Severity**: Error (E2E tests fail)  
**Impact**: M12.1 E2E tests fail due to test file referencing removed InventoryLocation.type field

**Command**:
```bash
pnpm --filter api test:e2e -- --testPathPattern="inventory-m121-period-close"
```

**Output**:
```
PrismaClientValidationError:
Invalid `prisma.inventoryLocation.create()` invocation:
{
  data: {
    org: { connect: { id: '...' } },
    branch: { connect: { id: '...' } },
    name: 'Freezer',
    type: 'STORAGE',
          ~~~~
    isActive: true
  }
}

Unknown argument `type`. Available options are marked with ?.
```

**Why Pre-Existing**: The InventoryLocation model previously had a `type` field that was removed in an earlier schema migration (likely M11.x or M12.0). The E2E test file `inventory-m121-period-close.e2e-spec.ts` still references this removed field when creating test fixtures. M12.3 does not modify the InventoryLocation model or this test file.

**Fix**: Update the E2E test file to remove references to `type` field in InventoryLocation creation.

---

## PRE-013: Sonner module missing in web build

**Category**: build-error  
**First Observed**: M12.9 Baseline (2026-01-08)  
**Impact**: HIGH - Blocks web build  
**Status**: FIXED (M12.9)

**Command**:
```
pnpm -C apps/web build
```

**Output**:
```
./src/pages/inventory/accounting-mappings.tsx:26:23
Type error: Cannot find module 'sonner' or its corresponding type declarations.

  24 | import { Alert, AlertDescription } from '@/components/ui/alert';
  25 | import { apiClient } from '@/lib/api';
> 26 | import { toast } from 'sonner';
     |                       ^
```

**Why Pre-Existing**: The `sonner` toast library was added as an import in `accounting-mappings.tsx` prior to M12.9 but the package was never added to `apps/web/package.json` dependencies. This is pre-existing as M12.9 does not modify this file or any web dependencies.

**Fix Applied**: Added `sonner` to apps/web dependencies via `pnpm -C apps/web add sonner`.

---

## PRE-014: M12.2 Test Expects Missing `checklist` Field

**Category**: test-api-mismatch  
**First Observed**: M12.9 Release Gate (2026-01-08)  
**Impact**: MEDIUM - Test failures in release gate  
**Status**: FIXED (M12.10)

**Summary**: The M12.2 E2E test expected incorrect field names from API responses:
- `checklist` instead of `blockers`
- `created`/`existing` instead of `createdCount`/`existingCount`
- `stocktake` model instead of `stocktakeSession`
- `notes` instead of `lockReason` in request body
- `response.body.events` instead of array directly
- `response.body.exports` as array instead of object

**Fix Applied (M12.10)**:
1. Changed test assertions to use correct API field names
2. Fixed stocktakeSession.create to include required `sessionNumber` field
3. Added CREATED event logging to inventory periods service
4. Updated events endpoint assertions (API returns array directly)
5. Updated valuation endpoint assertions (API returns array directly)

**Evidence**: All 19 tests in inventory-m122-close-ops-v2.e2e-spec.ts now pass.

---

## PRE-015: M10.17 Workforce Leave Tests - Route 404s

**Category**: test-api-mismatch  
**First Observed**: M12.9 Release Gate (2026-01-08)  
**Impact**: MEDIUM - Test failures in release gate  
**Status**: PARTIALLY FIXED (M12.10) - Route path fixed, service bugs remain

**Summary**: M10.17 workforce leave tests expected routes at `/workforce/leave/*` but controllers used `/api/v1/workforce/leave/*`.

**Fix Applied (M12.10)**: Changed controller route decorators:
- `leave.controller.ts`: `api/v1/workforce/leave` → `workforce/leave`
- `leave-enterprise.controller.ts`: Same fix for LeaveCalendarController and LeaveDelegationController

**Remaining Issues**: After route fix, deeper service bugs were exposed:
- Missing `orgId` in Prisma queries (`leaveTypeDefinition.findUnique`)
- Missing endpoint implementations (`/balance`, `/balance/adjust`, `/requests/pending`, etc.)
- These require service-level code changes beyond PRE scope

**Evidence**:
- Routes now reach controllers (no more 404 from path mismatch)
- 4 tests pass (was 1), 26 still fail due to service bugs
  > 525 |         .expect(HttpStatus.OK);
  
  Routes failing:
  - POST /workforce/leave/run-monthly-accrual
  - POST /workforce/leave/types (create)
```

**Why Pre-Existing**: Tests were written for API endpoints that were planned but never implemented. M12.9 does not modify workforce leave routes.

**Impact**: 29 test failures in workforce-m1017-leave.e2e-spec.ts

---

## PRE-016: M9.4 Reservations Test Infrastructure Issue

**Category**: test-infrastructure  
**First Observed**: M12.9 Release Gate (2026-01-08)  
**Impact**: MEDIUM - Test failures due to mock infrastructure  
**Status**: OPEN (requires test rewrite)

**Summary**: The M9.4 public booking test uses `PrismaTestModule` (mocked Prisma) instead of the real database + AppModule pattern used by passing tests. This causes:
1. `Cannot read properties of undefined (reading 'branch')` - Mock doesn't return real data
2. Rate limiting 429 responses due to test isolation issues
3. 500 errors when expecting 200/404

**Evidence**:
```typescript
// Current (broken) - uses mocked Prisma:
imports: [
  ReservationsModule,
  PrismaTestModule, // <-- Mock module
]
.overrideProvider(PrismaService).useClass(TestPrismaService)

// Working pattern (other E2E tests):
import { createE2EApp } from '../helpers/e2e-bootstrap';
app = await createE2EApp({ imports: [AppModule] }); // <-- Real DB
```

**Root Cause**: Test was written with isolated module approach that doesn't connect to real database or seed proper test data.

**Required Fix**: Rewrite test to use `createE2EApp({ imports: [AppModule] })` + `loginAs` + factory pattern like inventory-m122 tests. This is substantial work (400+ line test file).

**Impact**: 8 test failures in reservations-m94-public-booking.e2e-spec.ts

---

## PRE-017: Inventory Periods Controller Using Wrong Role Field

**Category**: code-bug  
**First Observed**: M12.9 Release Gate (2026-01-08)  
**Impact**: HIGH - Blocker resolve endpoint returns 403 incorrectly  
**Status**: FIXED (M12.9)

**Summary**: The `resolveBlocker` endpoint in inventory-periods.controller.ts was using `req.user.role` (undefined) instead of `req.user.roleLevel`.

**Evidence**:
```typescript
// Before (broken):
const roleLevel = this.getRoleLevelFromUserRole(req.user.role);

// After (fixed):
const roleLevel = req.user.roleLevel as 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
```

**Why Categorized as Pre-Existing**: This bug existed before M12.9 work began. The endpoint was created during M12.7 with incorrect role field usage.

**Fix Applied**: Changed to use `req.user.roleLevel` directly.

---

## PRE-018: M13.4 CashSession.create Missing branchId

**Category**: test-api-mismatch  
**First Observed**: M13.5.1 Stabilization (2026-01-09)  
**Impact**: MEDIUM - M13.4 E2E tests fail (23 of 27)  
**Status**: OPEN

**Summary**: The `PosCashSessionsService.openSession()` method creates a CashSession without including the required `branchId` field. The schema requires `branchId String` but the service only provides `orgId`.

**Evidence**:
```
PrismaClientValidationError:
Invalid `this.prisma.client.cashSession.create()` invocation in
pos-cash-sessions.service.ts:77:58

→ 77 const session = await this.prisma.client.cashSession.create({
       data: {
         orgId: "...",
         openedById: "...",
         openingFloatCents: 5000,
         status: "OPEN",
     +   branchId: String  // <-- MISSING
       }
     })

Argument `branchId` is missing.
```

**Why Pre-Existing**: This is a M13.4 service implementation bug. The JWT token contains `branchId` but the service doesn't extract/use it. M13.5.1 only fixes cleanup patterns and KDS qty.

**Required Fix**: Add `branchId: req.user.branchId` to the `cashSession.create()` call in `pos-cash-sessions.service.ts`.

**Impact**: 23 M13.4 E2E tests fail.

---

## PRE-019: M13.5 Payment Status Not Updating

**Category**: test-api-mismatch  
**First Observed**: M13.5.1 Stabilization (2026-01-09)  
**Impact**: MEDIUM - M13.5 E2E tests fail (10 of 18)  
**Status**: OPEN

**Summary**: The M13.5 payment flow creates payments but doesn't update the Order.paymentStatus field. Tests expect:
- `paymentStatus: 'PAID'` after full payment
- `paymentStatus: 'PARTIALLY_PAID'` after partial payment
- `paymentStatus: 'REFUNDED'` after refund

But the API returns `paymentStatus: 'UNPAID'` in all cases.

**Evidence**:
```
expect(received).toBe(expected) // Object.is equality
Expected: "PAID"
Received: "UNPAID"

  656 |       expect(orderAfter?.paymentStatus).toBe('PAID');
```

**Why Pre-Existing**: The payment service logic to update `Order.paymentStatus` based on payment totals vs order total was either not implemented or is broken. M13.5.1 only fixes cleanup patterns and KDS qty.

**Required Fix**: 
1. After each payment, recalculate `paidCents` from all CAPTURED payments
2. Compare to `orderTotalCents`
3. Update `Order.paymentStatus` accordingly

**Impact**: 10 M13.5 E2E tests fail.

---

## PRE-020: KDS Gateway Station Validation Error (Pre-existing)

**Category**: runtime-error  
**First Observed**: M13.5.1 Stabilization (2026-01-09)  
**Impact**: LOW - Non-blocking, but logs errors during tests  
**Status**: OPEN

**Summary**: KDS Gateway broadcasts use `station: "ALL"` which is not a valid `StationTag` enum value.

**Evidence**:
```
PrismaClientValidationError:
Invalid `this.prisma.client.kdsTicket.findMany()` invocation in
kds.service.ts:37:56

→ 37 const tickets = await this.prisma.client.kdsTicket.findMany({
       where: {
         station: "ALL",
                  ~~~~~

Invalid value for argument `station`. Expected StationTag.
```

**Why Pre-Existing**: The KDS service uses "ALL" as a station value but `StationTag` enum only contains specific station names (GRILL, PREP, etc.). This is a schema/code mismatch that predates M13.5.1.

**Required Fix**: Either add "ALL" to the StationTag enum, or change the query logic to not filter by station when fetching all tickets.

---

## Previously Logged Issues (Reference)

- PRE-001 through PRE-006: See git history for M8.x milestones

---

## PRE-021: E2E Gate Schema Drift - Outdated Test Files

**Category**: test-infrastructure  
**First Observed**: M13.5.5 (2026-01-09)  
**Impact**: MEDIUM - ~25 gate tests fail due to schema drift  
**Status**: OPEN

**Summary**: Multiple E2E test files reference outdated Prisma schema names and field conventions:

1. `prisma.organization` → should be `prisma.org`
2. `organizationId` → should be `orgId`
3. `role: 'L5'` → should be `roleLevel: 'L5'` (both in Prisma queries AND JWT tokens)
4. User model missing required fields: `firstName`, `lastName`
5. `SubscriptionPlan` uses `priceUGX` not `priceUsd`, requires `features` field
6. `Subscription` model is `OrgSubscription` with `planId` not `planCode`
7. `Branch` uses `status` enum, not `isActive` boolean

**Affected Files**:
```
test/a3-pos.e2e-spec.ts
test/auth.e2e-spec.ts
test/b2-apikey.e2e-spec.ts
test/e23-platform-access.e2e-spec.ts
test/e23-roles-access.e2e-spec.ts
test/e24-subscriptions.e2e-spec.ts
test/e26-kpis.e2e-spec.ts
test/e2e/app-bisect.e2e-spec.ts
test/e2e/billing.e2e-spec.ts
test/e2e/bookings.e2e-spec.ts
test/e2e/franchise-budgets-cache.e2e-spec.ts
test/e2e/franchise-cache-invalidation.e2e-spec.ts
test/e2e/franchise-rankings-cache.e2e-spec.ts
test/e2e/inventory.e2e-spec.ts
test/e2e/pos.e2e-spec.ts
test/e2e/pos-isolation.e2e-spec.ts
test/e2e/reports.e2e-spec.ts
test/e2e/workforce.e2e-spec.ts
test/e37-promotions.e2e-spec.ts
test/msr-card.e2e-spec.ts
test/plan-rate-limit.e2e-spec.ts
test/smoke/minimal-boot.e2e-spec.ts
test/sse-security.e2e-spec.ts
test/webhook-security.e2e-spec.ts
```

**Passing E2E Tests**:
- `test:e2e:strict`: 41/41 PASS (workforce-m103, workforce-m104)
- `test/billing-simple.e2e-spec.ts`: 11/11 PASS (fixed in M13.5.5)

**Fixes Applied in M13.5.5**:
- Fixed `billing-simple.e2e-spec.ts` completely (schema, roleLevel, demo protection)
- Partial fixes to `billing.e2e-spec.ts`, `franchise-*-cache.e2e-spec.ts`, `plan-rate-limit.e2e-spec.ts`
- Removed `devportal.prod.slice.e2e-spec.ts` from test list (disabled feature)

**Required Fix**: Each affected file needs comprehensive schema migration:
1. Replace all organization → org
2. Replace all organizationId → orgId
3. Replace role → roleLevel in Prisma and JWT
4. Add firstName/lastName to user creates
5. Fix SubscriptionPlan fields
6. Update Branch fields

**Why Pre-Existing**: These tests were written against an older schema version and never updated when the schema evolved.
