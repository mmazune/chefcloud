# Nimbus POS / ChefCloud — Security & Deployment Checklist

_Last updated: 2025-12-25 (Africa/Kampala)_

This checklist must be completed before any production deployment. It focuses on practical, verifiable security controls relevant to a multi-tenant POS and backoffice platform.

---

## 1. Secrets and Configuration
- [ ] No secrets committed to git (scan repo history if necessary).
- [ ] Production environment variables are set via secure secret manager.
- [ ] `DATABASE_URL`, Redis credentials, SMTP credentials, webhook secrets are all protected.
- [ ] `.env.example` contains placeholders only.
- [ ] Distinct secrets per environment (dev/staging/prod).

## 2. Authentication & Sessions
- [ ] HTTP-only secure cookies for web auth where intended.
- [ ] Session revocation works (logout kills session; revoked token cannot be reused).
- [ ] Idle timeout policies enforced for sensitive roles.
- [ ] Platform access guards validated (web vs desktop vs mobile).
- [ ] Password policies: minimum length, lockouts/rate limits (as designed).

## 3. Authorization (RBAC/ABAC)
- [ ] RBAC enforced server-side on every protected endpoint (UI hiding is not security).
- [ ] Endpoint matrix verification run: only expected 403 denials remain.
- [ ] Branch/org isolation validated: cannot access other org data with valid session.
- [ ] “Owner-only” settings endpoints verified.

## 4. Input Validation & API Hardening
- [ ] DTO validation enabled globally (NestJS ValidationPipe).
- [ ] All write endpoints validate payloads and reject unknown fields (where appropriate).
- [ ] Rate limits configured for:
  - public feedback endpoints
  - auth endpoints (login attempts)
  - webhook ingress (if applicable)
- [ ] CORS policy is strict (known origins) and not `*` in production.
- [ ] Helmet (or equivalent headers) configured for web and API.

## 5. CSRF / XSS / Clickjacking
- [ ] CSRF protections applied where cookies are used (or alternative mitigations documented).
- [ ] Content Security Policy (CSP) defined for web app.
- [ ] `X-Frame-Options` / frame-ancestors set to prevent clickjacking (unless kiosk embed needed).
- [ ] Output encoding and sanitization for any user-generated content (feedback/comments/notes).

## 6. Data Protection & Privacy
- [ ] No raw payment card data stored.
- [ ] MSR/badge data stored only as non-reversible hashes.
- [ ] Logs do not contain secrets, tokens, passwords, or sensitive PII.
- [ ] Document storage access controls validated (payslips, contracts).
- [ ] Backups encrypted at rest (if using managed DB, verify policy).

## 7. Financial and Inventory Integrity
- [ ] Idempotency enforced on critical financial endpoints (payments, close, refunds, receiving).
- [ ] Audit trails exist for voids/refunds/adjustments with actor + reason.
- [ ] Reconciliation reports consistent with DB ledgers.

## 8. Dependency and Supply Chain
- [ ] `pnpm audit` (or equivalent) reviewed; critical vulnerabilities addressed.
- [ ] Lockfile committed and consistent.
- [ ] Dependabot or similar update strategy defined (optional but recommended).
- [ ] Container images pinned to stable versions where used.

## 9. Infrastructure & Network
- [ ] TLS enforced end-to-end.
- [ ] Database not publicly exposed (private network or firewall).
- [ ] Redis not publicly exposed.
- [ ] Webhook endpoints protected (HMAC signatures, replay protection).
- [ ] Webhook delivery retries bounded (avoid infinite loops).

## 10. Observability and Incident Response
- [ ] Health checks (`/health`, `/api/health`) verified and monitored.
- [ ] Request IDs enabled and visible in error responses (non-sensitive).
- [ ] Error reporting configured (Sentry or equivalent) with PII scrubbing.
- [ ] Backup and restore drill documented.
- [ ] Rollback plan documented for each deployment.

## 11. Final Go/No-Go
- [ ] All tests pass: lint, unit, e2e (where applicable).
- [ ] M7 verifiers pass (0 failed; only expected denials).
- [ ] Manual smoke tests completed on production-like environment.
- [ ] Security checklist signed off.
