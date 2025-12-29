# ChefCloud - Testing & Verification Map

**Last Updated:** December 26, 2025

## Test Infrastructure Overview

### Test Types
1. **Unit Tests** - Jest (individual function/service tests)
2. **E2E Tests** - @nestjs/testing + supertest (full API integration tests)
3. **Slice Tests** - Isolated feature E2E tests (faster, focused)
4. **Verification Scripts** - Bash scripts for manual/automated verification

---

## E2E Test Suite

### Location
`services/api/test/**/*.e2e-spec.ts` (56 test files)

### Running E2E Tests

```bash
# All E2E tests
cd services/api
pnpm test:e2e

# Specific test file
pnpm test:e2e -- auth.e2e-spec.ts

# Specific test suite (describe block)
pnpm test:e2e -- -t "Badge revocation"

# E2E with performance profiling (NEW)
pnpm test:e2e:profile
```

### E2E Performance Profiling ⚡ NEW

**Command:**
```bash
cd services/api
pnpm test:e2e:profile
```

**What it does:**
1. Runs all E2E tests with `--runInBand` (sequential, for accurate timing)
2. Generates `.e2e-results.json` (Jest JSON output)
3. Parses results and displays:
   - Top 20 slowest individual tests
   - Top 20 slowest test files
   - Total duration and test counts
   - Open handles warning (if overhead > 10s)
   - Actionable recommendations

**Output files:**
- `.e2e-results.json` - Raw Jest JSON output (gitignored, ephemeral)
- Console output - Formatted profiling report

**Performance thresholds:**
- ⚠️ **Individual test > 1s** - Slow (consider optimization)
- 🔴 **Individual test > 5s** - Very slow (requires investigation)
- ⚠️ **Test file > 5s** - Slow (check setup/teardown)
- 🔴 **Test file > 10s** - Very slow (likely inefficient bootstrap or cleanup)
- 🔴 **Overhead > 10s** - Open handles detected (unclosed connections)

**Interpreting results:**
```
TOP 20 SLOWEST INDIVIDUAL TESTS
01. 8.45s      e22-franchise.e2e-spec.ts    Should calculate franchise scores
                                            ^^^ Target for optimization

TOP 20 SLOWEST TEST FILES
01. 12.34s     e22-franchise.e2e-spec.ts    (15 tests, 15 passed)
                                            ^^^ Check beforeAll/afterAll cleanup

SUMMARY
Total Duration: 51.5s
⚠ WARNING: Detected 12.3s of overhead
   This may indicate open handles (unclosed connections, timers, etc.)
   Run with --detectOpenHandles to investigate
```

**Red flags:**
- Any test > 30s → Likely a timeout or blocking operation
- Total overhead > 10s → Open handles (Prisma, Redis, BullMQ not closed)
- Many files > 10s → AppModule bootstrap is too heavy (use slice tests)

**Recommended workflow:**
1. Run `pnpm test:e2e:profile` before optimizing
2. Note baseline timings
3. Apply fixes (see [E2E_PERFORMANCE_DIAGNOSTIC_REPORT.md](../E2E_PERFORMANCE_DIAGNOSTIC_REPORT.md))
4. Re-run profiler to verify improvements
5. Commit profiler script (artifact is gitignored)

---

### E2E Test Configuration

**Setup:** `services/api/test/jest-e2e.setup.ts`
- Sets `E2E_AUTH_BYPASS=1` - JWT bypass for tests
- Sets `E2E_ADMIN_BYPASS=1` - Admin guard bypass for tests
- Creates test database `chefcloud_test`
- Runs migrations + seed automatically

**Environment:** `services/api/.env.e2e`
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chefcloud_test
REDIS_HOST=localhost
REDIS_PORT=6379
E2E_AUTH_BYPASS=1
E2E_ADMIN_BYPASS=1
```

**Test Database:**
- Automatically created/reset before each test run
- Isolated from dev database
- Disposable (safe to reset)

---

## E2E Test Inventory (56 files)

### 1. Authentication & Sessions (7 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `auth.e2e-spec.ts` | Password login | Email/password flow, JWT generation |
| `msr-card.e2e-spec.ts` | MSR login | Card swipe, badge enrollment, PAN rejection |
| `e2e/auth.e2e-spec.ts` | Auth endpoints | Full auth flow, session management |
| `e2e/auth.slice.e2e-spec.ts` | Auth slice | Isolated auth tests |
| `e2e/badge-revocation.e2e-spec.ts` | Badge revocation (E25) | Session invalidation < 2s, version increment |
| `e23-roles-access.e2e-spec.ts` | Role-based access | L1-L5 role enforcement |
| `e23-platform-access.e2e-spec.ts` | Platform access | Desktop/web/mobile access matrix |

**Key Assertions:**
- JWT structure (claims: `sub`, `orgId`, `roleLevel`, `sv`, `badgeId`, `jti`)
- Session version check on revocation
- Badge state transitions (ACTIVE → REVOKED/LOST → RETURNED)
- Cross-tab logout (session invalidation propagation)

---

### 2. POS & Orders (5 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `a3-pos.e2e-spec.ts` | POS orders | Order creation, payment, void, close |
| `e2e/pos.e2e-spec.ts` | POS full flow | Menu, modifiers, split bill, FIFO consumption |
| `e2e/pos-isolation.e2e-spec.ts` | Org isolation | Multi-tenant data isolation |
| `e2e/pos-imports-bisect.e2e-spec.ts` | Import bisect | Circular dependency detection |
| `e2e/orders.slice.e2e-spec.ts` | Orders slice | Isolated order tests |

**Key Assertions:**
- Order number generation (unique per branch)
- Idempotency key deduplication
- FIFO ingredient consumption (StockMovement creation)
- Margin calculation (`costUnit`, `marginPct`)

---

### 3. Inventory & Purchasing (6 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/inventory.e2e-spec.ts` | Inventory full | Items, recipes, wastage, counts |
| `e2e/inventory.slice.e2e-spec.ts` | Inventory slice | Isolated inventory tests |
| `e2e/inventory-kpis.e2e-spec.ts` | Inventory KPIs | Stock levels, turnover, shrinkage |
| `e2e/purchasing.slice.e2e-spec.ts` | Purchasing slice | PO creation, placement, receiving |
| `e27-costing.e2e-spec.ts` | Costing (E27) | Cost calculation, margin tracking |
| `e2e/transfer.invalidation.slice.e2e-spec.ts` | Transfer invalidation | Cache invalidation on stock transfer |

**Key Assertions:**
- Recipe-based consumption (M4)
- FIFO batch depletion
- Stock count variance tolerance (E45)
- Negative stock anomaly detection

---

### 4. KDS (3 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `m1-kds-enterprise.e2e-spec.ts` | KDS enterprise (M1) | Station filtering, SLA config, ticket status |
| `e2e/kds.slice.e2e-spec.ts` | KDS slice | Isolated KDS tests |
| `sse-security.e2e-spec.ts` | SSE security (M26) | JWT validation, org scoping |

**Key Assertions:**
- KDS ticket creation per station
- SLA color coding (green < 5min, orange < 10min, red > 10min)
- SSE event format (`kds:ticket:new`, `kds:ticket:ready`)

---

### 5. Billing & Subscriptions (4 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e24-subscriptions.e2e-spec.ts` | Subscriptions (E24) | Plan upgrade, cancellation, grace period |
| `billing-simple.e2e-spec.ts` | Billing simple | Basic billing flow |
| `e2e/billing.e2e-spec.ts` | Billing full | Full billing lifecycle |
| `e2e/billing.slice.e2e-spec.ts` | Billing slice | Isolated billing tests |

**Key Assertions:**
- Plan-based rate limiting (Free: 60/min, Pro: 300/min)
- Grace period enforcement
- Feature gating (dev portal blocked on Free plan)

---

### 6. Dev Portal (4 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `b2-apikey.e2e-spec.ts` | API keys (B2) | Key creation, revocation, usage |
| `webhook-security.e2e-spec.ts` | Webhook security | HMAC-SHA256 verification |
| `e2e/devportal.slice.e2e-spec.ts` | Dev portal slice | Isolated dev portal tests |
| `e2e/devportal.prod.slice.e2e-spec.ts` | Dev portal prod | Production-like test (no E2E bypass) |

**Key Assertions:**
- DevAdminGuard bypass (E2E_ADMIN_BYPASS=1)
- Webhook signature verification
- API usage logging

---

### 7. Franchise & Analytics (6 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e22-franchise.e2e-spec.ts` | Franchise (E22) | Branch rankings, budgets, forecasts |
| `e2e/franchise.slice.e2e-spec.ts` | Franchise slice | Isolated franchise tests |
| `e2e/franchise-rankings-cache.e2e-spec.ts` | Rankings cache | Redis cache invalidation |
| `e2e/franchise-budgets-cache.e2e-spec.ts` | Budgets cache | Redis cache invalidation |
| `e2e/franchise-cache-invalidation.e2e-spec.ts` | Cache invalidation | General cache tests |
| `e2e/forecast.slice.e2e-spec.ts` | Forecast slice | Demand forecasting |

**Key Assertions:**
- Franchise score calculation (revenue, margin, waste, SLA)
- Budget vs actual variance
- Redis cache TTL (5 min rankings, 10 min budgets)

---

### 8. HR & Workforce (2 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/workforce.e2e-spec.ts` | Workforce (M9) | Attendance, leave requests, payroll |
| `m2-shifts-scheduling.e2e-spec.ts` | Shifts (M2) | Shift templates, schedules, assignments |

**Key Assertions:**
- Attendance status (PRESENT, ABSENT, LATE, LEFT_EARLY)
- Absence deduction calculation
- Shift swap approval flow

---

### 9. Accounting & Finance (2 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/accounting.e2e-spec.ts` | Accounting (E40) | Journal entries, bank reconciliation |
| `m7-service-providers.e2e-spec.ts` | Service providers (M7) | Contracts, reminders, budgets |

**Key Assertions:**
- Double-entry bookkeeping (debits = credits)
- Period lock enforcement
- Bank reconciliation matching

---

### 10. Reservations & Events (3 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/reservations.slice.e2e-spec.ts` | Reservations slice | Table reservations |
| `e2e/bookings.e2e-spec.ts` | Event bookings | Event table bookings (E42) |
| `e2e/events-isolation.e2e-spec.ts` | Event isolation | Org isolation for events |

**Key Assertions:**
- Deposit hold/capture/refund flow
- Reservation auto-cancellation (autoCancelAt)
- Event booking credit system

---

### 11. Documents & Feedback (3 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/docs.e2e-spec.ts` | Documents (M18) | Upload, download, soft-delete |
| No E2E | Feedback (M20) | (Manual testing only) |
| No E2E | Promotions (M22) | (Manual testing only) |

**Key Assertions:**
- Document upload (multipart/form-data)
- Storage provider (LOCAL/S3/GCS)
- Soft-delete (deletedAt)

---

### 12. Reports (1 test)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/reports.e2e-spec.ts` | Reports (M4) | Sales, budgets, NPS, waste reports |

**Key Assertions:**
- Report generation (JSON, CSV, PDF)
- Report subscriptions (email/Slack delivery)

---

### 13. Idempotency & Rate Limiting (2 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `plan-rate-limit.e2e-spec.ts` | Plan rate limiting (E24) | Plan-based rate limits |
| (Implicit in other tests) | Idempotency (M21) | Idempotency key deduplication |

**Key Assertions:**
- 429 Too Many Requests on limit exceeded
- Duplicate request returns cached response

---

### 14. Webhooks (2 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/webhook.replay.slice.e2e-spec.ts` | Webhook replay | Webhook event replay |
| `webhook-security.e2e-spec.ts` | Webhook security | HMAC-SHA256 verification |

**Key Assertions:**
- Signature verification
- Timestamp check (±5 min tolerance)

---

### 15. SSE & Metrics (2 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `e2e/sse.smoke.e2e-spec.ts` | SSE smoke | SSE connection, event streaming |
| `e2e/metrics.e2e-spec.ts` | Metrics | Prometheus metrics endpoint |

**Key Assertions:**
- SSE event format (`event: type`, `data: JSON`)
- Prometheus metric format

---

### 16. Smoke & Isolation Tests (4 tests)

| File | Focus | Coverage |
|------|-------|----------|
| `smoke/minimal-boot.e2e-spec.ts` | Minimal boot | App starts without errors |
| `smoke/di.e2e-spec.ts` | Dependency injection | DI container integrity |
| `b3-multi-tenant.e2e-spec.ts` | Multi-tenant (B3) | Org/branch data isolation |
| `e2e/app-bisect.e2e-spec.ts` | App bisect | Circular dependency detection |

**Key Assertions:**
- App bootstraps successfully
- No circular dependencies
- Org isolation (user cannot access other org's data)

---

### 17. KPIs (1 test)

| File | Focus | Coverage |
|------|-------|----------|
| `e26-kpis.e2e-spec.ts` | KPIs (E26) | Real-time KPI streaming |

**Key Assertions:**
- KPI calculation (sales, orders, avg ticket)
- SSE streaming

---

### 18. Promotions (1 test)

| File | Focus | Coverage |
|------|-------|----------|
| `e37-promotions.e2e-spec.ts` | Promotions (E37) | Promotion activation, deactivation |

**Key Assertions:**
- Promotion approval flow
- Discount application

---

## Verification Scripts

### 1. Milestone 4 Verification (`verify-m4-completion.sh`)

**Purpose:** Verify M4 (Recipe-Based Consumption & COGS Analytics) completion

**Checks:**
- Recipe ingredient count (expected ~1,385)
- Consumption movement count (expected ~4,000 SALE movements)
- Closed order count (expected 40,000+)
- Active stock batch count
- COGS data integrity (last 5 days with COGS)
- Non-zero COGS per movement
- FIFO batch depletion (oldest batches consumed first)
- Negative stock anomaly detection

**Usage:**
```bash
./verify-m4-completion.sh
```

**Sample Output:**
```
📊 DATABASE METRICS
Recipe Ingredients: 1385
  ✅ Recipe count looks good
Consumption Movements (SALE): 4127
  ✅ Consumption movements look good
Closed Orders: 41234
  ✅ Order count looks good
Active Stock Batches: 237
  ✅ 237 batches have remaining stock

📈 COGS VERIFICATION
Last 5 days with COGS data:
Date       | Total COGS | Movements
-----------|------------|----------
2025-12-24 |   123456.78 |      1234
2025-12-23 |   118234.56 |      1198
...
```

### 2. Deployment Verification (`scripts/verify-deployment.sh`)

**Purpose:** Verify production deployment health

**Checks:**
- API health endpoint (`/health`)
- Database connectivity
- Redis connectivity
- Environment variables
- Seed data presence (Tapas/Cafesserie demo orgs)
- Demo user login (owner@tapas.demo.local)

**Usage:**
```bash
./scripts/verify-deployment.sh https://api.chefcloud.com
```

---

## Test Coverage

### Backend (services/api)
- **Unit Tests:** ~40% coverage (services, controllers)
- **E2E Tests:** ~70% coverage (API endpoints)
- **Slice Tests:** High coverage (isolated features)

### Frontend (apps/web)
- **Unit Tests:** ~20% coverage (components, hooks)
- **Integration Tests:** Manual testing only
- **A11y Tests:** Axe-core integration (Sidebar, KDS, POS)

---

## Running Tests Locally

### Prerequisites
```bash
# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# Verify PostgreSQL + Redis running
docker ps
```

### Backend Tests
```bash
cd services/api

# All E2E tests
pnpm test:e2e

# Specific test
pnpm test:e2e -- badge-revocation.e2e-spec.ts

# Watch mode
pnpm test:e2e:watch

# Coverage report
pnpm test:e2e --coverage
```

### Frontend Tests
```bash
cd apps/web

# All unit tests
pnpm test

# Watch mode
pnpm test:watch

# A11y tests
pnpm test -- Sidebar.a11y.test.tsx
```

---

## Release Gates

### Pre-Release Checklist
1. ✅ All E2E tests passing (`pnpm test:e2e`)
2. ✅ Linting passes (`pnpm lint`)
3. ✅ Build succeeds (`pnpm build`)
4. ✅ Verify M4 completion (`./verify-m4-completion.sh`)
5. ✅ Manual smoke test:
   - Login as owner@tapas.demo.local
   - Create POS order
   - Close order (verify FIFO consumption)
   - Check KDS screen (verify ticket created)
   - Check stock movements (verify consumption recorded)

### Post-Deploy Verification
1. ✅ Run deployment verification script
2. ✅ Check health endpoint (`GET /health`)
3. ✅ Verify demo data seeded (Tapas + Cafesserie)
4. ✅ Test login flow (all auth methods)
5. ✅ Verify SSE streaming (KDS screen)

---

## Known Test Limitations

### 1. E2E Auth Bypass
**Issue:** Dev portal E2E tests use `E2E_ADMIN_BYPASS=1` to bypass JWT validation
**Impact:** Production guards not fully tested in E2E
**Mitigation:** Separate prod slice test (`devportal.prod.slice.e2e-spec.ts`) without bypass

### 2. WebAuthn Mocking
**Issue:** E2E tests mock WebAuthn (no real device)
**Impact:** Passkey flow not fully tested
**Mitigation:** Manual testing with real passkey device

### 3. SSE Testing
**Issue:** SSE streaming hard to test in E2E (requires long-running connection)
**Impact:** SSE reconnect logic not tested
**Mitigation:** Manual testing + smoke test (`sse.smoke.e2e-spec.ts`)

### 4. Offline Queue
**Issue:** Service worker not tested in E2E
**Impact:** Offline POS queue not tested automatically
**Mitigation:** Manual testing in desktop app

### 5. Redis Cache Invalidation
**Issue:** Cache invalidation timing (< 2s) hard to verify reliably
**Impact:** Flaky tests for badge revocation
**Mitigation:** Retry logic + increased timeout (5s max)

---

## Adding New Tests

### E2E Test Template
```typescript
// services/api/test/feature.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

describe('Feature E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  const AUTH = { Authorization: 'Bearer TEST_TOKEN' };
  
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleRef.createNestApplication();
    prisma = moduleRef.get(PrismaService);
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .post('/endpoint')
      .set(AUTH)
      .send({ data: 'value' })
      .expect(201);
      
    expect(response.body).toMatchObject({ expected: 'result' });
  });
});
```

---

**Next Steps:**
- See `BACKEND_API_MAP.md` for endpoint details
- See `CLEANUP_CANDIDATES.md` for test refactoring opportunities
