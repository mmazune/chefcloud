# Staging Deployment Runbook

> Created: 2026-01-10 | Phase D3 — Staging Deployment Readiness

---

## Overview

This runbook provides deterministic, step-by-step instructions for deploying ChefCloud/NimbusPOS to a staging environment.

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| pnpm | 8.x | 9.x |
| PostgreSQL | 14.x | 16.x |
| Redis | 6.x | 7.x (optional) |
| Memory | 2GB | 4GB |
| Disk | 5GB | 10GB |

### Required Access

- [ ] Git repository access
- [ ] Staging server SSH/console access
- [ ] PostgreSQL database credentials
- [ ] Redis credentials (if used)
- [ ] Environment variable configuration access

---

## Environment Configuration

### API Environment (services/api/.env)

Create or update `.env` file with staging values:

```bash
# Required
DATABASE_URL="postgresql://user:pass@staging-db:5432/chefcloud_staging"
JWT_SECRET="staging-secret-minimum-32-characters-change-this"
NODE_ENV=staging
PORT=3001

# CORS (adjust for staging domain)
CORS_ORIGINS="https://staging.chefcloud.io"

# WebAuthn
RP_ID="staging.chefcloud.io"
ORIGIN="https://staging.chefcloud.io"

# Optional observability
SENTRY_DSN="https://xxx@sentry.io/staging"
METRICS_ENABLED=1
LOG_LEVEL=info
LOG_SILENCE_HEALTH=1

# Optional caching
REDIS_URL="redis://staging-redis:6379"

# Feature flags (DISABLED by default in staging)
DEVPORTAL_ENABLED=0
DOCS_ENABLED=0
DEMO_PROTECT_WRITES=1
```

### Web Environment (apps/web/.env.local)

```bash
NEXT_PUBLIC_API_URL="https://api-staging.chefcloud.io"
NEXT_PUBLIC_APP_VERSION="staging"
NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT=1
NEXT_PUBLIC_SESSION_IDLE_MINUTES=30
```

---

## Deployment Steps

### A. API Deployment

#### A1. Clone and Install

```bash
# Clone repository
git clone https://github.com/mmazune/nimbuspos.git
cd nimbuspos

# Install dependencies (timeout: 5 minutes)
timeout 300 pnpm install
```

#### A2. Build API

```bash
# Build API service (timeout: 3 minutes)
timeout 180 pnpm -C services/api build
```

#### A3. Database Migration

```bash
# Run Prisma migrations (timeout: 2 minutes)
timeout 120 pnpm -C services/api prisma migrate deploy
```

#### A4. Seed Data (Optional)

> ⚠️ Only run seeding on fresh staging databases. Skip for existing data.

```bash
# Seed demo data (timeout: 3 minutes)
timeout 180 pnpm -C services/api prisma:seed
```

#### A5. Start API Server

```bash
# Production start (timeout: 30 seconds for startup)
timeout 30 pnpm -C services/api start:prod &

# Or with PM2
pm2 start dist/main.js --name chefcloud-api
```

#### A6. Verify API Health

```bash
# Health check (expect 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
# Expected: 200

# Version check
curl http://localhost:3001/version
# Expected: JSON with version info
```

---

### B. Web Deployment

#### B1. Install Dependencies

```bash
# Install (if not already done at root)
timeout 300 pnpm install
```

#### B2. Build Web App

```bash
# Build Next.js app (timeout: 5 minutes)
timeout 300 pnpm -C apps/web build
```

#### B3. Start Web Server

```bash
# Production start
pnpm -C apps/web start &

# Or with PM2
pm2 start npm --name chefcloud-web -- run start -C apps/web
```

#### B4. Verify Web Health

```bash
# Home page (expect 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

---

## Post-Deployment Verification

### C1. Smoke Tests

Run the automated smoke verification script:

```bash
# Set staging API URL
export API_BASE_URL="https://api-staging.chefcloud.io"

# Run smoke tests
node scripts/verify/smoke-verification.mjs
```

**Expected Output:**
```
=== Smoke Verification Script ===
Base URL: https://api-staging.chefcloud.io
Tests: 10

✓ PASS Health Check - GET /health → 200
✓ PASS POS Menu Categories - GET /pos/menu/categories → 401
✓ PASS MSR Swipe Endpoint - POST /auth/msr-swipe → 400
...

=== Summary ===
Passed: 10 | Failed: 0

✓ All smoke tests passed!
```

### C2. Manual Verification Checklist

| Check | URL/Command | Expected |
|-------|-------------|----------|
| API Health | `GET /health` | 200 OK |
| API Version | `GET /version` | JSON with version |
| Login Page | `/auth/login` | Renders login form |
| Demo Login | `owner@demo.com / demo1234` | Redirects to dashboard |
| POS Page | `/orders` (as cashier) | Shows order interface |

### C3. Auth Flow Test

```bash
# Get token
TOKEN=$(curl -s -X POST https://api-staging.chefcloud.io/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.com","password":"demo1234"}' \
  | jq -r '.access_token')

# Verify token works
curl -s https://api-staging.chefcloud.io/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## DevPortal (Owner-Only)

By default, DevPortal is **DISABLED** in staging.

### Enabling DevPortal (Temporary)

Only enable if required for debugging:

```bash
# In API .env
DEVPORTAL_ENABLED=1
```

Then restart the API. See [DEVPORTAL_ENABLEMENT.md](../devportal/DEVPORTAL_ENABLEMENT.md) for details.

> ⚠️ **Security**: DevPortal routes require OWNER role. Do not enable in production unless necessary.

---

## Rollback Strategy

### Quick Rollback

```bash
# 1. Stop current services
pm2 stop all  # or kill processes

# 2. Checkout previous version
git checkout <previous-commit-sha>

# 3. Reinstall and rebuild
pnpm install
pnpm -C services/api build
pnpm -C apps/web build

# 4. Restart
pm2 start all
```

### Database Rollback

```bash
# Rollback last migration (if needed)
pnpm -C services/api prisma migrate resolve --rolled-back <migration-name>
```

### Emergency Rollback

If deployment fails critically:

1. Restore database from backup
2. Deploy previous known-good container/image
3. Notify team via Slack/PagerDuty

---

## Monitoring

### Logs

```bash
# API logs (PM2)
pm2 logs chefcloud-api --lines 100

# API logs (Docker)
docker logs chefcloud-api --tail 100 -f
```

### Metrics

If `METRICS_ENABLED=1`:

```bash
curl http://localhost:3001/metrics
```

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health check |
| `GET /health/ready` | Readiness (DB connected) |
| `GET /version` | Build info |

---

## Troubleshooting

### API Won't Start

1. Check `DATABASE_URL` is correct
2. Check `JWT_SECRET` is set (min 32 chars)
3. Check port 3001 is available
4. Run `pnpm -C services/api prisma migrate deploy`

### 401 on All Routes

1. Check CORS_ORIGINS includes your domain
2. Check JWT_SECRET matches between restarts
3. Verify token is being sent in Authorization header

### 404 on /dev/* Routes

DevPortal is disabled by default. Set `DEVPORTAL_ENABLED=1` if needed.

### Database Connection Failed

1. Check DATABASE_URL format
2. Check database server is reachable
3. Check credentials
4. Run `pnpm -C services/api prisma db push` to verify schema

---

## Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | — |
| Backend Lead | — |
| On-Call | — |

---

*Part of Phase D3 — Staging Deployment Readiness*
