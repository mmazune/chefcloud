# Production Environment Matrix

> Created: 2026-01-10 | Phase F1 — Production Readiness

---

## Overview

This document defines environment variables for **production** deployments. Variables are categorized as Required, Recommended, or Optional with production-specific defaults.

**Source Reference:** [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) (complete variable catalog)

---

## Production Defaults Summary

| Category | Default Policy |
|----------|---------------|
| Feature Flags | **OFF** by default (DEVPORTAL, DOCS, METRICS) |
| Logging | `info` level, no pretty printing |
| Security | Strict CORS, rate limiting enabled |
| Observability | Sentry recommended, health checks on |

---

## API Environment Variables

### Critical (Required)

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `DATABASE_URL` | **Yes** | Provider-managed | Never commit; use secrets |
| `JWT_SECRET` | **Yes** | 32+ chars | Generate with `openssl rand -base64 32` |
| `NODE_ENV` | **Yes** | `production` | Disables debug features |
| `PORT` | No | `3001` | Provider may override |

### Security (Required for Production)

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `CORS_ORIGINS` | **Recommended** | `https://app.chefcloud.io` | Explicit origins only |
| `RP_ID` | **Recommended** | `app.chefcloud.io` | WebAuthn relying party |
| `ORIGIN` | **Recommended** | `https://app.chefcloud.io` | WebAuthn origin |
| `RATE_LIMIT_PUBLIC` | No | `60` | Requests per minute |

### Database & Cache

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `REDIS_URL` | Optional | Provider URL | For caching/sessions |
| `REDIS_REQUIRED` | No | `0` | Set `1` if Redis critical |

### Feature Flags (Production Defaults: OFF)

| Variable | Production Default | Recommended | Notes |
|----------|-------------------|-------------|-------|
| `DEVPORTAL_ENABLED` | `0` | **Keep 0** | Enable only for API consumers |
| `DOCS_ENABLED` | `0` | **Keep 0** | Never expose in production |
| `METRICS_ENABLED` | `0` | **Keep 0** | Unless Prometheus configured |
| `DEMO_PROTECT_WRITES` | `0` | Set `1` if demo org exists | Protects demo data |

### Observability (Recommended)

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `SENTRY_DSN` | **Recommended** | Project DSN | Error tracking |
| `LOG_LEVEL` | No | `info` | Use `warn` for quieter logs |
| `PRETTY_LOGS` | No | `0` | Always 0 in production |
| `LOG_SILENCE_HEALTH` | No | `1` | Reduce log noise |
| `LOG_SILENCE_METRICS` | No | `1` | Reduce log noise |
| `ERROR_INCLUDE_STACKS` | No | `0` | Never expose stacks |

### Build Metadata

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `BUILD_VERSION` | Recommended | `1.0.0` | Semantic version |
| `BUILD_SHA` | Recommended | Git SHA | Set at build time |
| `BUILD_DATE` | No | ISO timestamp | Set at build time |

### Integration (Optional)

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `WH_SECRET` | If webhooks | Generated secret | For webhook signing |
| `WH_SECRET_REQUIRED` | No | `1` | Require webhook signatures |

---

## Web Environment Variables

### Critical (Required)

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://api.chefcloud.io` | Build-time variable |

### Session Security

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT` | Recommended | `1` | Enable session timeout |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | No | `15` | Timeout duration |
| `NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES` | No | `2` | Warning before logout |

### Build Metadata

| Variable | Required | Production Value | Notes |
|----------|----------|------------------|-------|
| `NEXT_PUBLIC_APP_VERSION` | Recommended | `1.0.0` | Display version |

### Demo Features (Disable in Production)

| Variable | Production Value | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK` | `false` | No demo fallbacks |

---

## Production Environment Template

### API (.env.production)

```bash
# ========================================
# PRODUCTION ENVIRONMENT TEMPLATE
# ========================================
# DO NOT COMMIT ACTUAL VALUES
# Use provider secrets management
# ========================================

# === CRITICAL (Required) ===
NODE_ENV=production
# DATABASE_URL=<from-provider-secrets>
# JWT_SECRET=<from-provider-secrets>

# === SECURITY ===
CORS_ORIGINS=https://app.chefcloud.io
RP_ID=app.chefcloud.io
ORIGIN=https://app.chefcloud.io
RATE_LIMIT_PUBLIC=60

# === FEATURE FLAGS (ALL OFF) ===
DEVPORTAL_ENABLED=0
DOCS_ENABLED=0
METRICS_ENABLED=0
DEMO_PROTECT_WRITES=1

# === OBSERVABILITY ===
LOG_LEVEL=info
PRETTY_LOGS=0
LOG_SILENCE_HEALTH=1
LOG_SILENCE_METRICS=1
ERROR_INCLUDE_STACKS=0
# SENTRY_DSN=<from-provider-secrets>

# === BUILD METADATA ===
# BUILD_VERSION=<set-at-build-time>
# BUILD_SHA=<set-at-build-time>

# === INTEGRATIONS ===
# WH_SECRET=<from-provider-secrets>
WH_SECRET_REQUIRED=1

# === CACHE (Optional) ===
# REDIS_URL=<from-provider-secrets>
REDIS_REQUIRED=0
```

### Web (Build Args)

```bash
# Web environment (build-time)
NEXT_PUBLIC_API_URL=https://api.chefcloud.io
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false
NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT=1
NEXT_PUBLIC_SESSION_IDLE_MINUTES=15
```

---

## Secrets Management

### Never Commit These

| Secret | Why |
|--------|-----|
| `DATABASE_URL` | Database credentials |
| `JWT_SECRET` | Token signing key |
| `REDIS_URL` | Cache credentials |
| `SENTRY_DSN` | Project identifier |
| `WH_SECRET` | Webhook signing |

### Provider Secrets Configuration

**Render:**
```
Dashboard → Service → Environment → Add Environment Variable
```

**Fly.io:**
```bash
fly secrets set JWT_SECRET="..." DATABASE_URL="..." -a chefcloud-prod-api
```

**Docker (Self-hosted):**
```bash
# Use Docker secrets or external secrets manager
docker secret create jwt_secret ./jwt_secret.txt
```

---

## Validation Checklist

Before deploying to production, verify:

- [ ] `NODE_ENV=production` is set
- [ ] `DATABASE_URL` is set via secrets (not in code)
- [ ] `JWT_SECRET` is 32+ characters
- [ ] `CORS_ORIGINS` is set to production domain(s)
- [ ] `DEVPORTAL_ENABLED=0`
- [ ] `DOCS_ENABLED=0`
- [ ] `METRICS_ENABLED=0` (unless Prometheus configured)
- [ ] `ERROR_INCLUDE_STACKS=0`
- [ ] `SENTRY_DSN` is configured (recommended)
- [ ] No secrets in codebase or logs

---

## Environment Parity

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | development | staging | production |
| `DOCS_ENABLED` | 1 | 0 | 0 |
| `DEVPORTAL_ENABLED` | 1 | 0 | 0 |
| `PRETTY_LOGS` | 1 | 0 | 0 |
| `ERROR_INCLUDE_STACKS` | 1 | 0 | 0 |
| `CORS_ORIGINS` | * | staging domain | prod domain |

---

*This document is part of Phase F1 Production Readiness. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
