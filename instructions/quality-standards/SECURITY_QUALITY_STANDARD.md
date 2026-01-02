# Security Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Authentication, Authorization, Input Validation, Audit, OWASP Compliance  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Authentication mechanisms (password, PIN, MSR/badge, WebAuthn)
- Session management and token handling
- Role-based access control (RBAC)
- Input validation and sanitization
- Output encoding and XSS prevention
- CSRF protection
- Rate limiting and brute force prevention
- Audit logging
- Security headers
- Secrets management

### Out of Scope
- Network security (WAF, DDoS)
- Infrastructure security (server hardening)
- Penetration testing execution
- Compliance certifications (SOC2, PCI)

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| SEC-INV-01 | **Password hashing**: Passwords stored with bcrypt (cost ≥ 12) or Argon2id | Auth service |
| SEC-INV-02 | **Session expiration**: All sessions expire after configured timeout | Token TTL |
| SEC-INV-03 | **RBAC enforcement**: Every API endpoint validates role before access | Guard middleware |
| SEC-INV-04 | **Tenant isolation**: Users cannot access data from other tenants | Query scoping |
| SEC-INV-05 | **Input validation**: All inputs validated before processing | Validation pipes |
| SEC-INV-06 | **Audit immutability**: Security audit logs cannot be modified or deleted | DB permissions |
| SEC-INV-07 | **Token secrets rotation**: JWT secrets rotatable without logout | Key management |
| SEC-INV-08 | **No sensitive data in logs**: Passwords, tokens, PII never logged | Log sanitization |
| SEC-INV-09 | **HTTPS only**: All production traffic over TLS 1.2+ | Config enforcement |
| SEC-INV-10 | **Failed auth tracking**: Lockout after N failed attempts | Rate limiter |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | Auth works; minimal users exist |
| DEMO_TAPAS | Sample users per role; session history |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch RBAC; cross-branch restrictions |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All auth events create audit trail
- [ ] RBAC consistent across all endpoints
- [ ] Session state reflects actual login status
- [ ] Failed attempts tracked and enforceable
- [ ] Token revocation immediately effective

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `POST /auth/login` | Rate-limited; lockout after N failures |
| `POST /auth/logout` | Invalidates session; clears tokens |
| `GET /auth/me` | Returns current user; tenant/role info |
| `POST /auth/refresh` | New token; validates session still active |
| `POST /auth/password/reset` | Rate-limited; secure token; expires |
| `POST /auth/mfa/*` | Second factor validation |
| `GET /auth/sessions` | User's active sessions |
| `DELETE /auth/sessions/:id` | Revoke specific session |

### Response Time SLA
- Login: < 1s (includes hash verification)
- Token validation: < 50ms
- Session revocation: immediate (< 100ms)

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| ALL USERS | Clear login flow; password strength indicator |
| OWNER | Session management; force logout capability |
| MANAGER | Can reset staff passwords (branch scope) |
| IT_ADMIN | Full security settings; audit log access |
| STAFF | Cannot modify own permissions |

### UX Requirements
- Login form shows password requirements
- Failed login shows generic "Invalid credentials" (no enumeration)
- Session timeout gives 60s warning before logout
- Password change requires current password
- MFA setup shows backup codes prominently
- Locked account shows lockout duration
- Active sessions list shows device/location hints
- Logout clears all client-side storage

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| SEC-ERR-01 | Wrong password | 401 error "Invalid credentials" |
| SEC-ERR-02 | Account locked | 403 error "Account locked. Try after X min" |
| SEC-ERR-03 | Session expired | 401 error "Session expired" |
| SEC-ERR-04 | Invalid token | 401 error "Invalid token" |
| SEC-ERR-05 | Missing required role | 403 error "Forbidden" |
| SEC-ERR-06 | Tenant mismatch | 403 error "Forbidden" (no hint) |
| SEC-ERR-07 | CSRF token invalid | 403 error "Invalid request" |
| SEC-ERR-08 | Rate limit exceeded | 429 error "Too many requests" |
| SEC-ERR-09 | Weak password submitted | 400 error "Password requirements not met" |
| SEC-ERR-10 | XSS attempt in input | Input sanitized; no script execution |
| SEC-ERR-11 | SQL injection attempt | Parameterized query; no execution |
| SEC-ERR-12 | Path traversal attempt | 400 error "Invalid path" |

---

## G) Observability & Audit Requirements

### Audit Trail (MANDATORY)
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Login success | INFO | userId, timestamp, IP, device |
| Login failure | WARN | attemptedEmail, timestamp, IP, reason |
| Logout | INFO | userId, timestamp, sessionId |
| Password change | WARN | userId, timestamp |
| Password reset request | WARN | email, timestamp, IP |
| Session revoked | WARN | sessionId, revokedBy, userId |
| Permission denied | WARN | userId, resource, action, IP |
| Account locked | WARN | userId, lockReason, duration |
| MFA enabled/disabled | WARN | userId, method |
| API key created/revoked | WARN | keyId, userId |

### Metrics
| Metric | Purpose |
|--------|---------|
| `auth.login.success` | Volume tracking |
| `auth.login.failure` | Attack detection |
| `auth.lockouts` | Security monitoring |
| `auth.rate_limit.hits` | Capacity |
| `security.violations` | Incident tracking |

### Alerts
- Lockouts > 10/hour: WARN
- Failed logins > 100/hour: WARN (possible attack)
- Permission denied spike: WARN
- Unusual IP login: INFO

---

## H) Security Requirements

### Password Policy
| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Character classes | 3 of 4 (upper, lower, number, symbol) |
| No common passwords | Check against top 10k list |
| No user info | Cannot contain email/name |
| History | Last 5 passwords cannot be reused |
| Max age | Optional; recommend 90 days |

### Session Management
| Requirement | Value |
|-------------|-------|
| Session timeout | 30 min idle (configurable) |
| Absolute timeout | 24 hours |
| Concurrent sessions | Limited to 5 per user |
| Session binding | Optional IP/device binding |
| Secure cookies | HttpOnly, Secure, SameSite=Strict |

### Token Security
| Requirement | Value |
|-------------|-------|
| JWT algorithm | RS256 or ES256 (not HS256 in prod) |
| Access token TTL | 15 minutes |
| Refresh token TTL | 7 days |
| Token storage | HttpOnly cookie (web); secure storage (mobile) |

### Rate Limiting
| Endpoint | Limit | Lockout |
|----------|-------|---------|
| Login | 5/min per IP | 15 min lockout after 10 fails |
| Password reset | 3/hour per email | 24h block |
| API general | 1000/min per user | Throttle |

### OWASP Top 10 Compliance
| Risk | Mitigation |
|------|------------|
| Injection | Parameterized queries; input validation |
| Broken Auth | Strong passwords; MFA; session management |
| XSS | Output encoding; CSP headers |
| Insecure Design | Threat modeling; secure defaults |
| Security Misconfig | Security headers; error handling |
| Vulnerable Components | Dependency scanning; updates |
| Identification Failures | RBAC; logging |
| Integrity Failures | Signed updates; CSRF tokens |
| Logging Failures | Comprehensive audit logging |
| SSRF | URL validation; allowlist |

---

## I) Acceptance Criteria Checklist

### Authentication (7 items)
- [ ] SEC-AC-01: Login with email/password
- [ ] SEC-AC-02: Login with PIN
- [ ] SEC-AC-03: Login with MSR/badge
- [ ] SEC-AC-04: MFA setup and verification
- [ ] SEC-AC-05: Password reset flow
- [ ] SEC-AC-06: Account lockout after failed attempts
- [ ] SEC-AC-07: WebAuthn/passkey support

### Session Management (5 items)
- [ ] SEC-AC-08: Session created on login
- [ ] SEC-AC-09: Session expires after timeout
- [ ] SEC-AC-10: Logout invalidates session
- [ ] SEC-AC-11: View active sessions
- [ ] SEC-AC-12: Revoke specific session

### Authorization (5 items)
- [ ] SEC-AC-13: RBAC enforced on all endpoints
- [ ] SEC-AC-14: Tenant isolation enforced
- [ ] SEC-AC-15: Branch-scoped access where applicable
- [ ] SEC-AC-16: Permission denied logged
- [ ] SEC-AC-17: Forbidden returns 403 (not 404)

### Input Validation (4 items)
- [ ] SEC-AC-18: XSS prevented (output encoded)
- [ ] SEC-AC-19: SQL injection prevented
- [ ] SEC-AC-20: Path traversal prevented
- [ ] SEC-AC-21: Request size limits enforced

### Audit (4 items)
- [ ] SEC-AC-22: Login/logout logged
- [ ] SEC-AC-23: Password changes logged
- [ ] SEC-AC-24: Permission denied logged
- [ ] SEC-AC-25: Audit logs immutable

---

## J) Minimum E2E Expansion Set

### API Contract Tests (10 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Login success returns token | DEMO_TAPAS | 30s |
| Login failure returns 401 | DEMO_TAPAS | 30s |
| Account lockout after failures | DEMO_TAPAS | 30s |
| Expired token returns 401 | DEMO_TAPAS | 30s |
| RBAC blocks unauthorized access | DEMO_TAPAS | 30s |
| Tenant isolation prevents cross-access | DEMO_CAFESSERIE_FRANCHISE | 30s |
| Session revocation effective | DEMO_TAPAS | 30s |
| Rate limit returns 429 | DEMO_TAPAS | 30s |
| XSS attempt sanitized | DEMO_TAPAS | 30s |
| CSRF protection active | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| OWNER can view sessions | OWNER | DEMO_TAPAS | 30s |
| MANAGER can reset staff password | MANAGER | DEMO_TAPAS | 30s |
| CASHIER cannot access admin | CASHIER | DEMO_TAPAS | 30s |
| Cross-branch access denied | MANAGER | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Security Validation Tests (4 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Security headers present | DEMO_TAPAS | 30s |
| Password strength enforced | DEMO_TAPAS | 30s |
| Audit log created on login | DEMO_TAPAS | 30s |
| Token refresh works | DEMO_TAPAS | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Login page loads | DEMO_EMPTY | 30s |
| 403 page renders correctly | DEMO_TAPAS | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| CheatSheetSeries | ✅ CC-BY-4.0 | OWASP cheat sheets for all security topics |
| ASVS | ✅ CC-BY-4.0 | Application Security Verification Standard |
| juice-shop | ✅ MIT | Vulnerable patterns to avoid |

**Note:** All repos are permissive (use with attribution).
