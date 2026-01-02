# CheatSheetSeries MAP

> **Repository:** https://github.com/OWASP/CheatSheetSeries  
> **License:** ✅ CC-BY-4.0 (use with attribution)  
> **Domain:** Security Reference  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

OWASP security cheat sheets. Best reference for:
- Security best practices by topic
- Implementation guidance
- Vulnerability prevention
- Secure coding patterns
- Authentication/authorization
- Input validation
- Session management

---

## (ii) Content Type

| Type | Format |
|------|--------|
| Cheat Sheets | Markdown |
| Language | English |
| Updates | Community-maintained |

---

## (iii) High-Level Directory Map

```
CheatSheetSeries/
├── cheatsheets/
│   ├── Access_Control_Cheat_Sheet.md
│   ├── Authentication_Cheat_Sheet.md
│   ├── Authorization_Cheat_Sheet.md
│   ├── Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md
│   ├── Cross_Site_Scripting_Prevention_Cheat_Sheet.md
│   ├── Input_Validation_Cheat_Sheet.md
│   ├── Password_Storage_Cheat_Sheet.md
│   ├── REST_Security_Cheat_Sheet.md
│   ├── Session_Management_Cheat_Sheet.md
│   ├── SQL_Injection_Prevention_Cheat_Sheet.md
│   └── ... (80+ cheat sheets)
├── assets/
│   └── images/
└── IndexASVS.md
```

---

## (iv) Where the "Important Stuff" Lives

| Topic | Path |
|-------|------|
| Authentication | `cheatsheets/Authentication_Cheat_Sheet.md` |
| Authorization | `cheatsheets/Authorization_Cheat_Sheet.md` |
| Session Mgmt | `cheatsheets/Session_Management_Cheat_Sheet.md` |
| Password Storage | `cheatsheets/Password_Storage_Cheat_Sheet.md` |
| Input Validation | `cheatsheets/Input_Validation_Cheat_Sheet.md` |
| XSS Prevention | `cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.md` |
| CSRF Prevention | `cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.md` |
| SQL Injection | `cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.md` |
| REST Security | `cheatsheets/REST_Security_Cheat_Sheet.md` |
| JWT Security | `cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.md` |

---

## (v) Key Topics by Nimbus Feature

### Authentication (auth/, webauthn/)
- Multi-factor authentication guidance
- Password requirements
- Account lockout policies
- Credential storage (bcrypt, argon2)

### Session Management (auth/)
- Session ID generation
- Session timeout
- Secure cookie attributes
- Session fixation prevention

### Authorization (access/)
- Role-based access control
- Attribute-based access control
- Principle of least privilege

### API Security (all endpoints)
- REST security headers
- Rate limiting
- Input validation
- Output encoding

---

## (vi) What We Can Adapt

**✅ CC-BY-4.0 = Use with attribution**

- Apply all recommendations directly
- Reference in security documentation
- Use as checklist for code review

---

## (vii) What Nimbus Should Learn

1. **Password hashing** — Use bcrypt/argon2 with proper work factors

2. **Session security** — HttpOnly, Secure, SameSite cookies

3. **CSRF tokens** — Double-submit or synchronizer tokens

4. **XSS prevention** — Context-aware output encoding

5. **SQL injection** — Parameterized queries always

6. **Input validation** — Allowlist validation, length limits

7. **Error handling** — Don't leak sensitive info in errors

8. **Logging security** — What to log, what NOT to log

9. **Rate limiting** — Prevent brute force

10. **Security headers** — CSP, HSTS, X-Frame-Options

11. **JWT best practices** — Signing, expiration, claims

12. **WebAuthn/Passkeys** — Modern authentication
