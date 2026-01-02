# juice-shop MAP

> **Repository:** https://github.com/juice-shop/juice-shop  
> **License:** ✅ MIT (adaptation allowed with attribution)  
> **Domain:** Security Testing / Learning  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Intentionally vulnerable web application. Best reference for:
- Understanding common vulnerabilities
- Security testing practice
- OWASP Top 10 examples
- How NOT to code (anti-patterns)
- Security awareness training

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js / Express |
| Frontend | Angular |
| Database | SQLite |
| Auth | JWT |
| Build | npm |

---

## (iii) High-Level Directory Map

```
juice-shop/
├── frontend/
│   └── src/app/           # Angular components
├── routes/                # Express routes (vulnerable!)
├── models/                # Data models
├── lib/                   # Utilities
├── data/                  # Static data
├── test/
│   └── api/               # API tests
└── config/                # Challenge configs
```

---

## (iv) Vulnerability Categories

| Category | Example Path |
|----------|--------------|
| SQL Injection | `routes/login.ts` |
| XSS | `routes/search.ts` |
| Broken Auth | `routes/login.ts` |
| Sensitive Data | `routes/order.ts` |
| Broken Access | `routes/basket.ts` |
| Security Misconfig | `server.ts` |
| Insecure Deserialization | Various |
| SSRF | `routes/redirect.ts` |

---

## (v) How Nimbus Should Use This

### 1. As Anti-Pattern Reference
Look at vulnerable code → understand what NOT to do → verify Nimbus doesn't have similar patterns.

### 2. Security Testing Practice
- Run juice-shop locally
- Practice exploitation
- Build muscle memory for security review

### 3. Code Review Checklist
For each vulnerability type, create a "what to look for" checklist.

---

## (vi) What We Can Adapt

**✅ MIT = Learning and testing patterns can be adapted**

- Test case patterns
- Challenge structure for security training
- Vulnerability detection techniques

**DO NOT adapt the vulnerable code itself.**

---

## (vii) What Nimbus Should Learn

1. **SQL Injection patterns** — What makes code injectable

2. **XSS vectors** — Where user input reflects unsafely

3. **Broken authentication** — Weak session handling

4. **IDOR vulnerabilities** — Insecure direct object references

5. **Path traversal** — File access outside intended directory

6. **SSRF patterns** — When URLs from user input are fetched

7. **Sensitive data exposure** — Debug info, stack traces

8. **Broken access control** — Missing authorization checks

9. **Security misconfiguration** — Verbose errors, default creds

10. **Cryptographic failures** — Weak algorithms, hardcoded keys

11. **Rate limiting absence** — No brute force protection

12. **Logging failures** — No security event logging
