# Environment Variable Parity Matrix

> Created: 2026-01-10 | Phase D3 — Staging Deployment Readiness

---

## Overview

This document catalogs all environment variables used by the API and Web applications. Variables are marked as Required or Optional with their defaults and security implications.

---

## API Environment Variables (services/api)

### Critical (Required for Operation)

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `DATABASE_URL` | **Yes** | — | `postgresql://user:pass@host:5432/db` | Postgres connection string |
| `JWT_SECRET` | **Yes** | — | `super-secret-key-32-chars-min` | Min 32 chars, used for token signing |
| `NODE_ENV` | No | `development` | `production` | Controls debug features |
| `PORT` | No | `3001` | `3001` | HTTP listen port |

### Authentication & Security

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `JWT_EXPIRES_IN` | No | `7d` | `24h` | Token expiry duration |
| `RP_ID` | No | `localhost` | `app.chefcloud.io` | WebAuthn relying party ID |
| `ORIGIN` | No | `http://localhost:5173` | `https://app.chefcloud.io` | WebAuthn origin |
| `CORS_ORIGINS` | No | `*` (dev) | `https://app.chefcloud.io,https://staging.chefcloud.io` | Comma-separated allowed origins |
| `RATE_LIMIT_PUBLIC` | No | `60` | `100` | Requests per minute (throttle) |

### Database & Cache

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `REDIS_URL` | No | — | `redis://localhost:6379` | Full Redis URL (preferred) |
| `REDIS_HOST` | No | — | `localhost` | Redis host (if not using URL) |
| `REDIS_PORT` | No | `6379` | `6379` | Redis port |
| `REDIS_REQUIRED` | No | `0` | `1` | If `1`, fail startup without Redis |

### Observability

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `SENTRY_DSN` | No | — | `https://xxx@sentry.io/123` | Error tracking |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | `http://otel-collector:4317` | OpenTelemetry endpoint |
| `METRICS_ENABLED` | No | `0` | `1` | Enable `/metrics` endpoint |
| `LOG_LEVEL` | No | `info` | `debug` | pino log level |
| `PRETTY_LOGS` | No | `0` | `1` | Pretty print (dev only) |
| `LOG_SILENCE_HEALTH` | No | `0` | `1` | Silence /health logs |
| `LOG_SILENCE_METRICS` | No | `0` | `1` | Silence /metrics logs |

### Feature Flags

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `DEVPORTAL_ENABLED` | No | `0` | `1` | Enable /dev/* routes (OWNER only) |
| `DOCS_ENABLED` | No | `0` | `1` | Enable Swagger UI at /docs |
| `DEMO_PROTECT_WRITES` | No | `0` | `1` | Block writes to demo org |
| `DEMO_VERIFY` | No | — | `true` | Skip throttle for demo verification |

### Build Metadata

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `BUILD_VERSION` | No | from package.json | `1.2.3` | Shown in /version |
| `BUILD_SHA` | No | `unknown` | `abc123def` | Git commit SHA |
| `BUILD_DATE` | No | `unknown` | `2026-01-10T12:00:00Z` | Build timestamp |
| `GIT_COMMIT_SHA` | No | — | `abc123` | Alternative commit var |
| `RENDER_GIT_COMMIT` | No | — | `abc123` | Render.com auto-set |

### Stream/SSE Configuration

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `STREAM_KEEPALIVE_SEC` | No | `15` | `30` | SSE keepalive interval |
| `STREAM_MAX_CLIENTS` | No | `200` | `500` | Max concurrent SSE clients |

### Integration/Payment (Optional)

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `PAY_MTN_ENABLED` | No | `false` | `true` | Enable MTN Mobile Money |
| `PAY_AIRTEL_ENABLED` | No | `false` | `true` | Enable Airtel Money |
| `WH_SECRET` | No | — | `whsec_xxx` | Webhook signing secret |
| `WH_SECRET_REQUIRED` | No | `0` | `1` | Require webhook secret |
| `SPOUT_VERIFY` | No | `false` | `true` | Verify Spout printer certs |

### Demo/Dev Settings

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `DEFAULT_ORG_ID` | No | `demo` | `demo` | Default org for dev |
| `DEMO_TAPAS_ORG_SLUG` | No | `tapas-demo` | `tapas-demo` | Secondary demo org |
| `SUPPORT_MAX_SESSION_MIN` | No | `30` | `60` | Max support session |
| `ERROR_INCLUDE_STACKS` | No | `0` | `1` | Include stacks in errors |
| `BASE_URL` | No | `http://localhost:3001` | `https://api.chefcloud.io` | Swagger server URL |

### Cache TTL Tuning

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `E22_OVERVIEW_TTL` | No | `15` | `30` | Franchise overview cache (sec) |
| `E22_RANKINGS_TTL` | No | `30` | `60` | Franchise rankings cache |
| `E22_BUDGETS_TTL` | No | `60` | `120` | Franchise budgets cache |

---

## Web Environment Variables (apps/web)

### Critical

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:3001` | `https://api.chefcloud.io` | API base URL |

### Optional Features

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `NEXT_PUBLIC_APP_VERSION` | No | `dev` | `1.2.3` | Displayed version |
| `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK` | No | `false` | `true` | Enable demo data fallbacks |
| `NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT` | No | `0` | `1` | Enable session idle timeout |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | No | `15` | `30` | Idle timeout minutes |
| `NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES` | No | `2` | `5` | Warning before logout |
| `NEXT_PUBLIC_ENABLE_POS_SW` | No | `true` | `false` | Enable POS service worker |
| `NEXT_PUBLIC_POS_CACHE_MAX_AGE_HOURS` | No | `24` | `48` | POS cache TTL |

### DevPortal Config (if enabled)

| Variable | Required | Default | Example | Notes |
|----------|----------|---------|---------|-------|
| `NEXT_PUBLIC_SANDBOX_API_BASE_URL` | No | `https://sandbox.api.chefcloud.io` | — | DevPortal sandbox URL |
| `NEXT_PUBLIC_PRODUCTION_API_BASE_URL` | No | `https://api.chefcloud.io` | — | DevPortal prod URL |
| `NEXT_PUBLIC_DEV_DOCS_URL` | No | — | `https://docs.chefcloud.io` | External docs link |

---

## Summary

| Category | API Vars | Web Vars | Critical |
|----------|----------|----------|----------|
| Database | 1 | 0 | DATABASE_URL |
| Auth | 5 | 0 | JWT_SECRET |
| Cache | 4 | 0 | — |
| Observability | 7 | 0 | — |
| Feature Flags | 4 | 5 | — |
| Build Metadata | 5 | 1 | — |
| **Total** | ~35 | ~10 | 3 |

---

## Top 10 Critical Variables for Staging

1. `DATABASE_URL` — Postgres connection (API)
2. `JWT_SECRET` — Token signing key (API)
3. `NEXT_PUBLIC_API_URL` — API base URL (Web)
4. `NODE_ENV` — Set to `staging` or `production`
5. `CORS_ORIGINS` — Allow staging domain
6. `REDIS_URL` — If caching/sessions required
7. `SENTRY_DSN` — Error tracking
8. `DEVPORTAL_ENABLED` — Keep `0` unless needed
9. `DOCS_ENABLED` — Keep `0` in production
10. `RATE_LIMIT_PUBLIC` — Tune for expected load

---

*Part of Phase D3 — Staging Deployment Readiness*
