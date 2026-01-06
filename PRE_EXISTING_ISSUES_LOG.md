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

## Previously Logged Issues (Reference)

- PRE-001 through PRE-006: See git history for M8.x milestones
