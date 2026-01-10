# Fly.io Staging Deployment Runbook

> Created: 2026-01-10 | Phase E3.3 — Fly.io Staging Deployment

---

## Overview

This runbook provides step-by-step instructions for deploying ChefCloud staging environment on Fly.io.

| Component | Fly App | URL Pattern |
|-----------|---------|-------------|
| PostgreSQL | Fly Postgres | Internal connection |
| Redis | Upstash (external) | Connection string |
| API | `chefcloud-staging-api` | `https://chefcloud-staging-api.fly.dev` |
| Web | `chefcloud-staging-web` | `https://chefcloud-staging-web.fly.dev` |

---

## Prerequisites

### Required

- Fly.io account (https://fly.io)
- `flyctl` CLI installed
- Authenticated: `fly auth login`

### Install flyctl

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Verify
fly version
```

---

## Step 1: Create Postgres Database

```bash
# Create Fly Postgres cluster
fly postgres create \
  --name chefcloud-staging-db \
  --region sea \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1

# Get connection string
fly postgres connect -a chefcloud-staging-db
```

Save the connection string for the API secrets.

---

## Step 2: Create API App

```bash
cd infra/fly/api

# Create app (don't deploy yet)
fly launch --no-deploy --name chefcloud-staging-api --region sea

# Attach Postgres
fly postgres attach chefcloud-staging-db -a chefcloud-staging-api

# Set required secrets
fly secrets set JWT_SECRET="$(openssl rand -base64 32)" -a chefcloud-staging-api

# Optional: External Redis (Upstash)
# fly secrets set REDIS_URL="redis://..." -a chefcloud-staging-api

# Optional: Sentry
# fly secrets set SENTRY_DSN="https://..." -a chefcloud-staging-api

# Set CORS (must match web app URL)
fly secrets set CORS_ORIGINS="https://chefcloud-staging-web.fly.dev" -a chefcloud-staging-api

# Set WebAuthn
fly secrets set RP_ID="chefcloud-staging-web.fly.dev" -a chefcloud-staging-api
fly secrets set ORIGIN="https://chefcloud-staging-web.fly.dev" -a chefcloud-staging-api
```

---

## Step 3: Deploy API

```bash
cd infra/fly/api

# Deploy from repo root context
fly deploy --dockerfile ../../../services/api/Dockerfile --config fly.toml

# Check status
fly status -a chefcloud-staging-api
```

---

## Step 4: Run Database Migrations

**⚠️ IMPORTANT:** Migrations are NOT run automatically.

```bash
# SSH into API machine
fly ssh console -a chefcloud-staging-api

# Run migrations
npx prisma migrate deploy

# Exit
exit
```

Or use one-shot machine:

```bash
fly machine run \
  -a chefcloud-staging-api \
  --entrypoint "npx prisma migrate deploy" \
  --rm
```

---

## Step 5: Create Web App

```bash
cd infra/fly/web

# Create app
fly launch --no-deploy --name chefcloud-staging-web --region sea

# Deploy with build args
fly deploy \
  --dockerfile ../../../apps/web/Dockerfile \
  --config fly.toml \
  --build-arg NEXT_PUBLIC_API_URL=https://chefcloud-staging-api.fly.dev \
  --build-arg NEXT_PUBLIC_APP_VERSION=staging

# Check status
fly status -a chefcloud-staging-web
```

---

## Step 6: Seed Demo Data (Optional)

> **⚠️ Demo Only:** This seeds test data for development/demo purposes.

```bash
fly ssh console -a chefcloud-staging-api

# Run seed
npx prisma db seed

exit
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.com` | `demo1234` |
| Manager | `manager@demo.com` | `demo1234` |
| Cashier | `cashier@demo.com` | `demo1234` |

---

## Step 7: Verify Deployment

### 7.1 Manual Verification

| Check | URL | Expected |
|-------|-----|----------|
| Web UI | https://chefcloud-staging-web.fly.dev | Login page |
| API Health | https://chefcloud-staging-api.fly.dev/health | `{ "status": "ok" }` |
| API Version | https://chefcloud-staging-api.fly.dev/version | Version JSON |

### 7.2 Run Smoke Verification

```bash
API_BASE_URL=https://chefcloud-staging-api.fly.dev \
  node scripts/verify/smoke-verification.mjs
```

---

## Redis Options

### Option A: Upstash (Recommended)

1. Create Upstash Redis at https://upstash.com
2. Get connection string
3. Set secret:

```bash
fly secrets set REDIS_URL="redis://default:xxx@xxx.upstash.io:6379" -a chefcloud-staging-api
```

### Option B: Fly Redis (Beta)

```bash
fly redis create --name chefcloud-staging-redis --region sea
fly redis attach chefcloud-staging-redis -a chefcloud-staging-api
```

### Option C: No Redis

API works without Redis but loses:
- Rate limiting persistence
- Session caching
- Real-time features may degrade

---

## Monitoring

### Logs

```bash
# Tail logs
fly logs -a chefcloud-staging-api

# Web logs
fly logs -a chefcloud-staging-web
```

### Status

```bash
fly status -a chefcloud-staging-api
fly status -a chefcloud-staging-web
```

### Metrics

```bash
fly dashboard -a chefcloud-staging-api
```

---

## Scaling

### Scale Machines

```bash
# Add machines
fly scale count 2 -a chefcloud-staging-api

# Scale memory
fly scale memory 1024 -a chefcloud-staging-api
```

### Regions

```bash
# Add region
fly regions add ord -a chefcloud-staging-api
```

---

## Troubleshooting

### API Fails Health Check

```bash
# Check logs
fly logs -a chefcloud-staging-api

# SSH in
fly ssh console -a chefcloud-staging-api

# Check env
env | grep -E "DATABASE|JWT|NODE"
```

### Database Connection Issues

```bash
# Verify Postgres is attached
fly postgres list

# Check connection
fly postgres connect -a chefcloud-staging-db
```

### Deployment Fails

```bash
# Check build logs
fly deploy --verbose

# Check machine status
fly machines list -a chefcloud-staging-api
```

---

## Secrets Reference

### API Secrets

| Secret | Required | How to Set |
|--------|----------|------------|
| `JWT_SECRET` | Yes | `fly secrets set JWT_SECRET="..."` |
| `DATABASE_URL` | Auto | Attached via `fly postgres attach` |
| `REDIS_URL` | No | `fly secrets set REDIS_URL="..."` |
| `SENTRY_DSN` | No | `fly secrets set SENTRY_DSN="..."` |
| `CORS_ORIGINS` | Yes | `fly secrets set CORS_ORIGINS="..."` |
| `RP_ID` | Yes | `fly secrets set RP_ID="..."` |
| `ORIGIN` | Yes | `fly secrets set ORIGIN="..."` |

### View Secrets

```bash
fly secrets list -a chefcloud-staging-api
```

---

## Shutdown / Cleanup

### Stop Machines (Preserve Data)

```bash
fly scale count 0 -a chefcloud-staging-api
fly scale count 0 -a chefcloud-staging-web
```

### Destroy Apps (Permanent)

```bash
fly apps destroy chefcloud-staging-api
fly apps destroy chefcloud-staging-web
fly postgres destroy chefcloud-staging-db
```

> ⚠️ This deletes all data permanently.

---

## Quick Reference

```bash
# ============ Deploy ============
fly deploy -a chefcloud-staging-api
fly deploy -a chefcloud-staging-web

# ============ Logs ============
fly logs -a chefcloud-staging-api
fly logs -a chefcloud-staging-web

# ============ SSH ============
fly ssh console -a chefcloud-staging-api

# ============ Secrets ============
fly secrets list -a chefcloud-staging-api
fly secrets set KEY=value -a chefcloud-staging-api

# ============ Status ============
fly status -a chefcloud-staging-api
fly status -a chefcloud-staging-web

# ============ Scale ============
fly scale count 2 -a chefcloud-staging-api
fly scale memory 1024 -a chefcloud-staging-api
```

---

## Related Documentation

- [FLY_STAGING_SMOKE.md](../docs/verification/FLY_STAGING_SMOKE.md) — Smoke verification guide
- [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) — Environment variable reference
- [infra/fly/api/fly.toml](../infra/fly/api/fly.toml) — API Fly config
- [infra/fly/web/fly.toml](../infra/fly/web/fly.toml) — Web Fly config

---

*Phase E3.3 — Fly.io Staging Deployment*
