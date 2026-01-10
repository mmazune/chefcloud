# Fly.io Staging Smoke Verification Guide

> Created: 2026-01-10 | Phase E3.3 — Fly.io Staging Deployment

---

## Overview

This guide explains how to run smoke verification against the Fly.io staging deployment to confirm the API is operational.

---

## Prerequisites

- Node.js 20+
- Local clone of the repository
- Dependencies installed (`pnpm install`)
- Fly.io staging deployment is live

---

## Quick Start

```bash
# Run smoke verification against Fly staging API
API_BASE_URL=https://chefcloud-staging-api.fly.dev \
  node scripts/verify/smoke-verification.mjs
```

---

## Expected Output

```
🔍 Running ChefCloud Smoke Verification
   Target: https://chefcloud-staging-api.fly.dev

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

### Health Check Fails

❌ **FAIL** — API is not responding.

**Troubleshooting:**
1. Check app status: `fly status -a chefcloud-staging-api`
2. View logs: `fly logs -a chefcloud-staging-api`
3. Verify secrets: `fly secrets list -a chefcloud-staging-api`
4. Check Postgres: `fly postgres list`

### Endpoint Returns 404

❌ **FAIL** — Endpoint not found.

**Possible causes:**
- Deployment incomplete
- Missing module registration
- Route not wired

### Endpoint Returns 500

❌ **FAIL** — Internal server error.

**Troubleshooting:**
1. Check logs: `fly logs -a chefcloud-staging-api`
2. Verify migrations ran: `fly ssh console -a chefcloud-staging-api`
3. Check DATABASE_URL is set

---

## Custom Domain URL

If using custom domains:

```bash
API_BASE_URL=https://api.staging.chefcloud.io \
  node scripts/verify/smoke-verification.mjs
```

---

## Fly-Specific Checks

### Machine Status

```bash
fly status -a chefcloud-staging-api
```

Expected: At least one machine in `started` state.

### Health Check Status

```bash
fly checks list -a chefcloud-staging-api
```

Expected: All checks `passing`.

### Recent Deployments

```bash
fly releases -a chefcloud-staging-api
```

---

## Troubleshooting

### Connection Refused

```
Error: ECONNREFUSED
```

**Fix:** Machine may have scaled to zero. Make a request to wake it:
```bash
curl https://chefcloud-staging-api.fly.dev/health
```

Fly auto-starts machines on first request (if `auto_start_machines = true`).

### Timeout on First Request

Fly machines with `auto_stop_machines = true` spin down after inactivity.

First request may take 10-30 seconds while machine starts.

### SSL Certificate Error

```
Error: CERT_HAS_EXPIRED
```

**Fix:** Check app domain configuration:
```bash
fly certs list -a chefcloud-staging-api
```

---

## Automated CI Smoke

Add to GitHub Actions for post-deploy verification:

```yaml
# .github/workflows/smoke-fly.yml
name: Smoke Test (Fly Staging)

on:
  workflow_dispatch:

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
      - run: API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/smoke-verification.mjs
```

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_FLY_STAGING.md](../../runbooks/DEPLOYMENT_RUNBOOK_FLY_STAGING.md) — Fly deployment guide
- [smoke-verification.mjs](../../scripts/verify/smoke-verification.mjs) — Smoke verification script
- [NOT_DORMANT_VERIFICATION.md](NOT_DORMANT_VERIFICATION.md) — Feature verification guide

---

*Phase E3.3 — Fly.io Staging Deployment*
