# Production Rollback Decision Matrix

> Created: 2026-01-10 | Phase F3 — Production Execution Pack

---

## Overview

Use this matrix to determine the correct rollback action based on failure type. Act quickly—production issues require immediate response.

**Related Documentation:**
- [PRODUCTION_GO_LIVE_CHECKLIST.md](./PRODUCTION_GO_LIVE_CHECKLIST.md) — Go-live steps
- [ALERT_RUNBOOK.md](./ALERT_RUNBOOK.md) — Incident response procedures
- [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md) — Complete release guide

---

## Quick Decision Tree

```
Failure detected
    │
    ├── Health check failing? ────────────────────────► ROLLBACK IMMEDIATELY
    │
    ├── 5xx spike (> 5%)? ────────────────────────────► ROLLBACK (within 5 min)
    │
    ├── Auth completely broken? ──────────────────────► ROLLBACK IMMEDIATELY
    │
    ├── Migration failure? ───────────────────────────► STOP + ASSESS + MANUAL FIX
    │
    ├── Bad environment variable? ────────────────────► FIX ENV + RESTART
    │
    ├── Minor bug / degraded feature? ────────────────► FIX FORWARD (next deploy)
    │
    └── Unknown / investigating? ─────────────────────► ROLLBACK IF > 15 min
```

---

## Rollback Matrix by Failure Type

### 1. Health Check Failing

**Symptoms:** `/healthz` returns non-200, service unreachable

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🔴 Critical | Rollback immediately | < 2 min |

**Render:**
```bash
# Dashboard → Service → Deploys → Previous deploy → Click "Rollback"
```

**Fly.io:**
```bash
fly releases -a chefcloud-prod-api
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api
```

**Post-Action:**
- [ ] Verify health restored
- [ ] Check logs for root cause
- [ ] Document incident

---

### 2. 5xx Error Spike

**Symptoms:** Error rate > 5%, multiple 500 errors in logs

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🟠 High | Rollback | < 5 min |

**Investigation First (1 min max):**
```bash
# Check logs
fly logs -a chefcloud-prod-api | grep -E '"statusCode":5'
```

**If caused by new code → Rollback:**
```bash
# Render: Use dashboard rollback
# Fly.io:
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api
```

**If caused by external service → Monitor:**
- Check database status
- Check third-party APIs
- Consider maintenance mode

---

### 3. Authentication Broken

**Symptoms:** All users getting 401, login not working

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🔴 Critical | Fix JWT_SECRET or Rollback | < 2 min |

**Check JWT_SECRET first:**
```bash
# Fly.io
fly secrets list -a chefcloud-prod-api | grep JWT_SECRET

# Verify it matches expected value
```

**If JWT_SECRET wrong → Fix:**
```bash
fly secrets set JWT_SECRET="<correct_value>" -a chefcloud-prod-api
# Service auto-restarts
```

**If JWT_SECRET correct → Rollback code:**
```bash
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api
```

---

### 4. Bad Migration

**Symptoms:** Database errors, missing columns, data corruption

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🔴 Critical | STOP deployment, assess, manual intervention | Immediate |

**DO NOT immediately rollback code** — migration may have partially applied.

**Step 1: Stop further damage**
```bash
# Scale down to prevent more writes
fly scale count 0 -a chefcloud-prod-api  # Fly.io
# Render: Dashboard → Suspend Service
```

**Step 2: Assess migration state**
```bash
# Check migration status
fly ssh console -a chefcloud-prod-api -C "npx prisma migrate status"
```

**Step 3: Based on assessment**

| State | Action |
|-------|--------|
| Migration fully applied, just bad code | Rollback code, keep migration |
| Migration partially applied | Write compensating migration |
| Data corruption | Restore from backup |

**Step 4: If restoring from backup**
```bash
# Restore database from pre-release backup
# Provider-specific; see backup documentation

# Then redeploy previous version
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api
```

---

### 5. Bad Environment Variable

**Symptoms:** App crashes on startup, specific feature broken

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🟠 High | Fix env var, service restarts | < 5 min |

**Diagnosis:**
```bash
# Check logs for env-related errors
fly logs -a chefcloud-prod-api | grep -E "undefined|missing|config"
```

**Fix:**
```bash
# Fly.io
fly secrets set VARIABLE_NAME="correct_value" -a chefcloud-prod-api

# Render
# Dashboard → Service → Environment → Update variable
# Service auto-redeploys
```

**Verify:**
```bash
curl -s https://YOUR_PROD_API_URL/healthz
```

---

### 6. Bad Build (Won't Start)

**Symptoms:** Deployment never becomes healthy, container crashes

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🟠 High | Rollback | < 5 min |

**Most providers auto-rollback on failed health check.** If not:

```bash
# Fly.io
fly releases -a chefcloud-prod-api
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api

# Render: Previous deploy remains active if new one fails
# Dashboard → Deploy previous commit manually if needed
```

---

### 7. Performance Degradation (No Errors)

**Symptoms:** Slow responses, high latency, but no errors

| Severity | Action | Time to Act |
|----------|--------|-------------|
| 🟡 Medium | Investigate, consider rollback | < 15 min |

**Investigation:**
```bash
# Check for slow queries
fly logs -a chefcloud-prod-api | jq 'select(.responseTime > 1000)'

# Check resource usage
fly status -a chefcloud-prod-api
```

**If caused by new code:**
```bash
fly releases rollback v<PREVIOUS_VERSION> -a chefcloud-prod-api
```

**If caused by load/resources:**
```bash
# Scale up
fly scale count 3 -a chefcloud-prod-api
fly scale vm shared-cpu-2x -a chefcloud-prod-api
```

---

## Rollback Commands Summary

### Render

| Action | Command |
|--------|---------|
| View deploys | Dashboard → Service → Deploys |
| Rollback | Click previous deploy → "Rollback to this deploy" |
| Suspend | Dashboard → Service → Settings → Suspend |
| Restart | Dashboard → Service → Manual Deploy (same commit) |

### Fly.io

| Action | Command |
|--------|---------|
| List releases | `fly releases -a chefcloud-prod-api` |
| Rollback | `fly releases rollback v<N> -a chefcloud-prod-api` |
| Scale down | `fly scale count 0 -a chefcloud-prod-api` |
| Scale up | `fly scale count 2 -a chefcloud-prod-api` |
| Restart | `fly apps restart chefcloud-prod-api` |

---

## Communication Template

When rolling back:

```
🔴 PRODUCTION ROLLBACK INITIATED

Time: YYYY-MM-DD HH:MM UTC
Service: chefcloud-prod-api
Reason: [Brief description]
Action: Rolling back to v[X]
ETA: [X] minutes

Updates will follow.
```

Post-rollback:

```
✅ PRODUCTION ROLLBACK COMPLETE

Time: YYYY-MM-DD HH:MM UTC
Service: chefcloud-prod-api
Rolled back to: v[X]
Status: Healthy
Impact: [Brief description]

Post-mortem scheduled for: [Date]
```

---

## Post-Rollback Checklist

- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Error rates back to normal
- [ ] Team notified
- [ ] Incident documented
- [ ] Root cause identified
- [ ] Fix planned for next release

---

*Created as part of Phase F3 — Production Execution Pack*
