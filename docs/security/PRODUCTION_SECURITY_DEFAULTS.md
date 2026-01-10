# Production Security Defaults

> Created: 2026-01-10 | Phase F1 — Production Readiness

---

## Overview

This document defines security defaults and policies for production deployments of ChefCloud. All settings prioritize security-by-default.

**Related Documentation:**
- [PRODUCTION_ENV_MATRIX.md](../../runbooks/PRODUCTION_ENV_MATRIX.md) — Environment configuration
- [PRODUCTION_RELEASE_RUNBOOK.md](../../runbooks/PRODUCTION_RELEASE_RUNBOOK.md) — Release procedures

---

## Core Security Principles

1. **Deny by default** — Features are disabled unless explicitly enabled
2. **Secrets never in code** — All secrets via environment/secrets manager
3. **Minimal exposure** — Only expose what's needed
4. **Defense in depth** — Multiple layers of protection

---

## Feature Flag Defaults

### Production Policy: OFF by Default

| Flag | Default | Policy |
|------|---------|--------|
| `DEVPORTAL_ENABLED` | `0` | **OFF** unless actively needed for API consumers |
| `DOCS_ENABLED` | `0` | **OFF** — never expose Swagger in production |
| `METRICS_ENABLED` | `0` | **OFF** unless Prometheus/Grafana configured |

### DevPortal Policy

The Developer Portal (`/dev/*` routes) provides API key management and sandbox access.

**When to enable:**
- You have external API consumers who need self-service key management
- You have implemented proper rate limiting on DevPortal endpoints
- Only OWNER role users should access DevPortal

**How to enable (if needed):**
```bash
# Only if absolutely necessary
fly secrets set DEVPORTAL_ENABLED=1 -a chefcloud-prod-api

# Verify access is properly restricted
# DevPortal routes require OWNER role
```

**Risks if enabled:**
- API key enumeration if not properly secured
- Increased attack surface

### Documentation Policy

**DOCS_ENABLED must remain 0 in production.**

Swagger documentation exposes:
- All API endpoints
- Request/response schemas
- Authentication requirements

For production API documentation, use:
- External documentation site
- API reference hosted separately
- Postman collections (shared privately)

---

## CORS Configuration

### Production CORS Policy

```bash
# Explicit allowed origins only
CORS_ORIGINS=https://app.chefcloud.io
```

### Multi-Domain Configuration

If multiple domains need access:
```bash
CORS_ORIGINS=https://app.chefcloud.io,https://admin.chefcloud.io
```

### CORS Best Practices

| Setting | Production Value | Notes |
|---------|------------------|-------|
| Allowed Origins | Explicit list | Never use `*` |
| Credentials | Allowed | For cookie-based auth |
| Methods | GET, POST, PUT, PATCH, DELETE, OPTIONS | Standard REST |
| Headers | Authorization, Content-Type | Only what's needed |

### CORS Verification

```bash
# Test CORS headers
curl -I -X OPTIONS https://api.chefcloud.io/health \
  -H "Origin: https://app.chefcloud.io" \
  -H "Access-Control-Request-Method: GET"

# Expected:
# Access-Control-Allow-Origin: https://app.chefcloud.io
# Access-Control-Allow-Methods: GET, POST, ...
```

---

## Rate Limiting

### Default Configuration

| Endpoint Type | Default Limit | Variable |
|---------------|---------------|----------|
| Public endpoints | 60/min | `RATE_LIMIT_PUBLIC` |
| Authenticated | Higher (per-user) | Built-in |
| Login attempts | 5/min per IP | Built-in |

### Rate Limit Tuning

```bash
# Adjust public rate limit
RATE_LIMIT_PUBLIC=100  # For higher traffic
```

### DDoS Protection

In addition to application-level rate limiting:
- Use provider-level DDoS protection (Cloudflare, AWS Shield)
- Configure WAF rules for API endpoints
- Monitor for unusual traffic patterns

---

## Authentication Security

### JWT Configuration

| Setting | Production Value | Notes |
|---------|------------------|-------|
| `JWT_SECRET` | 32+ characters | Generated with `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | `7d` | Adjust based on security requirements |

### JWT Rotation

See [PRODUCTION_RELEASE_RUNBOOK.md](../../runbooks/PRODUCTION_RELEASE_RUNBOOK.md#jwt_secret-rotation-procedure) for rotation procedure.

### Session Security

| Setting | Production Value | Notes |
|---------|------------------|-------|
| `NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT` | `1` | Enable session timeout |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | `15` | Timeout after 15 min idle |

---

## Secrets Management

### Never Commit

These values must NEVER appear in:
- Source code
- Git history
- Docker images
- Log files
- Error messages

| Secret | How to Protect |
|--------|----------------|
| `DATABASE_URL` | Provider secrets only |
| `JWT_SECRET` | Provider secrets only |
| `REDIS_URL` | Provider secrets only |
| `SENTRY_DSN` | Provider secrets only |
| `WH_SECRET` | Provider secrets only |

### Secret Patterns to Avoid

```bash
# ❌ NEVER DO THIS
DATABASE_URL=postgresql://user:password@host:5432/db  # In .env committed to git
JWT_SECRET=my-secret-key  # In docker-compose.yml

# ✅ CORRECT
# Set via provider secrets management
fly secrets set DATABASE_URL="..." -a chefcloud-prod-api
```

### Secret Scanning

The CI pipeline should fail if obvious secret patterns are detected:
- API keys (sk_live_*, pk_live_*)
- Connection strings with credentials
- JWT tokens
- Private keys

---

## Error Handling

### Production Error Policy

| Setting | Value | Reason |
|---------|-------|--------|
| `ERROR_INCLUDE_STACKS` | `0` | Never expose stack traces |
| `NODE_ENV` | `production` | Disables debug features |
| `PRETTY_LOGS` | `0` | Structured JSON for log aggregation |

### Error Response Format

Production errors should return:
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

Never include:
- Stack traces
- File paths
- Internal variable names
- Database queries

---

## Logging Security

### Log Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| `LOG_LEVEL` | `info` or `warn` | Balance detail vs volume |
| `LOG_SILENCE_HEALTH` | `1` | Reduce noise |
| `LOG_SILENCE_METRICS` | `1` | Reduce noise |

### What NOT to Log

- Passwords (even hashed)
- JWT tokens
- API keys
- Credit card numbers
- Personal data (PII)

### Log Retention

- Retain logs for 30-90 days
- Archive to cold storage for compliance
- Ensure logs are encrypted at rest

---

## WebAuthn Configuration

For passwordless authentication:

| Setting | Production Value |
|---------|------------------|
| `RP_ID` | `app.chefcloud.io` (your domain) |
| `ORIGIN` | `https://app.chefcloud.io` |

**Important:** These must match your production domain exactly.

---

## Webhook Security

If using webhooks:

| Setting | Value | Reason |
|---------|-------|--------|
| `WH_SECRET` | Generated secret | Sign webhook payloads |
| `WH_SECRET_REQUIRED` | `1` | Reject unsigned webhooks |

### Webhook Signature Verification

All incoming webhooks must:
1. Include signature header
2. Be verified against `WH_SECRET`
3. Be rejected if signature invalid

---

## Security Checklist

### Pre-Production Verification

- [ ] `NODE_ENV=production`
- [ ] `DEVPORTAL_ENABLED=0`
- [ ] `DOCS_ENABLED=0`
- [ ] `METRICS_ENABLED=0`
- [ ] `ERROR_INCLUDE_STACKS=0`
- [ ] `CORS_ORIGINS` set to explicit domains (no `*`)
- [ ] `JWT_SECRET` is 32+ characters
- [ ] All secrets stored in provider secrets manager
- [ ] No secrets in Git history
- [ ] Session timeout enabled
- [ ] Rate limiting configured
- [ ] Sentry configured for error tracking

### Periodic Security Review

Monthly:
- [ ] Review access logs for anomalies
- [ ] Check for failed login patterns
- [ ] Verify feature flags still appropriate
- [ ] Review API key usage

Quarterly:
- [ ] Rotate `JWT_SECRET`
- [ ] Review CORS configuration
- [ ] Audit user permissions
- [ ] Update dependencies for security patches

---

## Incident Response

### Security Incident Types

| Type | Severity | Response |
|------|----------|----------|
| Credential leak | P1 | Immediate rotation |
| Unauthorized access | P1 | Investigate + block |
| DDoS attack | P2 | Enable protection |
| Vulnerability found | P2-P3 | Assess + patch |

### Immediate Actions for Credential Leak

1. **Rotate all potentially exposed secrets**
   ```bash
   fly secrets set JWT_SECRET="$(openssl rand -base64 32)" -a chefcloud-prod-api
   ```

2. **Invalidate active sessions** (if JWT_SECRET leaked)

3. **Check for unauthorized access** in logs

4. **Notify affected users** if data exposed

5. **Document and report** per compliance requirements

---

*This document is part of Phase F1 Production Readiness. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
