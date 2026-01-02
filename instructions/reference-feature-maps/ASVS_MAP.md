# ASVS MAP

> **Repository:** https://github.com/OWASP/ASVS  
> **License:** ✅ CC-BY-4.0 (use with attribution)  
> **Domain:** Security Verification Standard  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Application Security Verification Standard. Best reference for:
- Security requirements checklist
- Verification levels (L1, L2, L3)
- Compliance verification
- Security testing guidance
- Audit preparation

---

## (ii) Content Type

| Type | Format |
|------|--------|
| Standard | Markdown / PDF / Excel |
| Levels | L1 (Opportunistic), L2 (Standard), L3 (Advanced) |
| Chapters | 14 verification categories |

---

## (iii) High-Level Directory Map

```
ASVS/
├── 5.0/
│   ├── en/
│   │   ├── 0x00-Header.md
│   │   ├── 0x01-Frontispiece.md
│   │   ├── V1-Architecture.md
│   │   ├── V2-Authentication.md
│   │   ├── V3-Session-Management.md
│   │   ├── V4-Access-Control.md
│   │   ├── V5-Validation-Sanitization-Encoding.md
│   │   ├── V6-Stored-Cryptography.md
│   │   ├── V7-Error-Logging.md
│   │   ├── V8-Data-Protection.md
│   │   ├── V9-Communications.md
│   │   ├── V10-Malicious-Code.md
│   │   ├── V11-Business-Logic.md
│   │   ├── V12-Files-Resources.md
│   │   ├── V13-API-Web-Service.md
│   │   └── V14-Configuration.md
│   └── OWASP ASVS 5.0.xlsx
└── 4.0/                     # Previous version
```

---

## (iv) Key Verification Categories

| Chapter | Topic | Nimbus Relevance |
|---------|-------|------------------|
| V1 | Architecture | Multi-tenant isolation |
| V2 | Authentication | Login, MFA, WebAuthn |
| V3 | Session Management | JWT, sessions |
| V4 | Access Control | RBAC, permissions |
| V5 | Validation/Encoding | Input validation |
| V7 | Error/Logging | Audit logs |
| V8 | Data Protection | PII handling |
| V9 | Communications | TLS, certificates |
| V11 | Business Logic | Order flow security |
| V13 | API Security | REST endpoints |
| V14 | Configuration | Secure defaults |

---

## (v) Verification Levels

### Level 1 (L1) — Opportunistic
- Minimum security baseline
- Protection against common vulnerabilities
- Suitable for low-risk applications

### Level 2 (L2) — Standard
- Most applications should target this
- Protection against skilled attackers
- Includes L1 + additional controls

### Level 3 (L3) — Advanced
- High-value applications
- Protection against advanced persistent threats
- Military, healthcare, financial

**Nimbus target: L2 for production**

---

## (vi) What We Can Adapt

**✅ CC-BY-4.0 = Use with attribution**

- Use as security requirements checklist
- Reference in security design documents
- Verify compliance in code review

---

## (vii) What Nimbus Should Learn

1. **L2 baseline** — Target L2 requirements for production

2. **Authentication requirements**:
   - Password complexity rules
   - Multi-factor for admins
   - Credential rotation

3. **Session requirements**:
   - Timeout policies
   - Concurrent session limits
   - Session invalidation on privilege change

4. **Access control requirements**:
   - Deny by default
   - Attribute-based decisions
   - Audit logging of access

5. **Validation requirements**:
   - Server-side validation
   - Parameterized queries
   - Context-aware encoding

6. **Logging requirements**:
   - Security event logging
   - Log integrity protection
   - PII redaction in logs

7. **Data protection requirements**:
   - Encryption at rest
   - Encryption in transit
   - Key management

8. **API requirements**:
   - Rate limiting
   - Schema validation
   - Authentication on all endpoints

9. **Configuration requirements**:
   - Secure defaults
   - Remove debug in production
   - Disable unused features

10. **Business logic requirements**:
    - Transaction integrity
    - Anti-automation controls
    - Idempotency
