# Staging Smoke Verification Guide

> Created: 2026-01-10 | Phase D3 — Staging Deployment Readiness

---

## Overview

This guide explains how to run smoke verification against a staging deployment to validate core endpoints are operational.

---

## Prerequisites

- Node.js 18+ installed
- Access to staging API URL
- Demo credentials (from seeded data)

---

## Running the Smoke Script

### 1. Set Environment Variables

```bash
# Required: Set the staging API URL
export API_BASE_URL="https://api-staging.chefcloud.io"

# Windows PowerShell
$env:API_BASE_URL = "https://api-staging.chefcloud.io"
```

### 2. Run the Script

```bash
# From repository root
node scripts/verify/smoke-verification.mjs
```

### 3. Expected Output (All Pass)

```
=== Smoke Verification Script ===
Base URL: https://api-staging.chefcloud.io
Tests: 10

✓ PASS Health Check - GET /health → 200
✓ PASS POS Menu Categories - GET /pos/menu/categories → 401
✓ PASS MSR Swipe Endpoint - POST /auth/msr-swipe → 400
✓ PASS Login Endpoint - POST /auth/login → 400
✓ PASS Inventory Items - GET /inventory/items → 401
✓ PASS Inventory Categories - GET /inventory/categories → 401
✓ PASS POS Orders - GET /pos/orders → 401
✓ PASS Workforce Employees - GET /workforce/employees → 401
✓ PASS Workforce Payroll Runs - GET /workforce/payroll-runs → 401
✓ PASS Finance Journal Entries - GET /finance/journal-entries → 401

=== Summary ===
Passed: 10 | Failed: 0

✓ All smoke tests passed!
```

> **Note**: 401 responses are expected for authenticated endpoints when no token is provided. This confirms the route exists and authentication is working.

---

## What the Script Checks

| Test | Endpoint | Success Codes | Purpose |
|------|----------|---------------|---------|
| Health Check | `GET /health` | 200 | API is running |
| Menu Categories | `GET /pos/menu/categories` | 200, 401 | POS routes exist |
| MSR Swipe | `POST /auth/msr-swipe` | 400, 401, 422 | MSR auth wired |
| Login | `POST /auth/login` | 400, 401, 422 | Auth module wired |
| Inventory Items | `GET /inventory/items` | 200, 401 | Inventory module wired |
| Inventory Categories | `GET /inventory/categories` | 200, 401 | Inventory module wired |
| POS Orders | `GET /pos/orders` | 200, 401 | POS module wired |
| Workforce Employees | `GET /workforce/employees` | 200, 401 | Workforce module wired |
| Payroll Runs | `GET /workforce/payroll-runs` | 200, 401 | Payroll module wired |
| Journal Entries | `GET /finance/journal-entries` | 200, 401 | Finance module wired |

---

## Demo Credentials

Use these credentials (from seeded demo data) for authenticated tests:

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.com` | `demo1234` |
| Manager | `manager@demo.com` | `demo1234` |
| Cashier | `cashier@demo.com` | `demo1234` |

> ⚠️ **Security**: These credentials are for development/staging only. Never use in production.

---

## Extended Auth Test (Manual)

To verify authenticated endpoints work correctly:

```bash
# 1. Get token
TOKEN=$(curl -s -X POST $API_BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.com","password":"demo1234"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Test authenticated endpoint
curl -s $API_BASE_URL/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: User object with id, email, role
```

---

## Interpreting Failures

### Health Check Fails (Connection Refused)

```
✗ FAIL Health Check - GET /health → ERROR: fetch failed
```

**Cause**: API is not running or URL is wrong.  
**Fix**: Verify `API_BASE_URL` is correct and API is deployed.

### Routes Return 404

```
✗ FAIL Inventory Items - GET /inventory/items → 404 (expected: 200|401)
```

**Cause**: Route not mounted.  
**Fix**: Check API build and module configuration.

### All Routes Return 500

**Cause**: API crash or database connection failure.  
**Fix**: Check API logs for errors. Verify DATABASE_URL.

---

## CI/CD Integration

Add to CI pipeline:

```yaml
# .github/workflows/staging.yml
- name: Smoke Test
  env:
    API_BASE_URL: ${{ secrets.STAGING_API_URL }}
  run: node scripts/verify/smoke-verification.mjs
```

---

## Script Inputs Summary

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `API_BASE_URL` | Yes | `http://localhost:3001` | Target API URL |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |

---

*Part of Phase D3 — Staging Deployment Readiness*
