# Threat Model — Nimbus POS / ChefCloud

> **Last updated:** 2026-01-02  
> **Methodology:** STRIDE-based analysis  
> **Scope:** Multi-tenant SaaS POS with backoffice

---

## A) Assets

Assets are what attackers target. Prioritized by business impact:

| ID | Asset | Description | Sensitivity |
|----|-------|-------------|-------------|
| A1 | Tenant data | Orders, inventory, menus, settings | HIGH |
| A2 | User credentials | Passwords, PINs, badge data | CRITICAL |
| A3 | Session tokens | JWT access/refresh tokens | CRITICAL |
| A4 | Payment data | Transaction records, refund data | CRITICAL |
| A5 | Inventory/COGS | Stock levels, costs, recipes | HIGH |
| A6 | PII | Staff names, emails, addresses, timesheets | HIGH |
| A7 | Audit logs | Security events, financial adjustments | HIGH |
| A8 | API keys | Developer portal keys, webhook secrets | CRITICAL |
| A9 | Financial records | Journals, invoices, subscriptions | HIGH |
| A10 | System configuration | Feature flags, RBAC assignments | HIGH |

---

## B) Actors

### Legitimate Actors

| Actor | Description | Access Level |
|-------|-------------|--------------|
| Cashier | POS operations, order taking | POS module, branch-scoped |
| Waiter/Server | Order entry, table management | FOH module, branch-scoped |
| Kitchen Staff | KDS viewing | KDS module, branch-scoped |
| Manager | Reports, inventory, staff management | Branch admin, multi-module |
| Accountant | Financial reports, journals | Accounting module, tenant-scoped |
| Owner | Full access, billing, settings | All modules, tenant-scoped |
| IT Admin | System settings, integrations | Config only, tenant-scoped |
| Franchise Admin | Cross-branch oversight | Multi-branch, franchise-scoped |
| API Developer | Third-party integrations | Dev portal, scoped by API key |

### Threat Actors

| Actor | Capability | Motivation |
|-------|------------|------------|
| External Attacker | Network access, public endpoints | Financial gain, data theft |
| Rogue Employee | Valid credentials, insider knowledge | Fraud, sabotage, theft |
| Malicious Customer | Guest access, feedback forms | XSS, spam, reputation damage |
| Competitor | Reconnaissance, social engineering | Business intelligence |
| Former Employee | Stale credentials if not revoked | Grudge, theft |

---

## C) Entry Points

| ID | Entry Point | Protocol | Auth Required | Rate Limited |
|----|-------------|----------|---------------|--------------|
| E1 | Web Application | HTTPS | Yes (most routes) | Yes |
| E2 | REST API | HTTPS | Yes (JWT) | Yes |
| E3 | SSE Streams | HTTPS | Yes (JWT) | Yes |
| E4 | WebSocket | WSS | Yes | Partial |
| E5 | Webhook Ingress | HTTPS | No (signature verified) | Yes |
| E6 | Public Feedback | HTTPS | No | Yes |
| E7 | Dev Portal | HTTPS | Yes (API key) | Yes |
| E8 | Desktop App | Electron | Yes (JWT) | Via API |
| E9 | Mobile App | HTTPS | Yes (JWT) | Via API |
| E10 | Admin Console | HTTPS | Yes (elevated) | Yes |

---

## D) Threat Enumeration (STRIDE)

### Spoofing (S) — Impersonation Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T01 | Credential stuffing | Authentication | Rate limiting; account lockout; MFA | CRITICAL |
| T02 | Session hijacking | Session tokens | HttpOnly cookies; TLS; session binding | CRITICAL |
| T03 | API key theft | Dev portal | Key rotation; IP allowlist; scoped permissions | HIGH |
| T04 | Badge/MSR cloning | POS auth | Device binding; hash with salt | HIGH |
| T05 | JWT forgery | Token validation | RS256 signing; secret rotation | CRITICAL |

### Tampering (T) — Data Modification Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T06 | Order manipulation | POS data | Audit trail; void requires manager | HIGH |
| T07 | Inventory count fraud | Stock levels | Count locks; dual verification | MEDIUM |
| T08 | Price tampering | Menu items | Change logging; role restriction | HIGH |
| T09 | Timesheet fraud | Labor data | Manager approval; audit trail | MEDIUM |
| T10 | Audit log tampering | Security logs | Append-only; no DELETE permission | CRITICAL |

### Repudiation (R) — Action Denial Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T11 | Void denial | Refunds/voids | Immutable audit log; manager signature | HIGH |
| T12 | Cash drawer discrepancy | EOD reconciliation | Drawer open events logged | MEDIUM |
| T13 | Webhook delivery denial | Integrations | Delivery receipts; retry logs | MEDIUM |

### Information Disclosure (I) — Data Leak Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T14 | Cross-tenant data leak | Tenant isolation | Prisma query scoping; JWT tenantId | CRITICAL |
| T15 | IDOR (insecure direct object ref) | All resources | Object-level authorization checks | HIGH |
| T16 | Error message leakage | System internals | Generic errors; no stack in prod | MEDIUM |
| T17 | Log file exposure | Sensitive data | Log redaction; secure log storage | HIGH |
| T18 | Backup data exposure | All data | Encrypted backups; access controls | HIGH |

### Denial of Service (D) — Availability Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T19 | Rate limit bypass | API availability | Multiple rate limit layers | HIGH |
| T20 | Resource exhaustion | Reports/exports | Timeouts; queue limits; pagination | MEDIUM |
| T21 | Webhook flood | Ingress endpoints | Signature validation; rate limits | MEDIUM |
| T22 | SSE connection exhaustion | Real-time features | Max connections per user | MEDIUM |

### Elevation of Privilege (E) — Access Escalation Threats

| ID | Threat | Target | Mitigation | Severity |
|----|--------|--------|------------|----------|
| T23 | RBAC bypass | Authorization | Server-side guards; deny by default | CRITICAL |
| T24 | Branch escape | Multi-branch isolation | branchId in JWT; query scoping | HIGH |
| T25 | Self-privilege escalation | User management | Cannot modify own role/permissions | HIGH |

---

## E) Additional Specific Threats

### Multi-Tenancy Isolation

| ID | Threat | Attack Vector | Mitigation |
|----|--------|---------------|------------|
| T26 | Tenant ID manipulation | Modify tenantId in request | tenantId from JWT only; never from request body |
| T27 | Cross-tenant search | Enumerate other tenant data | All queries filtered by user.tenantId |
| T28 | Tenant confusion in cache | Shared Redis keys | Prefix all cache keys with tenantId |

### Webhook Security

| ID | Threat | Attack Vector | Mitigation |
|----|--------|---------------|------------|
| T29 | Webhook replay attack | Replay captured webhook | Timestamp validation; nonce tracking |
| T30 | Webhook SSRF | Malicious callback URL | URL allowlist; no internal IPs |
| T31 | Missing signature | Tampered payload | HMAC-SHA256 signature required |

### Session Security

| ID | Threat | Attack Vector | Mitigation |
|----|--------|---------------|------------|
| T32 | Session fixation | Attacker sets victim's session ID | Generate new session on login |
| T33 | Session persistence after logout | Token reuse | sessionVersion invalidation |
| T34 | Concurrent session abuse | Credential sharing | Session limit (5); device tracking |

### Input Validation

| ID | Threat | Attack Vector | Mitigation |
|----|--------|---------------|------------|
| T35 | SQL injection | Malicious query input | Prisma parameterized queries |
| T36 | NoSQL injection | JSON manipulation | Strict DTO validation |
| T37 | XSS (stored) | Feedback/notes fields | Output encoding; CSP |
| T38 | XSS (reflected) | URL parameters | Input sanitization; CSP |
| T39 | Path traversal | File upload/download | Basename extraction; allowlist |
| T40 | Command injection | Shell exec (if any) | Avoid shell; parameterize |

---

## F) Threat-to-Control Mapping

| Threat ID | Primary Control | Secondary Control | Test Required |
|-----------|-----------------|-------------------|---------------|
| T01 | Rate limiting | Account lockout | E2E lockout test |
| T02 | HttpOnly cookies | Session binding | Token inspection |
| T05 | RS256 JWT | Key rotation | Signature validation test |
| T14 | Prisma scoping | JWT tenantId | Cross-tenant E2E test |
| T15 | IDOR checks | Audit logging | IDOR E2E tests |
| T23 | RolesGuard | Deny by default | RBAC matrix test |
| T29 | Timestamp + nonce | Replay cache | Webhook replay E2E |
| T33 | sessionVersion | Logout handler | Session revocation E2E |
| T35 | Prisma ORM | DTO validation | SQL injection E2E |

---

## G) Risk Ratings

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| CRITICAL | Credential theft, tenant breach, payment fraud | Immediate fix |
| HIGH | Data leak, privilege escalation, RBAC bypass | Within 24h |
| MEDIUM | Availability impact, limited data exposure | Within 1 week |
| LOW | Informational, no direct impact | Next release |

---

## H) Review Schedule

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| Threat model update | Per major feature | Security Lead |
| Control verification | Per milestone | Dev Team |
| Penetration test | Quarterly | External |
| Dependency audit | Weekly (automated) | CI/CD |

---

## References

- [SECURITY_BASELINE_ASVS.md](SECURITY_BASELINE_ASVS.md)
- [SECURITY_CONTROL_MATRIX.md](SECURITY_CONTROL_MATRIX.md)
- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
