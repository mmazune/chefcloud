# Nimbus POS / ChefCloud — Backend Reference

_Last updated: 2025-12-25 (Africa/Kampala)_

This document summarizes the backend technology stack and backend structure (services, schema domains, and API surfaces). **The Prisma schema and the NestJS controllers are the authoritative source**; this is a navigation and orientation reference for LLMs and engineers.

---

## A) Technology Stack

### Runtime & Tooling
- Node.js 20+
- pnpm monorepo workspace
- TypeScript

### Backend Services
- **NestJS API** (`services/api`)
- **Worker service** (`services/worker`) for background jobs (BullMQ)
- **Sync service** (`services/sync`) placeholder / future expansion

### Data & Infrastructure
- PostgreSQL (primary datastore)
- Prisma (schema, migrations, client) in `packages/db`
- Redis (sessions/queues/caching; BullMQ backing store)

### Testing / Quality
- Unit tests + E2E tests (NestJS)
- Linting and formatting at repo level

### Security / Hardening (Implemented or referenced in docs)
- Platform access guards
- Session revocation and audit metadata
- API key hashing and webhook HMAC signatures (developer portal)
- Rate limiting (notably for public endpoints)
- CORS/Helmet hardening patterns

---

## B) Service Layout and Responsibilities

### `services/api` (NestJS)
Primary modules (high-level):
- Auth & Sessions
- POS (orders, items, payments, voids, transfers)
- Inventory & Recipes (FIFO consumption)
- Procurement (POs/receiving)
- Accounting (GL, reports, tax)
- Reservations & Events (deposits integrated to accounting)
- Feedback/NPS
- Documents
- Dev Portal (API keys, webhooks)
- Franchise / Multi-branch analytics (where implemented)
- Reporting / Digests

### `services/worker`
- background tasks (email digests, report generation, webhook dispatch retries, etc.) depending on configuration

### `packages/db`
- Prisma schema
- migrations
- shared DB client

---

## C) Schema Domains (Conceptual)

**Note:** Field-level detail must be read from `packages/db/prisma/schema.prisma`.

### Identity & Access
- User
- Employee (if distinct)
- Session
- MsrCard / Badge mappings
- Role and permissions (roleLevel + future jobRole)

### POS
- Order
- OrderItem
- Payment
- Shift / CashSession
- KDS ticket records (where modeled)

### Menu
- MenuCategory
- MenuItem
- Modifiers / Options (where modeled)

### Inventory & Procurement
- InventoryItem
- StockMovement / StockLedger
- Wastage
- Recipe
- RecipeIngredient
- PurchaseOrder
- GoodsReceipt / Receiving
- Vendor / Supplier

### Accounting
- ChartOfAccounts / Account
- JournalEntry / JournalLine
- GL postings from POS, deposits, wastage, tips
- Reports tables/views (logical)

### Reservations & Events
- Reservation
- Event / EventBooking
- Deposits and accounting mappings

### Documents
- Document (linked to entity types)

### Feedback
- Feedback (NPS scoring, channels)

### Dev Portal / Integrations
- DevApiKey
- WebhookSubscription
- WebhookDelivery

### Franchise / Enterprise (Roadmap / partial)
- Branch budgets
- Forecast models
- Inter-branch transfers

---

## D) API Surface (Conceptual Map)

**Note:** Exact routes are in NestJS controllers and documented runbooks.

Common areas:
- `/auth/*` — login/logout/session operations
- `/me` — current session user context
- `/pos/*` — orders lifecycle, payments, transfers, voids
- `/menu/*` — menu and categories
- `/inventory/*` — stock, items, movements, wastage, recipes
- `/procurement/*` — vendors, POs, receiving
- `/accounting/*` — GL, journals, AP/AR, reports
- `/reports/*` — tax and operational summaries
- `/reservations/*` and `/events/*` — bookings, deposits, lifecycle actions
- `/feedback/*` — capture + analytics
- `/documents/*` — upload/download/list
- `/dev-portal/*` — API keys, webhooks, delivery inspection
- `/franchise/*` — multi-branch consolidation endpoints (where available)
- `/health` — API health

---

## E) Invariants and Engineering Rules

- Idempotency keys must protect critical write endpoints.
- Financial writes must be auditable (who, when, why).
- Inventory adjustments must be reconciled to a movement/ledger entry.
- Date-range queries must treat end-of-day as inclusive per project standard.
- Never store raw MSR track data; store only safe hashes.
