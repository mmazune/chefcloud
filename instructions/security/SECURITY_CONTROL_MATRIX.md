# Security Control Matrix

> **Last updated:** 2026-01-02  
> **Controls:** 50+  
> **Purpose:** Actionable implementation reference with verification methods

---

## How to Use This Matrix

1. **Find applicable controls** for your feature area
2. **Implement** according to the "Implementation" column
3. **Verify** using the method in "Verification" column
4. **Check** severity to prioritize

---

## Authentication Controls (SEC-AUTH)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-AUTH-01 | Password hashing with Argon2id | Backend | `argon2.hash()` with memoryCost ≥64MB | Unit test hash output | HIGH | T01 |
| SEC-AUTH-02 | Login rate limiting | Backend | `@Throttle({limit:5, ttl:60000})` on login | E2E: 6th login returns 429 | HIGH | T01 |
| SEC-AUTH-03 | Account lockout after failures | Backend | Track failures in Redis; block after 10 | E2E: lockout test | HIGH | T01 |
| SEC-AUTH-04 | Generic error messages | Backend | "Invalid credentials" for wrong user/password | E2E: verify error text | LOW | T16 |
| SEC-AUTH-05 | PIN authentication hash | Backend | Argon2 with device salt | Unit test | HIGH | T04 |
| SEC-AUTH-06 | Badge/MSR hash | Backend | HMAC-SHA256 with device-specific key | Unit test | HIGH | T04 |
| SEC-AUTH-07 | MFA verification | Backend | TOTP validation with 30s window | E2E: MFA flow test | HIGH | T01 |
| SEC-AUTH-08 | WebAuthn/Passkey | Backend | `@simplewebauthn/server` integration | E2E: passkey flow | HIGH | T01 |

---

## Session Management Controls (SEC-SESS)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-SESS-01 | JWT RS256 signing | Backend | `@nestjs/jwt` with RS256 algorithm | Config review | CRITICAL | T05 |
| SEC-SESS-02 | Short access token TTL | Backend | 15 minute expiry | Token inspection | HIGH | T02 |
| SEC-SESS-03 | Refresh token rotation | Backend | New refresh token on use; invalidate old | E2E: refresh test | HIGH | T02 |
| SEC-SESS-04 | sessionVersion validation | Backend | Guard checks `token.sv === user.sessionVersion` | E2E: logout invalidates | CRITICAL | T33 |
| SEC-SESS-05 | HttpOnly cookies | Backend | `cookie: { httpOnly: true, secure: true }` | Browser dev tools | HIGH | T02 |
| SEC-SESS-06 | SameSite cookie attribute | Backend | `sameSite: 'strict'` | Cookie inspection | MEDIUM | T02 |
| SEC-SESS-07 | Concurrent session limit | Backend | Max 5 sessions per user | E2E: 6th login fails | MEDIUM | T34 |
| SEC-SESS-08 | Session timeout | Backend | 30min idle; 24h absolute | E2E: timeout test | MEDIUM | T02 |
| SEC-SESS-09 | Logout clears all tokens | Backend | Increment sessionVersion; clear cookie | E2E: logout test | HIGH | T33 |

---

## Access Control Controls (SEC-RBAC)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-RBAC-01 | RolesGuard on all routes | Backend | `@UseGuards(JwtAuthGuard, RolesGuard)` | Route audit | CRITICAL | T23 |
| SEC-RBAC-02 | @Roles() decorator | Backend | Explicit role requirements per endpoint | Code review | CRITICAL | T23 |
| SEC-RBAC-03 | Deny by default | Backend | All routes require auth unless @Public() | Route audit | CRITICAL | T23 |
| SEC-RBAC-04 | Tenant isolation in queries | Backend | `where: { tenantId: user.tenantId }` | Query review; E2E | CRITICAL | T14 |
| SEC-RBAC-05 | Branch isolation | Backend | `branchId` scoping for branch-specific data | E2E: cross-branch test | HIGH | T24 |
| SEC-RBAC-06 | IDOR prevention | Backend | Check `resource.tenantId === user.tenantId` | E2E: IDOR test | HIGH | T15 |
| SEC-RBAC-07 | Self-privilege escalation block | Backend | Cannot modify own role/permissions | E2E: self-modify test | HIGH | T25 |
| SEC-RBAC-08 | Permission denied logging | Backend | Log userId, resource, action | Log review | MEDIUM | T11 |
| SEC-RBAC-09 | 403 not 404 for forbidden | Backend | Return 403 for exists-but-forbidden | E2E: 403 test | LOW | T16 |

---

## Input Validation Controls (SEC-INPUT)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-INPUT-01 | Global ValidationPipe | Backend | `app.useGlobalPipes(new ValidationPipe(...))` | Config review | HIGH | T35-40 |
| SEC-INPUT-02 | Whitelist unknown fields | Backend | `whitelist: true, forbidNonWhitelisted: true` | E2E: extra field test | HIGH | T36 |
| SEC-INPUT-03 | DTO for every endpoint | Backend | All request bodies have corresponding DTO | Code review | HIGH | T35-40 |
| SEC-INPUT-04 | @MaxLength on strings | Backend | Reasonable limits per field type | DTO review | MEDIUM | T20 |
| SEC-INPUT-05 | @IsUUID for IDs | Backend | UUID validation for path/query params | E2E: invalid UUID test | HIGH | T15 |
| SEC-INPUT-06 | File type validation | Backend | MIME type + extension check | Upload test | MEDIUM | T39 |
| SEC-INPUT-07 | File size limits | Backend | Max size per upload type | Large file test | MEDIUM | T20 |
| SEC-INPUT-08 | Path traversal prevention | Backend | `path.basename()` on filenames | E2E: traversal test | HIGH | T39 |
| SEC-INPUT-09 | HTML sanitization | Backend | Sanitize user content before storage | XSS test | HIGH | T37 |

---

## Data Protection Controls (SEC-DATA)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-DATA-01 | TLS 1.2+ enforcement | Infra | HTTPS only; HSTS header | SSL Labs test | CRITICAL | T18 |
| SEC-DATA-02 | Database encryption at rest | Infra | Managed PostgreSQL encryption | Provider docs | HIGH | T18 |
| SEC-DATA-03 | No secrets in code | Backend | Environment variables only | Git scan | CRITICAL | T17 |
| SEC-DATA-04 | Log redaction | Backend | Pino redact paths for sensitive fields | Log review | HIGH | T17 |
| SEC-DATA-05 | No PII in error messages | Backend | Generic errors; no user data | E2E: error inspection | MEDIUM | T16 |
| SEC-DATA-06 | Backup encryption | Infra | Encrypted backups in provider | Config review | HIGH | T18 |
| SEC-DATA-07 | Secure cookie storage | Frontend | No sensitive data in localStorage | Code review | MEDIUM | T02 |

---

## Rate Limiting Controls (SEC-RATE)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-RATE-01 | Global rate limiter | Backend | `@nestjs/throttler` as global guard | E2E: rate limit test | HIGH | T19 |
| SEC-RATE-02 | Per-endpoint limits | Backend | `@Throttle()` with custom limits | E2E: endpoint test | HIGH | T19 |
| SEC-RATE-03 | Password reset limits | Backend | 3/hour per email | E2E: reset test | MEDIUM | T01 |
| SEC-RATE-04 | Public endpoint limits | Backend | Stricter limits for unauthenticated | E2E: feedback test | MEDIUM | T19 |
| SEC-RATE-05 | SSE connection limits | Backend | Max 5 connections per user | Connection test | MEDIUM | T22 |

---

## Webhook Security Controls (SEC-HOOK)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-HOOK-01 | HMAC signature verification | Backend | Verify X-Signature header | E2E: invalid sig test | CRITICAL | T31 |
| SEC-HOOK-02 | Timestamp validation | Backend | Reject if timestamp > 5min old | E2E: old timestamp test | HIGH | T29 |
| SEC-HOOK-03 | Nonce/idempotency tracking | Backend | Store nonce; reject duplicates | E2E: replay test | HIGH | T29 |
| SEC-HOOK-04 | URL validation | Backend | Allowlist domains; no internal IPs | Config review | HIGH | T30 |
| SEC-HOOK-05 | Retry limits | Backend | Max 5 retries with backoff | Log review | MEDIUM | T21 |

---

## SSE/Real-time Controls (SEC-SSE)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-SSE-01 | JWT auth on connect | Backend | Validate token before stream | E2E: no token test | CRITICAL | T23 |
| SEC-SSE-02 | Tenant scoping | Backend | Only send events for user.tenantId | E2E: cross-tenant test | CRITICAL | T14 |
| SEC-SSE-03 | Branch scoping | Backend | Filter by branchId where applicable | E2E: cross-branch test | HIGH | T24 |
| SEC-SSE-04 | Heartbeat/keepalive | Backend | Periodic pings; cleanup stale connections | Connection test | LOW | T22 |

---

## Audit & Logging Controls (SEC-AUDIT)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-AUDIT-01 | Login/logout logging | Backend | Audit log entry on auth events | Log review | HIGH | T11 |
| SEC-AUDIT-02 | Password change logging | Backend | Audit entry with userId, timestamp | Log review | HIGH | T11 |
| SEC-AUDIT-03 | Permission denied logging | Backend | Log access attempts | Log review | MEDIUM | T23 |
| SEC-AUDIT-04 | Immutable audit trail | Backend | Append-only table; no DELETE | DB permissions test | CRITICAL | T10 |
| SEC-AUDIT-05 | Request ID correlation | Backend | X-Request-ID in all logs | Log trace test | LOW | T16 |
| SEC-AUDIT-06 | Void/refund audit | Backend | Reason + actor for sensitive actions | E2E: audit test | HIGH | T11 |

---

## Security Headers Controls (SEC-HDR)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-HDR-01 | Helmet middleware | Backend | `app.use(helmet())` | Header inspection | MEDIUM | T37 |
| SEC-HDR-02 | Content-Security-Policy | Frontend | Strict CSP in Next.js | CSP evaluator | HIGH | T37-38 |
| SEC-HDR-03 | X-Frame-Options | Backend | `DENY` or `SAMEORIGIN` | Header check | MEDIUM | T38 |
| SEC-HDR-04 | X-Content-Type-Options | Backend | `nosniff` | Header check | LOW | T38 |
| SEC-HDR-05 | HSTS | Infra | Strict-Transport-Security header | Header check | HIGH | T18 |

---

## Dependency Security Controls (SEC-DEP)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-DEP-01 | Lockfile committed | Infra | pnpm-lock.yaml in git | Git check | HIGH | T18 |
| SEC-DEP-02 | Dependency audit | CI | `pnpm audit` in pipeline | CI gate | HIGH | T18 |
| SEC-DEP-03 | No critical vulnerabilities | CI | Fail on critical findings | CI output | CRITICAL | T18 |
| SEC-DEP-04 | Container pinning | Infra | Specific version tags (no `latest`) | Dockerfile review | MEDIUM | T18 |
| SEC-DEP-05 | Automatic updates | Infra | Dependabot/Renovate configured | Config review | LOW | T18 |

---

## Secrets Management Controls (SEC-SEC)

| ID | Description | Where | Implementation | Verification | Severity | Threat |
|----|-------------|-------|----------------|--------------|----------|--------|
| SEC-SEC-01 | No secrets in code | Backend | All secrets via env vars | Git scan | CRITICAL | T17 |
| SEC-SEC-02 | Secret rotation support | Backend | JWT keys rotatable without logout | Manual test | HIGH | T05 |
| SEC-SEC-03 | Least privilege | Infra | Each service gets only needed secrets | Config review | MEDIUM | T17 |
| SEC-SEC-04 | .env.example only | Backend | Placeholders only; no real values | File review | HIGH | T17 |

---

## Summary Statistics

| Category | Control Count | Critical | High | Medium | Low |
|----------|---------------|----------|------|--------|-----|
| Authentication | 8 | 0 | 6 | 0 | 2 |
| Session | 9 | 2 | 5 | 2 | 0 |
| Access Control | 9 | 4 | 3 | 1 | 1 |
| Input Validation | 9 | 0 | 6 | 3 | 0 |
| Data Protection | 7 | 2 | 4 | 1 | 0 |
| Rate Limiting | 5 | 0 | 2 | 3 | 0 |
| Webhook | 5 | 1 | 3 | 1 | 0 |
| SSE | 4 | 2 | 1 | 0 | 1 |
| Audit | 6 | 1 | 3 | 1 | 1 |
| Headers | 5 | 0 | 2 | 2 | 1 |
| Dependencies | 5 | 1 | 2 | 1 | 1 |
| Secrets | 4 | 1 | 2 | 1 | 0 |
| **TOTAL** | **76** | **14** | **39** | **16** | **7** |

---

## References

- [SECURITY_BASELINE_ASVS.md](SECURITY_BASELINE_ASVS.md)
- [THREAT_MODEL.md](THREAT_MODEL.md)
- [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md)
