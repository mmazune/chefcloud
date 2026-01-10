# Staging Go-Live Checklist

> Created: 2026-01-10 | Phase E4 — Staging Verification Pack

---

## Overview

This checklist ensures staging environments (Docker, Render, Fly.io) are consistent and production-ready before declaring "go-live".

**Authoritative References:**
- [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) — Complete env var catalog
- [STAGING_ENV_ASSERTIONS.md](../docs/verification/STAGING_ENV_ASSERTIONS.md) — Must-be-true assertions
- [STAGING_ROLLBACK_PLAYBOOK.md](./STAGING_ROLLBACK_PLAYBOOK.md) — Rollback procedures

---

## Quick Links by Platform

| Platform | Deployment Runbook | Smoke Command |
|----------|-------------------|---------------|
| Docker | [DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md](./DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md) | `pnpm staging:smoke` |
| Render | [DEPLOYMENT_RUNBOOK_RENDER_STAGING.md](./DEPLOYMENT_RUNBOOK_RENDER_STAGING.md) | `API_BASE_URL=https://chefcloud-staging-api.onrender.com node scripts/verify/smoke-verification.mjs` |
| Fly.io | [DEPLOYMENT_RUNBOOK_FLY_STAGING.md](./DEPLOYMENT_RUNBOOK_FLY_STAGING.md) | `API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/smoke-verification.mjs` |

---

## Preflight Checklist

### 1. Environment Variables

Verify all required environment variables are set. Refer to [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) for the full list.

| Variable | Required | Check |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | Connection string set |
| `JWT_SECRET` | **Yes** | Min 32 characters |
| `NODE_ENV` | No | Should be `production` for staging |
| `CORS_ORIGINS` | No | Matches web app URL |
| `DEVPORTAL_ENABLED` | No | Should be `0` (disabled) |
| `DOCS_ENABLED` | No | Should be `0` (disabled) |
| `METRICS_ENABLED` | No | Should be `0` unless monitoring configured |

**Docker:**
```bash
# Check env file exists
cat .env.docker.staging | grep -E "^(DATABASE_URL|JWT_SECRET|DEVPORTAL_ENABLED|DOCS_ENABLED)="
```

**Render:**
```bash
# Via Render Dashboard: Service → Environment
# Verify JWT_SECRET, DATABASE_URL (auto-set), DEVPORTAL_ENABLED=0
```

**Fly.io:**
```bash
fly secrets list -a chefcloud-staging-api
# Should show: JWT_SECRET, DATABASE_URL, CORS_ORIGINS
```

- [ ] **PASS:** All required env vars set
- [ ] **PASS:** Feature flags disabled (DEVPORTAL_ENABLED=0, DOCS_ENABLED=0)

---

### 2. Health Check Verification

| Endpoint | Expected | Purpose |
|----------|----------|---------|
| `GET /health` | 200 OK | API is running |
| `GET /` (web) | 200 OK | Web is running |

**Docker:**
```bash
curl -s http://localhost:3001/health && echo " ✓ API healthy"
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}" && echo " ✓ Web healthy"
```

**Render:**
```bash
curl -s https://chefcloud-staging-api.onrender.com/health && echo " ✓ API healthy"
curl -s https://chefcloud-staging-web.onrender.com -o /dev/null -w "%{http_code}" && echo " ✓ Web healthy"
```

**Fly.io:**
```bash
curl -s https://chefcloud-staging-api.fly.dev/health && echo " ✓ API healthy"
curl -s https://chefcloud-staging-web.fly.dev -o /dev/null -w "%{http_code}" && echo " ✓ Web healthy"
```

- [ ] **PASS:** API health check returns 200
- [ ] **PASS:** Web returns 200

---

### 3. Database Connectivity

Verify database is reachable and migrations applied.

**Docker:**
```bash
# Check Postgres container
docker exec chefcloud-staging-postgres pg_isready -U chefcloud

# Check migration status
docker exec chefcloud-staging-api npx prisma migrate status
```

**Render:**
```bash
# Use Render Shell for API service
npx prisma migrate status
```

**Fly.io:**
```bash
fly ssh console -a chefcloud-staging-api -C "npx prisma migrate status"
```

- [ ] **PASS:** Database responds to pg_isready/connection test
- [ ] **PASS:** All migrations applied (no pending)

---

### 4. Redis Connectivity (Optional)

If Redis is configured:

**Docker:**
```bash
docker exec chefcloud-staging-redis redis-cli ping
# Expected: PONG
```

**Cloud (Upstash/Redis Cloud):**
```bash
# From API shell
redis-cli -u $REDIS_URL ping
```

- [ ] **PASS:** Redis responds PONG (or N/A if not configured)

---

### 5. Migration Status Check

**Critical:** Always verify migrations before declaring staging ready.

```bash
# Expected output: "Database schema is up to date"
# or "No pending migrations"
```

If pending migrations exist:
1. **DO NOT** proceed with go-live
2. Run migrations per platform runbook
3. Re-verify migration status

- [ ] **PASS:** No pending migrations

---

### 6. Smoke Verification

Run the comprehensive smoke test suite.

**Docker:**
```bash
pnpm staging:smoke
```

**Render:**
```bash
API_BASE_URL=https://chefcloud-staging-api.onrender.com node scripts/verify/smoke-verification.mjs
```

**Fly.io:**
```bash
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/smoke-verification.mjs
```

**Preflight Script (Extended Checks):**
```bash
# Docker
node scripts/verify/staging-preflight.mjs

# Render
API_BASE_URL=https://chefcloud-staging-api.onrender.com node scripts/verify/staging-preflight.mjs

# Fly.io
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/staging-preflight.mjs
```

- [ ] **PASS:** Smoke verification passes (all endpoints respond correctly)
- [ ] **PASS:** Preflight verification passes (auth guards, feature flags)

---

### 7. Auth Guard Verification

Confirm authentication is working (not misconfigured).

```bash
# Protected endpoint should return 401 without token
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/inventory/items
# Expected: 401
```

- [ ] **PASS:** Protected endpoints return 401 without auth

---

### 8. Feature Flag Verification

Confirm disabled features return expected responses.

```bash
# If DOCS_ENABLED=0, /docs should 404 (or redirect)
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/docs
# Expected: 404 or 302

# If DEVPORTAL_ENABLED=0, /dev/* should 404
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/dev/api-keys
# Expected: 404
```

- [ ] **PASS:** Disabled features return 404/403

---

### 9. UI Spot-Check (Top 5 Routes)

Manually verify the web UI loads correctly for these routes:

| Route | Auth Required | Check |
|-------|---------------|-------|
| `/` | No | Landing page loads |
| `/login` | No | Login form renders |
| `/dashboard` | Yes | Redirects to login if not authenticated |
| `/orders` | Yes | Protected route works |
| `/inventory` | Yes | Protected route works |

**How to check:**
1. Open web URL in browser
2. Navigate to each route
3. Verify no white screen / JavaScript errors
4. Check browser console for errors

- [ ] **PASS:** All 5 routes render without errors

---

### 10. CORS Verification

Ensure CORS is configured correctly for API-to-Web communication.

```bash
# Check CORS headers
curl -s -I -X OPTIONS $API_BASE_URL/health \
  -H "Origin: $WEB_URL" \
  -H "Access-Control-Request-Method: GET" | grep -i access-control
```

Expected headers:
- `Access-Control-Allow-Origin: <web-url>` or `*`
- `Access-Control-Allow-Methods: GET, POST, ...`

- [ ] **PASS:** CORS headers present for web origin

---

## Go-Live Decision

### All Checks Passed

If ALL checkboxes above are ✓ PASS:

```
✅ STAGING GO-LIVE: APPROVED
   Platform: [Docker / Render / Fly.io]
   Date: [YYYY-MM-DD]
   Verified by: [Name]
```

### Any Check Failed

If ANY checkbox is ✗ FAIL:

```
❌ STAGING GO-LIVE: BLOCKED
   Failed checks: [list]
   Action required: [remediation steps]
```

Do not proceed. Fix issues and re-run checklist.

---

## Post Go-Live Verification

After declaring staging ready:

1. **Monitor logs** for 15 minutes for unexpected errors
2. **Create a test order** (if demo data seeded)
3. **Verify webhook delivery** (if webhooks configured)
4. **Document** any deviations in session notes

---

## Quick Reference Card

```
STAGING GO-LIVE QUICK CHECK
===========================
[ ] ENV VARS: DATABASE_URL, JWT_SECRET set
[ ] FEATURE FLAGS: DEVPORTAL=0, DOCS=0
[ ] HEALTH: GET /health → 200
[ ] DB: prisma migrate status → up to date
[ ] SMOKE: pnpm staging:smoke → all pass
[ ] AUTH: /inventory/items → 401 (no token)
[ ] UI: / and /login render correctly
```

---

*This document is part of Phase E4 Staging Verification Pack. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
