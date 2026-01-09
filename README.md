# ChefCloud

**Enterprise-grade, offline-first POS for restaurants and bars in Uganda**

[![CI](https://github.com/mmazune/nimbuspos/actions/workflows/ci.yml/badge.svg)](https://github.com/mmazune/nimbuspos/actions/workflows/ci.yml)
[![E2E Slice Coverage](https://codecov.io/gh/mmazune/nimbuspos/branch/main/graph/badge.svg?flag=e2e-slice)](https://codecov.io/gh/mmazune/nimbuspos)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ChefCloud is a modern Point-of-Sale system designed specifically for Ugandan restaurants and bars, featuring:

- **Offline-First Architecture**: Continue operations during internet outages
- **Multi-Platform**: Desktop (Tauri), Web (Next.js), Mobile (Expo)
- **Uganda-Specific Integrations**: MTN MoMo, Airtel Money, URA EFRIS
- **Anti-Theft AI**: Behavioral analytics and anomaly detection
- **Kitchen Display System (KDS)**: Real-time order tracking
- **Inventory & Recipe Management**: Automatic stock depletion, wastage tracking
- **HR & Attendance**: Clock-in/out, shift management, payroll exports

## Architecture

```
ChefCloud/
├── apps/
│   ├── desktop/       # Tauri + React (POS Terminals)
│   ├── web/           # Next.js (Manager Portal)
│   └── mobile/        # Expo (Mobile Companion)
├── services/
│   ├── api/           # NestJS REST API
│   ├── worker/        # BullMQ Job Processor
│   └── sync/          # Offline Sync Service (ElectricSQL/RxDB)
├── packages/
│   ├── db/            # Prisma Schema & Client
│   ├── ui/            # Shared UI Components
│   ├── printer/       # ESC/POS Utilities
│   ├── auth/          # RBAC/ABAC Policies
│   └── contracts/     # Shared Types & DTOs
└── infra/
    ├── docker/        # Docker Compose (Postgres, Redis)
    └── deploy/        # GitHub Actions, IaC
```

## Tech Stack

- **Language**: TypeScript
- **Monorepo**: Turborepo + PNPM
- **Frontend**: React, Next.js, Tauri, Expo
- **Backend**: NestJS, Prisma, PostgreSQL
- **Offline Sync**: ElectricSQL (planned)
- **Queue/Cache**: BullMQ, Redis
- **DevOps**: Docker, GitHub Actions, Codespaces

## Quick Start

### 🚀 Zero-Touch Demo Setup (M7.6)

**New!** One-shot script that does everything:

```bash
# Windows
.\scripts\demo-reset.ps1

# Linux/Mac/WSL
chmod +x scripts/demo-reset.sh
./scripts/demo-reset.sh
```

**What it does**: Installs deps, builds packages, runs migrations, seeds demo data, verifies setup.  
**Time**: ~3-5 minutes  
**Result**: Production-ready demo with 0 test failures

📖 **Full guide**: [M7.6_FRESH_START_GUIDE.md](./instructions/M7.6_FRESH_START_GUIDE.md)  
🎯 **Quick ref**: [DEMO_QUICK_REFERENCE.md](./docs/runbooks/DEMO_QUICK_REFERENCE.md)

---

### Manual Setup (Advanced)

#### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ (or Docker Compose)

#### Installation

```bash
# Clone the repository
git clone https://github.com/mmazune/nimbuspos.git
cd nimbuspos

# Install dependencies
pnpm install

# Start infrastructure services (if using Docker)
cd infra/docker
docker-compose up -d
cd ../..

# Generate Prisma Client
cd packages/db
pnpm run db:generate
pnpm run db:push  # Push schema to database
cd ../..

# Build all packages
pnpm run build
```

### Development

```bash
# Start all services in watch mode
pnpm run dev

# Or run specific apps/services:
pnpm --filter @chefcloud/web dev       # Next.js on :3000
pnpm --filter @chefcloud/api dev       # NestJS on :3001
pnpm --filter @chefcloud/desktop dev   # Tauri on :1420
pnpm --filter @chefcloud/mobile start  # Expo
```

### Using Devcontainer (Recommended)

1. Open in GitHub Codespaces or VS Code with Dev Containers extension
2. The container will automatically:
   - Install dependencies
   - Start Postgres and Redis
3. Run `pnpm run dev` to start development

## Project Status

**M0 - Groundwork**: ✅ Complete (10/100 points)
- Monorepo scaffold
- Docker Compose infrastructure
- CI/CD pipeline
- Prisma schema foundation

**Next Milestone**: M1 - POS Core (18 points)

See [CHEFCLOUD_BLUEPRINT.md](./docs/CHEFCLOUD_BLUEPRINT.md) for full roadmap.

## Backend ↔ Frontend Parity (M34)

**P0 parity is now fully implemented.** Every major backend feature area has at least one clear, discoverable UI entry point:

### Backend Feature → UI Entry Points

- **Auth & Sessions (M10)**
  - UI: `/login`, AppShell session handling, idle timeout banner

- **POS, Orders, KDS (M11–M13, M26–M29)**
  - UI: `/pos` (POS Terminal), `/kds` (Kitchen Display), `/launch` (PWA/device role)

- **Inventory, Wastage, Shrinkage**
  - UI: `/inventory` (stock levels, wastage), Reports Hub → "Inventory & Stock", Analytics → franchise dashboards (waste/shrinkage metrics)

- **Staff KPIs, Awards, Promotions (M19)**
  - UI: `/staff/insights` (Staff Insights), `/staff` (Staff listing)

- **Reservations & Events (M15)**
  - UI: `/reservations` (Reservations vertical), POS integration for seating

- **Feedback & NPS (M20)**
  - UI: `/feedback` (Feedback & NPS vertical), Reports Hub → "Customer Feedback & NPS"

- **Documents & Receipts (M18)**
  - UI: `/documents` (Documents vertical), linked from Finance/HR contexts (planned P1 cross-links)

- **Franchise Analytics (E22)**
  - UI: `/analytics` (overview, rankings, budgets, variance, forecast), Reports Hub → multiple analytics-backed reports

- **Dev Portal (E23)**
  - UI: `/dev` (API keys, webhooks, logs, usage, docs)

- **Billing (E24)**
  - UI: `/billing` (plan, status, risk banners, feature gating)

- **Reports & Digests (M24 + M34-FE-PARITY-S2)**
  - UI: `/reports` (Reports Hub – Sales, Budgets & Variance, Waste & Shrinkage, Staff Insights, NPS, Inventory, Dev usage)
  - UI: `/reports/budgets` (Finance Budgets & Variance)

- **Diagnostics, Offline, PWA, Session Security (M27–M32)**
  - UI: Diagnostics panel (from global shell), Offline/sync panel in POS/KDS/Inventory, `/launch` (device role selection & PWA), global idle timeout handling and cross-tab logout

## API Endpoints

### Services/API (NestJS)
- `GET /health` - Health check with database status

### Apps/Web (Next.js)
- `GET /api/health` - Web app health
- `GET /api/version` - Version information

## Deployment

### Production Deployment (Railway + Vercel)

**Quick Start**: See [DEPLOY_QUICK.md](./docs/runbooks/DEPLOY_QUICK.md) for fast-track 5-step deployment.

**Full Guide**: See [DEPLOYMENT.md](./docs/runbooks/DEPLOYMENT.md) for comprehensive step-by-step instructions.

**What You'll Get**:
- ✅ Railway: API + PostgreSQL + Worker
- ✅ Vercel: Next.js Web Frontend
- ✅ Tapas Demo: Pre-seeded with 30 days of data
- ✅ 9 Demo Users: All roles ready to test
- ✅ Production-Ready: HTTPS, CORS, security headers

**Deploy Checklist**:
```bash
# 1. Railway PostgreSQL + API
# 2. Run migrations & seed Tapas demo
# 3. Vercel Web deployment
# 4. Update CORS configuration
# 5. Test login with owner@tapas.demo
```

See deployment guides for Railway configuration, environment variables, and troubleshooting.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Security

For security concerns, see [SECURITY.md](./SECURITY.md).

## Code of Conduct

We follow the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Authors

- **Moses Mazune** - Product Owner
- Built with GitHub Copilot

---

**Built for Uganda 🇺🇬 | Powered by TypeScript & Rust**
