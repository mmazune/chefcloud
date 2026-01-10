# Production Monitoring & Alerting

> Phase F2 — Production Observability Baseline  
> Generated: 2026-01-10

---

## Overview

ChefCloud API provides production-grade observability through:

| Component | Purpose | Flag/Config |
|-----------|---------|-------------|
| **Structured Logging** | Request tracing, audit | Always on (pino) |
| **Sentry** | Error tracking, performance | `SENTRY_DSN` env var |
| **Prometheus Metrics** | System/custom metrics | `METRICS_ENABLED=1` |
| **Health Endpoints** | Liveness/readiness checks | Always on |

---

## 1. Structured Logging

All HTTP requests are logged with consistent structured fields.

### Log Fields

| Field | Description | Source |
|-------|-------------|--------|
| `requestId` | Correlation ID for request tracing | X-Request-Id header or auto-generated UUID |
| `userId` | Authenticated user ID (if present) | JWT token payload |
| `method` | HTTP method | Request |
| `url` | Request path | Request |
| `ip` | Client IP (trusted proxy) | Request |
| `statusCode` | Response status | Response |
| `responseTime` | Duration in ms | Measured |

### Example Log Entry (JSON)

```json
{
  "level": "info",
  "time": 1736510400000,
  "requestId": "abc123-def456",
  "userId": "usr_1234",
  "method": "POST",
  "url": "/inventory/items",
  "statusCode": 201,
  "responseTime": 45
}
```

### Searching Logs

```bash
# Find all requests for a specific requestId
grep "abc123-def456" /var/log/chefcloud/*.log

# Find all errors for a user
jq 'select(.userId == "usr_1234" and .level == "error")' api.log

# Find slow requests (> 1s)
jq 'select(.responseTime > 1000)' api.log
```

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error) |
| `PRETTY_LOGS` | `0` | `1` enables pino-pretty (dev only) |
| `LOG_SILENCE_HEALTH` | `0` | `1` suppresses /healthz logs |
| `LOG_SILENCE_METRICS` | `0` | `1` suppresses /metrics logs |

---

## 2. Sentry Integration

Sentry provides error tracking and performance monitoring.

### Enablement

Sentry is **disabled by default** and activates only when `SENTRY_DSN` is set.

```bash
# Production .env
SENTRY_DSN=https://abc123@o456.ingest.sentry.io/789
```

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `SENTRY_DSN` | *(none)* | Sentry DSN; if missing, Sentry is not initialized |
| `NODE_ENV` | `development` | Environment tag sent to Sentry |

### Sample Rates

| Environment | Traces Sample Rate |
|-------------|-------------------|
| Production | 20% (`0.2`) |
| Development | 100% (`1.0`) |

### What Gets Captured

- Unhandled exceptions
- HTTP 5xx responses
- Custom breadcrumbs (if added)
- Performance traces (with sampling)

### Setup Steps

1. Create Sentry project at https://sentry.io
2. Get DSN from Project Settings → Client Keys
3. Add `SENTRY_DSN` to production environment
4. Deploy and verify in Sentry dashboard

---

## 3. Prometheus Metrics

Custom and system metrics exposed in Prometheus format.

### Enablement

Metrics endpoint is **disabled by default**.

```bash
# Enable metrics
METRICS_ENABLED=1
```

### Endpoint

```
GET /metrics
```

Returns Prometheus text format when enabled.

### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `chefcloud_*` | Various | - | Node.js default metrics (memory, CPU, GC) |
| `cache_hits_total` | Counter | endpoint | Cache hits by endpoint |
| `cache_misses_total` | Counter | endpoint | Cache misses by endpoint |
| `rate_limit_hits_total` | Counter | route, kind | Rate-limited requests |
| `webhook_verification_total` | Counter | result | Webhook signature verifications |
| `cache_invalidations_total` | Counter | prefix | Cache invalidations |
| `db_query_ms_seconds` | Histogram | endpoint, cached | Database query latency |
| `sse_clients_gauge` | Gauge | - | Current SSE connections |

### Security Considerations

When `METRICS_ENABLED=1`:

1. **Internal Network Only**: Prefer exposing metrics on internal port or behind auth
2. **No PII**: Metrics do not contain personally identifiable information
3. **Rate Limiting**: Consider rate-limiting /metrics if exposed publicly

> **Production Recommendation**: Keep `METRICS_ENABLED=0` unless you have Prometheus configured and have verified the endpoint is not publicly accessible.

### Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'chefcloud-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['api-internal:3001']
    metrics_path: /metrics
```

---

## 4. Health Endpoints

### Liveness Probe

```
GET /healthz
```

Returns `200 OK` if the process is running.

```json
{ "status": "ok" }
```

### Readiness Probe

```
GET /readiness
```

Returns `200 OK` if database and dependencies are healthy.

```json
{
  "status": "ok",
  "db": true,
  "redis": true
}
```

Returns `503 Service Unavailable` if degraded:

```json
{
  "status": "degraded",
  "db": false,
  "redis": true
}
```

### Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 15
  
readinessProbe:
  httpGet:
    path: /readiness
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 5. Alert Thresholds (Recommended)

These are starting thresholds; adjust based on traffic patterns.

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| API Down | `/healthz` fails for 2min | Critical | Immediate investigation |
| High Error Rate | 5xx > 5% for 5min | High | Check logs, rollback if needed |
| High Latency | P95 > 2s for 5min | Medium | Investigate slow queries |
| DB Connection Failed | Readiness check fails | Critical | Check DB connectivity |
| Redis Connection Failed | Readiness check fails | High | Check Redis connectivity |
| Auth Failure Spike | 401s > 10x baseline | Medium | Possible brute force attack |
| Rate Limit Spike | `rate_limit_hits_total` > 1000/min | Low | Check for abuse |

### Example Prometheus Alert Rules

```yaml
groups:
  - name: chefcloud
    rules:
      - alert: APIDown
        expr: up{job="chefcloud-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "ChefCloud API is down"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: high
        annotations:
          summary: "High 5xx error rate detected"
```

---

## 6. Feature Flags (Security Defaults)

All developer/debug features are OFF by default in production.

| Flag | Default | Description |
|------|---------|-------------|
| `DEVPORTAL_ENABLED` | `0` | Developer Portal (API key management) |
| `DOCS_ENABLED` | `0` | Swagger/OpenAPI documentation |
| `METRICS_ENABLED` | `0` | Prometheus metrics endpoint |
| `ERROR_INCLUDE_STACKS` | `0` | Stack traces in error responses |

> ⚠️ **Never set these to 1 in production unless specifically required and secured.**

---

## 7. Verification

Run the production preflight script to verify monitoring baseline:

```bash
API_BASE_URL=https://your-prod-api.example.com node scripts/verify/production-preflight.mjs
```

See: [runbooks/ALERT_RUNBOOK.md](../../runbooks/ALERT_RUNBOOK.md) for incident response.

---

## Related Documents

- [PRODUCTION_RELEASE_RUNBOOK.md](../../runbooks/PRODUCTION_RELEASE_RUNBOOK.md)
- [PRODUCTION_SECURITY_DEFAULTS.md](../security/PRODUCTION_SECURITY_DEFAULTS.md)
- [PRODUCTION_ENV_MATRIX.md](../../runbooks/PRODUCTION_ENV_MATRIX.md)
- [ALERT_RUNBOOK.md](../../runbooks/ALERT_RUNBOOK.md)

---

*This document is part of Phase F2 Production Monitoring Baseline.*
