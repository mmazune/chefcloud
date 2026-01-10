# Production Go-Live Checklist

> Created: 2026-01-10 | Phase F3 — Production Execution Pack

---

## Overview

This is a **single-page execution checklist** for deploying ChefCloud to production. Follow each step in order. Check each box only when complete.

> **Time Estimate:** 30–60 minutes for experienced operator

**Authoritative References:**
| Document | Purpose |
|----------|---------|
| [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md) | Complete release procedures |
| [PRODUCTION_ENV_MATRIX.md](./PRODUCTION_ENV_MATRIX.md) | Environment variables |
| [PRODUCTION_SECURITY_DEFAULTS.md](../docs/security/PRODUCTION_SECURITY_DEFAULTS.md) | Security configuration |
| [ALERT_RUNBOOK.md](./ALERT_RUNBOOK.md) | Incident response |
| [PRODUCTION_ROLLBACK_MATRIX.md](./PRODUCTION_ROLLBACK_MATRIX.md) | Rollback decision tree |

---

## ⏱️ Pre-Flight (T-15 min)

### CI/CD Green

```bash
# Verify CI passes
git status --porcelain  # Must be clean
pnpm verify:no-wip-imports  # Must pass
pnpm -C services/api lint   # Must pass (warnings ok)
pnpm -C apps/web lint       # Must pass (warnings ok)
pnpm -C services/api build  # Must pass
pnpm -C apps/web build      # Must pass
```

- [ ] CI workflow passes on GitHub Actions
- [ ] `verify:no-wip-imports` → **PASS**
- [ ] `api lint` → **PASS**
- [ ] `web lint` → **PASS**
- [ ] `api build` → **PASS**
- [ ] `web build` → **PASS**

### Staging Smoke Green

```bash
# Run staging smoke tests
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/smoke-verification.mjs
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/staging-preflight.mjs
```

- [ ] Staging deployed with same commit as release candidate
- [ ] Staging smoke tests → **ALL PASS**
- [ ] Staging preflight → **ALL PASS**

### Environment Variables Confirmed

Cross-reference with [PRODUCTION_ENV_MATRIX.md](./PRODUCTION_ENV_MATRIX.md).

| Variable | Check |
|----------|-------|
| `DATABASE_URL` | ✅ Set in provider secrets |
| `JWT_SECRET` | ✅ 32+ chars, rotated within policy |
| `NODE_ENV` | ✅ Set to `production` |
| `CORS_ORIGINS` | ✅ Explicit origins (no `*`) |
| `DEVPORTAL_ENABLED` | ✅ `0` (disabled) |
| `DOCS_ENABLED` | ✅ `0` (disabled) |
| `METRICS_ENABLED` | ✅ `0` (unless Prometheus configured) |
| `SENTRY_DSN` | ✅ Set if error tracking desired |

- [ ] All required env vars set
- [ ] All optional feature flags OFF by default
- [ ] No secrets in code/repo

---

## 💾 Backup (T-10 min)

### Database Backup

**Render (Managed Postgres):**
```bash
# Render auto-snapshots daily; trigger manual snapshot:
# Dashboard → Database → Snapshots → Create Snapshot
```

**Fly.io (External DB):**
```bash
# Supabase/Neon: Use provider's backup interface
# Self-managed: pg_dump
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M).sql
```

- [ ] Database backup created
- [ ] Backup timestamp noted: `______________`
- [ ] Backup location noted: `______________`

### Backup Validation (Optional but Recommended)

```bash
# Restore to test database and verify
psql $TEST_DATABASE_URL < backup-YYYYMMDD-HHMM.sql
# Run quick count query
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
```

- [ ] Backup restoration tested (or skip with approval)

---

## 🚀 Deploy API (Canary First)

Deploy API first. Keep web on previous version until API is verified.

### Render

```bash
# Option 1: Git push triggers auto-deploy
git push origin main

# Option 2: Manual deploy
# Dashboard → chefcloud-prod-api → Manual Deploy → Select tag/commit
```

### Fly.io

```bash
cd infra/fly/api
fly deploy -a chefcloud-prod-api --strategy canary
```

- [ ] API deployment initiated
- [ ] Deployment completed (no build errors)

### API Health Verification

```bash
# Immediately after deploy
curl -s https://YOUR_PROD_API_URL/healthz | jq

# Wait 2 minutes, then:
curl -s https://YOUR_PROD_API_URL/readiness | jq
```

- [ ] `/healthz` returns `{"status":"ok"}`
- [ ] `/readiness` returns healthy status

---

## 🔄 Run Migrations

Only if schema changes in this release.

```bash
# Render: Runs automatically via postDeploy hook
# Fly.io: SSH into container
fly ssh console -a chefcloud-prod-api -C "npx prisma migrate deploy"
```

- [ ] Migrations applied (or N/A if no schema changes)
- [ ] No migration errors in logs

---

## 🌐 Deploy Web (After API Verified)

Only proceed when API is confirmed healthy.

### Render

```bash
# Dashboard → chefcloud-prod-web → Manual Deploy → Select same commit as API
```

### Fly.io

```bash
cd infra/fly/web
fly deploy -a chefcloud-prod-web
```

- [ ] Web deployment completed

---

## ✅ Post-Deploy Verification (T+5 min)

### Automated Smoke Tests

```bash
# Run production preflight
API_BASE_URL=https://YOUR_PROD_API_URL node scripts/verify/production-preflight.mjs

# Run smoke tests
API_BASE_URL=https://YOUR_PROD_API_URL node scripts/verify/smoke-verification.mjs
```

- [ ] `production-preflight.mjs` → **ALL PASS**
- [ ] `smoke-verification.mjs` → **ALL PASS**

### Top 5 UI Spot Checks

Manually verify in browser:

| Route | Expected | Check |
|-------|----------|-------|
| `/login` | Login page renders | [ ] |
| Login as `owner@demo.com` / `demo1234` | Redirects to dashboard | [ ] |
| `/dashboard/owner` | Dashboard loads with data | [ ] |
| `/inventory/items` | Inventory list loads | [ ] |
| `/orders` | Orders page loads | [ ] |

- [ ] All 5 UI routes verified

### Log Monitoring (First 15 min)

```bash
# Render
# Dashboard → Service → Logs

# Fly.io
fly logs -a chefcloud-prod-api --follow
```

Watch for:
- [ ] No 5xx errors
- [ ] No auth failures spike
- [ ] No database connection errors

---

## 🔴 Rollback Triggers

**Immediate rollback if:**
- Health checks fail
- 5xx error rate > 5%
- Auth completely broken
- Database errors

**See:** [PRODUCTION_ROLLBACK_MATRIX.md](./PRODUCTION_ROLLBACK_MATRIX.md)

### Quick Rollback Commands

**Render:**
```bash
# Dashboard → Service → Deploys → Click previous deploy → Rollback
```

**Fly.io:**
```bash
fly releases -a chefcloud-prod-api
fly releases rollback v<N-1> -a chefcloud-prod-api
```

---

## ✅ Go-Live Complete

When all checks pass:

- [ ] Remove maintenance mode (if enabled)
- [ ] Update status page (if applicable)
- [ ] Notify team/stakeholders
- [ ] Tag release in git (if not already):
  ```bash
  git tag -a v1.x.x -m "Production release v1.x.x"
  git push origin v1.x.x
  ```

---

## Post-Release Monitoring (T+24h)

- [ ] Error rates stable
- [ ] Latency normal
- [ ] No customer-reported issues
- [ ] Sentry clean (if enabled)

---

## Appendix: Emergency Contacts

| Role | Contact |
|------|---------|
| On-Call | (configure) |
| Engineering Lead | (configure) |
| Database Admin | (configure) |

---

*Created as part of Phase F3 — Production Execution Pack*
