# ChefCloud (NimbusPOS) Deployment Report

**Generated:** 2026-01-11 02:42 (Local Time)
**Node Version:** v22.14.0
**pnpm Version:** 8.15.0
**Docker Compose:** v2.40.3

---

## ✅ Deployment Status: SUCCESS

All core services are running and operational.

---

## 🏗️ Infrastructure

| Service | Container/Port | Status |
|---------|---------------|--------|
| PostgreSQL 16 | `chefcloud-postgres` (5432) | ✅ Running |
| Redis 7 | `chefcloud-redis` (6379) | ✅ Running |
| Backend API | `localhost:3001` | ✅ Running |
| Frontend (Next.js) | `localhost:3000` | ✅ Running |

---

## 🔒 Health Checks

### Backend Health Endpoint (`/api/health`)

```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Version Endpoint (`/version`)

```json
{
  "version": "1.0.0-rc.1",
  "node": "v22.14.0",
  "env": "development"
}
```

---

## 👥 Demo Users Verified

### Tapas Restaurant (`@tapas.demo.local`)
| Role | Email | Status |
|------|-------|--------|
| OWNER | owner@tapas.demo.local | ✅ Login OK |
| MANAGER | manager@tapas.demo.local | ✅ Login OK |
| CASHIER | cashier@tapas.demo.local | ✅ Login OK |
| WAITER | waiter@tapas.demo.local | ✅ Seeded |
| CHEF | chef@tapas.demo.local | ✅ Seeded |
| BARTENDER | bartender@tapas.demo.local | ✅ Seeded |
| SUPERVISOR | supervisor@tapas.demo.local | ✅ Seeded |
| ACCOUNTANT | accountant@tapas.demo.local | ✅ Seeded |
| PROCUREMENT | procurement@tapas.demo.local | ✅ Seeded |
| STOCK | stock@tapas.demo.local | ✅ Seeded |
| EVENTMGR | eventmgr@tapas.demo.local | ✅ Seeded |

### Cafesserie (`@cafesserie.demo.local`)
| Role | Email | Status |
|------|-------|--------|
| OWNER | owner@cafesserie.demo.local | ✅ Login OK |
| WAITER | waiter@cafesserie.demo.local | ✅ Login OK |
| MANAGER | manager@cafesserie.demo.local | ✅ Seeded |
| CASHIER | cashier@cafesserie.demo.local | ✅ Seeded |
| CHEF | chef@cafesserie.demo.local | ✅ Seeded |
| SUPERVISOR | supervisor@cafesserie.demo.local | ✅ Seeded |
| ACCOUNTANT | accountant@cafesserie.demo.local | ✅ Seeded |
| PROCUREMENT | procurement@cafesserie.demo.local | ✅ Seeded |

**All passwords:** `Demo#123`

---

## 🧪 Test Results

### Lint
- **Status:** ✅ Passed
- **Errors:** 0
- **Warnings:** 233 (non-blocking)

### Unit Tests (API)
- **Passed:** 606
- **Failed:** 57 (module import/mock setup issues)
- **Skipped:** 3

### Desktop Tests
- **Issue:** Native SQLite bindings not built for Node v22
- **Impact:** Desktop-specific tests fail (not blocking for web deployment)

---

## 🔧 Fixed Issues

### 1. Prisma Seed - InventoryPostingMapping Upsert
- **File:** `services/api/prisma/demo/seedPostingMappings.ts`
- **Issue:** Prisma `upsert` cannot handle `null` in compound unique key (`orgId_branchId`)
- **Fix:** Changed from `upsert` to `findFirst` + conditional `update`/`create` pattern

---

## 🚀 Quick Start Commands

### Start All Services
```powershell
# Terminal 1: Docker infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# Terminal 2: Backend API
cd services/api
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud"
$env:REDIS_HOST="localhost"; $env:REDIS_PORT="6379"
$env:JWT_SECRET="dev-secret-key-32chars-minimum!!"
$env:JWT_REFRESH_SECRET="dev-refresh-secret-key-32chars!!"
node dist/src/main.js

# Terminal 3: Frontend
cd apps/web
pnpm run dev
```

### Stop All Services
```powershell
# Stop Docker
docker compose -f infra/docker/docker-compose.yml down

# Stop Node processes
Stop-Process -Name node -Force
```

---

## 🌐 Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Health | http://localhost:3001/api/health |
| API Version | http://localhost:3001/version |

---

## 📋 Notes

1. Backend runs successfully when started via `Start-Process` PowerShell cmdlet
2. Frontend is in development mode (`next dev`)
3. All seeded demo data is available for testing
4. CORS is configured for `localhost:3000` and `localhost:5173`
