# Alert Runbook

> Phase F2 — Production Incident Response  
> Generated: 2026-01-10

---

## Quick Reference

| Alert | Severity | First Response | Escalation |
|-------|----------|----------------|------------|
| API Down | 🔴 Critical | Check process, restart | Immediately |
| DB Down | 🔴 Critical | Check connection string, DB status | Immediately |
| Redis Down | 🟠 High | Check Redis, app continues degraded | 15 min |
| 5xx Spike | 🟠 High | Check logs, consider rollback | 10 min |
| Auth Failure Spike | 🟡 Medium | Check for brute force | 30 min |
| High Latency | 🟡 Medium | Check slow queries | 30 min |

---

## Alert: API Down

### Symptoms
- `/healthz` returns non-200 or times out
- No responses from API
- Monitoring shows `up == 0`

### Diagnosis

```bash
# 1. Check if process is running
curl -s https://YOUR_API_URL/healthz

# 2. Check logs for crash
# Render:
render logs --service chefcloud-api --tail 100

# Fly.io:
fly logs -a chefcloud-api

# 3. Check recent deployments
git log --oneline -5
```

### Resolution

```bash
# Option 1: Restart the service
# Render: Use dashboard or CLI
render restart --service chefcloud-api

# Fly.io:
fly apps restart chefcloud-api

# Option 2: Rollback if recent deploy caused issue
# See PRODUCTION_RELEASE_RUNBOOK.md for rollback procedures
```

### Post-Incident
- [ ] Identify root cause (OOM, crash, config issue?)
- [ ] Check if restart resolved or if rollback needed
- [ ] Update incident log

---

## Alert: DB Down

### Symptoms
- `/readiness` shows `db: false`
- 500 errors mentioning Prisma/database
- "Cannot connect to database" in logs

### Diagnosis

```bash
# 1. Check readiness endpoint
curl -s https://YOUR_API_URL/readiness | jq

# 2. Check DB provider status
# - Supabase: status.supabase.com
# - Neon: status.neon.tech
# - Railway: status.railway.app

# 3. Test connection directly (if you have access)
psql $DATABASE_URL -c "SELECT 1"
```

### Resolution

| Cause | Action |
|-------|--------|
| DB provider outage | Wait for provider, monitor status page |
| Connection pool exhausted | Restart API to reset connections |
| Wrong DATABASE_URL | Verify env var in deployment |
| Network/firewall issue | Check allowed IPs in DB provider |

```bash
# Restart to reset connection pool
fly apps restart chefcloud-api  # Fly.io
render restart --service chefcloud-api  # Render
```

### Post-Incident
- [ ] Verify connections recovered
- [ ] Check for connection leak if recurring
- [ ] Review connection pool settings

---

## Alert: Redis Down

### Symptoms
- `/readiness` shows `redis: false`
- Cache operations timing out
- Rate limiting not working

### Diagnosis

```bash
# 1. Check readiness
curl -s https://YOUR_API_URL/readiness | jq

# 2. Check Redis provider status
# - Upstash: status.upstash.com
# - Redis Cloud: status.redis.com

# 3. Test connection (if you have access)
redis-cli -u $REDIS_URL ping
```

### Resolution

| Cause | Action |
|-------|--------|
| Redis provider outage | Wait for provider; API continues without cache |
| Wrong REDIS_URL | Verify env var in deployment |
| Connection limit | Check usage against plan limits |

> **Note**: ChefCloud API is designed to operate in degraded mode without Redis. Rate limiting and caching will be disabled, but core functionality continues.

### Post-Incident
- [ ] Verify Redis recovered
- [ ] Check cache hit rates returned to normal
- [ ] Review Redis plan limits if capacity issue

---

## Alert: 5xx Spike

### Symptoms
- Error rate > 5% for sustained period
- Sentry showing new exceptions
- User reports of failures

### Diagnosis

```bash
# 1. Check recent errors in logs
fly logs -a chefcloud-api | grep -E '"level":"error"|"statusCode":5'

# 2. Check Sentry for new issues
# Go to Sentry dashboard → Issues → Sort by First Seen

# 3. Check if correlates with deployment
git log --oneline -10
```

### Resolution

| Cause | Action |
|-------|--------|
| Bad deployment | Rollback to previous version |
| Transient issue | Monitor, may self-resolve |
| External service failure | Check third-party status |
| Resource exhaustion | Scale up or restart |

```bash
# Rollback if caused by recent deploy
# Fly.io:
fly releases -a chefcloud-api
fly releases rollback v123 -a chefcloud-api

# Render:
# Use dashboard to rollback to previous deploy
```

### Post-Incident
- [ ] Identify root cause
- [ ] Fix forward or confirm rollback stable
- [ ] Post-mortem if significant impact

---

## Alert: Auth Failure Spike

### Symptoms
- 401 responses > 10x normal rate
- `auth_failures_total` metric spiking
- Concentrated from specific IPs

### Diagnosis

```bash
# 1. Check for concentrated IPs in logs
grep '"statusCode":401' api.log | jq '.ip' | sort | uniq -c | sort -rn | head

# 2. Check if legitimate (e.g., expired tokens) or attack
# Look for patterns: same IP, sequential attempts, credential stuffing patterns

# 3. Check rate limiting is active
curl -s https://YOUR_API_URL/metrics | grep rate_limit
```

### Resolution

| Cause | Action |
|-------|--------|
| Brute force attack | Rate limiting should block; monitor |
| Expired tokens (legitimate) | Users need to re-login; normal |
| JWT_SECRET rotation issue | Check JWT_SECRET is correct |
| Client bug | Investigate client-side |

```bash
# If severe attack and rate limiting insufficient:
# Consider IP block at CDN/firewall level
```

### Post-Incident
- [ ] Verify rate limiting blocked attack
- [ ] Check if any accounts compromised
- [ ] Consider additional security measures

---

## Alert: High Latency

### Symptoms
- P95 latency > 2 seconds
- User complaints about slowness
- Timeouts in client apps

### Diagnosis

```bash
# 1. Check slow queries in logs
jq 'select(.responseTime > 1000)' api.log | head -20

# 2. Check which endpoints are slow
jq 'select(.responseTime > 1000) | .url' api.log | sort | uniq -c | sort -rn

# 3. Check DB query metrics
curl -s https://YOUR_API_URL/metrics | grep db_query_ms
```

### Resolution

| Cause | Action |
|-------|--------|
| Missing database index | Add index, deploy |
| N+1 query | Optimize query with includes |
| Large result sets | Add pagination |
| External service slow | Check third-party status |
| Resource exhaustion | Scale up |

```bash
# Quick mitigation: restart to clear any stuck connections
fly apps restart chefcloud-api
```

### Post-Incident
- [ ] Identify specific slow queries
- [ ] Add indexes or optimize as needed
- [ ] Consider query monitoring tools

---

## Escalation Contacts

| Role | Contact | When |
|------|---------|------|
| On-Call Engineer | (configure in PagerDuty/Opsgenie) | All critical alerts |
| Engineering Lead | (configure) | Outages > 30 min |
| Database Admin | (configure) | DB issues |

---

## Related Documents

- [MONITORING_ALERTING.md](../docs/ops/MONITORING_ALERTING.md)
- [PRODUCTION_RELEASE_RUNBOOK.md](./PRODUCTION_RELEASE_RUNBOOK.md)
- [PRODUCTION_SECURITY_DEFAULTS.md](../docs/security/PRODUCTION_SECURITY_DEFAULTS.md)

---

*This document is part of Phase F2 Production Monitoring Baseline.*
