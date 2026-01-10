# Docker Staging Deployment Runbook

> Created: 2026-01-10 | Phase E1 — Docker Staging Environment  
> Updated: 2026-01-10 | Phase E3.1 — Developer Ergonomics Scripts

---

## Overview

This runbook provides step-by-step instructions for deploying ChefCloud in a deterministic "staging-like" local environment using Docker Compose.

| Component | Container | Port | Health Endpoint |
|-----------|-----------|------|-----------------|
| PostgreSQL | `chefcloud-staging-postgres` | 5433 | pg_isready |
| Redis | `chefcloud-staging-redis` | 6380 | redis-cli ping |
| API | `chefcloud-staging-api` | 3001 | GET /health |
| Web | `chefcloud-staging-web` | 3000 | GET / |

---

## pnpm Scripts (Recommended)

All staging operations are available as pnpm scripts from the repo root:

| Script | Command | Description |
|--------|---------|-------------|
| `pnpm staging:up` | Build and start stack (detached) | Main entry point |
| `pnpm staging:down` | Stop stack (preserve data) | Graceful shutdown |
| `pnpm staging:down:clean` | Stop stack + delete volumes | Full reset |
| `pnpm staging:logs` | Tail all container logs | Live output |
| `pnpm staging:logs:api` | Tail API logs only | Debug API |
| `pnpm staging:logs:web` | Tail Web logs only | Debug Web |
| `pnpm staging:migrate` | Run prisma migrate deploy | Safe migrations |
| `pnpm staging:seed` | Run prisma db seed | Demo data only |
| `pnpm staging:smoke` | Run smoke verification | API health check |
| `pnpm staging:shell` | Shell into API container | Debug access |

---

## Prerequisites

### Required Software

- Docker 24.0+ with Docker Compose v2
- Git
- Node.js 20+ (for smoke verification only)

### Verify Docker Installation

```bash
docker --version        # Should be 24.0+
docker compose version  # Should be v2.x
```

---

## Step 1: Clone and Setup

```bash
# Clone repository (if not already)
git clone https://github.com/mmazune/nimbuspos.git
cd nimbuspos

# Ensure on main branch
git checkout main
git pull origin main
```

---

## Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.docker.staging.example .env.docker.staging

# Edit and set required values
# REQUIRED: JWT_SECRET (min 32 chars)
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (32+ chars) | `openssl rand -base64 32` |

### Optional Environment Variables

See [docs/runbooks/ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) for the complete list.

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_PASSWORD` | `chefcloud_staging_pw` | Database password |
| `DEVPORTAL_ENABLED` | `0` | Enable DevPortal (OWNER only) |
| `DOCS_ENABLED` | `0` | Enable Swagger at /docs |
| `LOG_LEVEL` | `info` | Logging verbosity |

---

## Step 3: Build and Start

```bash
# Using pnpm script (recommended)
pnpm staging:up

# Or manually with docker compose
docker compose -f docker-compose.staging.yml up --build -d
```

### Expected Startup Output

```
✔ Container chefcloud-staging-postgres  Healthy
✔ Container chefcloud-staging-redis     Healthy
✔ Container chefcloud-staging-api       Healthy
✔ Container chefcloud-staging-web       Started
```

---

## Step 4: Run Database Migrations

**⚠️ IMPORTANT:** Migrations are NOT run automatically to prevent accidental data loss.

```bash
# Using pnpm script (recommended)
pnpm staging:migrate

# Or manually
docker compose -f docker-compose.staging.yml exec api npx prisma migrate deploy

# Expected output:
# Prisma Migrate applied X migrations
```

---

## Step 5: Seed Demo Data (Optional)

> **⚠️ Demo Only:** This seeds test data for development/demo purposes.

```bash
# Using pnpm script (recommended)
pnpm staging:seed

# Or manually
docker compose -f docker-compose.staging.yml exec api npx prisma db seed

# Expected output:
# 🌱 Seeding complete
```

### Demo Credentials

After seeding, you can log in with:

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.com` | `demo1234` |
| Manager | `manager@demo.com` | `demo1234` |
| Cashier | `cashier@demo.com` | `demo1234` |

See [docs/overview/SAMPLE_DATA_AND_SEEDS.md](../docs/overview/SAMPLE_DATA_AND_SEEDS.md) for complete credentials.

---

## Step 6: Verify Deployment

### 6.1 Manual Browser Verification

| Service | URL | Expected |
|---------|-----|----------|
| Web UI | http://localhost:3000 | Login page |
| API Health | http://localhost:3001/health | `{ "status": "ok" }` |
| API Version | http://localhost:3001/version | Version JSON |

### 6.2 Run Smoke Verification Script

```bash
# Using pnpm script (recommended)
pnpm staging:smoke

# Or manually
API_BASE_URL=http://localhost:3001 node scripts/verify/smoke-verification.mjs
```

### Expected Smoke Output

```
🔍 Running ChefCloud Smoke Verification
   Target: http://localhost:3001

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

## Step 7: View Logs

```bash
# All services (pnpm)
pnpm staging:logs

# API only (pnpm)
pnpm staging:logs:api

# Web only (pnpm)
pnpm staging:logs:web

# Or manually with docker compose
docker compose -f docker-compose.staging.yml logs -f
docker compose -f docker-compose.staging.yml logs -f api
docker compose -f docker-compose.staging.yml logs -f web
```

---

## Step 8: Shutdown and Cleanup

### Stop Services (Preserve Data)

```bash
# Using pnpm script (recommended)
pnpm staging:down

# Or manually
docker compose -f docker-compose.staging.yml down
```

### Stop and Remove Volumes (Full Reset)

```bash
# Using pnpm script (recommended)
pnpm staging:down:clean

# Or manually
docker compose -f docker-compose.staging.yml down -v
```

### Remove All Staging Artifacts

```bash
# Stop containers, remove volumes and images
docker compose -f docker-compose.staging.yml down -v --rmi local

# Prune unused resources
docker system prune -f
```

---

## Troubleshooting

### API Container Exits Immediately

**Symptom:** API container exits with code 1

**Check:**
1. Verify JWT_SECRET is set and at least 32 characters
2. Check postgres is healthy: `docker compose -f docker-compose.staging.yml ps`
3. View API logs: `docker compose -f docker-compose.staging.yml logs api`

### Database Connection Refused

**Symptom:** `ECONNREFUSED` or `Connection refused`

**Fix:**
1. Wait for postgres healthcheck to pass (up to 30s)
2. Verify postgres is running: `docker compose -f docker-compose.staging.yml ps postgres`
3. Check postgres logs: `docker compose -f docker-compose.staging.yml logs postgres`

### Web UI Shows Blank Page

**Symptom:** Blank page or network errors in browser console

**Check:**
1. Ensure API is healthy: `curl http://localhost:3001/health`
2. Verify NEXT_PUBLIC_API_URL is set correctly in .env.docker.staging
3. Rebuild web: `docker compose -f docker-compose.staging.yml up --build web`

### Port Already in Use

**Symptom:** `bind: address already in use`

**Fix:**
1. Stop conflicting services: `docker ps` and `docker stop <container>`
2. Or change ports in docker-compose.staging.yml

### Migrations Fail

**Symptom:** `P3009` or migration errors

**Fix:**
1. Check database connectivity
2. For fresh start: `docker compose -f docker-compose.staging.yml down -v`
3. Re-run migrations after restart

---

## Quick Reference

```bash
# ============ pnpm Scripts (Recommended) ============
pnpm staging:up           # Start stack (detached)
pnpm staging:down         # Stop (preserve data)
pnpm staging:down:clean   # Stop + delete volumes
pnpm staging:migrate      # Run migrations
pnpm staging:seed         # Seed demo data
pnpm staging:smoke        # Run smoke test
pnpm staging:logs         # Tail all logs
pnpm staging:logs:api     # Tail API logs
pnpm staging:shell        # Shell into API container

# ============ Raw Docker Commands ============
docker compose -f docker-compose.staging.yml up --build -d
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml down -v
docker compose -f docker-compose.staging.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.staging.yml exec api npx prisma db seed
API_BASE_URL=http://localhost:3001 node scripts/verify/smoke-verification.mjs
docker compose -f docker-compose.staging.yml logs -f api
docker compose -f docker-compose.staging.yml exec api sh
```

---

## Related Documentation

- [ENV_PARITY_MATRIX.md](../docs/runbooks/ENV_PARITY_MATRIX.md) — Complete environment variable reference
- [SAMPLE_DATA_AND_SEEDS.md](../docs/overview/SAMPLE_DATA_AND_SEEDS.md) — Demo data and credentials
- [STAGING_SMOKE_GUIDE.md](../docs/runbooks/STAGING_SMOKE_GUIDE.md) — Staging verification guide

---

*Phase E1 — Docker Staging Environment*
