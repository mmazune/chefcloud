# Milestone Definition of Done (DoD)

> **Last updated:** 2026-01-05  
> **Version:** 1.1  
> **Purpose:** Mandatory completion criteria for every milestone

---

## Overview

No milestone can be marked complete without satisfying all items in this Definition of Done. This ensures consistent quality, test coverage, and documentation across all feature implementations.

---

## DoD Checklist

### 1. Feature Documentation

- [ ] **Feature dossier created/updated** per [FEATURE_DOSSIER_TEMPLATE.md](FEATURE_DOSSIER_TEMPLATE.md)
- [ ] Dossier sections completed:
  - [ ] Scope (in/out, modules, tables, endpoints)
  - [ ] Current Nimbus state documented
  - [ ] Reference repos consulted (per [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](FEATURE_LEVEL_COMPARISON_WORKFLOW.md))
  - [ ] Data model changes documented
  - [ ] Acceptance criteria listed (with test mapping)
  - [ ] E2E test requirements specified

### 2. Domain Quality Standards

- [ ] **Identified applicable domain standard(s):**
  - [ ] [ACCOUNTING_QUALITY_STANDARD.md](quality-standards/ACCOUNTING_QUALITY_STANDARD.md)
  - [ ] [INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md](quality-standards/INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md)
  - [ ] [POS_KDS_FOH_QUALITY_STANDARD.md](quality-standards/POS_KDS_FOH_QUALITY_STANDARD.md)
  - [ ] [WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md](quality-standards/WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md)
  - [ ] [RESERVATIONS_EVENTS_QUALITY_STANDARD.md](quality-standards/RESERVATIONS_EVENTS_QUALITY_STANDARD.md)
  - [ ] [BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md](quality-standards/BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md)
  - [ ] [REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md](quality-standards/REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md)
  - [ ] [SECURITY_QUALITY_STANDARD.md](quality-standards/SECURITY_QUALITY_STANDARD.md)
  - [ ] [ROLE_OPTIMIZED_UX_STANDARD.md](quality-standards/ROLE_OPTIMIZED_UX_STANDARD.md)
- [ ] All applicable invariants satisfied
- [ ] Acceptance criteria from standard checked

### 3. E2E Test Expansion

Per [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md):

- [ ] **Minimum test count met:**
  - Small feature (1-2 endpoints): 4 tests
  - Medium feature (3-5 endpoints): 8 tests
  - Large feature (6+ endpoints): 12 tests
- [ ] **Test distribution correct:**
  - [ ] ≥2 happy path tests per acceptance criterion
  - [ ] ≥1 error path test per acceptance criterion
  - [ ] ≥1 edge case test per feature
- [ ] **Dataset declarations present** in all new test files
- [ ] **Timeouts configured:** `test.setTimeout(30_000)` in all tests
- [ ] **Templates followed** per [E2E_TEST_TEMPLATES.md](E2E_TEST_TEMPLATES.md)
- [ ] **Dataset rules followed** per [E2E_DATASET_RULES.md](E2E_DATASET_RULES.md)

### 4. Cross-Platform Gate (M10.16)

- [ ] **E2E gate runs on both Windows AND Linux:**
  - [ ] `pnpm -C services/api test:e2e:gate:self-check` passes
  - [ ] `pnpm -C services/api test:e2e:gate` completes without ENOENT/spawn errors
- [ ] **No platform-specific commands in scripts:**
  - [ ] No hardcoded `pnpm` spawn (use `pnpm.cmd` on Windows)
  - [ ] No GNU `timeout` dependency
  - [ ] No `bash -c` requirement
- [ ] See [E2E_CROSS_PLATFORM_GATE_RUNBOOK.md](E2E_CROSS_PLATFORM_GATE_RUNBOOK.md) for details

### 5. Security Requirements

Per [security/SECURITY_GATES.md](security/SECURITY_GATES.md):

- [ ] Security controls from [SECURITY_CONTROL_MATRIX.md](security/SECURITY_CONTROL_MATRIX.md) applied
- [ ] RBAC/tenant isolation tested if applicable
- [ ] Input validation DTOs created
- [ ] No secrets in code
- [ ] Audit logging for sensitive operations

### 6. CI Gates

All commands must pass before milestone completion:

**Cross-Platform Commands (Windows + Linux):**
```powershell
# Self-check gate runner (max 60s)
pnpm -C services/api test:e2e:gate:self-check

# E2E gate (full matrix, max 30m)
pnpm -C services/api test:e2e:gate
```

**Linux/CI Commands (with GNU timeout):**
```bash
# Lint (max 120s)
timeout 120s pnpm lint

# TypeScript check (max 120s)
timeout 120s pnpm tsc --noEmit

# Unit tests (max 180s)
timeout 180s pnpm test

# E2E coverage check (max 10s)
timeout 10s pnpm -C services/api run test:e2e:coverage-check

# Teardown check (max 30s)
timeout 30s pnpm -C services/api run test:e2e:teardown-check

# E2E gate (full matrix, max 600s)
timeout 600s pnpm -C services/api run test:e2e:gate
```

### 7. Code Review

- [ ] PR created with descriptive title and body
- [ ] Linked to milestone/issue
- [ ] At least one approval from team member
- [ ] Security-sensitive changes reviewed by security lead
- [ ] No unresolved comments

### 8. Documentation Updates

- [ ] API documentation updated (Swagger annotations if applicable)
- [ ] README updated if user-facing behavior changed
- [ ] Feature dossier status set to `COMPLETE`

---

## Gate Commands Reference

### Quick Local Verification (Cross-Platform)

**Windows PowerShell:**
```powershell
cd services/api

# 1. Self-check gate runner
pnpm test:e2e:gate:self-check

# 2. E2E gate
pnpm test:e2e:gate
```

**Linux/macOS:**
```bash
# Run all gates locally before PR
cd /workspaces/chefcloud/services/api

# 1. Code quality
timeout 120s pnpm lint && echo "✅ Lint passed"
timeout 120s pnpm tsc --noEmit && echo "✅ TypeScript passed"

# 2. E2E coverage check
timeout 10s node scripts/check-e2e-coverage.mjs && echo "✅ Coverage check passed"

# 3. Teardown check
timeout 30s node scripts/check-e2e-teardown.mjs && echo "✅ Teardown check passed"

# 4. Full E2E gate
timeout 600s pnpm test:e2e:gate && echo "✅ E2E gate passed"
```

### CI/CD Integration

```yaml
# .github/workflows/pr-gate.yml (example)
- name: E2E Coverage Check
  run: timeout 10s pnpm -C services/api run test:e2e:coverage-check

- name: E2E Teardown Check
  run: timeout 30s pnpm -C services/api run test:e2e:teardown-check

- name: E2E Gate
  run: timeout 600s pnpm -C services/api run test:e2e:gate
```

---

## Failure Response

### If Any Gate Fails

1. **Do not merge** until all gates pass
2. Check specific failure:
   - `lint`: Fix code style issues
   - `tsc`: Fix type errors
   - `coverage-check`: Add/update tests per E2E_EXPANSION_CONTRACT
   - `teardown-check`: Fix duplicate cleanup patterns
   - `e2e:gate`: Debug failing tests

### Coverage Check Failures

If `test:e2e:coverage-check` fails with message like:
```
❌ You changed src/inventory/stock.service.ts but no tests changed.
   Add/update tests per E2E_EXPANSION_CONTRACT.md
```

**Resolution:**
1. Create or update E2E tests in `test/` or `test/e2e/`
2. Follow templates in [E2E_TEST_TEMPLATES.md](E2E_TEST_TEMPLATES.md)
3. Re-run coverage check

---

## Cross-References

| Document | Purpose |
|----------|---------|
| [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](FEATURE_LEVEL_COMPARISON_WORKFLOW.md) | Reference repo comparison process |
| [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md) | Test count and distribution requirements |
| [E2E_TEST_TEMPLATES.md](E2E_TEST_TEMPLATES.md) | Copy-ready test templates |
| [E2E_DATASET_RULES.md](E2E_DATASET_RULES.md) | Dataset selection and usage |
| [security/SECURITY_GATES.md](security/SECURITY_GATES.md) | Security gate definitions |
| [quality-standards/README.md](quality-standards/README.md) | Domain quality standards index |

---

## Sign-Off Template

When completing a milestone, include in PR description:

```markdown
## DoD Checklist

- [x] Feature dossier: `instructions/feature-dossiers/[feature].md`
- [x] Domain standard(s): [list applicable standards]
- [x] E2E tests: [count] added/updated
- [x] All gates passing:
  - [x] lint
  - [x] tsc
  - [x] test:e2e:coverage-check
  - [x] test:e2e:teardown-check
  - [x] test:e2e:gate
- [x] Code reviewed by: @[reviewer]
```
