# Staging Rollback Playbook

> Created: 2026-01-10 | Phase E4 — Staging Verification Pack

---

## Overview

This playbook provides procedures for rolling back staging deployments when issues are detected. Use this when:

- Health checks fail after deployment
- Migrations caused data corruption
- Critical features are broken
- Security issues discovered

**Severity Levels:**

| Level | Trigger | Response Time |
|-------|---------|---------------|
| P1 | Staging completely down | Immediate rollback |
| P2 | Critical feature broken | Rollback within 1 hour |
| P3 | Minor issue | Fix forward preferred |

---

## Quick Links

| Platform | Deployment Runbook |
|----------|-------------------|
| Docker | [DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md](./DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md) |
| Render | [DEPLOYMENT_RUNBOOK_RENDER_STAGING.md](./DEPLOYMENT_RUNBOOK_RENDER_STAGING.md) |
| Fly.io | [DEPLOYMENT_RUNBOOK_FLY_STAGING.md](./DEPLOYMENT_RUNBOOK_FLY_STAGING.md) |

---

## Rollback Procedures by Platform

### Docker (Local Staging)

**Option A: Rebuild from Previous Commit**
```bash
# Find last known good commit
git log --oneline -10

# Checkout previous commit
git checkout <commit-sha>

# Rebuild and restart
pnpm staging:down
pnpm staging:up

# Verify
pnpm staging:smoke
```

**Option B: Use Docker Image Tags**
```bash
# If using tagged images, pull previous version
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d

# Verify
pnpm staging:smoke
```

**Option C: Full Reset (Nuclear)**
```bash
# Remove everything including volumes
pnpm staging:down:clean

# Rebuild from scratch
pnpm staging:up

# Re-run migrations and seed
pnpm staging:migrate
pnpm staging:seed
```

---

### Render

**Option A: Redeploy Previous Commit (Recommended)**
1. Go to Render Dashboard → **chefcloud-staging-api**
2. Click **Manual Deploy** → Select commit
3. Choose last known good commit from dropdown
4. Click **Deploy**
5. Repeat for **chefcloud-staging-web**

**Option B: Rollback via Git**
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Render auto-deploys from main
# Monitor deploy in dashboard
```

**Option C: Suspend Service (Emergency)**
1. Go to service → **Settings**
2. Click **Suspend Service**
3. This stops the service immediately
4. Fix issues, then Resume

**Verify Rollback:**
```bash
API_BASE_URL=https://chefcloud-staging-api.onrender.com node scripts/verify/smoke-verification.mjs
```

---

### Fly.io

**Option A: Rollback to Previous Release**
```bash
# List recent releases
fly releases -a chefcloud-staging-api

# Rollback to previous release (n=1 means one version back)
fly deploy -a chefcloud-staging-api --image registry.fly.io/chefcloud-staging-api:<previous-version>

# Or use rollback command
fly releases rollback -a chefcloud-staging-api

# Repeat for web
fly releases rollback -a chefcloud-staging-web
```

**Option B: Deploy from Previous Commit**
```bash
# Checkout previous commit
git checkout <commit-sha>

# Redeploy
cd infra/fly/api
fly deploy --dockerfile ../../../services/api/Dockerfile --config fly.toml

cd ../web
fly deploy --dockerfile ../../../apps/web/Dockerfile --config fly.toml
```

**Option C: Scale to Zero (Emergency)**
```bash
# Stop all machines immediately
fly scale count 0 -a chefcloud-staging-api
fly scale count 0 -a chefcloud-staging-web

# Fix issues, then scale back up
fly scale count 1 -a chefcloud-staging-api
fly scale count 1 -a chefcloud-staging-web
```

**Verify Rollback:**
```bash
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/smoke-verification.mjs
```

---

## Detecting Bad Migrations

### Symptoms
- Health check fails with database error
- API returns 500 on all database queries
- Prisma migration status shows error

### Diagnosis
```bash
# Check migration status
npx prisma migrate status

# Look for:
# - "Failed migrations"
# - "Database schema drift"
# - "Pending migrations with errors"
```

### Mitigation Strategies

**Strategy 1: Resolve Migration (Preferred)**
```bash
# Mark problematic migration as resolved
npx prisma migrate resolve --applied "<migration-name>"

# Or mark as rolled back
npx prisma migrate resolve --rolled-back "<migration-name>"
```

**Strategy 2: Reset Database (Staging Only)**
```bash
# WARNING: This destroys all data
# Only use in staging, NEVER in production

# Docker
pnpm staging:down:clean
pnpm staging:up
pnpm staging:migrate
pnpm staging:seed

# Render/Fly: Drop and recreate database
# Use platform-specific instructions
```

**Strategy 3: Manual SQL Fix**
```bash
# Connect to database
# Docker
docker exec -it chefcloud-staging-postgres psql -U chefcloud

# Fly
fly postgres connect -a chefcloud-staging-db

# Run corrective SQL
# (specific to the migration issue)
```

---

## Disable Flags Fast

When you need to immediately disable features without redeploying:

### Feature Flags

| Flag | Purpose | Emergency Action |
|------|---------|-----------------|
| `DEVPORTAL_ENABLED` | Developer portal routes | Set to `0` |
| `DOCS_ENABLED` | Swagger documentation | Set to `0` |
| `METRICS_ENABLED` | Prometheus metrics endpoint | Set to `0` |

### Docker
```bash
# Edit .env.docker.staging
DEVPORTAL_ENABLED=0
DOCS_ENABLED=0
METRICS_ENABLED=0

# Restart API
docker-compose -f docker-compose.staging.yml restart api
```

### Render
1. Go to **chefcloud-staging-api** → **Environment**
2. Set variables:
   - `DEVPORTAL_ENABLED` = `0`
   - `DOCS_ENABLED` = `0`
   - `METRICS_ENABLED` = `0`
3. Click **Save Changes**
4. Service auto-restarts

### Fly.io
```bash
fly secrets set DEVPORTAL_ENABLED=0 DOCS_ENABLED=0 METRICS_ENABLED=0 -a chefcloud-staging-api
# Service auto-restarts on secret change
```

### Verify Flags Disabled
```bash
# Should return 404
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/docs
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/dev/api-keys
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/metrics
```

---

## Incident Checklist

When a staging incident occurs, follow this checklist:

### 1. Immediate Actions (First 5 Minutes)

- [ ] **Identify severity** (P1/P2/P3)
- [ ] **Check health endpoint:** `curl $API_BASE_URL/health`
- [ ] **Check recent changes:** `git log --oneline -5`
- [ ] **Note start time** for incident tracking

### 2. Gather Logs

**Docker:**
```bash
# All logs
pnpm staging:logs

# API logs only (last 100 lines)
docker logs chefcloud-staging-api --tail 100

# Search for errors
docker logs chefcloud-staging-api 2>&1 | grep -i error
```

**Render:**
1. Go to service → **Logs**
2. Filter by time range
3. Look for ERROR/FATAL messages

**Fly.io:**
```bash
# Recent logs
fly logs -a chefcloud-staging-api

# Last 100 lines
fly logs -a chefcloud-staging-api -n 100

# Search for errors
fly logs -a chefcloud-staging-api | grep -i error
```

### 3. Check Sentry (If Enabled)

If `SENTRY_DSN` is configured:
1. Go to Sentry dashboard
2. Filter by environment: `staging`
3. Check for new exceptions
4. Note error fingerprints

### 4. Check Database Connections

**Docker:**
```bash
docker exec chefcloud-staging-postgres psql -U chefcloud -c "SELECT count(*) FROM pg_stat_activity;"
```

**Fly.io:**
```bash
fly postgres connect -a chefcloud-staging-db -c "SELECT count(*) FROM pg_stat_activity;"
```

Look for:
- Connection count spikes
- Long-running queries
- Blocked transactions

### 5. Document and Resolve

- [ ] **Root cause identified**
- [ ] **Rollback executed** (if needed)
- [ ] **Smoke test passed** after fix
- [ ] **Incident documented** in session notes

---

## Rollback Decision Matrix

| Symptom | Severity | Action |
|---------|----------|--------|
| Health check 500 | P1 | Immediate rollback |
| All API requests 500 | P1 | Immediate rollback |
| Single endpoint broken | P2 | Disable feature flag or rollback |
| Slow responses (>5s) | P2 | Check DB, scale up, or rollback |
| UI white screen | P1 | Rollback web, check API |
| Login broken | P1 | Check JWT_SECRET, rollback |
| CORS errors | P2 | Fix CORS_ORIGINS env var |
| Missing data | P2 | Check migrations, restore backup |

---

## Post-Rollback Verification

After any rollback, always verify:

```bash
# 1. Health check
curl $API_BASE_URL/health

# 2. Smoke test
node scripts/verify/smoke-verification.mjs

# 3. Preflight check
node scripts/verify/staging-preflight.mjs

# 4. Manual UI check
# Open $WEB_URL in browser
# Login with demo@demo.com / demo1234
# Navigate to /dashboard
```

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | (configure) | First response |
| Team Lead | (configure) | P1 incidents |
| DevOps | (configure) | Infrastructure issues |

---

*This document is part of Phase E4 Staging Verification Pack. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
