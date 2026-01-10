# Production Smoke & Preflight Verification Guide

> Created: 2026-01-10 | Phase F3 — Production Execution Pack

---

## Overview

This guide provides exact commands for running automated verification scripts against production environments. These scripts are **non-destructive** and safe to run at any time.

**Scripts Available:**

| Script | Purpose | Location |
|--------|---------|----------|
| `smoke-verification.mjs` | Core endpoint health checks | `scripts/verify/smoke-verification.mjs` |
| `production-preflight.mjs` | Security defaults validation | `scripts/verify/production-preflight.mjs` |
| `staging-preflight.mjs` | Staging environment validation | `scripts/verify/staging-preflight.mjs` |

---

## Quick Reference

### Production Verification

```bash
# Set your production API URL
export API_BASE_URL=https://your-prod-api.example.com

# Run production preflight (security defaults)
node scripts/verify/production-preflight.mjs

# Run smoke tests (endpoint health)
node scripts/verify/smoke-verification.mjs
```

### Staging Verification

```bash
# Render staging
export API_BASE_URL=https://chefcloud-staging-api.onrender.com

# Fly.io staging
export API_BASE_URL=https://chefcloud-staging-api.fly.dev

# Run staging preflight
node scripts/verify/staging-preflight.mjs

# Run smoke tests
node scripts/verify/smoke-verification.mjs
```

---

## Script Details

### 1. Production Preflight (`production-preflight.mjs`)

Validates production security defaults are correctly configured.

**What it checks:**
| Check | Expected Result |
|-------|-----------------|
| `/healthz` | 200 OK |
| `/readiness` | 200 or 503 |
| Protected route (no token) | 401 Unauthorized |
| `/docs` | 404 (DOCS_ENABLED=0) |
| `/dev/status` | 404 (DEVPORTAL_ENABLED=0) |
| `/metrics` | Disabled message (METRICS_ENABLED=0) |
| `X-Request-Id` header | Present |
| Security headers | Helmet active |

**Command:**
```bash
API_BASE_URL=https://your-prod-api.example.com node scripts/verify/production-preflight.mjs
```

**Expected Output:**
```
═══════════════════════════════════════════════════════════════
  ChefCloud Production Preflight Verification
═══════════════════════════════════════════════════════════════

  Target: https://your-prod-api.example.com

  ── HEALTH ──
    Health Check (Liveness)... ✓ PASS (Status 200, { status: "ok" })
    Readiness Check... ✓ PASS (Status 200)

  ── SECURITY ──
    Auth Guard Active... ✓ PASS (Status 401 (auth working))
    Auth Guard on User Route... ✓ PASS (Status 401 (auth working))

  ── FEATURE-FLAGS ──
    DOCS_ENABLED=0 (Default)... ✓ PASS (Status 404 (docs disabled))
    DEVPORTAL_ENABLED=0 (Default)... ✓ PASS (Status 404 (devportal disabled))
    METRICS_ENABLED=0 (Default)... ✓ PASS (Metrics disabled (secure default))

  ── OBSERVABILITY ──
    X-Request-Id Header... ✓ PASS (X-Request-Id: abc123...)

═══════════════════════════════════════════════════════════════
  SUMMARY
═══════════════════════════════════════════════════════════════

    Passed: 9/9
    Failed: 0/9

  ✓ PREFLIGHT PASSED

  Production environment has secure defaults.
```

**Exit Codes:**
- `0` = All checks passed
- `1` = One or more checks failed

---

### 2. Smoke Verification (`smoke-verification.mjs`)

Tests core API endpoints are responding correctly.

**What it checks:**
| Check | Expected Result |
|-------|-----------------|
| Health endpoint | 200 OK |
| Auth endpoints | Present |
| Protected routes | Return 401 without auth |
| Response times | Within thresholds |

**Command:**
```bash
API_BASE_URL=https://your-prod-api.example.com node scripts/verify/smoke-verification.mjs
```

**Expected Output:**
```
ChefCloud Smoke Verification
Target: https://your-prod-api.example.com

✓ GET /health => 200 (45ms)
✓ GET /healthz => 200 (38ms)
✓ GET /auth/me => 401 (52ms)
✓ GET /inventory/items => 401 (48ms)

Summary: 4/4 passed
```

---

### 3. Staging Preflight (`staging-preflight.mjs`)

Similar to production preflight but for staging environments.

**Command:**
```bash
API_BASE_URL=https://chefcloud-staging-api.fly.dev node scripts/verify/staging-preflight.mjs
```

---

## Integration with Go-Live

### Pre-Deployment (Staging)

Before deploying to production, verify staging:

```bash
# 1. Set staging URL
export API_BASE_URL=https://chefcloud-staging-api.fly.dev

# 2. Run all checks
node scripts/verify/smoke-verification.mjs && \
node scripts/verify/staging-preflight.mjs && \
echo "✅ Staging verified, ready for production"
```

### Post-Deployment (Production)

After deploying to production, verify:

```bash
# 1. Set production URL
export API_BASE_URL=https://your-prod-api.example.com

# 2. Run all checks
node scripts/verify/production-preflight.mjs && \
node scripts/verify/smoke-verification.mjs && \
echo "✅ Production verified, deployment successful"
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  verify-production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Run Production Preflight
        env:
          API_BASE_URL: ${{ secrets.PRODUCTION_API_URL }}
        run: node scripts/verify/production-preflight.mjs
        
      - name: Run Smoke Tests
        env:
          API_BASE_URL: ${{ secrets.PRODUCTION_API_URL }}
        run: node scripts/verify/smoke-verification.mjs
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Connection refused | API not running | Check health in provider dashboard |
| SSL error | Certificate issue | Verify HTTPS is configured |
| 401 on all routes | JWT_SECRET not set | Check secrets in provider |
| 404 on /healthz | Wrong base URL | Verify API_BASE_URL is correct |
| Timeout | Network/firewall | Check if IP is allowed |

### Debug Mode

If checks fail, run individual curl commands:

```bash
# Test health
curl -v https://your-prod-api.example.com/healthz

# Test auth
curl -v https://your-prod-api.example.com/auth/me

# Test docs disabled
curl -v https://your-prod-api.example.com/docs

# Check headers
curl -I https://your-prod-api.example.com/healthz
```

---

## Related Documentation

- [PRODUCTION_GO_LIVE_CHECKLIST.md](../../runbooks/PRODUCTION_GO_LIVE_CHECKLIST.md) — Complete go-live steps
- [PRODUCTION_ROLLBACK_MATRIX.md](../../runbooks/PRODUCTION_ROLLBACK_MATRIX.md) — Rollback decision tree
- [MONITORING_ALERTING.md](../ops/MONITORING_ALERTING.md) — Monitoring configuration
- [STAGING_SMOKE_GUIDE.md](./STAGING_SMOKE_GUIDE.md) — Staging-specific guide

---

*Created as part of Phase F3 — Production Execution Pack*
