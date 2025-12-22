
# ChefCloud — Engineering Blueprint v0.1

**Owner:** Mazune m (Product)
**Tech Lead (you + me):** Build director + coding assistant
**Repo:** `github.com/mmazune/chefcloud` (fresh)
**Goal:** Enterprise‑grade, offline‑first POS for restaurants/bars in Uganda, reaching or exceeding Oracle MICROS parity while staying lighter, faster, and more local.

---

## 1) Vision & Scope

ChefCloud is a 3‑platform suite (Desktop terminals, Web backoffice, Mobile companion) that runs reliably with poor internet, integrates Uganda‑first payments and tax (MTN MoMo, Airtel Money, URA EFRIS), and provides deep analytics + anti‑theft AI.

### Primary Platforms
- **Desktop (Tauri)**: cashier/waiter/supervisor terminals, KDS, printing, hardware (MSR card, fingerprint).
- **Web (Next.js)**: owner/manager/accountant portals, configuration, analytics.
- **Mobile (React Native/Expo)**: manager on-the-go, stock operations, chef/KDS companion, push notifications.

### User Levels & Targets
- **L1 Waiter**, **L2 Cashier/Supervisor**, **L3 Chef/Stock**, **L4 Manager/Accountant**, **L5 Owner + Admin managers**.

### Core Feature Areas
1. **POS**: floor plan, orders, modifiers, KDS, payments, receipts, void/discount with approvals.
2. **Inventory & Recipes**: BOM, auto-decrement, wastage, suppliers, purchase orders, cross‑branch transfer.
3. **Reservations**: table booking incl. deposits, aerial floor view, conflict prevention.
4. **HR/Attendance**: shifts, clock‑in/out (PIN/MSR/fingerprint), performance stats, payroll exports.
5. **Finance/Tax**: VAT rules, P&L, X/Z reports, fiscalization (EFRIS).
6. **Uganda payments**: MTN MoMo, Airtel Money, card rails (later), cash.
7. **AI & Analytics**: demand forecasts, anomaly detection, anti‑theft scores.
8. **Remote Support & Observability**: secure shadowing, logs/metrics/traces, crash reporting.
9. **Security & Compliance**: RBAC, ABAC, MFA, encryption, audit trails, GDPR‑style data hygiene.

---

## 2) Non‑Functional Requirements (NFRs)

- **Offline‑first**: terminals continue operating without internet for at least 60 minutes; conflict‑free sync on reconnect.
- **Performance**: <200ms main terminal interactions; printing within 1s; KDS refresh 1–2s.
- **Reliability**: graceful degradation when services fail; daily backups + PITR; deploy without downtime.
- **Security**: all sensitive actions audit‑logged; manager‑PIN required for voids/discounts > threshold.
- **Extensibility**: modular services & packages; clearly versioned contracts; plugin points for hardware and payments.
- **Internationalization**: en‑UG default; currency UGX standard.
- **Accessibility**: high‑contrast modes, keyboard navigation, large touch targets.

---

## 3) Architecture Overview

**Pattern:** Local‑first apps (SQLite on device) + cloud Postgres; replication via ElectricSQL or RxDB; API via NestJS; queues via BullMQ/Redis; real‑time via WebSockets.

```
apps/
  desktop/ (Tauri + React)  -> ESC/POS, HID/serial, offline cache
  web/ (Next.js)            -> Admin, analytics
  mobile/ (Expo RN)         -> Manager/Stock/Chef companion
services/
  api/ (NestJS)             -> Auth, RBAC, REST/GraphQL
  worker/ (Node)            -> queues: email, reports, fiscalization
  sync/ (replication)       -> ElectricSQL or RxDB bridge
packages/
  db/ (Prisma)              -> schema + migrations
  ui/ (shadcn/ui)           -> shared components (later; UI last)
  printer/                  -> ESC/POS utilities
  auth/                     -> RBAC/ABAC guards, policy
  contracts/                -> OpenAPI/tRPC/Zod models
infra/
  docker/                   -> postgres, redis, mailhog
  deploy/                   -> GitHub Actions, IaC stubs
```

**Printing:** ESC/POS over network (and USB via native addon).  
**Hardware:** MSR (magstripe) via HID/serial, USB fingerprint via OS SDK (Windows Hello/macOS TouchID when available), PIN pads optional.  
**Auth options:** username+password + **MFA**; fast login methods (MSR swipe → map to Employee → ephemeral token; **PIN** keypad; **fingerprint** via platform APIs).  
**Compliance:** EFRIS integration (system‑to‑system), VAT support, immutable audit logs.  
**Observability:** Sentry, OpenTelemetry, structured logs.  
**Backups:** Nightly encrypted + PITR; secrets in GitHub Actions + dotenv for local.

---

## 4) Tech Stack

- **Lang:** TypeScript everywhere.
- **Web:** Next.js + React, shadcn/ui later, TanStack Query.
- **Desktop:** **Tauri** (Rust shell + React UI).
- **Mobile:** React Native (Expo).
- **API:** NestJS (REST first, opt‑in GraphQL).
- **DB:** Postgres (primary), SQLite (clients), Prisma ORM.
- **Sync:** ElectricSQL (preferred) or RxDB replicator.
- **Cache/Jobs:** Redis + BullMQ.
- **Auth:** Lucia/Auth.js or custom JWT + WebAuthn for MFA.
- **Testing:** Vitest/Jest, Playwright (E2E), k6 (perf), Testcontainers.
- **Docs:** Markdown in `/docs`, Docusaurus (optional later).
- **CI/CD:** GitHub Actions, Codespaces devcontainer.

---

## 5) Initial Data Model (high‑level)

- **Org, Branch, User, Role, Permission, Device, Session**
- **FloorPlan, Table**
- **Category, MenuItem, ModifierGroup, Modifier**
- **InventoryItem, StockBatch, Supplier, PurchaseOrder, GoodsReceipt**
- **RecipeIngredient**
- **Order, OrderItem, OrderEvent, KDSTicket**
- **Payment (cash/card/momo), Discount, TaxLine**
- **Reservation, Deposit**
- **Shift, Attendance, Tip, PayrollExport**
- **AuditEvent, WebhookSub, Integration (EFRIS, MoMo, Airtel)**

All write‑paths produce **AuditEvent**s with who/what/when/where and previous/new values. Sensitive actions require **ManagerPIN** or higher role.

---

## 6) AI & Anti‑Theft

### Signals & Heuristics (Phase 1: rule‑based)
- **“No‑drink” tables**: meals-only bills above X UGX → flag for upsell reminder/suspicion review.
- **Cancellation spikes**: waiters or supervisors with high void/cancel rate vs peers & time baseline.
- **Late voids**: void after item marked “served/printed”; flag.
- **Discount anomalies**: high discount usage per shift; repeated manual % discounts.
- **Inventory variance**: negative stock balance, frequent adjustments.
- **KDS bypass**: items paid with no cook ticket ever marked “ready”.
- **After‑hours activity**: transactions outside scheduled hours.
- **Payment splits**: unusual split patterns before close.
Each signal contributes to an **Anomaly Score** with threshold bands (Info/Warning/Critical).

### Phase 2 (statistical/ML)
- Time‑series baselines per branch/day/shift.
- Per‑employee behavioral profiles.
- Simple regression for expected basket composition; drift alerts.

Outputs: dashboards, Slack/email alerts, and **Explain‑why** text for transparency.

---

## 7) Security

- RBAC L1–L5 + ABAC on branch ownership.
- MFA (TOTP/WebAuthn) for L3+; forced password rotation policy.
- Device registration & attestation for terminals.
- Secrets via environment; least‑privilege DB roles.
- PII minimization; hashed MSR employee ids; fingerprint stays OS‑side (no raw biometric stored).

---

## 8) Color & Branding (UI comes later, but documented)

Palette (from provided image):
- **Primary Navy** `#00033D`
- **Chef Blue** `#0033FF`
- **Lavender Accent** `#977DFF`
- **Soft Gray** `#EAEDF3`
- **Ink** `#030812`
- **White** `#FFFFFF`
- **Gradients**: Blue→Lavender; and radial blue fog.

Store as `/packages/ui/tokens/colors.ts` later.

---

## 9) Roadmap & Weights (for % completion)

We track progress by **weights totaling 100**:

- **M1 POS Core** (tables→order→KDS→pay→print→X/Z): **18**
- **M2 Inventory & Recipes**: **12**
- **M3 Offline & Sync**: **10**
- **M4 Payments & Tax (UG)**: **12**
- **M5 Roles, HR & Performance**: **8**
- **M6 Reservations & Floorplan**: **6**
- **M7 Bar Add‑ons (pour spout, shrinkage)**: **6**
- **M8 Analytics & Owner Views**: **8**
- **M9 Mobile Apps**: **7**
- **M10 AI (forecast + anomalies)**: **8**
- **M11 Remote Support & Observability**: **5**
- **M0 Groundwork (repo, CI, devcontainer)**: **10**

Completion % = (sum of delivered milestone weights) / 100.

---

## 10) Developer Workflow

- **Branching**: trunk‑based via PRs; conventional commits.
- **Code quality**: ESLint, Prettier, TypeScript strict; Husky pre‑commit.
- **Testing gates**: unit + e2e on PR; preview deploy for web.
- **Secrets**: never committed; use GitHub env secrets.
- **Releases**: semantic versioning; release notes automated.
- **Issue labels**: `feat`, `bug`, `chore`, `infra`, `ux`, `docs`, `good-first-issue`, `blocked`, `needs-design`.
- **Definition of Done**: code + tests + docs + telemetry + rollout plan.

---

## 11) First Three Milestones (acceptance tests)

### M0 — Groundwork
- Monorepo scaffold compiles; devcontainer brings up Postgres/Redis.
- CI: lint/test/build passes; preview job runs.
- Basic Prisma schema and migration works.

### M1 — POS Core
- Order from floor to KDS to paid receipt; void/discount with manager PIN; shift X/Z reports export CSV/PDF.
- Works offline for 30+ minutes; prints locally; syncs when reconnected.

### M2 — Inventory & Recipes
- Items sell down ingredients; wastage and returns recorded; theoretical vs counted variance report shows gaps.

---

## 12) Initial Directory Contracts (expected after scaffolding)

```
/apps
  /desktop
  /web
  /mobile
/services
  /api
  /worker
  /sync
/packages
  /db
  /ui
  /printer
  /auth
  /contracts
/infra
  /docker
  /deploy
/docs
```

---

## 13) Operations & Support

- **Crash reporting**: Sentry for all apps.
- **Logs**: JSON structured, retained 30 days.
- **Monitoring**: Health endpoints, uptime alarms.
- **Backups**: Nightly snapshots + PITR.
- **Remote support**: opt‑in device shadowing; all actions audit‑logged.

---

## 14) Prompts — Step A1 (Scaffold & CI)

Use the following prompt with Claude Sonnet **inside Codespaces** to create the repo scaffold. Paste it as‑is:

```
You are the project code generator. Work in this GitHub Codespace for repo mmazune/chefcloud.

Objective: scaffold a TypeScript monorepo with Turborepo and PNPM for the ChefCloud architecture below, WITHOUT building UI yet. Include devcontainer, Postgres, Redis, and CI.

Create:
- apps/{desktop,web,mobile} (Tauri+React; Next.js; Expo blank)
- services/{api,worker,sync} (NestJS; Node worker with BullMQ; placeholder sync svc)
- packages/{db,ui,printer,auth,contracts} (Prisma; ui stub; ESC/POS utils stub; auth policy; shared types)
- infra/{docker,deploy} with docker-compose for postgres:16 and redis:7; GitHub Actions workflow to run lint/test/build.
- docs/CHEFCLOUD_BLUEPRINT.md (copy in the key sections from the provided blueprint).

Requirements:
- Package manager: pnpm with a turbo.json.
- TypeScript strict everywhere.
- Prisma in packages/db with initial schema containing Org, Branch, User, Role, Permission, Table, Category, MenuItem, Order, OrderItem, Payment, AuditEvent (empty models OK).
- NestJS API: health endpoint GET /health; connect to Postgres via Prisma.
- Worker: BullMQ queue 'reports' with a dummy processor.
- Desktop (Tauri): minimal boot with React; no UI design, only "Hello ChefCloud".
- Web (Next): minimal /health and /version routes.
- Mobile (Expo): blank app.
- Devcontainer: Node LTS, pnpm, docker-compose up postgres+redis on start.
- Husky + lint-staged; eslint/prettier config; commitlint.
- Conventional commits; LICENSE (MIT), README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- GitHub Actions: on PR -> pnpm install, turbo run lint,test,build; cache pnpm/turbo.

Deliverables:
1) Run all generation steps and commit.
2) Print the final repo tree.
3) Run pnpm -w install and build; fix any issues.
4) Output the commands I need to run locally to start dev (devcontainer + seed).

After you finish, respond with: 
===FEEDBACK REQUEST===
Did all CI steps pass locally in Codespaces? If ANY step failed, paste the error log section and propose a fix. If all good, say "A1 OK".
```

**Feedback reply to send me after running the prompt above:**
```
A1 status: {A1 OK | FAILED}
If FAILED: paste the exact error text from the step, then say "Need A1‑fix".
```

---

## 15) Next Steps

1) Run **Step A1** in Codespaces with Claude Sonnet.  
2) Send the **Feedback reply** above.  
3) I will then generate **A1‑fix** prompt if needed or move to **A2 (DB schema & migrations)**.

---

## Appendix — Risk Notes

- EFRIS and payment SDKs can have sandbox quirks; keep adapters behind interfaces.
- Hardware variability (MSR/fingerprint) → feature‑flags per branch.
- Offline conflicts → choose last‑write‑wins for non‑financial metadata, but ledger‑style merges for financial events.

---
