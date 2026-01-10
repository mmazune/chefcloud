# Staging Environment Assertions

> Created: 2026-01-10 | Phase E4 — Staging Verification Pack

---

## Overview

This document lists "must be true" assertions for a properly configured staging environment. Use these to detect misconfigurations without requiring access to secrets.

**Related Documentation:**
- [ENV_PARITY_MATRIX.md](../runbooks/ENV_PARITY_MATRIX.md) — Complete environment variable catalog
- [STAGING_GO_LIVE_CHECKLIST.md](../../runbooks/STAGING_GO_LIVE_CHECKLIST.md) — Full go-live checklist
- [staging-preflight.mjs](../../scripts/verify/staging-preflight.mjs) — Automated assertions script

---

## Must-Be-True Assertions

### 1. API Health Assertion

**Assertion:** API is running and responds to health checks.

```bash
# Test
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health

# Expected
200

# Failure indicates
# - API not running
# - Incorrect API_BASE_URL
# - Network/firewall issue
```

---

### 2. Database Connectivity Assertion

**Assertion:** API can connect to PostgreSQL database.

```bash
# Test (health endpoint returns JSON with db status)
curl -s $API_BASE_URL/health | jq -r '.database // .status'

# Expected
"ok" or "healthy" or similar positive indicator

# Failure indicates
# - DATABASE_URL not set or invalid
# - Database unreachable
# - Wrong credentials
```

---

### 3. JWT/Auth Guard Assertion

**Assertion:** Protected endpoints require authentication.

```bash
# Test
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/inventory/items

# Expected
401

# Failure indicates
# - JWT_SECRET not set (auth disabled)
# - AuthGuard not applied
# - Endpoint incorrectly marked public
```

---

### 4. CORS Configuration Assertion

**Assertion:** CORS headers are present for cross-origin requests.

```bash
# Test
curl -s -I -X OPTIONS $API_BASE_URL/health \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control-allow"

# Expected (at least one of)
Access-Control-Allow-Origin: *
# or
Access-Control-Allow-Origin: https://chefcloud-staging-web.fly.dev
# or similar configured origin

# Failure indicates
# - CORS_ORIGINS not set
# - CORS middleware not applied
# - Origin not in allowed list
```

---

### 5. Feature Flags Disabled Assertion

**Assertion:** Optional features are disabled by default in staging.

```bash
# Test DOCS_ENABLED=0
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/docs

# Expected
404 or 302 (redirect) or 403

# Test DEVPORTAL_ENABLED=0
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/dev/api-keys

# Expected
404

# Test METRICS_ENABLED=0
curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/metrics

# Expected
404

# Failure indicates
# - Feature flag set to 1 unexpectedly
# - Security exposure in staging
```

---

### 6. Redis Connectivity Assertion (Optional)

**Assertion:** If Redis is configured, API can connect to it.

```bash
# Test (if Redis status exposed in health)
curl -s $API_BASE_URL/health | jq -r '.redis // "not_exposed"'

# Expected (if Redis configured)
"ok" or "connected"

# Expected (if Redis not configured)
"not_exposed" or null

# Failure indicates
# - REDIS_URL invalid
# - Redis server unreachable
# - REDIS_REQUIRED=1 but Redis down
```

---

### 7. Web App Assertion

**Assertion:** Web application is running and serves HTML.

```bash
# Test
curl -s -o /dev/null -w "%{http_code}" $WEB_BASE_URL/

# Expected
200

# Check content type
curl -s -I $WEB_BASE_URL/ | grep -i "content-type"

# Expected
Content-Type: text/html

# Failure indicates
# - Web app not deployed
# - Build failed
# - Wrong URL
```

---

### 8. API URL Configured in Web Assertion

**Assertion:** Web app can reach the API (NEXT_PUBLIC_API_URL set correctly).

```bash
# Test (check if web app's runtime config points to correct API)
# This requires browser inspection or network tab check

# Alternative: Check if login page loads and form submits to correct API
# Open $WEB_BASE_URL/login in browser
# Check Network tab for API call destination

# Failure indicates
# - NEXT_PUBLIC_API_URL not set
# - API URL mismatch
# - Build-time env vars not applied
```

---

## Quick Assertion Script

Run all assertions in sequence:

```bash
#!/bin/bash
API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"

echo "=== Staging Environment Assertions ==="
echo "API: $API_BASE_URL"
echo "Web: $WEB_BASE_URL"
echo ""

# 1. Health
status=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health)
[[ "$status" == "200" ]] && echo "✓ Health: PASS" || echo "✗ Health: FAIL ($status)"

# 2. Auth Guard
status=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/inventory/items)
[[ "$status" == "401" ]] && echo "✓ Auth Guard: PASS" || echo "✗ Auth Guard: FAIL ($status, expected 401)"

# 3. Docs Disabled
status=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/docs)
[[ "$status" == "404" || "$status" == "302" || "$status" == "403" ]] && echo "✓ Docs Disabled: PASS" || echo "✗ Docs Disabled: FAIL ($status)"

# 4. DevPortal Disabled
status=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/dev/api-keys)
[[ "$status" == "404" ]] && echo "✓ DevPortal Disabled: PASS" || echo "✗ DevPortal Disabled: FAIL ($status)"

# 5. Web Accessible
status=$(curl -s -o /dev/null -w "%{http_code}" $WEB_BASE_URL/)
[[ "$status" == "200" ]] && echo "✓ Web App: PASS" || echo "✗ Web App: FAIL ($status)"

echo ""
echo "=== Assertions Complete ==="
```

---

## Failure Response Matrix

| Assertion | Failure | Likely Cause | Fix |
|-----------|---------|--------------|-----|
| Health | 5xx | App crashed | Check logs, restart |
| Health | Connection refused | App not running | Deploy or start container |
| Auth Guard | 200 | JWT_SECRET not set | Set JWT_SECRET env var |
| Docs Disabled | 200 | DOCS_ENABLED=1 | Set DOCS_ENABLED=0 |
| DevPortal | 200 | DEVPORTAL_ENABLED=1 | Set DEVPORTAL_ENABLED=0 |
| CORS | No headers | CORS not configured | Set CORS_ORIGINS |
| Web App | 5xx | Build failed | Check build logs |

---

## Platform-Specific Notes

### Docker
- All assertions should work with `localhost:3001` (API) and `localhost:3000` (Web)
- Use `docker logs` to diagnose failures

### Render
- Allow 30-60 seconds after deploy for services to warm up
- First request may be slow (cold start)
- Check service status in dashboard before running assertions

### Fly.io
- Machines may be stopped if `auto_stop_machines = true`
- First request wakes the machine (1-3 second delay)
- Use `fly status` to check machine state

---

*This document is part of Phase E4 Staging Verification Pack. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
