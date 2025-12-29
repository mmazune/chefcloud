# ChefCloud - Backend API Map

**Last Updated:** December 25, 2025  
**Service:** `services/api` (NestJS)  
**Base URL:** `http://localhost:3001` (dev) | `https://api.chefcloud.com` (prod)

## API Architecture Overview

### NestJS Module Structure
```
services/api/src/
├── app.module.ts          # Root module (imports all domain modules)
├── main.ts                # Bootstrap (port 3001)
├── prisma.module.ts       # Global Prisma service
├── prisma.service.ts      # Prisma client wrapper
├── common/                # Cross-cutting concerns
│   ├── cache.module.ts    # Redis caching
│   ├── redis.service.ts   # Redis client
│   ├── custom-throttler.guard.ts  # Rate limiting
│   ├── webhook-verification.guard.ts
│   ├── idempotency/       # M21 idempotency infrastructure
│   └── demo/              # M33 demo protection
└── <domain>/              # Domain modules (see below)
```

## Domain Modules & Controllers

### 1. Identity & Authentication (`auth/`)

**Module:** `AuthModule`  
**Controllers:** `AuthController`

#### Endpoints

| Method | Path | Min Role | Purpose | Request Body | Response |
|--------|------|----------|---------|--------------|----------|
| POST | `/auth/login` | Public | Email/password login | `{ email, password }` | `{ token, user }` |
| POST | `/auth/msr-swipe` | Public | MSR card swipe login | `{ trackData }` | `{ token, user }` |
| POST | `/auth/enroll-badge` | L4 | Assign MSR badge to user | `{ userId, badgeId }` | `{ profile }` |
| POST | `/auth/logout` | L1 | Logout (revoke session) | - | `{ message }` |
| GET | `/auth/session` | L1 | Get current session | - | `{ session }` |

**Guards:** `JwtAuthGuard`, `PlatformAccessGuard`

---

### 2. WebAuthn (`webauthn/`)

**Module:** `WebAuthnModule`  
**Controllers:** `WebAuthnController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/webauthn/registration/options` | L3 | Get registration options |
| POST | `/webauthn/registration/verify` | L3 | Verify registration response |
| POST | `/webauthn/authentication/options` | Public | Get authentication options |
| POST | `/webauthn/authentication/verify` | Public | Verify authentication response |

---

### 3. Badge Management (`badges/`)

**Module:** `BadgesModule`  
**Controllers:** `BadgesController`

#### Endpoints

| Method | Path | Min Role | Purpose | Request Body |
|--------|------|----------|---------|--------------|
| POST | `/badges/:code/revoke` | L4 | Revoke badge permanently | `{ reason }` |
| POST | `/badges/:code/lost` | L4 | Mark badge as lost | - |
| POST | `/badges/:code/returned` | L4 | Mark badge as returned | - |
| GET | `/badges/:code` | L4 | Get badge status | - |

**Session Invalidation:** Revoke/Lost increments user's `sessionVersion`, invalidating all active JWTs

---

### 4. User Profile (`me/`)

**Module:** `MeModule`  
**Controllers:** `MeController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/me` | L1 | Get current user profile |
| PUT | `/me` | L1 | Update user profile |
| GET | `/me/sessions` | L1 | List active sessions |
| DELETE | `/me/sessions/:id` | L1 | Revoke specific session |

---

### 5. POS Orders (`pos/`)

**Module:** `PosModule`  
**Controllers:** `PosController`

#### Endpoints

| Method | Path | Min Role | Purpose | Idempotent | Request Body |
|--------|------|----------|---------|------------|--------------|
| POST | `/pos/orders` | L1 | Create new order | ✅ | `{ tableId?, serviceType, items: [] }` |
| GET | `/pos/orders` | L2 | List orders (status, date filters) | ❌ | - |
| GET | `/pos/orders/:id` | L1 | Get order details | ❌ | - |
| PUT | `/pos/orders/:id/send` | L1 | Send order to kitchen | ❌ | - |
| POST | `/pos/orders/:id/payment` | L2 | Record payment | ✅ | `{ method, amount }` |
| POST | `/pos/orders/:id/void` | L2 | Void order | ❌ | `{ reason }` |
| PUT | `/pos/orders/:id/close` | L2 | Close order (triggers FIFO consumption) | ❌ | - |
| POST | `/pos/orders/:id/split` | L2 | Split bill | ❌ | `{ splitType, items }` |

**Business Logic:**
- **Order Creation:** Creates `Order`, `OrderItem[]`, `KdsTicket[]`
- **Close Order:** Triggers recipe consumption (FIFO), creates `StockMovement[]`
- **Idempotency:** Uses `Idempotency-Key` header (M21)

---

### 6. Kitchen Display System (`kds/`)

**Module:** `KdsModule`  
**Controllers:** `KdsController`

#### Endpoints

| Method | Path | Min Role | Purpose | Query Params |
|--------|------|----------|---------|--------------|
| GET | `/kds/tickets` | L2 | List KDS tickets | `station`, `status`, `since` (for polling) |
| PUT | `/kds/tickets/:id/ready` | L2 | Mark ticket as READY | - |
| GET | `/kds/sla` | L4 | Get SLA config | - |
| PUT | `/kds/sla` | L4 | Update SLA config | `{ station, greenThresholdSec, orangeThresholdSec }` |

**Real-Time:** SSE endpoint at `/stream/kds` (see SSE section)

---

### 7. Menu Management (`menu/`)

**Module:** `MenuModule`  
**Controllers:** `MenuController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/menu/items` | L1 | List menu items (branch-scoped) |
| POST | `/menu/items` | L4 | Create menu item |
| PUT | `/menu/items/:id` | L4 | Update menu item |
| DELETE | `/menu/items/:id` | L4 | Delete menu item |
| GET | `/menu/categories` | L1 | List categories |
| POST | `/menu/categories` | L4 | Create category |

---

### 8. Floor & Tables (`floor/`)

**Module:** `FloorModule`  
**Controllers:** `FloorController`, `TablesController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/floor/plans` | L1 | List floor plans |
| POST | `/floor/plans` | L4 | Create floor plan |
| GET | `/tables` | L1 | List tables |
| PUT | `/tables/:id/status` | L2 | Update table status (AVAILABLE, OCCUPIED, CLEANING) |

---

### 9. Inventory (`inventory/`)

**Module:** `InventoryModule`  
**Controllers:** Multiple controllers

#### Core Inventory Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/inventory/items` | L3 | List inventory items |
| POST | `/inventory/items` | L4 | Create inventory item |
| GET | `/inventory/levels` | L3 | Get on-hand stock levels (across all batches) |

#### Recipe Management (`inventory/recipes.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/inventory/recipes/:menuItemId` | L3 | Get recipe for menu item |
| POST | `/inventory/recipes/:menuItemId` | L4 | Create/update recipe |
| DELETE | `/inventory/recipes/:menuItemId` | L4 | Delete recipe |

**Recipe Schema:**
```json
{
  "ingredients": [
    {
      "itemId": "item-123",
      "qtyPerUnit": 0.2,
      "wastePct": 10,
      "modifierOptionId": null  // null = always consumed, non-null = only if modifier selected
    }
  ]
}
```

#### Wastage Tracking (`inventory/wastage.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/inventory/wastage` | L3 | List wastage records |
| POST | `/inventory/wastage` | L3 | Record wastage |

#### Stock Counts (`inventory/counts.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/inventory/counts` | L3 | Submit stock count (shift-close gate - E45) |
| GET | `/inventory/counts` | L3 | List stock counts |

#### Low Stock Alerts (`inventory/low-stock-alerts.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/inventory/low-stock` | L3 | Get low-stock alerts |
| POST | `/inventory/low-stock/config` | L4 | Configure alert thresholds |

#### Reconciliation (`inventory/reconciliation.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/inventory/reconciliation` | L4 | Get variance report (expected vs actual stock) |

---

### 10. Purchasing (`purchasing/`)

**Module:** `PurchasingModule`  
**Controllers:** `PurchasingController`

#### Endpoints

| Method | Path | Min Role | Purpose | Idempotent |
|--------|------|----------|---------|------------|
| POST | `/purchasing/po` | L4 | Create purchase order (draft) | ✅ |
| GET | `/purchasing/po` | L3 | List purchase orders |
| GET | `/purchasing/po/:id` | L3 | Get PO details |
| PUT | `/purchasing/po/:id/place` | L4 | Place PO (send to supplier) | ❌ |
| POST | `/purchasing/po/:id/receive` | L3 | Receive PO (creates goods receipt + stock batches) | ✅ |
| GET | `/purchasing/suppliers` | L3 | List suppliers |
| POST | `/purchasing/suppliers` | L4 | Create supplier |

**Business Logic:**
- **Receive PO:** Creates `GoodsReceipt`, `GoodsReceiptLine[]`, `StockBatch[]` (FIFO queue)

---

### 11. Shifts & Schedules (`shifts/`, `shift-templates/`, `shift-schedules/`, `shift-assignments/`)

#### Shift Templates (`shift-templates/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/shift-templates` | L4 | List shift templates |
| POST | `/shift-templates` | L4 | Create template |

#### Shift Schedules (`shift-schedules/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/shift-schedules` | L4 | List schedules (date range) |
| POST | `/shift-schedules` | L4 | Create schedule from template |

#### Shift Assignments (`shift-assignments/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/shift-assignments` | L4 | List assignments |
| POST | `/shift-assignments` | L4 | Assign user to shift |

#### Shift Sessions (`shifts/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/shifts/open` | L2 | Open shift (record opening float) |
| PUT | `/shifts/:id/close` | L2 | Close shift (record cash count, stock count gate - E45) |
| GET | `/shifts` | L2 | List shifts |

**Shift Close Flow (E45):**
1. Manager attempts to close shift
2. System checks for stock count submission
3. If variance > tolerance → require manager override
4. Record `overrideUserId`, `overrideReason` in `Shift` record

---

### 12. Payments & Refunds (`payments/`)

**Module:** `PaymentsModule`  
**Controllers:** `PaymentsController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/payments/intents` | L2 | Create payment intent (MoMo) |
| GET | `/payments/intents/:id` | L2 | Get intent status |
| POST | `/payments/refunds` | L4 | Issue refund |
| GET | `/payments/refunds/:id` | L2 | Get refund status |

---

### 13. Reservations (`reservations/`)

**Module:** `ReservationsModule`  
**Controllers:** `ReservationsController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/reservations` | L2 | List reservations (date, status filters) |
| POST | `/reservations` | L2 | Create reservation |
| PUT | `/reservations/:id/confirm` | L2 | Confirm reservation |
| PUT | `/reservations/:id/cancel` | L2 | Cancel reservation (refund deposit if applicable) |
| PUT | `/reservations/:id/seat` | L2 | Seat reservation (assign table) |

---

### 14. Event Bookings (`bookings/`)

**Module:** `BookingsModule`  
**Controllers:** `BookingsController`, `PublicBookingsController`, `CheckinController`

#### Private Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/bookings/events` | L3 | List events |
| POST | `/bookings/events` | L4 | Create event |
| GET | `/bookings/events/:eventId/bookings` | L3 | List bookings for event |

#### Public Endpoints (E42)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/public/bookings/events/:slug` | Public | Get event details (public) |
| POST | `/public/bookings/events/:slug/book` | Public | Book event table (public) |

#### Check-In (E42-S2)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/events/bookings/:ticketCode/checkin` | L2 | QR/ULID check-in |

---

### 15. Reservations (`reservations/`)

**Module:** `ReservationsModule`  
**Controllers:** `ReservationsController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/reservations` | L2 | List reservations |
| POST | `/reservations` | L2 | Create reservation (with optional deposit) |
| PUT | `/reservations/:id/confirm` | L2 | Confirm reservation |
| PUT | `/reservations/:id/cancel` | L2 | Cancel reservation |
| PUT | `/reservations/:id/seat` | L2 | Seat reservation (assign table) |

---

### 16. Staff & HR (`staff/`, `hr/`)

#### Staff Management (`staff/staff.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/staff` | L4 | List employees |
| POST | `/staff` | L4 | Create employee |
| PUT | `/staff/:id` | L4 | Update employee |

#### Staff Insights (M19 - `staff/staff-insights.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/staff/insights` | L4 | Get aggregated staff KPIs (sales, reliability, service scores) |
| GET | `/staff/insights/:employeeId` | L4 | Get individual staff metrics |

#### Promotion Suggestions (M22 - `staff/promotion-insights.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/staff/promotion-suggestions` | L4 | List promotion suggestions |
| POST | `/staff/promotion-suggestions/:id/accept` | L5 | Accept suggestion |
| POST | `/staff/promotion-suggestions/:id/reject` | L5 | Reject suggestion |

#### HR Attendance (`hr/attendance.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/hr/attendance` | L4 | List attendance records |
| POST | `/hr/attendance/clockin` | L2 | Clock in (auto or manual) |
| POST | `/hr/attendance/clockout` | L2 | Clock out |

#### HR Employees (`hr/employees.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/hr/employees` | L4 | List employees (with contracts, attendance) |
| POST | `/hr/employees` | L4 | Create employee |
| POST | `/hr/employees/:id/contracts` | L4 | Add employment contract |

---

### 17. Workforce Management (`workforce/`)

**Module:** `WorkforceModule`  
**Controllers:** `WorkforceController`, `PayrollController`

#### Leave Requests (`workforce/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/workforce/leave-requests` | L3 | List leave requests |
| POST | `/workforce/leave-requests` | L3 | Submit leave request |
| PUT | `/workforce/leave-requests/:id/approve` | L4 | Approve leave |

#### Duty Shifts (`workforce/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/workforce/duty-shifts` | L4 | List duty shifts |
| POST | `/workforce/duty-shifts` | L4 | Create duty shift assignment |

#### Shift Swaps (`workforce/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/workforce/shift-swaps` | L3 | List swap requests |
| POST | `/workforce/shift-swaps` | L3 | Request shift swap |
| PUT | `/workforce/shift-swaps/:id/approve` | L4 | Approve swap |

#### Payroll (`payroll/`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/payroll/runs` | L4 | List pay runs |
| POST | `/payroll/runs` | L4 | Create pay run (draft) |
| POST | `/payroll/runs/:id/approve` | L5 | Approve pay run |
| GET | `/payroll/slips` | L3 | List pay slips (own or team) |
| GET | `/payroll/slips/:id` | L3 | Get pay slip details |

---

### 18. Finance & Accounting (`accounting/`, `finance/`)

#### Accounting Core (`accounting/accounting.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/accounting/accounts` | L4 | List chart of accounts |
| POST | `/accounting/accounts` | L5 | Create account |
| GET | `/accounting/journal` | L4 | List journal entries |
| POST | `/accounting/journal` | L4 | Create journal entry |

#### Fiscal Periods (`accounting/periods.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/accounting/periods` | L4 | List fiscal periods |
| POST | `/accounting/periods/:id/close` | L5 | Close period (lock edits) |

#### Bank Reconciliation (`accounting/bank-rec.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/accounting/bank/accounts` | L4 | List bank accounts |
| GET | `/accounting/bank/statements` | L4 | List bank statements |
| POST | `/accounting/bank/reconcile` | L4 | Match transactions |

#### Finance Budgets (`finance/budget.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/finance/budgets` | L4 | List branch budgets |
| POST | `/finance/budgets` | L5 | Create/update budget |
| GET | `/finance/budgets/variance` | L4 | Get budget vs actual variance report |

---

### 19. Service Providers (`service-providers/`)

**Module:** `ServiceProvidersModule`  
**Controllers:** `ServiceProvidersController`, `RemindersController`

#### Service Providers

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/service-providers` | L4 | List providers (rent, utilities, DJ, etc.) |
| POST | `/service-providers` | L4 | Create provider |
| POST | `/service-providers/:id/contracts` | L4 | Add service contract |

#### Service Reminders (`finance/service-reminders`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/finance/service-reminders` | L4 | List upcoming payables |
| POST | `/finance/service-reminders/:id/acknowledge` | L4 | Acknowledge reminder |

---

### 20. Documents (`documents/`)

**Module:** `DocumentsModule`  
**Controllers:** `DocumentsController`

#### Endpoints (M18)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/documents/upload` | L3 | Upload document (multipart/form-data) |
| GET | `/documents` | L3 | List documents (category, entity filters) |
| GET | `/documents/:id/download` | L3 | Download document |
| DELETE | `/documents/:id` | L4 | Soft-delete document |

**Storage Providers:**
- `LOCAL` - Filesystem (`/uploads`)
- `S3` - AWS S3 (planned)
- `GCS` - Google Cloud Storage (planned)

---

### 21. Customer Feedback (`feedback/`)

**Module:** `FeedbackModule`  
**Controllers:** `FeedbackController`

#### Endpoints (M20)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/feedback` | Public | Submit feedback (NPS 0-10) |
| GET | `/feedback` | L3 | List feedback (date, NPS filters) |
| GET | `/feedback/nps` | L4 | Get NPS score & breakdown (Detractors, Passives, Promoters) |

**NPS Categories:**
- Detractor: 0-6
- Passive: 7-8
- Promoter: 9-10

**NPS Score = (% Promoters) - (% Detractors)**

---

### 22. Reports (`reports/`)

**Module:** `ReportsModule`  
**Controllers:** `ReportsController`

#### Endpoints (M4, M24, M34)

| Method | Path | Min Role | Purpose | Format |
|--------|------|----------|---------|--------|
| GET | `/reports/sales` | L4 | Sales report (date range) | JSON, CSV, PDF |
| GET | `/reports/budgets-variance` | L4 | Budget vs actual variance | JSON, CSV |
| GET | `/reports/waste-shrinkage` | L4 | Wastage & shrinkage report | JSON, CSV |
| GET | `/reports/staff-insights` | L4 | Staff KPIs report | JSON, CSV |
| GET | `/reports/nps` | L4 | Customer feedback NPS report | JSON, CSV |
| GET | `/reports/inventory` | L4 | Stock levels & movements | JSON, CSV |

#### Report Subscriptions (M4)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/reports/subscriptions` | L4 | List report subscriptions |
| POST | `/reports/subscriptions` | L4 | Create subscription (email/Slack delivery) |
| DELETE | `/reports/subscriptions/:id` | L4 | Delete subscription |

---

### 23. Analytics & Dashboards (`analytics/`, `dashboards/`)

#### Analytics - Franchise Rankings (E22)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/franchise/rankings` | L4 | Get branch rankings (by period) |
| GET | `/franchise/budgets` | L4 | Get franchise budgets (by branch, period) |
| GET | `/franchise/forecasts` | L4 | Get demand forecasts |
| POST | `/franchise/budgets` | L5 | Set franchise budgets |

#### KPIs (`dashboards/dashboards.controller.ts`)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/dash/kpis` | L2 | Get dashboard KPIs (sales, orders, avg ticket, etc.) |

---

### 24. Dev Portal (`dev-portal.disabled/`) - E23

**Status:** TEMPORARILY DISABLED (see `dev-portal.disabled/` folder)

**Note:** Dev Portal endpoints are currently disabled in production. Controllers exist but module is not imported in `app.module.ts`.

#### Planned Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/dev/keys` | L4+ | Create API key |
| DELETE | `/dev/keys/:id` | L4+ | Revoke API key |
| GET | `/dev/logs` | L4+ | Get API usage logs |
| POST | `/dev/webhooks` | L4+ | Create webhook subscription |
| GET | `/dev/webhooks/:id/deliveries` | L4+ | Get webhook delivery logs |

**Guards:**
- `DevAdminGuard` - Checks `dev_admins` table
- `SuperDevGuard` - Checks `isSuper` flag
- `PlanRateLimiterGuard` - Plan-based rate limits (E24)

---

### 25. Billing & Subscriptions (`billing/`) - E24

**Module:** `BillingModule`  
**Controllers:** `BillingController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/billing/subscription` | L5 | Get current subscription |
| POST | `/billing/subscription/upgrade` | L5 | Upgrade plan |
| POST | `/billing/subscription/cancel` | L5 | Cancel subscription (blocked for demo orgs) |
| GET | `/billing/usage` | L5 | Get usage metrics |
| GET | `/billing/plans` | L5 | List available plans |

**Plan Codes:**
- `FREE` - 60 req/min
- `STARTER` - 300 req/min
- `PRO` - 1000 req/min
- `ENTERPRISE` - Unlimited

---

### 26. Promotions (`promotions/`)

**Module:** `PromotionsModule`  
**Controllers:** `PromotionsController`

#### Endpoints (M22)

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/promotions` | L3 | List promotions |
| POST | `/promotions` | L4 | Create promotion (requires approval) |
| PUT | `/promotions/:id/approve` | L5 | Approve promotion |
| PUT | `/promotions/:id/activate` | L4 | Activate promotion |
| DELETE | `/promotions/:id` | L5 | Delete promotion |

**Promotion Types:**
- `PERCENT_OFF` - % discount
- `FIXED_OFF` - Fixed amount off
- `HAPPY_HOUR` - Time-based pricing
- `BUNDLE` - Buy X get Y

---

### 27. Settings (`settings/`)

**Module:** `SettingsModule`  
**Controllers:** `SettingsController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/settings` | L4 | Get org settings |
| PUT | `/settings` | L5 | Update org settings (VAT%, currency, tax matrix, etc.) |

---

### 28. Server-Sent Events (SSE) - M26

**Module:** `StreamModule`  
**Controllers:** `StreamController`

#### Endpoints

| Method | Path | Min Role | Purpose | Content-Type |
|--------|------|----------|---------|--------------|
| GET | `/stream/kds` | L2 | Real-time KDS ticket updates | `text/event-stream` |
| GET | `/stream/kpis` | L2 | Real-time KPI dashboard | `text/event-stream` |

**Event Format:**
```
event: kds:ticket:new
data: {"ticketId":"...","orderId":"...","station":"GRILL","status":"QUEUED","items":[...]}

event: kds:ticket:ready
data: {"ticketId":"...","orderId":"...","status":"READY"}
```

**Security:**
- JWT validation via query param: `?token=<JWT>`
- Org/branch scoping

---

### 29. Webhooks (`webhooks.controller.ts`)

**Controller:** `WebhooksController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/webhooks/momo` | Public | MTN MoMo payment callback |
| POST | `/webhooks/airtel` | Public | Airtel Money payment callback |

**Security:**
- HMAC-SHA256 signature verification
- Timestamp check (±5 min)
- Signature in `X-ChefCloud-Signature` header

---

### 30. Observability (`observability/`)

**Module:** `ObservabilityModule`  
**Controllers:** `ReadinessController`, `MetricsController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/health` | Public | Health check (DB, Redis status) |
| GET | `/metrics` | Public | Prometheus metrics |
| GET | `/ready` | Public | Readiness probe (K8s) |

---

### 31. EFRIS Fiscal Integration (`efris/`)

**Module:** `EfrisModule`  
**Controllers:** `EfrisController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| POST | `/fiscal/invoices/:orderId/submit` | L4 | Submit invoice to URA EFRIS |
| GET | `/fiscal/invoices/:orderId` | L4 | Get fiscal invoice status |

---

### 32. Device Management (`device/`)

**Module:** `DeviceModule`  
**Controllers:** `DeviceController`

#### Endpoints

| Method | Path | Min Role | Purpose |
|--------|------|----------|---------|
| GET | `/devices` | L4 | List devices |
| POST | `/devices` | L5 | Register device |
| PUT | `/devices/:id/deactivate` | L5 | Deactivate device |

---

## Cross-Cutting Concerns

### Guards & Middleware

#### 1. JWT Authentication Guard
**File:** `services/api/src/auth/jwt-auth.guard.ts`

**Usage:** `@UseGuards(JwtAuthGuard)`

**Behavior:**
- Validates JWT from `Authorization: Bearer <token>` header
- Extracts user, org, branch from JWT claims
- Checks session version (`sv` claim) against DB (E25)
- Checks token deny list (Redis)

#### 2. Roles Guard
**File:** `services/api/src/auth/roles.guard.ts`

**Usage:** `@Roles('L4', 'L5')`

**Behavior:**
- Checks user's `roleLevel` against required level
- L5 > L4 > L3 > L2 > L1

#### 3. Platform Access Guard
**File:** `services/api/src/auth/platform-access.guard.ts`

**Usage:** Automatic (global guard)

**Behavior:**
- Checks `org_settings.platformAccess` matrix
- Blocks desktop users from web-only endpoints
- Blocks L1 users from web entirely

#### 4. Idempotency Interceptor (M21)
**File:** `services/api/src/common/idempotency/idempotency.interceptor.ts`

**Usage:** `@UseInterceptors(IdempotencyInterceptor)`

**Behavior:**
- Checks `Idempotency-Key` header
- Computes SHA256 hash of request body
- Returns cached response if duplicate request
- Stores response in Redis + PostgreSQL (24h TTL)

#### 5. Rate Limiter Guard (E24)
**File:** `services/api/src/common/custom-throttler.guard.ts`

**Usage:** Automatic (global guard)

**Behavior:**
- Enforces plan-based rate limits (Free: 60/min, Pro: 300/min)
- Uses Redis sliding window
- Returns `429 Too Many Requests` if exceeded

#### 6. Demo Write Protection (M33)
**File:** `services/api/src/ops/write-block.middleware.ts`

**Usage:** Automatic (global middleware)

**Behavior:**
- Checks `DEMO_PROTECT_WRITES=1` env flag
- Blocks writes to demo orgs (by slug match)
- Blocks: billing changes, API key creation

#### 7. Webhook Verification Guard (E24)
**File:** `services/api/src/common/webhook-verification.guard.ts`

**Usage:** `@UseGuards(WebhookVerificationGuard)`

**Behavior:**
- Validates HMAC-SHA256 signature
- Checks timestamp (±5 min tolerance)
- Signature in `X-ChefCloud-Signature` header

### Middleware

#### 1. Logger Middleware
**File:** `services/api/src/logger.middleware.ts`

**Behavior:**
- Logs all HTTP requests (method, path, status, duration)
- Structured JSON logs in production

#### 2. Write Block Middleware (M33)
**File:** `services/api/src/ops/write-block.middleware.ts`

**Behavior:**
- Global maintenance window enforcement
- Demo write protection

---

## API Conventions

### Request Headers
```
Authorization: Bearer <JWT>
Content-Type: application/json
Idempotency-Key: <ULID>  (for POST/PUT idempotent endpoints)
```

### Response Format

#### Success (200, 201)
```json
{
  "data": { ... }
}
```

#### Error (400, 401, 403, 404, 500)
```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "Bad Request",
  "timestamp": "2025-12-25T10:30:00.000Z",
  "path": "/api/endpoint"
}
```

### Pagination
```
GET /endpoint?page=1&limit=50
Response:
{
  "data": [...],
  "meta": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "totalPages": 25
  }
}
```

### Filtering
```
GET /orders?status=CLOSED&startDate=2025-01-01&endDate=2025-01-31
```

### Sorting
```
GET /orders?sortBy=createdAt&order=desc
```

---

**Next Steps:**
- See `FRONTEND_ROUTE_MAP.md` for frontend route-to-API mapping
- See `SCHEMA_DOMAIN_MAP.md` for database model documentation
- See `TESTING_AND_VERIFICATION_MAP.md` for E2E test coverage
