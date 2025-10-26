# ChefCloud

**Enterprise-grade, offline-first POS for restaurants and bars in Uganda**

[![CI](https://github.com/mmazune/chefcloud/actions/workflows/ci.yml/badge.svg)](https://github.com/mmazune/chefcloud/actions/workflows/ci.yml)
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

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/mmazune/chefcloud.git
cd chefcloud

# Install dependencies
pnpm install

# Start infrastructure services
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

## API Endpoints

### Services/API (NestJS)
- `GET /health` - Health check with database status

### Apps/Web (Next.js)
- `GET /api/health` - Web app health
- `GET /api/version` - Version information

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Security

For security concerns, see [SECURITY.md](./SECURITY.md).

## Code of Conduct

We follow the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Authors

- **Ssemakula Allan** - Product Owner
- Built with GitHub Copilot

---

**Built for Uganda 🇺🇬 | Powered by TypeScript & Rust**
