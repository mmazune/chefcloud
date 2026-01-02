# Security Test Plan

> **Last updated:** 2026-01-02  
> **Minimum E2E Tests:** 25  
> **Purpose:** Define required security tests mapped to controls

---

## Overview

This test plan defines the minimum security tests required for Nimbus POS. Tests are categorized by type and mapped to specific controls from [SECURITY_CONTROL_MATRIX.md](SECURITY_CONTROL_MATRIX.md).

---

## A) E2E Security Tests (Minimum 25)

### Authentication Tests (6 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-01 | Login success returns valid JWT | SEC-AUTH-01 | DEMO_TAPAS | 30s |
| SEC-E2E-02 | Login failure with wrong password returns 401 | SEC-AUTH-04 | DEMO_TAPAS | 30s |
| SEC-E2E-03 | Account lockout after 10 failed attempts | SEC-AUTH-03 | DEMO_TAPAS | 30s |
| SEC-E2E-04 | Rate limit returns 429 after threshold | SEC-AUTH-02 | DEMO_TAPAS | 30s |
| SEC-E2E-05 | Expired token returns 401 | SEC-SESS-02 | DEMO_TAPAS | 30s |
| SEC-E2E-06 | Refresh token rotation works | SEC-SESS-03 | DEMO_TAPAS | 30s |

### Session Management Tests (4 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-07 | Logout invalidates session | SEC-SESS-09 | DEMO_TAPAS | 30s |
| SEC-E2E-08 | Token reuse after logout fails | SEC-SESS-04 | DEMO_TAPAS | 30s |
| SEC-E2E-09 | Session timeout after idle | SEC-SESS-08 | DEMO_TAPAS | 30s |
| SEC-E2E-10 | Concurrent session limit enforced | SEC-SESS-07 | DEMO_TAPAS | 30s |

### Authorization/RBAC Tests (6 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-11 | RBAC blocks unauthorized role | SEC-RBAC-01 | DEMO_TAPAS | 30s |
| SEC-E2E-12 | Tenant isolation prevents cross-access | SEC-RBAC-04 | DEMO_CAFESSERIE_FRANCHISE | 30s |
| SEC-E2E-13 | Branch isolation prevents cross-access | SEC-RBAC-05 | DEMO_CAFESSERIE_FRANCHISE | 30s |
| SEC-E2E-14 | IDOR attempt returns 403 | SEC-RBAC-06 | DEMO_TAPAS | 30s |
| SEC-E2E-15 | Cannot modify own role | SEC-RBAC-07 | DEMO_TAPAS | 30s |
| SEC-E2E-16 | 403 returned for forbidden (not 404) | SEC-RBAC-09 | DEMO_TAPAS | 30s |

### Input Validation Tests (4 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-17 | XSS payload sanitized | SEC-INPUT-09 | DEMO_TAPAS | 30s |
| SEC-E2E-18 | Unknown fields rejected | SEC-INPUT-02 | DEMO_TAPAS | 30s |
| SEC-E2E-19 | Invalid UUID returns 400 | SEC-INPUT-05 | DEMO_TAPAS | 30s |
| SEC-E2E-20 | Path traversal attempt blocked | SEC-INPUT-08 | DEMO_TAPAS | 30s |

### Webhook Security Tests (3 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-21 | Webhook without signature rejected | SEC-HOOK-01 | DEMO_TAPAS | 30s |
| SEC-E2E-22 | Webhook replay rejected | SEC-HOOK-03 | DEMO_TAPAS | 30s |
| SEC-E2E-23 | Webhook old timestamp rejected | SEC-HOOK-02 | DEMO_TAPAS | 30s |

### SSE Security Tests (2 tests)

| ID | Test Name | Control | Dataset | Timeout |
|----|-----------|---------|---------|---------|
| SEC-E2E-24 | SSE without auth rejected | SEC-SSE-01 | DEMO_TAPAS | 30s |
| SEC-E2E-25 | SSE cross-tenant events blocked | SEC-SSE-02 | DEMO_CAFESSERIE_FRANCHISE | 30s |

---

## B) API Negative Test Patterns

### Required Patterns for All Endpoints

| Pattern | Description | Expected Response |
|---------|-------------|-------------------|
| NO_AUTH | Request without Authorization header | 401 Unauthorized |
| INVALID_TOKEN | Malformed JWT | 401 Unauthorized |
| EXPIRED_TOKEN | Token past expiry | 401 Unauthorized |
| WRONG_TENANT | Valid token, wrong tenant resource | 403 Forbidden |
| WRONG_ROLE | Valid token, insufficient role | 403 Forbidden |
| INVALID_INPUT | Malformed request body | 400 Bad Request |
| RATE_LIMITED | Exceed rate limit | 429 Too Many Requests |

### Test Implementation Template

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature Security - Authentication
 * @milestone M0.4
 */
describe('Authentication Security', () => {
  test.setTimeout(30_000);

  test('login with wrong password returns 401', async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: { email: 'owner@demo-tapas.com', password: 'wrong' },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toBe('Invalid credentials');
    // Verify no enumeration
    expect(body.message).not.toContain('user not found');
  });
});
```

---

## C) Static Security Checks

### Lint Rules

| Tool | Purpose | Configuration |
|------|---------|---------------|
| ESLint | Code quality + security patterns | `.eslintrc.js` |
| @typescript-eslint | Type safety | tsconfig.json strict mode |
| eslint-plugin-security | Common security patterns | Optional plugin |

**Required Lint Checks:**
- [ ] No `eval()` or `Function()` usage
- [ ] No `any` type in security-critical code
- [ ] No `console.log` in production code (use pino)
- [ ] Consistent error handling patterns

### Dependency Audit Approach

**Tool:** `pnpm audit`

**Process:**
1. Run `pnpm audit` in CI pipeline
2. Fail on CRITICAL vulnerabilities
3. Review HIGH vulnerabilities within 24h
4. Document accepted risks for MODERATE

**Command:**
```bash
timeout 60s pnpm audit --audit-level=critical
```

### Secret Scanning Approach

**Pre-commit (Recommended):**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

**CI Check:**
```bash
timeout 30s git log -p --all | grep -i "password\|secret\|apikey\|token" || true
```

**Manual Review Checklist:**
- [ ] No `.env` files committed (except `.env.example`)
- [ ] No hardcoded credentials in code
- [ ] No private keys in repository
- [ ] No JWT secrets in code

---

## D) Security Regression Suite

### Suite Definition

**Name:** `security-regression`  
**Location:** `services/api/test/security/`  
**Pattern:** `*.security.e2e-spec.ts`

### File Structure

```
services/api/test/security/
├── auth.security.e2e-spec.ts
├── session.security.e2e-spec.ts
├── rbac.security.e2e-spec.ts
├── input-validation.security.e2e-spec.ts
├── webhook.security.e2e-spec.ts
├── sse.security.e2e-spec.ts
└── headers.security.e2e-spec.ts
```

### Jest Configuration

```json
{
  "displayName": "security-regression",
  "testMatch": ["**/test/security/**/*.security.e2e-spec.ts"],
  "testTimeout": 30000,
  "setupFilesAfterEnv": ["<rootDir>/test/helpers/e2e-setup.ts"]
}
```

### Running the Suite

```bash
# Full security suite
timeout 120s pnpm jest --config test/jest-security.json

# Individual file
timeout 30s pnpm jest test/security/auth.security.e2e-spec.ts
```

### Integration with E2E Gate

The security regression suite is integrated into the main E2E gate:

```bash
# In package.json scripts
"test:e2e:security": "jest --config test/jest-security.json",
"test:e2e:gate": "pnpm test:e2e:security && pnpm test:e2e:teardown-check && node scripts/e2e-runtime-matrix.mjs"
```

---

## E) Test Coverage Requirements

### Minimum Coverage by Control Category

| Category | Min Tests | Min Assertions |
|----------|-----------|----------------|
| Authentication | 6 | 12 |
| Session | 4 | 8 |
| Authorization/RBAC | 6 | 12 |
| Input Validation | 4 | 8 |
| Webhook | 3 | 6 |
| SSE | 2 | 4 |
| **TOTAL** | **25** | **50** |

### Coverage Formula

```
Security coverage = (Tested controls / Total applicable controls) × 100%
Target: ≥ 80% of applicable controls have E2E tests
```

---

## F) Test Data Requirements

### Security-Specific Test Users

| User | Role | Tenant | Purpose |
|------|------|--------|---------|
| owner@demo-tapas.com | OWNER | demo_tapas | Full access tests |
| manager@demo-tapas.com | MANAGER | demo_tapas | Elevated access tests |
| cashier@demo-tapas.com | CASHIER | demo_tapas | Limited access tests |
| attacker@evil.com | N/A | N/A | Invalid credential tests |
| owner@demo-cafe.com | OWNER | demo_cafesserie | Cross-tenant tests |

### Test Tokens

```typescript
// test/helpers/security-tokens.ts
export const tokens = {
  valid: () => generateToken({ userId: 'test', tenantId: 'demo_tapas' }),
  expired: () => generateToken({ userId: 'test', exp: Date.now() - 1000 }),
  wrongTenant: () => generateToken({ userId: 'test', tenantId: 'other' }),
  malformed: 'not.a.valid.jwt',
};
```

---

## G) Reporting Requirements

### Test Output Format

Each security test run must produce:

1. **JUnit XML** - For CI integration
2. **Console summary** - For quick review
3. **Coverage report** - For control mapping

### Pass/Fail Criteria

| Criteria | Pass | Fail |
|----------|------|------|
| All security tests pass | ✅ | ❌ |
| No CRITICAL vulnerabilities | ✅ | ❌ |
| ≥80% control coverage | ✅ | ❌ |
| No test timeouts | ✅ | ❌ |

---

## References

- [SECURITY_CONTROL_MATRIX.md](SECURITY_CONTROL_MATRIX.md)
- [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md)
- [SECURITY_GATES.md](SECURITY_GATES.md)
