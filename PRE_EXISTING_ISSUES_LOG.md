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
**Status**: OPEN

**Summary**: RateLimitGuard creates a setInterval for cleanup that is not stopped on module teardown, causing Jest to detect open handles.

**Evidence**:
```
services/api/src/common/rate-limit.guard.ts:36
  this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  
Jest output:
  A worker process has failed to exit gracefully and has been force exited.
  This is likely caused by tests leaking due to improper teardown.
```

**Workaround**: Use `--forceExit` flag with Jest E2E tests.

**Future Fix**: Add `onModuleDestroy()` lifecycle hook to clear the interval.

---

## Previously Logged Issues (Reference)

- PRE-001 through PRE-006: See git history for M8.x milestones
