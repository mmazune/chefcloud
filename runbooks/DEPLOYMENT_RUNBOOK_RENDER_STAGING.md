# Render Staging Deployment Runbook

> Created: 2026-01-10 | Phase E3.2 — Render Staging Deployment

---

## Overview

This runbook provides step-by-step instructions for deploying ChefCloud staging environment on Render.

| Component | Render Service | URL Pattern |
|-----------|----------------|-------------|
| PostgreSQL | Managed Database | Internal connection |
| Redis | External (Upstash/Redis Cloud) | Connection string |
| API | Docker Web Service | `https://chefcloud-staging-api.onrender.com` |
| Web | Docker Web Service | `https://chefcloud-staging-web.onrender.com` |

---

## Prerequisites

### Required

- Render account (https://render.com)
- GitHub repo connected to Render
- Admin access to create services

### Optional

- Upstash account (for Redis)
- Sentry account (for error tracking)

---

## Step 1: Connect Repository

1. Log in to Render Dashboard
2. Go to **Blueprints** → **New Blueprint Instance**
3. Connect the GitHub repository: `mmazune/nimbuspos`
4. Select branch: `main`
5. Select blueprint file: `infra/render/render.yaml`

---

## Step 2: Configure Secrets

Before deploying, set required secrets in Render Dashboard:

### API Service Secrets

Navigate to **chefcloud-staging-api** → **Environment**

| Variable | How to Generate |
|----------|-----------------|
| `JWT_SECRET` | `openssl rand -base64 32` |
| `SENTRY_DSN` | (Optional) From Sentry project settings |
| `REDIS_URL` | (Optional) From Upstash/Redis Cloud |

> ⚠️ **NEVER** commit secrets to the repository.

---

## Step 3: Deploy

1. After configuring secrets, click **Apply** on the Blueprint
2. Render will:
   - Create PostgreSQL database
   - Build API Docker image
   - Build Web Docker image
   - Deploy services

3. Wait for all services to show **Live** status

### Expected Deploy Time

| Service | Approximate Time |
|---------|------------------|
| Database | 2-5 minutes |
| API | 5-10 minutes (Docker build) |
| Web | 5-10 minutes (Docker build) |

---

## Step 4: Run Database Migrations

**⚠️ IMPORTANT:** Migrations are NOT run automatically.

### Option A: Render Shell

1. Go to **chefcloud-staging-api** → **Shell**
2. Run:

```bash
npx prisma migrate deploy
```

### Option B: One-Off Job

1. Go to **Jobs** → **New Job**
2. Configure:
   - Command: `cd services/api && npx prisma migrate deploy`
   - Connect to database
3. Run job

### Expected Output

```
Prisma Migrate applied X migrations
```

---

## Step 5: Seed Demo Data (Optional)

> **⚠️ Demo Only:** This seeds test data for development/demo purposes.

In Render Shell:

```bash
npx prisma db seed
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.com` | `demo1234` |
| Manager | `manager@demo.com` | `demo1234` |
| Cashier | `cashier@demo.com` | `demo1234` |

See [SAMPLE_DATA_AND_SEEDS.md](../docs/overview/SAMPLE_DATA_AND_SEEDS.md) for complete list.

---

## Step 6: Verify Deployment

### 6.1 Manual Verification

| Check | URL | Expected |
|-------|-----|----------|
| Web UI | https://chefcloud-staging-web.onrender.com | Login page |
| API Health | https://chefcloud-staging-api.onrender.com/health | `{ "status": "ok" }` |
| API Version | https://chefcloud-staging-api.onrender.com/version | Version JSON |

### 6.2 Run Smoke Verification

From your local machine:

```bash
# Set the API URL to your Render staging API
API_BASE_URL=https://chefcloud-staging-api.onrender.com \
  node scripts/verify/smoke-verification.mjs
```

See [RENDER_STAGING_SMOKE.md](../docs/verification/RENDER_STAGING_SMOKE.md) for detailed smoke test guide.

---

## Step 7: Configure Custom Domains (Optional)

1. Go to service → **Settings** → **Custom Domains**
2. Add domain (e.g., `api.staging.chefcloud.io`)
3. Configure DNS as instructed
4. Update environment variables:
   - `CORS_ORIGINS` in API
   - `NEXT_PUBLIC_API_URL` in Web
   - `RP_ID` and `ORIGIN` in API (for WebAuthn)

---

## Monitoring

### Logs

- **Dashboard:** Service → **Logs**
- **Tail logs:** Available in real-time

### Metrics

- **Dashboard:** Service → **Metrics**
- CPU, Memory, Request count

### Alerts

Configure in **Settings** → **Notifications**:
- Deploy failures
- Health check failures
- High error rates

---

## Troubleshooting

### API Fails Health Check

1. Check logs: Service → **Logs**
2. Verify `JWT_SECRET` is set (min 32 chars)
3. Verify database connection
4. Check migrations ran successfully

### Web Shows Blank Page

1. Check browser console for errors
2. Verify `NEXT_PUBLIC_API_URL` points to correct API URL
3. Check API is healthy

### Database Connection Errors

1. Verify database is **Live** status
2. Check `DATABASE_URL` is auto-linked
3. Try restarting API service

### CORS Errors

1. Verify `CORS_ORIGINS` includes Web URL
2. Check for trailing slashes (remove them)
3. Redeploy API after changes

---

## Rollback

### Rollback to Previous Deploy

1. Go to service → **Events**
2. Find previous successful deploy
3. Click **Rollback**

### Manual Rollback

1. Revert commit in GitHub
2. Render auto-deploys on push

---

## Shutdown / Cleanup

### Suspend Services (Preserve Data)

1. Go to each service → **Settings**
2. Click **Suspend Service**

### Delete Services (Permanent)

1. Go to Blueprint → **Delete Instance**
2. Confirm deletion

> ⚠️ This deletes the database and all data permanently.

---

## Quick Reference

| Task | Location |
|------|----------|
| View logs | Service → Logs |
| Run shell | Service → Shell |
| Set env vars | Service → Environment |
| View metrics | Service → Metrics |
| Rollback | Service → Events → Rollback |
| Custom domain | Service → Settings → Custom Domains |

---

## Related Documentation

- [RENDER_ENV_SETUP.md](RENDER_ENV_SETUP.md) — Environment variable setup guide
- [RENDER_STAGING_SMOKE.md](../docs/verification/RENDER_STAGING_SMOKE.md) — Smoke verification guide
- [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) — Complete environment variable reference
- [infra/render/render.yaml](../infra/render/render.yaml) — Render Blueprint definition

---

*Phase E3.2 — Render Staging Deployment*
