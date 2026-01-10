# Production Release Runbook

> Created: 2026-01-10 | Phase F1 — Production Readiness

---

## Overview

This runbook provides step-by-step procedures for releasing ChefCloud to production. It covers pre-release verification, deployment, migration, rollback, and incident response.

**Related Documentation:**
- [PRODUCTION_ENV_MATRIX.md](./PRODUCTION_ENV_MATRIX.md) — Production environment variables
- [PRODUCTION_SECURITY_DEFAULTS.md](../docs/security/PRODUCTION_SECURITY_DEFAULTS.md) — Security configuration
- [STAGING_GO_LIVE_CHECKLIST.md](./STAGING_GO_LIVE_CHECKLIST.md) — Staging verification (reference)

---

## Pre-Release Checklist

Complete ALL items before proceeding to production deployment.

### 1. CI/CD Verification

- [ ] All CI checks pass on `main` branch
- [ ] `pnpm verify:no-wip-imports` → PASS
- [ ] `pnpm -C services/api lint` → PASS (warnings acceptable)
- [ ] `pnpm -C apps/web lint` → PASS (warnings acceptable)
- [ ] `pnpm -C services/api build` → PASS
- [ ] `pnpm -C apps/web build` → PASS

### 2. Staging Verification

- [ ] Staging environment deployed with same code as release candidate
- [ ] Smoke tests pass: `node scripts/verify/smoke-verification.mjs`
- [ ] Preflight tests pass: `node scripts/verify/staging-preflight.mjs`
- [ ] Manual UI spot-check completed (login, dashboard, key flows)

### 3. Version Tagging

```bash
# Determine version (semantic versioning)
VERSION="v1.0.0"  # Update appropriately

# Tag the release
git tag -a $VERSION -m "Release $VERSION"
git push origin $VERSION

# Verify tag
git describe --tags --abbrev=0
```

### 4. Release Notes (Recommended)

Document changes for this release:
- New features
- Bug fixes
- Breaking changes
- Migration requirements

---

## Secrets Checklist

### Required Secrets

| Secret | Storage | Rotation Schedule | Notes |
|--------|---------|-------------------|-------|
| `DATABASE_URL` | Provider secrets | On compromise | Postgres connection string |
| `JWT_SECRET` | Provider secrets | Quarterly or on compromise | Min 32 characters |
| `REDIS_URL` | Provider secrets | On compromise | If Redis enabled |
| `SENTRY_DSN` | Provider secrets | Never (project-specific) | Error tracking |
| `WH_SECRET` | Provider secrets | On compromise | Webhook signing |

### Secret Generation

```bash
# Generate JWT_SECRET (32+ chars)
openssl rand -base64 32

# Generate webhook secret
openssl rand -hex 32
```

### Secret Storage by Provider

**Render:**
1. Dashboard → Service → Environment
2. Add/update secret variables
3. Service auto-restarts on change

**Fly.io:**
```bash
fly secrets set JWT_SECRET="<value>" -a chefcloud-prod-api
fly secrets set DATABASE_URL="<value>" -a chefcloud-prod-api
```

**AWS/GCP:**
- Use Secrets Manager or Parameter Store
- Reference via environment variable injection

### JWT_SECRET Rotation Procedure

1. Generate new secret: `openssl rand -base64 32`
2. Update secret in provider (do NOT delete old yet)
3. Deploy new version that supports both secrets (if applicable)
4. Wait for all active sessions to expire (7 days default)
5. Remove old secret
6. Verify no auth failures in logs

---

## Deployment Procedure

### Provider-Agnostic Steps

1. **Verify pre-release checklist complete**
2. **Enable maintenance mode** (if available)
3. **Create database backup** (critical)
4. **Deploy application**
5. **Run migrations** (see below)
6. **Verify health endpoints**
7. **Run smoke tests**
8. **Disable maintenance mode**
9. **Monitor logs for 15 minutes**

### Render Deployment

```bash
# Option 1: Auto-deploy from git push
git push origin main

# Option 2: Manual deploy via dashboard
# Dashboard → Service → Manual Deploy → Select commit/tag
```

### Fly.io Deployment

```bash
# Deploy API
cd infra/fly/api
fly deploy --dockerfile ../../../services/api/Dockerfile --config fly.toml -a chefcloud-prod-api

# Deploy Web
cd ../web
fly deploy --dockerfile ../../../apps/web/Dockerfile --config fly.toml -a chefcloud-prod-web
```

---

## Migration Procedure

### Pre-Migration

1. **Backup database**
   ```bash
   # Render: Use dashboard backup feature
   # Fly: pg_dump via fly proxy
   fly proxy 5432:5432 -a chefcloud-prod-db &
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Review pending migrations**
   ```bash
   npx prisma migrate status
   ```

3. **Test migrations on staging first** (always)

### Execute Migration

```bash
# Run migration (idempotent, safe to re-run)
npx prisma migrate deploy
```

### Post-Migration Verification

```bash
# Verify migration status
npx prisma migrate status
# Expected: "Database schema is up to date"

# Quick health check
curl $API_BASE_URL/health
```

---

## Rollback Procedure

### Application Rollback

**Render:**
1. Dashboard → Service → **Events/Deploys**
2. Find last successful deploy
3. Click **Redeploy**

**Fly.io:**
```bash
# List releases
fly releases -a chefcloud-prod-api

# Rollback to previous release
fly releases rollback -a chefcloud-prod-api

# Repeat for web
fly releases rollback -a chefcloud-prod-web
```

**Docker (Self-hosted):**
```bash
# Deploy previous tag
docker pull chefcloud/api:v0.9.9  # Previous version
docker-compose up -d
```

### Migration Rollback (Bad Migration Protocol)

**Step 1: Assess Impact**
- Is the app still functional?
- Is data corrupted?
- Can we fix forward?

**Step 2: Mark Migration as Rolled Back (if needed)**
```bash
# Mark the problematic migration as rolled back
npx prisma migrate resolve --rolled-back "<migration-name>"
```

**Step 3: Manual SQL Fix (if data corruption)**
```sql
-- Connect to database
-- Apply corrective SQL based on migration issue
-- Document all manual changes
```

**Step 4: Restore from Backup (nuclear option)**
```bash
# Only if data corruption is severe
# Restore from pre-migration backup
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql
```

**Step 5: Post-Rollback**
- Notify team
- Document incident
- Fix migration locally
- Re-test on staging
- Schedule re-deployment

---

## Post-Release Verification

### Automated Checks

```bash
# Set production URL
export API_BASE_URL=https://api.chefcloud.io

# Run smoke tests
node scripts/verify/smoke-verification.mjs

# Run preflight checks
node scripts/verify/staging-preflight.mjs
```

### Manual Verification (Top 5 Routes)

| Route | Check |
|-------|-------|
| `/` | Landing page loads |
| `/login` | Login form renders, auth works |
| `/dashboard` | Dashboard loads with data |
| `/orders` | Orders page accessible |
| `/inventory` | Inventory page accessible |

### Monitoring Checklist

- [ ] Health check passing: `GET /health` → 200
- [ ] No 5xx errors in logs
- [ ] Response times normal (<500ms P95)
- [ ] Database connections stable
- [ ] No Sentry alerts (if configured)

---

## Incident Response Quick Steps

### Severity Matrix

| Level | Symptoms | Response |
|-------|----------|----------|
| P1 | Site completely down | Immediate rollback |
| P2 | Core feature broken | Rollback or hotfix within 1hr |
| P3 | Minor bug | Fix forward, monitor |

### P1 Response (Site Down)

1. **Acknowledge** — Note start time
2. **Assess** — Check health endpoint, check logs
3. **Rollback** — Use rollback procedure above
4. **Verify** — Confirm site is back
5. **Communicate** — Notify stakeholders
6. **Document** — Write incident report

### Quick Diagnostic Commands

```bash
# Check health
curl -s $API_BASE_URL/health

# Check recent logs (Fly.io)
fly logs -a chefcloud-prod-api -n 100

# Check recent logs (Render)
# Use dashboard → Logs

# Check database connections
fly ssh console -a chefcloud-prod-api -C "npx prisma db execute --stdin <<< 'SELECT count(*) FROM pg_stat_activity'"
```

### Emergency Disable (Feature Flags)

```bash
# Disable problematic features without redeploying
fly secrets set DEVPORTAL_ENABLED=0 -a chefcloud-prod-api
fly secrets set DOCS_ENABLED=0 -a chefcloud-prod-api
fly secrets set METRICS_ENABLED=0 -a chefcloud-prod-api
```

---

## Release Cadence Recommendations

| Type | Frequency | Notes |
|------|-----------|-------|
| Patch | As needed | Bug fixes, security patches |
| Minor | Weekly | New features, improvements |
| Major | Monthly | Breaking changes, major features |

### Release Checklist Summary

```
PRODUCTION RELEASE QUICK CHECK
==============================
[ ] CI green (lint + build)
[ ] Staging smoke tests pass
[ ] Version tagged
[ ] Secrets verified (not exposed)
[ ] Database backup taken
[ ] Deploy executed
[ ] Migrations run
[ ] Smoke tests pass
[ ] Logs monitored (15 min)
[ ] Release documented
```

---

## Appendix A: Render-Specific Notes

### Environment Configuration
- Use Blueprint (`render.yaml`) for infrastructure-as-code
- Secrets set via Dashboard (never in Blueprint)
- Auto-deploy from `main` branch (or configure branch)

### Scaling
- Adjust instance count in Dashboard
- Use Render Auto-scaling for production workloads

### Database
- Managed Postgres included
- Automatic daily backups
- Manual backup before major releases

---

## Appendix B: Fly.io-Specific Notes

### Environment Configuration
- Use `fly.toml` for app configuration
- Secrets via `fly secrets set`
- Deploy with `fly deploy`

### Scaling
```bash
# Scale to 2 instances
fly scale count 2 -a chefcloud-prod-api

# Scale memory
fly scale memory 1024 -a chefcloud-prod-api
```

### Database
- Fly Postgres cluster
- Use `fly postgres` commands for management
- Enable automatic backups

### Useful Commands
```bash
# SSH into production
fly ssh console -a chefcloud-prod-api

# Check status
fly status -a chefcloud-prod-api

# View secrets (names only)
fly secrets list -a chefcloud-prod-api
```

---

*This document is part of Phase F1 Production Readiness. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
