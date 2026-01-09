# E2E Expansion Contract

> **Last updated:** 2026-01-02  
> **Version:** 1.0  
> **Purpose:** Mandatory E2E test expansion requirements for every feature implementation

---

## Overview

This contract defines the minimum E2E test expansion requirements for each feature implemented in Nimbus POS. Compliance with this contract is mandatory before a feature can be marked as complete.

**Key Principle:** Every acceptance criterion must have corresponding E2E coverage.

---

## Minimum Requirements

### 1. Test Count Per Feature

| Feature Complexity | Min E2E Tests | Min Assertions |
|-------------------|---------------|----------------|
| Small (1-2 endpoints) | 4 | 8 |
| Medium (3-5 endpoints) | 8 | 16 |
| Large (6+ endpoints) | 12 | 24 |

### 2. Test Distribution

| Test Type | Requirement | Example |
|-----------|-------------|---------|
| Happy path | ≥2 per acceptance criterion | Create, read, update, delete |
| Error path | ≥1 per acceptance criterion | Validation error, not found, forbidden |
| Edge case | ≥1 per feature | Empty list, max values, concurrent access |

### 3. Coverage Formula

```
Minimum E2E tests = (Acceptance Criteria × 2) + (Error Scenarios × 1)
```

---

## Dataset Requirements

### Mandatory Dataset Declaration

Every E2E test file MUST declare which dataset it requires:

```typescript
// apps/e2e/src/inventory/stock-adjustments.spec.ts

/**
 * @dataset DEMO_TAPAS
 * @feature Stock Adjustments
 * @milestone M15
 */
import { test, expect } from '@playwright/test';

test.describe('Stock Adjustments', () => {
  // tests...
});
```

### Dataset Selection Guide

| Dataset | Use When | Tenant ID |
|---------|----------|-----------|
| `DEMO_EMPTY` | Testing clean slate scenarios, initial setup | `demo_empty` |
| `DEMO_TAPAS` | Testing single restaurant flows | `demo_tapas` |
| `DEMO_CAFESSERIE_FRANCHISE` | Testing multi-branch, franchise flows | `demo_cafesserie` |

### Dataset Loading

```typescript
import { resetToDataset } from '@nimbus/e2e-utils';

test.beforeAll(async () => {
  await resetToDataset('DEMO_TAPAS');
});
```

---

## Timeout Requirements

### Hard Limits

| Scope | Maximum Timeout |
|-------|-----------------|
| Individual test | 30 seconds |
| Test file | 5 minutes |
| Full E2E suite | 15 minutes |

### Timeout Configuration

```typescript
// Per test
test('should create adjustment', async ({ page }) => {
  test.setTimeout(30_000); // 30 seconds max
  // test code...
});

// Per file (in playwright.config.ts)
export default defineConfig({
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
});
```

### Fail-Fast Rule

```typescript
// playwright.config.ts
export default defineConfig({
  // Stop on first failure in CI
  maxFailures: process.env.CI ? 1 : undefined,
});
```

---

## Test Structure

### File Organization

```
apps/e2e/src/
├── [module]/
│   ├── [feature].spec.ts       # Main test file
│   ├── [feature].fixtures.ts   # Test fixtures
│   └── [feature].helpers.ts    # Helper functions
├── utils/
│   ├── auth.ts                 # Auth helpers
│   ├── dataset.ts              # Dataset loading
│   └── assertions.ts           # Custom assertions
└── playwright.config.ts
```

### Test File Template

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature [Feature Name]
 * @milestone [Mxx]
 * @acceptance AC-01, AC-02, AC-03
 */
import { test, expect } from '@playwright/test';
import { login, resetToDataset } from '../utils';

test.describe('[Feature Name]', () => {
  test.beforeAll(async () => {
    await resetToDataset('DEMO_TAPAS');
  });

  test.beforeEach(async ({ page }) => {
    await login(page, 'manager');
  });

  // === Happy Path Tests ===

  test('AC-01: should [expected behavior]', async ({ page }) => {
    test.setTimeout(30_000);
    // Arrange
    // Act
    // Assert
  });

  // === Error Path Tests ===

  test('AC-01-ERR: should show error when [error condition]', async ({ page }) => {
    test.setTimeout(30_000);
    // Arrange
    // Act
    // Assert
  });

  // === Edge Case Tests ===

  test('EDGE: should handle [edge case]', async ({ page }) => {
    test.setTimeout(30_000);
    // Arrange
    // Act
    // Assert
  });
});
```

---

## Deterministic Testing

### Idempotency Requirement

Tests MUST be idempotent:
- Running twice produces same result
- Tests don't depend on previous test state
- Tests can run in any order

### Deterministic Data

```typescript
// ✅ GOOD - Deterministic test data
const testItem = {
  id: 'test-item-001',
  name: 'Test Widget',
  quantity: 100,
};

// ❌ BAD - Non-deterministic
const testItem = {
  id: crypto.randomUUID(),
  name: `Item-${Date.now()}`,
  quantity: Math.random() * 100,
};
```

### Database Reset Strategy

```typescript
// Option 1: Reset before each test file
test.beforeAll(async () => {
  await resetToDataset('DEMO_TAPAS');
});

// Option 2: Transaction rollback (faster)
test.beforeEach(async () => {
  await beginTransaction();
});

test.afterEach(async () => {
  await rollbackTransaction();
});
```

---

## Verification Gate

### Running E2E Gate

```bash
# Standard gate (recommended)
timeout 900s pnpm test:e2e:gate

# Verbose output
timeout 900s pnpm test:e2e:gate -- --reporter=list

# Specific feature
timeout 300s pnpm test:e2e:gate -- --grep "Stock Adjustments"
```

### Gate Script Definition

```json
// package.json
{
  "scripts": {
    "test:e2e:gate": "playwright test --project=e2e-gate",
    "test:e2e:full": "playwright test",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

### CI Configuration

```yaml
# .github/workflows/e2e.yml
e2e-gate:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - run: pnpm install
    - run: pnpm test:e2e:gate
      env:
        CI: true
```

---

## Expansion Tracking

### Feature Dossier Integration

Every feature dossier must include E2E expansion tracking:

```markdown
## 10. E2E Expansions

### 10.1 Required Coverage

| Acceptance Criterion | Test Count | Status |
|---------------------|------------|--------|
| AC-01 | 2 | ✅ Done |
| AC-02 | 2 | ✅ Done |
| AC-03 | 2 | 🔲 TODO |

### 10.2 New Tests Added

| Test Name | File | Dataset | Timeout |
|-----------|------|---------|---------|
| should create adjustment | stock-adjustments.spec.ts | DEMO_TAPAS | 30s |
| should reject invalid qty | stock-adjustments.spec.ts | DEMO_TAPAS | 30s |

### 10.3 Coverage Metrics

- Tests added: 6
- Assertions added: 18
- Dataset coverage: DEMO_TAPAS, DEMO_CAFESSERIE_FRANCHISE
```

### Coverage Report

```bash
# Generate coverage report
pnpm test:e2e:gate -- --reporter=html

# View report
open playwright-report/index.html
```

---

## Anti-Patterns to Avoid

### ❌ Don't Do This

| Anti-Pattern | Why | Fix |
|--------------|-----|-----|
| No timeout specified | Tests hang forever | Add `test.setTimeout(30_000)` |
| Random test data | Non-deterministic failures | Use fixed test data |
| Tests depend on order | Flaky in parallel | Make tests independent |
| No dataset declaration | Unclear prerequisites | Add `@dataset` comment |
| Sleep-based waits | Slow and flaky | Use `waitForSelector` |
| Global state mutation | Affects other tests | Use transaction rollback |

### ✅ Do This Instead

```typescript
// ✅ Explicit timeout
test.setTimeout(30_000);

// ✅ Wait for element
await page.waitForSelector('[data-testid="submit-btn"]');

// ✅ Explicit assertions
await expect(page.locator('[data-testid="toast"]')).toHaveText('Success');

// ✅ Independent test data
const uniqueId = 'test-' + test.info().testId;
```

---

## Quick Reference

### Minimum Per Feature

| Item | Minimum |
|------|---------|
| E2E tests | 4+ |
| Happy path tests | 2+ per AC |
| Error path tests | 1+ per AC |
| Timeout per test | ≤ 30s |
| Dataset declaration | Required |

### Gate Commands

```bash
# Run gate
pnpm test:e2e:gate

# Run with filter
pnpm test:e2e:gate -- --grep "feature"

# Run headed (debug)
pnpm test:e2e:gate -- --headed

# Generate report
pnpm test:e2e:gate -- --reporter=html
```

### Required Files

| File | Purpose |
|------|---------|
| `[feature].spec.ts` | Main test file |
| `@dataset` declaration | Dataset requirement |
| `test.setTimeout()` | Timeout limit |

---

## Operational Gates (M0.5)

> Added: 2026-01-02 (M0.5 E2E Expansion Operationalization)

This section links to operational documents that make E2E expansion **unavoidable and repeatable**.

### Pre-Merge Checks

| Check | Command | Timeout | Failure Action |
|-------|---------|---------|----------------|
| Coverage Check | `pnpm -C services/api test:e2e:coverage-check` | 10s | Requires test file changes for source changes |
| Teardown Check | `pnpm -C services/api test:e2e:teardown-check` | 30s | Prevents duplicate teardown hooks |
| E2E Gate | `pnpm -C services/api test:e2e:gate` | 600s | Runs full E2E suite |

### Workflow Documents

| Document | Purpose |
|----------|---------|
| [MILESTONE_DEFINITION_OF_DONE.md](./MILESTONE_DEFINITION_OF_DONE.md) | Mandatory completion criteria |
| [E2E_TEST_TEMPLATES.md](./E2E_TEST_TEMPLATES.md) | Copy-ready test templates |
| [E2E_DATASET_RULES.md](./E2E_DATASET_RULES.md) | Dataset selection and extension rules |

### Coverage Check Script

The `check-e2e-coverage.mjs` script enforces that source changes have test changes:

```bash
# Run coverage check
pnpm -C services/api test:e2e:coverage-check

# With verbose output
pnpm -C services/api test:e2e:coverage-check --verbose

# Exempt via commit message
git commit -m "[skip-e2e-check] Update comments only"
```

### Integration with CI

```yaml
# Example GitHub Actions workflow
- name: E2E Coverage Check
  run: pnpm -C services/api test:e2e:coverage-check
  
- name: E2E Teardown Check
  run: pnpm -C services/api test:e2e:teardown-check
  
- name: E2E Gate
  run: pnpm -C services/api test:e2e:gate
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](./FEATURE_LEVEL_COMPARISON_WORKFLOW.md) | Overall workflow |
| [FEATURE_DOSSIER_TEMPLATE.md](./FEATURE_DOSSIER_TEMPLATE.md) | Dossier template |
| [DEMO_TENANTS_AND_DATASETS.md](./DEMO_TENANTS_AND_DATASETS.md) | Dataset definitions |
| [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](./DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) | Completeness rules |
