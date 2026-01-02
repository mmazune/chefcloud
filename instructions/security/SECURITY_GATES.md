# Security Gates

> **Last updated:** 2026-01-02  
> **Purpose:** Define exact gates required before merge and deploy

---

## Overview

Security gates are automated checks that must pass before code can be merged or deployed. This document defines the exact commands, expected outputs, and pass/fail criteria.

**All commands include explicit timeouts per operating procedure.**

---

## A) Pre-Merge Gates (Automated - CI)

These gates run on every pull request:

### 1. Lint Gate

**Command:**
```bash
timeout 120s pnpm lint
```

**Pass Criteria:**
- Exit code 0
- No security-related lint errors

**Fail Actions:**
- Fix lint errors before merge
- Document exceptions in PR if suppressing

---

### 2. Unit Test Gate

**Command:**
```bash
timeout 180s pnpm test
```

**Pass Criteria:**
- Exit code 0
- All tests pass

**Fail Actions:**
- Fix failing tests
- No skipped security tests allowed

---

### 3. E2E Gate

**Command:**
```bash
timeout 600s pnpm test:e2e:gate
```

**Components:**
```bash
# Runs these in sequence:
pnpm test:e2e:teardown-check    # Verify clean state
node scripts/e2e-runtime-matrix.mjs  # Run E2E with matrix
```

**Pass Criteria:**
- Exit code 0
- All E2E tests pass
- No teardown violations

**Fail Actions:**
- Fix failing E2E tests
- Check for resource leaks

---

### 3a. E2E Coverage Check Gate

> Added: 2026-01-02 (M0.5)

**Command:**
```bash
timeout 10s pnpm -C services/api test:e2e:coverage-check
```

**Purpose:** Ensures source code changes have corresponding test changes.

**Pass Criteria:**
- Exit code 0
- Source changes accompanied by test changes
- OR change is exempt (docs-only, config-only)

**Exemptions:**
- Commit message contains `[skip-e2e-check]`, `[docs]`, `[chore]`, `[ci]`, or `[config]`
- Only changes to: `*.md`, `*.json`, `*.yml`, `docs/`, `instructions/`, `.github/`

**Fail Actions:**
- Add/update tests in `test/` or `*.spec.ts` files
- OR add `[skip-e2e-check]` to commit message with justification

**See Also:**
- [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md)
- [MILESTONE_DEFINITION_OF_DONE.md](../MILESTONE_DEFINITION_OF_DONE.md)

---

### 4. Security Regression Suite (PLACEHOLDER)

**Command:**
```bash
timeout 120s pnpm test:e2e:security
```

**Note:** This gate is defined but test files may not exist yet. When implemented:

```bash
# Expected script in package.json
"test:e2e:security": "jest --config test/jest-security.json"
```

**Pass Criteria:**
- Exit code 0
- All 25+ security tests pass
- No timeouts

**Placeholder Behavior:**
- If security test config doesn't exist, gate passes with warning
- Document security test backlog in PR

---

### 5. Dependency Audit Gate

**Command:**
```bash
timeout 60s pnpm audit --audit-level=critical
```

**Pass Criteria:**
- Exit code 0
- No CRITICAL vulnerabilities

**Fail Actions:**
- Update affected dependencies
- If update not possible, document risk in security registry
- Request security lead approval for exceptions

---

### 6. Secret Scan Gate (PLACEHOLDER)

**Command:**
```bash
timeout 30s git diff HEAD~1 --no-color | grep -iE "(password|secret|apikey|token).*=.*['\"][^'\"]{8,}" || true
```

**Note:** This is a basic check. For production, integrate:
- `detect-secrets` pre-commit hook
- GitHub secret scanning alerts
- Gitleaks in CI

**Pass Criteria:**
- No obvious secrets in diff
- Manual review required for flagged patterns

**Placeholder Behavior:**
- Currently advisory-only (does not block merge)
- Future: integrate proper secret scanning tool

---

### 7. TypeScript Strict Mode Gate

**Command:**
```bash
timeout 120s pnpm tsc --noEmit
```

**Pass Criteria:**
- Exit code 0
- No type errors

**Fail Actions:**
- Fix type errors
- No `// @ts-ignore` in security-critical code

---

## B) Pre-Deploy Gates (Manual + Automated)

These gates run before production deployment:

### 1. Full E2E Suite

**Command:**
```bash
timeout 1500s pnpm test:e2e:ci
```

**Pass Criteria:**
- Exit code 0
- All tests pass within 25min deadline
- JUnit report generated

---

### 2. Security Checklist

**Document:** [SECURITY_DEPLOY_CHECKLIST.md](../SECURITY_DEPLOY_CHECKLIST.md)

**Process:**
1. Manual review of all checklist items
2. Sign-off by authorized reviewer
3. Document any acknowledged risks

---

### 3. Dependency Audit (Extended)

**Command:**
```bash
timeout 60s pnpm audit
```

**Pass Criteria:**
- No CRITICAL vulnerabilities
- HIGH vulnerabilities reviewed and documented
- No new MODERATE+ since last deploy

---

### 4. Environment Configuration Check

**Command:**
```bash
timeout 10s test -z "${JWT_SECRET:-}" && echo "FAIL: JWT_SECRET not set" && exit 1 || echo "PASS"
timeout 10s test -z "${DATABASE_URL:-}" && echo "FAIL: DATABASE_URL not set" && exit 1 || echo "PASS"
```

**Required Environment Variables:**
- `JWT_SECRET` or `JWT_PRIVATE_KEY` (for RS256)
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`

**Pass Criteria:**
- All required secrets configured
- No secrets in source code

---

### 5. Health Check Verification

**Command (post-deploy):**
```bash
timeout 30s curl -sf https://api.chefcloud.com/health | jq '.status'
```

**Pass Criteria:**
- Returns `"ok"` or `"healthy"`
- Response time < 5s

---

### 6. Security Headers Check

**Command:**
```bash
timeout 30s curl -sI https://api.chefcloud.com | grep -iE "^(strict-transport|x-frame|x-content-type|content-security)"
```

**Expected Headers:**
- `Strict-Transport-Security: max-age=...`
- `X-Frame-Options: DENY` or `SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: ...` (for web app)

**Pass Criteria:**
- All expected headers present
- No insecure values

---

## C) Gate Summary Matrix

| Gate | Stage | Timeout | Required | Blocking |
|------|-------|---------|----------|----------|
| Lint | Pre-merge | 120s | ✅ | ✅ |
| Unit tests | Pre-merge | 180s | ✅ | ✅ |
| E2E gate | Pre-merge | 600s | ✅ | ✅ |
| Security regression | Pre-merge | 120s | ⚠️ Placeholder | ✅ when exists |
| Dependency audit (critical) | Pre-merge | 60s | ✅ | ✅ |
| Secret scan | Pre-merge | 30s | ⚠️ Placeholder | Advisory |
| TypeScript | Pre-merge | 120s | ✅ | ✅ |
| Full E2E | Pre-deploy | 1500s | ✅ | ✅ |
| Security checklist | Pre-deploy | Manual | ✅ | ✅ |
| Dependency audit (full) | Pre-deploy | 60s | ✅ | ✅ |
| Env config check | Pre-deploy | 10s | ✅ | ✅ |
| Health check | Post-deploy | 30s | ✅ | Rollback trigger |
| Security headers | Post-deploy | 30s | ✅ | ✅ |

---

## D) CI Integration

### GitHub Actions Example

```yaml
# .github/workflows/security-gates.yml
name: Security Gates

on: [push, pull_request]

jobs:
  security-gates:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Lint
        run: timeout 120s pnpm lint
        
      - name: TypeScript check
        run: timeout 120s pnpm tsc --noEmit
        
      - name: Unit tests
        run: timeout 180s pnpm test
        
      - name: Dependency audit
        run: timeout 60s pnpm audit --audit-level=critical
        
      - name: E2E tests
        run: timeout 600s pnpm test:e2e:gate
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
```

---

## E) Gate Failure Handling

### Escalation Matrix

| Gate | Failure Action | Escalation |
|------|----------------|------------|
| Lint | Fix before merge | Developer |
| Unit tests | Fix before merge | Developer |
| E2E | Investigate; fix or revert | Developer → Lead |
| Dependency audit (CRITICAL) | Block merge; update dep | Developer → Security |
| Secret detected | Block merge; revoke if real | Developer → Security |
| Pre-deploy checklist | Block deploy | Lead → Security |
| Post-deploy health | Rollback | DevOps → Lead |

### Exception Process

1. **Document the exception** in PR description
2. **Get approval** from security lead
3. **Create follow-up issue** for remediation
4. **Set deadline** (max 7 days for HIGH, 30 days for MEDIUM)

---

## F) Future Gate Additions

When implementing additional security tooling, add these gates:

| Tool | Purpose | Gate Command |
|------|---------|--------------|
| Snyk | Dependency + container scanning | `snyk test --severity-threshold=critical` |
| OWASP ZAP | DAST scanning | `zap-baseline.py -t $URL` |
| detect-secrets | Secret detection | `detect-secrets scan --baseline .secrets.baseline` |
| Trivy | Container image scanning | `trivy image $IMAGE` |

---

## References

- [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md)
- [SECURITY_DEPLOY_CHECKLIST.md](../SECURITY_DEPLOY_CHECKLIST.md)
- [SECURITY_CONTROL_MATRIX.md](SECURITY_CONTROL_MATRIX.md)
