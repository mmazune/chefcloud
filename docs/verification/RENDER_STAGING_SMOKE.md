# Render Staging Smoke Verification Guide

> Created: 2026-01-10 | Phase E3.2 — Render Staging Deployment

---

## Overview

This guide explains how to run smoke verification against the Render staging deployment to confirm the API is operational.

---

## Prerequisites

- Node.js 20+
- Local clone of the repository
- Dependencies installed (`pnpm install`)
- Render staging deployment is live

---

## Quick Start

```bash
# Run smoke verification against Render staging API
API_BASE_URL=https://chefcloud-staging-api.onrender.com \
  node scripts/verify/smoke-verification.mjs
```

---

## Expected Output

```
🔍 Running ChefCloud Smoke Verification
   Target: https://chefcloud-staging-api.onrender.com

✅ Health Check               200 OK
✅ POS Menu Categories         401/200 OK
✅ MSR Swipe Endpoint          400/401 OK
✅ Login Endpoint              400/401 OK
✅ Inventory Items             401/200 OK
✅ Inventory Categories        401/200 OK
✅ POS Orders                  401/200 OK
✅ Workforce Employees         401/200 OK
✅ Workforce Payroll Runs      401/200 OK
✅ Finance Journal Entries     401/200 OK

══════════════════════════════════════════
   SMOKE VERIFICATION: PASS
══════════════════════════════════════════
```

---

## What the Smoke Test Verifies

| Test | Endpoint | Expected Status | Purpose |
|------|----------|-----------------|---------|
| Health Check | `GET /health` | 200 | API is running |
| POS Menu Categories | `GET /pos/menu/categories` | 200 or 401 | POS module wired |
| MSR Swipe | `POST /auth/msr-swipe` | 400 or 401 | Auth module wired |
| Login | `POST /auth/login` | 400 or 401 | Auth module wired |
| Inventory Items | `GET /inventory/items` | 200 or 401 | Inventory module wired |
| Inventory Categories | `GET /inventory/categories` | 200 or 401 | Inventory module wired |
| POS Orders | `GET /pos/orders` | 200 or 401 | POS module wired |
| Workforce Employees | `GET /workforce/employees` | 200 or 401 | Workforce module wired |
| Payroll Runs | `GET /workforce/payroll-runs` | 200 or 401 | Payroll module wired |
| Journal Entries | `GET /finance/journal-entries` | 200 or 401 | Finance module wired |

---

## Interpreting Results

### All Pass (200 or 401)

✅ **PASS** — API is healthy and all endpoints are wired correctly.

- `200` = Endpoint accessible (may require auth for full data)
- `401` = Endpoint exists but requires authentication

### Health Check Fails

❌ **FAIL** — API is not responding.

**Troubleshooting:**
1. Check Render Dashboard for service status
2. View API logs for errors
3. Verify database connection
4. Confirm `JWT_SECRET` is set

### Endpoint Returns 404

❌ **FAIL** — Endpoint not found.

**Possible causes:**
- API not fully deployed
- Missing module registration
- Route not wired

### Endpoint Returns 500

❌ **FAIL** — Internal server error.

**Troubleshooting:**
1. Check API logs for stack trace
2. Verify database migrations ran
3. Check environment variables

---

## Custom Domain URL

If using custom domains:

```bash
API_BASE_URL=https://api.staging.chefcloud.io \
  node scripts/verify/smoke-verification.mjs
```

---

## Automated Verification

### GitHub Actions

The CI workflow includes a smoke job that runs against local Docker.

For Render staging, you can add a manual workflow:

```yaml
# .github/workflows/smoke-render.yml
name: Smoke Test (Render Staging)

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install --frozen-lockfile
      - run: API_BASE_URL=https://chefcloud-staging-api.onrender.com node scripts/verify/smoke-verification.mjs
```

---

## Troubleshooting

### Connection Refused

```
Error: ECONNREFUSED
```

**Fix:** Service is not running. Check Render Dashboard.

### SSL Certificate Error

```
Error: CERT_HAS_EXPIRED
```

**Fix:** Render SSL auto-renewal issue. Contact Render support.

### Timeout

```
Error: ETIMEDOUT
```

**Fix:** Service may be cold starting. Wait and retry.

Render free tier services spin down after inactivity. First request may take 30-60 seconds.

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_RENDER_STAGING.md](../../runbooks/DEPLOYMENT_RUNBOOK_RENDER_STAGING.md) — Render deployment guide
- [smoke-verification.mjs](../../scripts/verify/smoke-verification.mjs) — Smoke verification script
- [NOT_DORMANT_VERIFICATION.md](NOT_DORMANT_VERIFICATION.md) — Feature verification guide

---

*Phase E3.2 — Render Staging Deployment*
