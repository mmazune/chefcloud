# Nimbus POS / ChefCloud — Security & Deployment Checklist

_Last updated: 2026-01-02 (Africa/Kampala)_

This checklist is structured in two layers:
- **Layer A: Pre-Merge (Automated)** — Gates that run in CI before merge
- **Layer B: Pre-Deploy (Manual + Automated)** — Checks before production deployment

**Related Security Documents:**
- [Security Baseline (ASVS)](instructions/security/SECURITY_BASELINE_ASVS.md)
- [Threat Model](instructions/security/THREAT_MODEL.md)
- [Control Matrix](instructions/security/SECURITY_CONTROL_MATRIX.md)
- [Test Plan](instructions/security/SECURITY_TEST_PLAN.md)
- [Security Gates](instructions/security/SECURITY_GATES.md)

---

## Layer A: Pre-Merge Gates (Automated CI)

These gates MUST pass before any PR can be merged:

### A1. Code Quality Gates
- [ ] `pnpm lint` passes (timeout 120s)
- [ ] `pnpm tsc --noEmit` passes (timeout 120s)
- [ ] `pnpm test` passes (timeout 180s)
- [ ] `pnpm test:e2e:gate` passes (timeout 600s)

### A2. Security-Specific Gates
- [ ] `pnpm audit --audit-level=critical` — no CRITICAL vulnerabilities
- [ ] Security regression tests pass (when implemented)
- [ ] No obvious secrets in diff (advisory scan)
- [ ] pnpm-lock.yaml committed and up-to-date

### A3. Review Requirements
- [ ] PR reviewed by at least one team member
- [ ] Security-sensitive changes flagged and reviewed by security lead
- [ ] No `// @ts-ignore` in security-critical code

---

## Layer B: Pre-Deploy Gates (Manual + Automated)

Complete before any production deployment:

### B1. Secrets and Configuration
- [ ] No secrets committed to git (scan repo history if necessary)
- [ ] Production environment variables set via secure secret manager
- [ ] `DATABASE_URL`, Redis credentials, SMTP, webhook secrets protected
- [ ] `.env.example` contains placeholders only
- [ ] Distinct secrets per environment (dev/staging/prod)
- [ ] JWT signing uses RS256/ES256 (not HS256 in prod)

### B2. Authentication & Sessions
- [ ] HTTP-only secure cookies configured
- [ ] Session revocation works (logout kills session)
- [ ] sessionVersion invalidation tested
- [ ] Idle timeout policies enforced (30min default)
- [ ] Platform access guards validated (web/desktop/mobile)
- [ ] Password policies enforced (12+ chars, complexity)
- [ ] Account lockout after failed attempts (10 failures)

### B3. Authorization (RBAC)
- [ ] RBAC enforced server-side on every protected endpoint
- [ ] Endpoint matrix verification run (only expected 403s)
- [ ] Tenant isolation validated (cannot access other tenant data)
- [ ] Branch isolation validated (where applicable)
- [ ] "Owner-only" settings endpoints verified
- [ ] Self-privilege escalation blocked

### B4. Input Validation & API Hardening
- [ ] ValidationPipe enabled globally (whitelist, forbidNonWhitelisted)
- [ ] All write endpoints validate payloads
- [ ] Rate limits configured:
  - [ ] Login: 5/min per IP
  - [ ] Password reset: 3/hour per email
  - [ ] API general: 1000/min per user
  - [ ] Public endpoints: stricter limits
- [ ] CORS policy strict (known origins, not `*`)
- [ ] Helmet middleware configured

### B5. CSRF / XSS / Clickjacking
- [ ] CSRF protection applied (or alternative documented)
- [ ] Content Security Policy defined
- [ ] X-Frame-Options set (DENY or SAMEORIGIN)
- [ ] Output encoding for user-generated content

### B6. Data Protection & Privacy
- [ ] No raw payment card data stored
- [ ] MSR/badge data stored as non-reversible hashes
- [ ] Logs do not contain secrets, tokens, passwords, PII
- [ ] Document storage access controls validated
- [ ] Backups encrypted at rest

### B7. Financial and Inventory Integrity
- [ ] Idempotency enforced on critical endpoints (payments, refunds)
- [ ] Audit trails for voids/refunds with actor + reason
- [ ] Reconciliation reports consistent with ledgers

### B8. Dependency and Supply Chain
- [ ] `pnpm audit` reviewed (HIGH vulnerabilities documented)
- [ ] Lockfile committed and consistent
- [ ] Container images pinned to specific versions
- [ ] No `latest` tags in production Dockerfiles

### B9. Infrastructure & Network
- [ ] TLS 1.2+ enforced end-to-end
- [ ] HSTS header configured
- [ ] Database not publicly exposed
- [ ] Redis not publicly exposed
- [ ] Webhook HMAC signatures verified
- [ ] Webhook replay protection active (timestamp + nonce)
- [ ] Webhook retry limits bounded

### B10. Observability and Incident Response
- [ ] Health checks verified (`/health`, `/api/health`)
- [ ] Request IDs enabled (X-Request-ID)
- [ ] Error reporting configured (Sentry) with PII scrubbing
- [ ] Audit logging active for auth events
- [ ] Backup and restore drill documented
- [ ] Rollback plan documented

### B11. Full Test Suite
- [ ] `pnpm test:e2e:ci` passes (25min deadline)
- [ ] Security regression suite passes (when implemented)
- [ ] All DEMO datasets verified

### B12. Final Sign-Off
- [ ] All gates in Layer A passing
- [ ] All checklist items in Layer B completed
- [ ] Security lead sign-off (if security-sensitive changes)
- [ ] Deployment authorized by release manager

---

## Sign-Off Record

| Deploy Date | Version | Reviewed By | Security Lead | Notes |
|-------------|---------|-------------|---------------|-------|
| YYYY-MM-DD | x.x.x | Name | Name | |

---

## Exception Register

Document any acknowledged risks or deferred items:

| Item | Risk Level | Reason | Remediation Date | Approved By |
|------|------------|--------|------------------|-------------|
| | | | | |
