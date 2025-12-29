# ChefCloud - Codebase Understanding: Executive Summary

**Generated:** December 25, 2025  
**Status:** RC1 (Post-Milestone 35)  
**Purpose:** Executive overview for feature development preparation

---

## 1. System Overview

**ChefCloud (Nimbus POS)** is an enterprise-grade, multi-tenant restaurant/bar POS system built as a TypeScript monorepo. The system supports offline-capable POS terminals, real-time KDS screens, comprehensive inventory management with FIFO consumption, HR/workforce management, accounting, and developer APIs.

### Key Statistics
- **100+ Prisma Models** across 20 business domains
- **60+ NestJS Modules** with 200+ API endpoints
- **27 Frontend Routes** with role-based access (L1-L5)
- **56 E2E Tests** covering authentication, POS, inventory, billing, analytics
- **6 Runtime Services** (API, Worker, Sync, Web, Desktop, Mobile)
- **5 Shared Packages** (db, contracts, ui, auth, printer)

### Technology Stack
- **Backend:** NestJS 10 + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend:** Next.js 13 (Pages Router) + React 18 + TanStack Query
- **Desktop:** Tauri 1.x (Rust) + React
- **Mobile:** Expo SDK + React Native
- **Auth:** WebAuthn (passkeys) + JWT + Argon2id
- **Infrastructure:** Turborepo + pnpm workspaces + Docker Compose

---

## 2. Architecture Highlights

### Multi-Tenancy
- **Org-scoped:** All data isolated by `orgId`
- **Branch-scoped:** Franchise operations support 4+ branches per org
- **Guards:** `@OrgGuard()`, `@BranchGuard()` enforce data isolation
- **Demo Orgs:** Tapas (1 branch) + Cafesserie (4 branches) with deterministic UUIDs

### Role-Based Access Control (RBAC)
- **5 Levels:** L1 (Owner) → L2 (Manager) → L3 (Supervisor) → L4 (Staff) → L5 (Temp)
- **Visibility Matrix:** Sidebar menu filtering, route protection, API endpoint gating
- **Platform Access:** Desktop (L4-L5 POS/KDS), Web (L1-L3 admin), Mobile (L1-L5 limited)

### Authentication & Security
- **MSR Badge Login:** Magnetic stripe card enrollment (PAN obfuscation)
- **WebAuthn:** Passkey-based authentication (FIDO2)
- **Session Versioning:** Badge revocation invalidates all sessions < 2s (E25)
- **Idempotency:** Client-generated keys prevent duplicate transactions (M21)
- **Rate Limiting:** Plan-based (Free: 60/min, Pro: 300/min) (E24)
- **Webhook Security:** HMAC-SHA256 signature + timestamp validation (B2)

### Cross-Cutting Infrastructure
- **SSE (Server-Sent Events):** Real-time KDS updates, metrics streaming (M26)
- **Offline Queue:** Service worker queues POS operations when offline (M27)
- **FIFO Inventory:** Recipe-based consumption, oldest batches depleted first (M3, M4)
- **Demo Protection:** `@DemoGuard()` prevents destructive actions in demo mode
- **Franchise Analytics:** Branch rankings, budgets, forecasts with Redis caching (E22)

---

## 3. Core Business Domains (20 Total)

### 1. Identity & Multi-Tenancy (12 models)
- **Org, User, Session, Badge, Passkey, RefreshToken**
- WebAuthn enrollment, MSR badge login, session management
- Session version increment on badge revocation (< 2s invalidation)

### 2. POS Orders (12 models)
- **Order, OrderLine, OrderLineModifier, Payment, Tab, Void**
- Offline-capable order creation, split bills, FIFO consumption on order close
- Order number generation (unique per branch)

### 3. Kitchen Display System (5 models)
- **KdsTicket, KdsTicketLine, KdsStation, KdsStationConfig**
- Station-based filtering (Grill, Fry, Salad, Bar)
- SLA color coding (green < 5min, orange < 10min, red > 10min)
- Real-time SSE updates (`kds:ticket:new`, `kds:ticket:ready`)

### 4. Inventory & Purchasing (18 models)
- **Item, Recipe, RecipeIngredient, StockBatch, StockMovement, PurchaseOrder**
- FIFO consumption: oldest batches depleted first
- Recipe-based tracking (1 beer → 330ml from oldest keg batch)
- Wastage, stock counts, variance tolerance (E45)

### 5. HR & Workforce (16 models)
- **Employee, Attendance, LeaveRequest, Payslip, ShiftTemplate, ShiftSchedule**
- Attendance tracking (PRESENT, ABSENT, LATE, LEFT_EARLY) (M9)
- Shift scheduling with templates (M2)
- Payroll generation (M19)

### 6. Accounting & Finance (15 models)
- **Account, JournalEntry, JournalLine, BankAccount, BankReconciliation**
- Double-entry bookkeeping (debits = credits) (E40)
- Period locking (prevent backdated edits)
- Bank reconciliation with auto-matching

### 7-20. Other Domains
- **Feedback & NPS** (M20): Customer feedback, NPS scoring
- **Documents** (M18): Secure upload, soft-delete, storage providers (LOCAL/S3/GCS)
- **Reservations** (M15): Table reservations, deposit holds
- **Events** (E42): Event bookings with credit system
- **Promotions** (E37): Discount campaigns, approval flow
- **Franchise** (E22): Branch rankings, budgets, forecasts
- **Billing** (E24): Subscription plans, rate limiting, grace periods
- **Dev Portal** (E23): API keys, webhooks, usage logging
- **Reports** (M4): Sales, budgets, NPS, waste reports (JSON/CSV/PDF)

---

## 4. API Surface (200+ Endpoints)

### Major Endpoint Groups
1. **Authentication** (`/auth`): Login, logout, refresh, MSR badge, WebAuthn
2. **POS** (`/pos`): Orders, payments, voids, tabs, offline sync
3. **KDS** (`/kds`): Tickets, stations, SLA config, SSE streaming
4. **Inventory** (`/inventory`): Items, recipes, stock batches, movements
5. **Purchasing** (`/purchasing`): Purchase orders, receiving, suppliers
6. **HR** (`/hr`): Employees, attendance, leave requests, payslips
7. **Workforce** (`/workforce`): Shifts, schedules, templates
8. **Accounting** (`/accounting`): Accounts, journal entries, bank reconciliation
9. **Finance** (`/finance`): Payroll, service providers, contracts
10. **Feedback** (`/feedback`): Customer feedback, NPS scores
11. **Documents** (`/documents`): Upload, download, soft-delete
12. **Reservations** (`/reservations`): Table reservations, cancellations
13. **Events** (`/events`): Event bookings, credits
14. **Promotions** (`/promotions`): Campaigns, activations
15. **Franchise** (`/franchise`): Rankings, budgets, forecasts
16. **Billing** (`/billing`): Plans, subscriptions, usage
17. **Dev** (`/dev`): API keys, webhooks, usage logs
18. **Reports** (`/reports`): Generate reports, subscriptions
19. **Analytics** (`/analytics`): Sales trends, KPIs, margins
20. **Ops** (`/ops`): Health checks, feature flags, maintenance

### API Conventions
- **Headers:** `Authorization: Bearer <JWT>`, `X-Org-Id`, `X-Branch-Id`, `Idempotency-Key`
- **Response:** `{ data: T, meta?: { total, page, limit } }`
- **Errors:** `{ statusCode, message, error, timestamp }`
- **Pagination:** `?page=1&limit=20`
- **Filtering:** `?branchId=uuid&status=OPEN&from=2025-01-01&to=2025-12-31`

---

## 5. Frontend Architecture

### Pages (27 Total)
- **/login** - Authentication (email/password, MSR badge, passkey)
- **/dashboard** - Role-based overview (L1-L3: analytics, L4-L5: POS/KDS)
- **/pos** - Point of sale (L4-L5, desktop only)
- **/kds** - Kitchen display (L4-L5, desktop only)
- **/inventory** - Items, recipes, stock (L1-L3)
- **/purchasing** - Purchase orders (L1-L3)
- **/staff** - Employee directory (L1-L3)
- **/hr** - Attendance, leave, payroll (L1-L2)
- **/workforce** - Shift scheduling (L1-L3)
- **/finance** - Accounting, bank reconciliation (L1-L2)
- **/feedback** - Customer feedback, NPS (L1-L3)
- **/reservations** - Table reservations (L2-L3)
- **/events** - Event bookings (L1-L2)
- **/promotions** - Discount campaigns (L1-L2)
- **/franchise** - Multi-branch analytics (L1 only)
- **/analytics** - Sales trends, KPIs (L1-L3)
- **/reports** - Report generation (L1-L3)
- **/documents** - Document management (L1-L3)
- **/billing** - Subscription management (L1 only)
- **/dev-portal** - API keys, webhooks (L1 only, dev-admin flag)
- **/settings** - Org/branch settings (L1-L2)

### State Management
- **TanStack Query:** Server state (orders, tickets, inventory)
- **Zustand:** Client state (POS cart, KDS filters, offline queue)
- **React Context:** Auth, org, branch selection

### Real-Time Features
- **SSE:** KDS ticket updates, live metrics
- **Polling:** Dashboard KPIs (5s interval)
- **Optimistic Updates:** POS order creation, KDS ticket actions

### Offline Capabilities
- **Service Worker:** POS operations queued when offline (M27)
- **IndexedDB:** Cached menu, modifiers, prices (24h TTL)
- **Sync Queue:** Retry failed operations with exponential backoff

---

## 6. Data Architecture

### Deterministic Seeding (E60 v2)
- **Tapas Demo Org:** 1 branch, ~100 orders, ~500 stock movements
- **Cafesserie Demo Org:** 4 branches, ~400 orders, ~2000 stock movements
- **Fixed UUIDs:** Predictable IDs for testing (e.g., Tapas org: `11111111-1111-...`)
- **Reproducible:** Running seed twice produces identical data (no duplicates)

### FIFO Inventory Flow
1. **Purchase Order:** Create PO, receive items → `StockBatch` created
2. **Recipe Setup:** Define ingredients (e.g., Beer = 330ml from Keg batch)
3. **POS Order:** Create order → FIFO consumption on order close
4. **Stock Movement:** `SALE` movement created, oldest batches depleted first
5. **COGS Tracking:** Cost from batch recorded in `StockMovement.cogs`

### Indexing Strategy
- **Multi-tenancy:** Composite indexes (`orgId`, `branchId`, `...`)
- **Time-series:** Indexes on `createdAt`, `updatedAt` for analytics
- **Enums:** Indexes on `status`, `movementType` for filtering
- **Soft-delete:** Indexes on `deletedAt IS NULL` for active records

---

## 7. Testing & Verification

### E2E Test Coverage
- **56 Test Files** covering all major features
- **Test Database:** `chefcloud_test` (auto-created, isolated)
- **Auth Bypass:** `E2E_AUTH_BYPASS=1` for faster tests
- **Test Commands:** `pnpm test:e2e`, `pnpm test:e2e -- badge-revocation.e2e-spec.ts`

### Verification Scripts
- **verify-m4-completion.sh:** Verify FIFO consumption, COGS integrity
- **scripts/verify-deployment.sh:** Verify production health, seed data

### Release Gates
1. All E2E tests passing
2. Linting passes
3. Build succeeds
4. Manual smoke test (login, create order, close order, check KDS)
5. Deployment verification script

---

## 8. Development Workflow

### Local Setup
```bash
# Prerequisites: Docker, Node 20+, pnpm 8+
git clone <repo>
cd chefcloud
pnpm install

# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# Setup database
cd packages/db
pnpm db:push
pnpm db:seed

# Start services
cd services/api && pnpm dev          # API on :3001
cd apps/web && pnpm dev              # Web on :3000
cd apps/desktop && pnpm tauri dev   # Desktop app
```

### Adding a Feature
1. **Read:** `DEV_GUIDE.md`, this summary, domain maps
2. **Design:** Define schema changes, API endpoints, UI routes
3. **Schema:** Update `packages/db/prisma/schema.prisma`, run `pnpm db:push`
4. **Backend:** Create NestJS module/controller/service, add E2E tests
5. **Frontend:** Create pages/components, integrate with TanStack Query
6. **Test:** Run E2E tests, manual smoke test
7. **Document:** Update completion report (E##-S#-COMPLETION.md)

### Migration Strategy
```bash
# Development
pnpm db:push  # Quick prototyping

# Production
pnpm db:migrate  # Generate migration, apply to production
```

---

## 9. Deployment

### Infrastructure
- **Production API:** Railway (NestJS + PostgreSQL + Redis)
- **Production Web:** Vercel (Next.js)
- **Desktop:** Tauri builds (Windows/macOS/Linux installers)
- **Mobile:** Expo builds (iOS/Android APKs)

### Environment Variables
```bash
# API
DATABASE_URL=postgresql://...
REDIS_HOST=...
JWT_SECRET=...
WEBHOOK_SECRET=...

# Web
NEXT_PUBLIC_API_URL=https://api.chefcloud.com
```

### CI/CD
- **GitHub Actions:** Lint, test, build on every PR
- **Deployment:** Auto-deploy to Railway/Vercel on main branch merge

---

## 10. Cleanup Opportunities (See CLEANUP_CANDIDATES.md)

### High Confidence (Safe to Remove)
1. **dev-portal.disabled/** - 17 files, superseded by active `dev/` module
2. **packages/ui/** - Unused placeholder package

### Medium Confidence (Needs Review)
3. Old seed cleanup functions (may be redundant with deterministic seeding)
4. Unused PostgreSQL indexes (requires DBA review)
5. Unused imports (ESLint auto-fix)

### Keep (Intentional Infrastructure)
- **FeatureFlag** system (ready for future A/B testing)
- **Test utilities** (active and necessary)

---

## 11. Maturity Assessment

### Strengths
- ✅ **Comprehensive:** 20 business domains, 200+ endpoints
- ✅ **Tested:** 56 E2E tests, verification scripts
- ✅ **Secure:** WebAuthn, session versioning, idempotency, webhook signing
- ✅ **Scalable:** Multi-tenancy, Redis caching, franchise support
- ✅ **Offline-capable:** Service worker, IndexedDB, sync queue
- ✅ **Well-documented:** 18K+ line DEV_GUIDE, completion reports

### Areas for Improvement
- ⚠️ **Frontend Test Coverage:** ~20% (needs more component tests)
- ⚠️ **API Documentation:** No OpenAPI spec (consider Swagger)
- ⚠️ **Monitoring:** No production APM (consider Sentry, DataDog)
- ⚠️ **Type Safety:** Some `any` types in legacy code (gradual cleanup)

---

## 12. Next Steps (Feature Development)

### Before Writing Code
1. ✅ **Read this summary** (you are here)
2. ✅ **Read domain maps:** `BACKEND_API_MAP.md`, `SCHEMA_DOMAIN_MAP.md`, `FRONTEND_ROUTE_MAP.md`
3. ✅ **Read relevant completion reports** (E##-S#-COMPLETION.md for similar features)
4. ⏳ **Define feature spec** (schema changes, API endpoints, UI mockups)
5. ⏳ **Write E2E tests first** (TDD approach recommended)

### Feature Implementation Checklist
- [ ] Update Prisma schema (if needed)
- [ ] Generate Prisma client (`pnpm db:generate`)
- [ ] Create NestJS module/controller/service
- [ ] Add guards (`@Roles()`, `@OrgGuard()`, `@PlatformAccess()`)
- [ ] Write E2E test
- [ ] Create frontend page/component
- [ ] Integrate with TanStack Query
- [ ] Add to sidebar menu (if new page)
- [ ] Update RBAC visibility matrix (if new page)
- [ ] Manual smoke test
- [ ] Document in completion report

---

## 13. Key Contacts & Resources

### Documentation
- **DEV_GUIDE.md** - 18K+ line comprehensive developer guide
- **/instructions/*.md** - Architecture maps (this summary + 5 others)
- **E##-S#-COMPLETION.md** - Feature completion reports (30+ files)

### Code Locations
- **Schema:** `packages/db/prisma/schema.prisma`
- **Backend:** `services/api/src/` (60+ modules)
- **Frontend:** `apps/web/src/pages/` (27 pages)
- **Tests:** `services/api/test/**/*.e2e-spec.ts` (56 files)

### Commands Reference
```bash
# Development
pnpm dev              # Start all services
pnpm build            # Build all workspaces
pnpm lint             # Lint all workspaces
pnpm test:e2e         # Run E2E tests

# Database
pnpm db:push          # Push schema changes (dev)
pnpm db:migrate       # Generate migration (prod)
pnpm db:seed          # Seed demo data
pnpm db:studio        # Open Prisma Studio

# Deployment
pnpm deploy:api       # Deploy API to Railway
pnpm deploy:web       # Deploy web to Vercel
```

---

## 14. Success Metrics

### Current Status (RC1)
- **35 Milestones Completed** (M0-M35)
- **200+ API Endpoints** operational
- **100+ Prisma Models** in production
- **56 E2E Tests** passing
- **2 Demo Orgs** with realistic data

### Production Readiness
- ✅ Multi-tenant isolation verified (B3)
- ✅ FIFO consumption verified (M4)
- ✅ Badge revocation < 2s (E25)
- ✅ Offline POS queue working (M27)
- ✅ SSE security validated (M26)
- ✅ Webhook security validated (B2)
- ✅ Rate limiting enforced (E24)

---

## 15. Conclusion

ChefCloud is a **production-ready, enterprise-grade POS system** with comprehensive features across 20 business domains. The codebase is well-architected, thoroughly tested, and ready for new feature development.

**Key Takeaways:**
1. **Multi-tenant by default** - Always scope queries by `orgId`/`branchId`
2. **RBAC everywhere** - Check role level before exposing features
3. **Offline-first POS** - Handle network failures gracefully
4. **FIFO inventory** - Recipe-based consumption, oldest batches first
5. **Security-first** - Idempotency, session versioning, webhook signing

**Recommended Reading Order:**
1. This summary (overview)
2. `CODEBASE_ARCHITECTURE_MAP.md` (monorepo structure)
3. `BACKEND_API_MAP.md` (API endpoints)
4. `SCHEMA_DOMAIN_MAP.md` (database models)
5. `FRONTEND_ROUTE_MAP.md` (UI pages)
6. `TESTING_AND_VERIFICATION_MAP.md` (test strategy)
7. Relevant completion reports for similar features

**You are now ready to implement features!** 🚀

Refer back to these maps as needed. Happy coding!
