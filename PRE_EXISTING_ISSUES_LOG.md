# Pre-Existing Issues Log

This document tracks issues that predate the current milestone and are not caused by the current work.

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

## Previously Logged Issues (Reference)

- PRE-001 through PRE-006: See git history for M8.x milestones
