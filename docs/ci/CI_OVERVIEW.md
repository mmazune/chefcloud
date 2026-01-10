# CI Overview

> Created: 2026-01-10 | Phase E2 — GitHub Actions CI

---

## Overview

ChefCloud uses GitHub Actions for continuous integration. The CI pipeline enforces code quality gates on every push and pull request to the `main` branch.

---

## Triggers

| Event | Branch | Jobs Run |
|-------|--------|----------|
| `push` | `main` | sanity → api → web → smoke |
| `pull_request` | `main` | sanity → api → web |

> **Note:** The `smoke` job only runs on push to `main` (not on PRs) to conserve CI resources.

---

## Jobs

### 1. Sanity (Import Firewall)

**Purpose:** Fail fast if any production code imports from `wip/` or `_quarantine/` folders.

| Step | Command |
|------|---------|
| Verify no WIP imports | `pnpm verify:no-wip-imports` |

**Local Reproduction:**
```bash
pnpm verify:no-wip-imports
```

---

### 2. API (Lint & Build)

**Purpose:** Ensure API code passes linting and compiles successfully.

| Step | Command |
|------|---------|
| Generate Prisma Client | `cd packages/db && pnpm run db:generate` |
| Lint | `pnpm -C services/api lint` |
| Build | `pnpm -C services/api build` |

**Local Reproduction:**
```bash
cd packages/db && pnpm run db:generate
pnpm -C services/api lint
pnpm -C services/api build
```

---

### 3. Web (Lint & Build)

**Purpose:** Ensure Web (Next.js) code passes linting and compiles successfully.

| Step | Command |
|------|---------|
| Lint | `pnpm -C apps/web lint` |
| Build | `pnpm -C apps/web build` |

**Local Reproduction:**
```bash
pnpm -C apps/web lint
pnpm -C apps/web build
```

---

### 4. Smoke (Docker Integration) — Main Branch Only

**Purpose:** Verify the full Docker Compose stack starts and responds to health checks.

| Step | Command |
|------|---------|
| Start Stack | `docker compose -f docker-compose.staging.yml up -d --build` |
| Wait for Health | Poll `http://localhost:3001/health` |
| Run Migrations | `docker compose exec api npx prisma migrate deploy` |
| Smoke Test | `API_BASE_URL=http://localhost:3001 node scripts/verify/smoke-verification.mjs` |
| Shutdown | `docker compose -f docker-compose.staging.yml down -v` |

**Local Reproduction:**
```bash
# Create env file
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env.docker.staging
echo "POSTGRES_PASSWORD=chefcloud_staging_pw" >> .env.docker.staging

# Start stack
docker compose -f docker-compose.staging.yml up -d --build

# Wait for health (manual check)
curl http://localhost:3001/health

# Run migrations
docker compose -f docker-compose.staging.yml exec api npx prisma migrate deploy

# Run smoke test
API_BASE_URL=http://localhost:3001 node scripts/verify/smoke-verification.mjs

# Cleanup
docker compose -f docker-compose.staging.yml down -v
```

---

## Job Dependencies

```
sanity (Import Firewall)
   │
   ├─► api (Lint & Build)
   │      │
   │      └─────┐
   │            ▼
   └─► web (Lint & Build)
              │
              └─► smoke (Docker Integration) [main only]
```

---

## Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Node.js | 20.x | `package.json` engines field |
| pnpm | 8.x | `package.json` packageManager field |
| Runner | `ubuntu-latest` | GitHub Actions |

---

## Caching

The CI pipeline uses caching to speed up builds:

| Cache | Key Pattern |
|-------|-------------|
| pnpm store | `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}` |

---

## Timeouts

All gates should complete within these local timeouts:

| Gate | Timeout |
|------|---------|
| `verify:no-wip-imports` | 60s |
| `api lint` | 5m |
| `api build` | 5m |
| `web lint` | 5m |
| `web build` | 5m |

---

## Failure Handling

| Job | On Failure |
|-----|------------|
| `sanity` | Blocks all other jobs — production code must not import from WIP |
| `api` | Blocks smoke — API must lint and build |
| `web` | Blocks smoke — Web must lint and build |
| `smoke` | Does not block merge — advisory only |

---

## Related Documentation

- [DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md](../../runbooks/DEPLOYMENT_RUNBOOK_DOCKER_STAGING.md) — Docker deployment guide
- [ENV_PARITY_MATRIX.md](../runbooks/ENV_PARITY_MATRIX.md) — Environment variable reference

---

*Phase E2 — GitHub Actions CI*
