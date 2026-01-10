# Render Environment Variable Setup

> Created: 2026-01-10 | Phase E3.2 — Render Staging Deployment

---

## Overview

This document specifies which environment variables go where in Render Dashboard. Use [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) as the authoritative reference.

---

## API Service: `chefcloud-staging-api`

Navigate to: **Dashboard** → **chefcloud-staging-api** → **Environment**

### Required Secrets (Set Manually)

| Variable | Value | How to Get |
|----------|-------|------------|
| `JWT_SECRET` | (min 32 chars) | `openssl rand -base64 32` |

### Auto-Configured (from Blueprint)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | (linked) | Auto-linked to managed Postgres |
| `NODE_ENV` | `staging` | From render.yaml |
| `PORT` | `3001` | From render.yaml |
| `DEVPORTAL_ENABLED` | `0` | Disabled by default |
| `DOCS_ENABLED` | `0` | Swagger disabled |
| `METRICS_ENABLED` | `0` | Metrics disabled |
| `LOG_LEVEL` | `info` | Standard logging |
| `LOG_SILENCE_HEALTH` | `1` | Reduce noise |
| `DEMO_PROTECT_WRITES` | `0` | Allow writes |

### Optional (Set Manually if Needed)

| Variable | Purpose | When to Set |
|----------|---------|-------------|
| `REDIS_URL` | External Redis | If using Upstash/Redis Cloud |
| `SENTRY_DSN` | Error tracking | If using Sentry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Tracing | If using OpenTelemetry |

### WebAuthn (Auto-Configured)

| Variable | Value | Notes |
|----------|-------|-------|
| `RP_ID` | `chefcloud-staging-web.onrender.com` | Must match web domain |
| `ORIGIN` | `https://chefcloud-staging-web.onrender.com` | Full URL |

### CORS (Auto-Configured)

| Variable | Value |
|----------|-------|
| `CORS_ORIGINS` | `https://chefcloud-staging-web.onrender.com` |

> **Note:** Update these if using custom domains.

---

## Web Service: `chefcloud-staging-web`

Navigate to: **Dashboard** → **chefcloud-staging-web** → **Environment**

### Auto-Configured (from Blueprint)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Next.js production mode |
| `PORT` | `3000` | Standard port |
| `NEXT_PUBLIC_API_URL` | `https://chefcloud-staging-api.onrender.com` | API URL |
| `NEXT_PUBLIC_APP_VERSION` | `staging` | Version indicator |

### Optional (Set Manually if Needed)

| Variable | Purpose | When to Set |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT` | Session timeout | If needed |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | Timeout duration | If timeout enabled |
| `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK` | Demo mode | For testing |

---

## Database: `chefcloud-staging-db`

Navigate to: **Dashboard** → **chefcloud-staging-db** → **Info**

### Connection String

The connection string is automatically linked to the API service via `DATABASE_URL`.

| Property | Auto-Available |
|----------|----------------|
| Host | Yes |
| Port | Yes |
| Database | `chefcloud_staging` |
| User | `chefcloud` |
| Password | Yes (hidden) |

---

## Secrets Checklist

Before first deployment, ensure these are set in Render Dashboard:

- [ ] `JWT_SECRET` — API service (min 32 chars)

Optional but recommended:
- [ ] `SENTRY_DSN` — API service (error tracking)
- [ ] `REDIS_URL` — API service (if using external Redis)

---

## Custom Domain Updates

If adding custom domains (e.g., `api.staging.chefcloud.io`), update:

### API Service

| Variable | New Value |
|----------|-----------|
| `CORS_ORIGINS` | `https://staging.chefcloud.io` |
| `RP_ID` | `staging.chefcloud.io` |
| `ORIGIN` | `https://staging.chefcloud.io` |

### Web Service

| Variable | New Value |
|----------|-----------|
| `NEXT_PUBLIC_API_URL` | `https://api.staging.chefcloud.io` |

---

## Environment Sync Workflow

1. **Blueprint deploy:** Auto-sets hardcoded values
2. **Manual secrets:** Set in Dashboard before deploy
3. **Custom domains:** Update values after domain verification
4. **Redeploy:** Trigger manual deploy after env changes

---

## Verification

After setting all variables:

1. Check API health:
```bash
curl https://chefcloud-staging-api.onrender.com/health
```

2. Check API version:
```bash
curl https://chefcloud-staging-api.onrender.com/version
```

3. Run smoke test:
```bash
API_BASE_URL=https://chefcloud-staging-api.onrender.com \
  node scripts/verify/smoke-verification.mjs
```

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_RENDER_STAGING.md](DEPLOYMENT_RUNBOOK_RENDER_STAGING.md) — Full deployment runbook
- [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) — Complete variable reference
- [infra/render/render.yaml](../infra/render/render.yaml) — Blueprint definition

---

*Phase E3.2 — Render Staging Deployment*
