# ChefCloud/Nimbus POS - Codebase Architecture Map

**Last Updated:** December 25, 2025  
**Version:** Post-M35 (RC1)

## 1. Monorepo Structure

### Package Manager & Build System
- **Workspace:** `pnpm` workspaces (v8.15.0+)
- **Build Orchestrator:** Turborepo v1.12.3
- **TypeScript:** Shared base config (`tsconfig.base.json`)
- **Linting:** ESLint + Prettier (husky + lint-staged pre-commit)

### Workspace Packages
```
chefcloud/
├── apps/                    # Frontend applications
│   ├── web/                 # Next.js 13 (Manager Portal)
│   ├── desktop/             # Tauri + React (POS Terminal)
│   └── mobile/              # Expo React Native (Mobile Companion)
├── services/                # Backend services
│   ├── api/                 # NestJS REST API (Port 3001)
│   ├── worker/              # BullMQ job processor
│   └── sync/                # Offline sync service (placeholder)
└── packages/                # Shared libraries
    ├── db/                  # Prisma schema & client
    ├── contracts/           # Shared TypeScript types & Zod schemas
    ├── ui/                  # Shared React components
    ├── auth/                # RBAC/ABAC utilities
    └── printer/             # ESC/POS printer drivers
```

## 2. Runtime Services

### A. **services/api** (NestJS - Port 3001)
**Purpose:** Core REST API for all business logic

**Tech Stack:**
- NestJS 10.x
- Prisma ORM (PostgreSQL)
- Redis (sessions, cache, pub/sub)
- JWT authentication
- WebAuthn (passkeys)
- Zod validation

**Entry Point:** `services/api/src/main.ts`

**Key Features:**
- Multi-tenant (org/branch isolation)
- RBAC with L1-L5 roles
- Idempotency keys (M21)
- Platform access guards (M10)
- Webhook signature verification
- SSE streaming (Server-Sent Events)
- Rate limiting (plan-based - E24)
- Demo write protection (M33)

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` - Redis for cache/sessions
- `JWT_SECRET` - JWT signing key
- `RP_ID`, `ORIGIN` - WebAuthn config
- `DEMO_PROTECT_WRITES` - Demo org protection

### B. **services/worker** (BullMQ - Background Jobs)
**Purpose:** Async task processing

**Tech Stack:**
- BullMQ
- Redis
- Shared Prisma client from `@chefcloud/db`

**Key Jobs:**
- Report generation (M4)
- Email digests (owner digests, shift-end summaries)
- Slack notifications
- Procurement forecasting (M2)
- Stock level alerts (M3)
- Subscription renewals (E24)

**Entry Point:** `services/worker/src/index.ts`

### C. **services/sync** (Offline Sync - Placeholder)
**Purpose:** Planned ElectricSQL/RxDB offline sync

**Status:** Infrastructure stub only, not actively used

### D. **apps/web** (Next.js 13 - Port 3000)
**Purpose:** Manager/Owner backoffice portal

**Tech Stack:**
- Next.js 13 (App Router NOT used - Pages Router)
- React 18
- Tailwind CSS
- TanStack Query (React Query)
- Chart.js / Recharts
- Zustand (state management for POS/KDS)

**Entry Point:** `apps/web/src/pages/_app.tsx`

**Key Features:**
- Session management (idle timeout - M10)
- Role-based sidebar filtering
- POS terminal (offline-capable via service worker - M27)
- KDS screen (SSE real-time updates - M28)
- Analytics dashboards (franchise rankings - E22)
- Reports hub (M24, M34)
- Dev Portal (E23)
- Billing portal (E24)

**Environment Variables:**
- `NEXT_PUBLIC_API_URL` - Backend API endpoint
- `NEXT_PUBLIC_WS_URL` - WebSocket/SSE endpoint

### E. **apps/desktop** (Tauri + React - Port 1420)
**Purpose:** Native desktop POS terminal

**Tech Stack:**
- Tauri 1.x (Rust backend)
- React 18 + Vite
- MSR keyboard wedge listener
- Local storage for offline queue

**Key Features:**
- MSR badge swipe authentication (E25)
- Offline POS queue (M27)
- ESC/POS printer integration
- Native file system access (receipts, reports)

**Entry Point:** `apps/desktop/src/main.tsx`

### F. **apps/mobile** (Expo - React Native)
**Purpose:** Mobile companion app

**Tech Stack:**
- Expo SDK
- React Native
- React Navigation

**Status:** Basic scaffold, minimal features implemented

## 3. Shared Packages

### A. **packages/db** (Prisma Schema)
**Purpose:** Single source of truth for data model

**Files:**
- `prisma/schema.prisma` - 3043 lines, 100+ models
- `prisma/seed.ts` - Main seed orchestrator
- `prisma/demo/seedDemo.ts` - Deterministic demo data (Tapas + Cafesserie)
- `prisma/tapas/*.ts` - Legacy Tapas seed scripts

**Key Models by Domain:** (See SCHEMA_DOMAIN_MAP.md)

**Prisma Commands:**
```bash
cd packages/db
pnpm run db:generate    # Generate client
pnpm run db:migrate     # Run migrations
pnpm run db:studio      # Open Prisma Studio
pnpm run db:seed        # Seed demo data
```

### B. **packages/contracts** (Shared Types)
**Purpose:** Type-safe API contracts between frontend/backend

**Files:**
- `src/index.ts` - Barrel export of all DTOs
- Zod schemas for validation
- TypeScript interfaces derived from Zod

**Example:**
```typescript
import { OrderCreateDto, OrderResponseDto } from '@chefcloud/contracts';
```

### C. **packages/ui** (Shared React Components)
**Purpose:** Reusable UI components

**Components:**
- Basic primitives (Button, Input, Card)
- Data tables
- Charts (wrappers around Chart.js)

**Status:** Minimal usage, most components live in `apps/web/src/components`

### D. **packages/auth** (RBAC/ABAC Utilities)
**Purpose:** Role-based access control helpers

**Files:**
- `src/index.ts` - Role level definitions (L1-L5)
- Permission checking utilities

**Role Levels:**
- L1: Waiter, Bartender
- L2: Cashier, Supervisor, Chef
- L3: Stock Manager, Procurement, Event Manager
- L4: Manager, Accountant
- L5: Owner, Admin

### E. **packages/printer** (ESC/POS Drivers)
**Purpose:** Receipt printing

**Files:**
- `src/index.ts` - ESC/POS command builders
- Printer drivers for USB/Network printers

**Status:** Basic implementation, used by desktop app

## 4. Infrastructure & DevOps

### Docker Compose (Local Dev)
**File:** `infra/docker/docker-compose.yml`

**Services:**
- PostgreSQL 14 (port 5432)
- Redis 7 (port 6379)

**Usage:**
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Deployment Platforms

#### Production: Railway + Vercel
- **Railway:** API service + PostgreSQL + Worker
- **Vercel:** Next.js web app

**Config Files:**
- `railway.api.json` - API service config
- `railway.worker.json` - Worker service config
- `render.yaml` - Alternative Render.com config
- `vercel.json` - Vercel deployment config

#### CI/CD: GitHub Actions
**File:** `.github/workflows/ci.yml`

**Checks:**
- TypeScript compilation
- ESLint
- Prettier
- Unit tests
- E2E tests (slice tests)

## 5. Cross-Cutting Infrastructure

### A. **Authentication & Sessions (M10)**
**Implementation:** `services/api/src/auth/`

**Methods:**
- Password + PIN
- MSR card swipe (M10)
- WebAuthn passkeys (A7)
- API keys (dev portal - E23)

**Session Management:**
- JWT tokens with session versioning (`sv` claim - E25)
- Redis session storage
- Idle timeout (15 min default)
- Cross-tab logout (BroadcastChannel API)
- Badge revocation invalidation (E25)

**Guards:**
- `JwtAuthGuard` - JWT validation
- `PlatformAccessGuard` - Platform-specific access (desktop/web/mobile)
- `RolesGuard` - L1-L5 role enforcement

### B. **Idempotency (M21)**
**Implementation:** `services/api/src/common/idempotency/`

**Mechanism:**
- `Idempotency-Key` header (ULID recommended)
- SHA256 request body hash
- 24-hour TTL
- Redis cache + PostgreSQL `idempotency_keys` table

**Protected Endpoints:**
- POST `/pos/orders`
- POST `/payments`
- POST `/purchasing/po`

### C. **Multi-Tenancy (B3)**
**Implementation:** Org/Branch scoping in all queries

**Isolation:**
- Every request extracts `orgId` from JWT
- Prisma queries filter by `orgId`/`branchId`
- Audit events track org/branch/user

**Demo Protection (M33):**
- `DEMO_PROTECT_WRITES=1` env flag
- Blocks writes to demo orgs:
  - Billing plan changes
  - API key creation
  - Subscription cancellations

### D. **Webhook Security (E24)**
**Implementation:** `services/api/src/common/webhook-verification.guard.ts`

**Verification:**
- HMAC-SHA256 signature
- Timestamp check (±5 min tolerance)
- Signature in `X-ChefCloud-Signature` header

**Webhook Endpoints:**
- POST `/webhooks/momo` - MTN MoMo callbacks
- POST `/webhooks/airtel` - Airtel Money callbacks

### E. **Rate Limiting (E24)**
**Implementation:** `services/api/src/common/custom-throttler.guard.ts`

**Strategy:**
- Plan-based limits (Free: 60 req/min, Pro: 300 req/min)
- Per-org rate limiting (Redis)
- Dev Portal bypass for SuperDev

### F. **Server-Sent Events (SSE) - M26**
**Implementation:** `services/api/src/stream/`

**Endpoints:**
- `/stream/kds` - KDS ticket updates
- `/stream/kpis` - Real-time KPI dashboard

**Security:**
- JWT validation
- Org/branch scoping
- Auto-reconnect on client

## 6. Build & Development

### Development Commands
```bash
# Root level
pnpm install           # Install all dependencies
pnpm build             # Build all packages
pnpm dev               # Dev mode (all services)
pnpm lint              # Lint all code
pnpm test              # Run all tests

# Individual services
pnpm --filter @chefcloud/api dev
pnpm --filter @chefcloud/web dev
pnpm --filter @chefcloud/desktop dev
pnpm --filter @chefcloud/worker dev
```

### Turbo Pipeline
**File:** `turbo.json`

**Tasks:**
- `build` - Build output (dist/, .next/, out/)
- `dev` - Persistent dev server
- `lint` - ESLint checks
- `test` - Jest/Vitest tests
- `clean` - Remove build artifacts

**Dependency Graph:**
```
apps/web → packages/contracts → packages/db
apps/api → packages/contracts → packages/db
apps/desktop → packages/contracts → packages/db
```

## 7. Key File Locations

### Configuration
- `/tsconfig.base.json` - Shared TypeScript config
- `/turbo.json` - Turborepo pipeline
- `/pnpm-workspace.yaml` - Workspace definition
- `/.env.example` - Environment variable template
- `/commitlint.config.js` - Conventional commits

### Documentation
- `/DEV_GUIDE.md` - 18K line developer manual
- `/README.md` - Project overview
- `/CONTRIBUTING.md` - Contribution guidelines
- `/DEPLOYMENT.md` - Deployment instructions
- `/SECURITY.md` - Security policies

### Completion Reports
- `/E22-*-COMPLETION.md` - Franchise feature completion
- `/E23-*-COMPLETION.md` - Dev Portal completion
- `/E24-*-COMPLETION.md` - Billing completion
- `/M10-*-COMPLETION.md` - Auth & sessions completion
- `/M11-*-COMPLETION.md` - POS order lifecycle completion
- `/M33-DEMO-*-COMPLETION.md` - Demo protection completion

### Scripts
- `/verify-m4-completion.sh` - M4 verification script
- `/scripts/verify-deployment.sh` - Deployment verification

## 8. Technology Highlights

### Backend
- **NestJS** - Modular architecture, DI, decorators
- **Prisma** - Type-safe ORM, migrations, studio
- **Redis** - Cache, sessions, pub/sub, rate limiting
- **BullMQ** - Reliable job queues
- **Zod** - Runtime validation
- **Argon2** - Password hashing
- **@simplewebauthn** - WebAuthn implementation

### Frontend
- **Next.js** - SSR, API routes, image optimization
- **React** - Component-based UI
- **TanStack Query** - Server state management
- **Zustand** - Client state (POS cart, KDS filters)
- **Tailwind CSS** - Utility-first styling
- **Chart.js / Recharts** - Data visualization
- **date-fns** - Date manipulation

### Desktop
- **Tauri** - Rust-based native app framework
- **Vite** - Fast HMR dev server

### DevOps
- **Docker** - Containerization
- **GitHub Actions** - CI/CD
- **Railway** - Hosting (API/Worker/DB)
- **Vercel** - Hosting (Web frontend)

## 9. External Integrations

### Payments
- **MTN MoMo** - Webhook integration (Uganda)
- **Airtel Money** - Webhook integration (Uganda)

### Fiscal
- **URA EFRIS** - Uganda Revenue Authority e-invoicing

### Hardware
- **Spout Devices** - Pour sensors (PoursENSE, FlowX)
- **ESC/POS Printers** - Receipt printing
- **MSR Readers** - Magnetic stripe card readers

## 10. Performance & Scalability

### Caching Strategy
- **Redis Keys:**
  - `franchise:rankings:{orgId}:{period}` - Franchise rankings (5 min TTL)
  - `franchise:budgets:{orgId}:{branchId}:{period}` - Budget data (10 min TTL)
  - `kds:tickets:{station}` - KDS tickets (30 sec TTL)
  - `session:{userId}` - User session metadata

### Database Indexes
- Composite indexes on `orgId`, `branchId`, `createdAt`
- Unique constraints on business keys (order numbers, PO numbers)
- Partial indexes for active records (`WHERE status = 'ACTIVE'`)

### Query Optimization
- Prisma query profiling in dev
- Aggregation queries for analytics
- Materialized views planned for heavy reports

## 11. Security Measures

### Authentication
- Argon2id password hashing (65536 memory cost)
- JWT with short expiry (24h)
- Session versioning for instant revocation
- WebAuthn for phishing resistance
- MSR card token hashing (SHA256)

### Authorization
- L1-L5 role hierarchy
- Platform-specific access guards
- Org/branch isolation in all queries
- Demo write protection

### Data Protection
- PostgreSQL SSL in production
- Environment variable secrets
- PAN detection & rejection (payment cards)
- Webhook signature verification
- Rate limiting per org

### Audit Trail
- `audit_events` table for all mutations
- `flag_audits` for feature flag changes
- Session revocation logs
- Badge custody trail

## 12. Development Patterns

### Error Handling
- NestJS exception filters
- Custom exceptions (`BadRequestException`, `UnauthorizedException`)
- Structured error responses with codes

### Logging
- `LoggerMiddleware` - HTTP request logging
- `telemetry.ts` - Performance metrics
- Structured JSON logs in production

### Testing Strategy
- Unit tests: Jest
- E2E tests: `@nestjs/testing` + supertest
- Slice tests: Isolated feature E2E (e.g., `devportal.slice.e2e-spec.ts`)
- E2E test bypass flags (`E2E_AUTH_BYPASS`, `E2E_ADMIN_BYPASS`)

### Code Quality
- ESLint + Prettier
- Husky pre-commit hooks
- Conventional commits (commitlint)
- Madge circular dependency detection

---

**Next Steps:**
- See `FRONTEND_ROUTE_MAP.md` for frontend route inventory
- See `BACKEND_API_MAP.md` for complete API endpoint listing
- See `SCHEMA_DOMAIN_MAP.md` for Prisma model documentation
- See `TESTING_AND_VERIFICATION_MAP.md` for test infrastructure
- See `CLEANUP_CANDIDATES.md` for technical debt assessment
