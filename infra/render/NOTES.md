# Render Infrastructure Notes

> Created: 2026-01-10 | Phase E3.2 — Render Staging Deployment

---

## Overview

This folder contains Render-specific infrastructure definitions for ChefCloud staging.

---

## Files

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint (Infrastructure as Code) |
| `NOTES.md` | This file — deployment notes |

---

## Service Definitions

### PostgreSQL Database

| Setting | Value |
|---------|-------|
| Name | `chefcloud-staging-db` |
| Plan | `starter` (upgrade for production) |
| Version | PostgreSQL 16 |
| Region | Oregon |

### API Service

| Setting | Value |
|---------|-------|
| Name | `chefcloud-staging-api` |
| Runtime | Docker |
| Dockerfile | `./services/api/Dockerfile` |
| Health Check | `GET /health` |
| Port | 3001 |

### Web Service

| Setting | Value |
|---------|-------|
| Name | `chefcloud-staging-web` |
| Runtime | Docker |
| Dockerfile | `./apps/web/Dockerfile` |
| Health Check | `GET /` |
| Port | 3000 |

---

## Health Checks

Render uses health checks for:
- **Readiness:** Determines when service is ready to receive traffic
- **Liveness:** Determines if service should be restarted

### API Health Check

```
GET /health
Expected: 200 OK with body { "status": "ok" }
```

### Web Health Check

```
GET /
Expected: 200 OK (login page renders)
```

---

## Start Commands

### API

```bash
node dist/src/main
```

The Dockerfile CMD handles this automatically.

### Web

```bash
pnpm start
```

The Dockerfile CMD handles this automatically.

---

## Ports

| Service | Internal Port | Notes |
|---------|---------------|-------|
| API | 3001 | Exposed via Render |
| Web | 3000 | Exposed via Render |

Render automatically provisions HTTPS and routes traffic to internal ports.

---

## Environment Variables

### Required Secrets (Set in Render Dashboard)

These must be set manually in Render Dashboard — **never commit secrets**:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key (min 32 chars) |
| `SENTRY_DSN` | (Optional) Error tracking |
| `REDIS_URL` | (Optional) External Redis URL |

### Auto-Configured

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Linked from managed PostgreSQL |

### Hardcoded in Blueprint

See `render.yaml` for complete list. Key defaults:
- `DEVPORTAL_ENABLED=0`
- `DOCS_ENABLED=0`
- `NODE_ENV=staging`

---

## Redis Considerations

Render managed Redis requires Team/Organization plan. Alternatives:

1. **Upstash** — Serverless Redis (free tier available)
2. **Redis Cloud** — Managed Redis
3. **Skip Redis** — Works without, but no caching/rate limiting persistence

If using external Redis, set `REDIS_URL` in Render Dashboard.

---

## Migrations

Migrations are **NOT** run automatically. After deployment:

```bash
# Option 1: Render Shell (Dashboard > Service > Shell)
npx prisma migrate deploy

# Option 2: One-off job
# Create a Render job with command:
cd services/api && npx prisma migrate deploy
```

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_RENDER_STAGING.md](../../runbooks/DEPLOYMENT_RUNBOOK_RENDER_STAGING.md)
- [RENDER_ENV_SETUP.md](../../runbooks/RENDER_ENV_SETUP.md)
- [ENV_PARITY_MATRIX.md](../../docs/runbooks/ENV_PARITY_MATRIX.md)

---

*Phase E3.2 — Render Staging Deployment*
