# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: [security contact to be added]

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Assessment within 7 days
- Status updates every 7 days
- Public disclosure once fixed (coordinated)

## Security Best Practices

### For Users

1. **Keep software updated**: Always use the latest stable version
2. **Use strong passwords**: Enable MFA for all admin accounts
3. **Network security**: Run POS terminals on isolated networks
4. **Backup regularly**: Enable automated backups
5. **Audit logs**: Review audit events regularly

### For Developers

1. **No secrets in code**: Use environment variables
2. **Input validation**: Validate all user inputs
3. **E2E test bypasses**: Only set `E2E_AUTH_BYPASS` and `E2E_ADMIN_BYPASS` in test setup files (`test/jest-e2e.setup.ts`), never in production config or CI global environment variables
3. **E2E test bypasses**: Only set `E2E_AUTH_BYPASS` and `E2E_ADMIN_BYPASS` in test setup files, never in production config or CI global env
3. **SQL injection**: Use Prisma parameterized queries
4. **XSS prevention**: Sanitize outputs
5. **Authentication**: Enforce MFA for sensitive operations
6. **Authorization**: Use RBAC/ABAC checks
7. **Encryption**: Use TLS for all network traffic
8. **Dependencies**: Keep dependencies updated
9. **Code review**: All PRs require review
10. **Security scanning**: CI runs security checks

## Compliance

ChefCloud follows:
- OWASP Top 10 guidelines
- Uganda Data Protection Act requirements
- PCI DSS recommendations for payment handling
- Audit trail requirements for financial systems

## Incident Response

In case of a security incident:

1. **Isolate**: Immediately isolate affected systems
2. **Report**: Contact security team
3. **Document**: Record all incident details
4. **Remediate**: Apply fixes
5. **Review**: Post-incident analysis
6. **Communicate**: Inform affected users (if applicable)

## Security Features

- **RBAC/ABAC**: Role and attribute-based access control
- **Audit Logs**: Immutable audit trail for all sensitive actions
- **MFA**: Multi-factor authentication for managers and above
- **Device Registration**: Trusted device attestation
- **Encryption**: Data at rest and in transit
- **Session Management**: Secure token-based sessions
- **Rate Limiting**: API rate limiting (planned)

Thank you for helping keep ChefCloud secure!
