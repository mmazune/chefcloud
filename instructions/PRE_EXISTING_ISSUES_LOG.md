# Pre-Existing Issues Log

This is an **append-only** log of pre-existing issues discovered during milestone execution.  
These issues were NOT introduced by the current work and are NOT blockers for the milestone.

---

## Log Format

| Field | Description |
|-------|-------------|
| ID | Sequential identifier (PRE-001, PRE-002...) |
| Category | lint-warning, lint-error, test-warning, security, infra, seed, typescript |
| First Seen | Date first observed |
| Command | Command used to detect (with timeout) |
| Excerpt | ≤15 lines of representative output |
| Impact | Low / Medium / High |
| Suggested Owner | Team/milestone bucket for resolution |
| Status | OPEN / RESOLVED |
| Resolution | Notes if/when resolved |

---

## Issues

### PRE-001: ESLint Warnings – API Service (120 warnings)

| Field | Value |
|-------|-------|
| **ID** | PRE-001 |
| **Category** | lint-warning |
| **First Seen** | 2026-01-02 |
| **Command** | `timeout 120s pnpm -C services/api lint 2>&1` |
| **Impact** | Low |
| **Suggested Owner** | Tech Debt / M9.x cleanup |
| **Status** | OPEN |

**Summary**: 120 ESLint warnings, all `@typescript-eslint/no-unused-vars`

**Top Warning Types by Count**:
| Count | Warning Type |
|-------|--------------|
| 36 | `'Test' is defined but never used` |
| 30 | `'createE2ETestingModuleBuilder' / 'createE2ETestingModule' is defined but never used` |
| 7 | `'ConfigModule' is defined but never used` |
| 4 | `'prismaService' is assigned a value but never used` |
| 6 | `'ObservabilityModule' / 'AuthModule' is defined but never used` |
| 3 | `'cleanup' is defined but never used` |
| 3 | `'dto' is defined but never used` |

**Affected File Categories**:
- `test/e2e/*.e2e-spec.ts` – slice test files with unused imports
- `test/*.e2e-spec.ts` – legacy test files
- `test/webhooks/*.ts` – webhook test utilities

**Representative Files**:
```
test/e2e/workforce.e2e-spec.ts
test/e2e/webhook.replay.slice.e2e-spec.ts
test/e2e/transfer.invalidation.slice.e2e-spec.ts
test/e2e/sse.smoke.e2e-spec.ts
test/e2e/reservations.slice.e2e-spec.ts
test/e2e/reports.e2e-spec.ts
test/e2e/purchasing.slice.e2e-spec.ts
test/m1-kds-enterprise.e2e-spec.ts
test/m7-service-providers.e2e-spec.ts
test/webhooks/replay.validate.ts
```

---

### PRE-002: ESLint Errors – Web App (2 errors + 16 warnings)

| Field | Value |
|-------|-------|
| **ID** | PRE-002 |
| **Category** | lint-error |
| **First Seen** | 2026-01-02 |
| **Command** | `timeout 60s pnpm -C apps/web lint 2>&1` |
| **Impact** | Medium |
| **Suggested Owner** | Frontend / M9.x cleanup |
| **Status** | OPEN |

**Errors (2)**:
```
./src/lib/api.ts
84:32  Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
102:32 Error: Require statement not part of import statement.  @typescript-eslint/no-var-requires
```

**Warnings (16)**: All `@typescript-eslint/no-unused-vars`

**Affected Files**:
- `src/lib/api.ts` – dynamic require statements (2 errors)
- `src/pages/dashboard.tsx` – unused imports (10 warnings)
- `src/pages/login.tsx` – unused autofill functions (2 warnings)
- `src/hooks/usePosCached*.test.tsx` – unused React import (2 warnings)

---

### PRE-003: E2E Teardown Check Warnings (2 warnings)

| Field | Value |
|-------|-------|
| **ID** | PRE-003 |
| **Category** | test-warning |
| **First Seen** | 2026-01-02 |
| **Command** | `timeout 30s pnpm -C services/api test:e2e:teardown-check 2>&1` |
| **Impact** | Low |
| **Suggested Owner** | Test Infrastructure / T2.x |
| **Status** | OPEN |

**Excerpt**:
```
⚠️  WARN: test/e2e/accounting-m84-partial-payments.e2e-spec.ts
   Found 2 afterAll hooks in 6 describe blocks
   This may be legitimate for nested test suites - please verify each has matching beforeAll
```

**Notes**: This is a false positive. The M8.4 test file uses nested describe blocks legitimately. The teardown checker script may need refinement to handle nested suites.

---

## Resolution History

_No resolutions yet._

---

## Statistics

| Category | Open | Resolved | Total |
|----------|------|----------|-------|
| lint-warning | 1 | 0 | 1 |
| lint-error | 1 | 0 | 1 |
| test-warning | 1 | 0 | 1 |
| **Total** | **3** | **0** | **3** |

---

*Last Updated: 2026-01-02*
