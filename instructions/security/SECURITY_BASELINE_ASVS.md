# Security Baseline — ASVS-Aligned

> **Last updated:** 2026-01-02  
> **Target Level:** ASVS L2 (SaaS POS minimum); L3 for payment/critical modules  
> **Reference:** OWASP ASVS v4.0.3

---

## Overview

The Application Security Verification Standard (ASVS) provides a framework for verifying application security. Nimbus POS targets **Level 2** as the baseline for all modules, with **Level 3** controls for payment processing, authentication, and PII-handling components.

### Level Selection Rationale

| Level | Scope | Nimbus Application |
|-------|-------|---------------------|
| L1 | Basic security | Not sufficient for SaaS POS |
| L2 | Standard security for most apps | **Default baseline** for all modules |
| L3 | High-value/critical applications | Payment endpoints, auth, PII storage |

---

## Control Areas

### 1. Authentication (V2)

**ASVS Requirement:** Verify authentication credentials are protected and properly validated.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Strong password policy | 12+ chars, 3/4 classes, bcrypt/argon2 | L2 |
| Brute force protection | @nestjs/throttler, 5/min login, 15min lockout | L2 |
| Credential storage | Argon2id with memory cost ≥64MB | L2 |
| Multi-factor authentication | TOTP + WebAuthn supported | L3 |
| Account recovery | Rate-limited, expiring tokens | L2 |
| PIN/badge authentication | Hashed with salt; device-bound | L2 |

**NestJS Pattern:**
- `AuthGuard('jwt')` on all protected routes
- `LocalAuthGuard` with custom validation pipe
- Password hashing in AuthService with argon2

---

### 2. Session Management (V3)

**ASVS Requirement:** Verify session tokens are securely generated, stored, and invalidated.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Session generation | Crypto-random tokens; JWT with RS256 | L2 |
| Session timeout | 30min idle; 24h absolute | L2 |
| Session revocation | sessionVersion in User model; increment on logout | L2 |
| Concurrent session limits | Max 5 sessions per user | L2 |
| Secure cookie attributes | HttpOnly, Secure, SameSite=Strict | L2 |
| Session binding | Optional IP/device fingerprint | L3 |

**NestJS Pattern:**
- JWT payload includes `sessionVersion`
- Guard validates `token.sessionVersion === user.sessionVersion`
- Logout increments `sessionVersion` atomically

---

### 3. Access Control (V4)

**ASVS Requirement:** Verify authorization is enforced at every access point.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| RBAC enforcement | `@Roles()` decorator + RolesGuard | L2 |
| Tenant isolation | `tenantId` in JWT; Prisma query scoping | L2 |
| Branch isolation | `branchId` scoping where applicable | L2 |
| Privilege escalation prevention | Cannot modify own role | L2 |
| Object-level authorization | IDOR checks in service layer | L2 |
| Deny by default | All routes require auth unless explicitly public | L2 |

**NestJS Pattern:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.OWNER)
@Get('sensitive-data')
async getSensitiveData(@User() user: AuthUser) {
  // user.tenantId automatically scopes queries
}
```

---

### 4. Input Validation (V5)

**ASVS Requirement:** Verify all input is validated before processing.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Server-side validation | class-validator + ValidationPipe | L2 |
| Reject unknown fields | `whitelist: true, forbidNonWhitelisted: true` | L2 |
| Type coercion | `transform: true` in ValidationPipe | L2 |
| Length limits | `@MaxLength()` on all string fields | L2 |
| Format validation | `@IsEmail()`, `@IsUUID()`, etc. | L2 |
| File upload validation | MIME type, size limits, name sanitization | L2 |

**NestJS Pattern:**
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

---

### 5. Data Protection (V6)

**ASVS Requirement:** Verify sensitive data is protected at rest and in transit.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| TLS 1.2+ for all traffic | Render/Cloud enforced; HSTS header | L2 |
| Database encryption at rest | Managed PostgreSQL encryption | L2 |
| No secrets in code | Environment variables; secret manager | L2 |
| PII minimization | Only store necessary data | L2 |
| Data masking in logs | Pino redact paths for passwords, tokens | L2 |
| Secure file storage | Signed URLs; access-controlled buckets | L2 |

**NestJS Pattern:**
```typescript
const logger = pino({
  redact: ['req.headers.authorization', 'password', 'token', 'secret'],
});
```

---

### 6. Cryptography (V7)

**ASVS Requirement:** Verify cryptographic operations use approved algorithms.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Password hashing | Argon2id (memory ≥64MB, iterations ≥3) | L2 |
| JWT signing | RS256 or ES256 (not HS256 in prod) | L2 |
| Random generation | Node.js crypto.randomBytes | L2 |
| Key rotation | Configurable JWT key rotation | L2 |
| Webhook signatures | HMAC-SHA256 | L2 |
| PIN/badge hashing | bcrypt or argon2 with device salt | L2 |

---

### 7. Error Handling & Logging (V8)

**ASVS Requirement:** Verify errors are handled securely and logged appropriately.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Generic error messages | No stack traces in production | L2 |
| Security event logging | Audit log for auth events | L2 |
| Log injection prevention | Structured logging (pino) | L2 |
| Sensitive data exclusion | Redact passwords, tokens, PII | L2 |
| Request ID correlation | X-Request-ID header propagation | L2 |
| Tamper-resistant audit logs | Append-only table; no DELETE permission | L3 |

---

### 8. Rate Limiting & Abuse Prevention (V9)

**ASVS Requirement:** Verify the application is resilient to abuse.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Authentication rate limiting | 5/min per IP; lockout after 10 failures | L2 |
| API rate limiting | 1000/min per user via @nestjs/throttler | L2 |
| Resource-intensive endpoint limits | Lower limits for reports, exports | L2 |
| Webhook retry limits | Max 5 retries with exponential backoff | L2 |
| Public endpoint protection | CAPTCHA/honeypot for feedback forms | L2 |
| Connection limits | SSE max connections per user | L2 |

**NestJS Pattern:**
```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post('login')
async login() {}
```

---

### 9. Secure Configuration (V10)

**ASVS Requirement:** Verify application configuration is secure by default.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Security headers | Helmet middleware | L2 |
| CORS restrictions | Explicit allowed origins | L2 |
| CSP headers | Strict policy in Next.js | L2 |
| Debug mode disabled | No debug routes in production | L2 |
| Swagger/OpenAPI access | Disabled or auth-protected in prod | L2 |
| Health endpoints | No sensitive data exposed | L2 |

---

### 10. Dependency Security (V11)

**ASVS Requirement:** Verify third-party components are secure and up-to-date.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Dependency auditing | `pnpm audit` in CI | L2 |
| Lockfile integrity | Committed pnpm-lock.yaml | L2 |
| Container image pinning | Specific version tags (no `latest`) | L2 |
| Automatic updates | Dependabot or similar | L2 |
| License compliance | Check for copyleft in dependencies | L2 |

---

### 11. CI/CD Security (V12)

**ASVS Requirement:** Verify build and deployment pipelines are secure.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Secret scanning | Pre-commit hooks; CI checks | L2 |
| Protected branches | Main branch requires reviews | L2 |
| Signed commits | Optional but recommended | L3 |
| Deployment approval | Manual approval for production | L2 |
| Immutable artifacts | Container images tagged with commit SHA | L2 |

---

### 12. Secrets Management (V13)

**ASVS Requirement:** Verify secrets are managed securely throughout their lifecycle.

| Control | Nimbus Implementation | Level |
|---------|----------------------|-------|
| Environment-based secrets | No secrets in code or config files | L2 |
| Secret rotation | JWT keys, API keys rotatable | L2 |
| Access auditing | Log who accessed which secrets | L3 |
| Least privilege | Services get only needed secrets | L2 |
| Secure storage | Render secrets, Vault, or AWS SSM | L2 |

---

## L3 Enhancement Areas

The following modules require L3 controls due to their sensitivity:

| Module | L3 Requirements |
|--------|-----------------|
| Payment processing | Idempotency; audit trail; MFA for refunds |
| Password/credential storage | Argon2id with high memory cost |
| PII access | Audit logging; encryption at rest |
| API key management | Scoped permissions; rotation; revocation |
| Webhook secrets | HMAC verification; replay protection |

---

## Verification Approach

| Control Area | Verification Method |
|--------------|---------------------|
| Authentication | E2E tests + manual review |
| Session management | E2E tests + token inspection |
| Access control | RBAC matrix verification; E2E tests |
| Input validation | Negative API tests; fuzz testing |
| Data protection | Configuration audit; log review |
| Rate limiting | Load tests; log analysis |
| Dependencies | `pnpm audit` output; CI gate |

---

## References

- [OWASP ASVS v4.0.3](https://owasp.org/www-project-application-security-verification-standard/)
- [SECURITY_QUALITY_STANDARD.md](../quality-standards/SECURITY_QUALITY_STANDARD.md)
- [THREAT_MODEL.md](THREAT_MODEL.md)
