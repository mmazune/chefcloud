# Nimbus POS / ChefCloud — Product Requirements Document (PRD)

_Last updated: 2025-12-25 (Africa/Kampala)_

This PRD defines the full feature set and quality bar for Nimbus POS (ChefCloud). It consolidates what is already implemented, what is in-progress, and what remains required for an enterprise-grade restaurant POS + backoffice platform.

This is a living document. **Source of truth is the repository code and Prisma schema**, but this PRD is the roadmap and acceptance reference for LLM-driven implementation.

---

## 1. Product Scope

Nimbus POS is an **offline-tolerant, multi-branch restaurant operations platform** spanning:

- **POS** (Front-of-house): orders, payments, shifts, receipts, KDS integration.
- **Kitchen/Bar** operational flows: ticket lifecycle, prep statuses, SLA monitoring.
- **Backoffice**: inventory, procurement, accounting, staff, reservations/events, documents, analytics, risk/anti-theft, feedback/NPS.
- **Enterprise/Franchise**: multi-branch consolidation, budgets, forecasting, transfers (roadmap/partial).
- **Developer/Integrations**: API keys, webhooks, external systems.

Platforms (repo-intended):
- Web (Next.js)
- Desktop (Tauri)
- Mobile (Expo / React Native)
- Backend services (NestJS API, Worker, Sync placeholder)

---

## 2. Personas and Roles (Job Roles vs Security Levels)

### 2.1 Two-layer model
- **Security RBAC (roleLevel / access control)**: enforces what a user may do.
- **Job Role UX (jobRole / workspace)**: optimizes what a user sees first and how they navigate.

### 2.2 Job roles (UX)
- OWNER / EXECUTIVE
- MANAGER / OPERATIONS
- ACCOUNTANT / FINANCE
- PROCUREMENT / PURCHASING
- STOCK_MANAGER / INVENTORY
- SUPERVISOR / SHIFT_LEAD
- CASHIER
- WAITER / SERVER
- CHEF / KITCHEN
- BARTENDER / BAR
- EVENT_MANAGER / BOOKINGS

### 2.3 Security levels (RBAC, already used in system)
- L1–L5 (exact mapping in RBAC docs)

---

## 3. Core Functional Requirements (By Domain)

### 3.1 Authentication, Sessions, and Access Hardening
- Login (email/password) and alternative enterprise methods where configured:
  - PIN login
  - MSR / badge-based login (hashed track mapping; never store raw track data)
  - Platform-bound access rules (web/desktop/mobile)
- Session management:
  - session creation, idle timeout, revocation, auditing, cleanup
  - “who logged in where” traceability (platform, device hints, timestamps)
- JWT and `/me` must return org, branch, roleLevel, jobRole (once implemented), and platform claims.

Acceptance:
- No auth token leakage to JS if using HTTP-only cookies for web.
- Revoked sessions cannot be reused.
- Platform guards work consistently.

### 3.2 POS Orders and Ticket Lifecycle
- Create/open order (table, customer optional, waiter assignment)
- Add/remove items, edit quantities
- Modifiers and item notes (kitchen instructions)
- Canonical order state machine:
  - NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED
  - VOIDED / CANCELLED paths with audit rules
- Transfers:
  - table transfer
  - waiter transfer
- Split bills (backend-supported; UI required)
- Receipts and printing integration

Acceptance:
- All transitions validated; no invalid transition silently allowed.
- Inventory and accounting integrations triggered at correct lifecycle moments.

### 3.3 Payments, Refunds, and Cash Handling
- Payment capture with multiple methods (cash, mobile money, card where available)
- Tip handling (tips posted to liabilities, not revenue)
- Refunds and post-close voids (audited)
- End-of-shift reconciliation support:
  - cash expected vs actual
  - over/short reporting
- Fiscalization integration stub with retries (where applicable)

Acceptance:
- Order cannot close with non-zero remaining balance.
- Idempotency applied to critical payment endpoints.

### 3.4 Kitchen Display / KDS and SLA
- KDS ticket feed and ticket status updates
- Derived order status from item statuses
- SLA tracking: time-to-ready, time-to-serve, breach indicators
- Live view / streaming (where implemented in roadmap)

Acceptance:
- KDS status and POS status remain consistent under edits/voids.

### 3.5 Inventory Management (FIFO + Recipes)
- Item master:
  - UOMs, categories, reorder levels
  - multi-branch stock
- Goods receiving:
  - purchase orders, receiving, supplier references
- Stock movements:
  - transfers between locations/branches
  - adjustments
  - wastage/spoilage
- Recipe management:
  - recipe definitions per menu item
  - ingredient consumption on sales/production
- FIFO consumption and COGS:
  - compute cost of sales per item/order/date range
  - audit trails for each consumption movement

Acceptance:
- Deterministic seed produces consistent inventory and recipes for demo orgs.
- Date-range inclusive logic does not drop end-of-day activity.

### 3.6 Procurement
- Supplier / vendor management
- Purchase orders with approvals (role-gated)
- Receiving and invoice matching (where supported)
- Lead time tracking and reorder suggestions (roadmap)

Acceptance:
- Procurement workflows must align to inventory movements and accounting postings.

### 3.7 Accounting Suite (Industrial-grade target)
Minimum enterprise accounting:
- Chart of accounts (COA)
- Journal entries with approvals/audit
- General ledger (GL)
- Trial balance
- P&L, Balance Sheet, Cash Flow
- Accounts Payable:
  - vendors, bills, payments, aging
- Accounts Receivable (optional for restaurants; required for events/catering):
  - customer invoices, receipts, aging
- Bank/cash accounts and reconciliation support
- Exports:
  - CSV, PDF, and integration-ready formats
- Tax reporting:
  - VAT/Tax summary
  - tax by category

Acceptance:
- POS transactions post correctly to GL (sales, tax, tips, deposits).
- Accounting reports match seeded demo data and verification scripts.

### 3.8 Reservations and Events
- Reservation lifecycle:
  - HELD → CONFIRMED → SEATED / CANCELLED / NO_SHOW
- Event bookings with deposits and minimum spends
- Ticketing/check-in flows where applicable
- Deposit accounting integration:
  - collect, apply, refund, forfeit

Acceptance:
- Booking metrics available per branch/date range.
- Deposits reflected correctly in GL.

### 3.9 Customer Feedback / NPS
- Public feedback entry (rate limited)
- Authenticated feedback capture
- NPS categorization and analytics
- Surfacing into reports/digests

Acceptance:
- One feedback per order/reservation/event where enforced.
- NPS trend and top comments available.

### 3.10 Documents
- Central document store linked to entities:
  - invoices, contracts, payslips, receipts, etc.
- Upload, download, list, soft delete
- Storage provider abstraction (local now, cloud later)
- RBAC controls and self-access rules (e.g., payslips)

Acceptance:
- Integrity metadata (checksum) recorded.
- Path structure and retention policy defined.

### 3.11 Staff, HR, and Performance Insights
- Staff directory with roles and branch assignments
- Attendance tracking / payroll runs (as implemented/roadmap)
- Staff awards (employee of the month)
- Promotion suggestions pipeline and decision tracking

Acceptance:
- Scoring is reproducible and auditable.
- RBAC prevents unauthorized HR access.

### 3.12 Developer Portal and Webhooks
- API keys:
  - hashed storage, rotate/revoke, environment tagging
- Webhook subscriptions and delivery inspection
- HMAC signatures with replay protection
- Delivery retry logic and status tracking

Acceptance:
- No raw API keys stored.
- Signature validation documented and testable.

### 3.13 Multi-Branch and Franchise (Enterprise roadmap)
- Consolidated metrics across branches:
  - sales, cash, stock, margins, SLA, shrinkage
- Branch rankings / scorecards
- Budgets vs actual with alerts
- Predictive stocking/forecasting
- Central procurement and inter-branch transfers with approvals
- HQ dashboards and rollups

Acceptance:
- Data model supports multi-branch without duplication.
- Cross-branch reporting correctness verified.

### 3.14 Offline-first and Reliability
- Client-side offline queue with idempotency keys
- Safe replay on reconnect
- Conflict behavior: same idempotency key + different payload ⇒ 409
- Background jobs (worker) for heavy processing

Acceptance:
- POS can continue capturing intent during outages.
- Reconnect sync does not duplicate financial records.

---

## 4. UX / Role-Based Workspaces (M8 Target)

Non-negotiable UX requirements:
- **Each jobRole has its own workspace landing page**
- **Navigation is capability-driven** (single config source of truth)
- Two roles at same security level must present meaningfully different workflows (e.g., Manager vs Accountant)

Role UX standards:
- Default landing route per jobRole
- Role-specific dashboards/KPIs
- Role-scoped “primary actions” surfaced above-the-fold
- Setup/settings only where relevant (Owner full, others minimal)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Fast hot paths: POS item add, order fetch, KDS views
- Indexed DB queries on common filters (branch/date/status)

### 5.2 Availability and Recovery
- Health endpoints for API and web
- Background job resilience
- Deterministic seed + reset scripts for fast environment recovery

### 5.3 Security and Compliance
- Hardened auth/session controls
- Rate limits on public endpoints
- Strong CORS + Helmet policies
- Audit trail for financial and inventory actions
- Least privilege RBAC

### 5.4 Observability
- Request IDs
- Structured logs
- Debug/verifier endpoints in non-production
- Alerts/notifications (SMTP/Slack where configured)

---

## 6. Acceptance Gates (Global)

A release candidate must satisfy:
- `pnpm lint`, `pnpm test`, `pnpm build` pass
- M7 verification baseline remains true (0 failed; only expected RBAC denials)
- Seed deterministic and idempotent; demo orgs consistent across machines
- No demo fallback data enabled by default
- Manual “click-through” smoke tests completed per role
- Security deploy checklist completed
