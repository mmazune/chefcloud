# Role-Based Functional Journeys

> Created: 2026-01-10 | Phase H1 — Functional Readiness

---

## Overview

This document defines "golden path" journeys per role using demo seed data. Each journey is a realistic workflow that a user in that role would perform.

**Preconditions:**
- API running: `cd services/api && node dist/src/main.js`
- Web running: `cd apps/web && pnpm dev`
- Demo data seeded: `cd services/api && npx tsx prisma/seed.ts`

---

## Demo Credentials

### Tapas Bar & Restaurant
| Role | Email | Password | Badge/PIN |
|------|-------|----------|-----------|
| OWNER | owner@tapas.demo.local | Demo#123 | - |
| MANAGER | manager@tapas.demo.local | Demo#123 | PIN: 1234 |
| ACCOUNTANT | accountant@tapas.demo.local | Demo#123 | - |
| PROCUREMENT | procurement@tapas.demo.local | Demo#123 | - |
| STOCK_MANAGER | stock@tapas.demo.local | Demo#123 | - |
| SUPERVISOR | supervisor@tapas.demo.local | Demo#123 | - |
| CASHIER | cashier@tapas.demo.local | Demo#123 | ORG1-CASHIER001 |
| WAITER | waiter@tapas.demo.local | Demo#123 | ORG1-WAIT001 |
| CHEF | chef@tapas.demo.local | Demo#123 | ORG1-CHEF001 |
| BARTENDER | bartender@tapas.demo.local | Demo#123 | - |
| EVENT_MANAGER | eventmgr@tapas.demo.local | Demo#123 | - |

### Cafesserie (Multi-Branch)
| Role | Email | Password | PIN |
|------|-------|----------|-----|
| OWNER | owner@cafesserie.demo.local | Demo#123 | - |
| MANAGER | manager@cafesserie.demo.local | Demo#123 | 5678 |
| ACCOUNTANT | accountant@cafesserie.demo.local | Demo#123 | - |
| PROCUREMENT | procurement@cafesserie.demo.local | Demo#123 | - |
| SUPERVISOR | supervisor@cafesserie.demo.local | Demo#123 | - |
| CASHIER | cashier@cafesserie.demo.local | Demo#123 | ORG2-CASHIER001 |
| WAITER | waiter@cafesserie.demo.local | Demo#123 | ORG2-WAIT001 |
| CHEF | chef@cafesserie.demo.local | Demo#123 | ORG2-CHEF001 |

---

## OWNER Journeys

Login: `owner@demo.com` / `demo1234`

### J-OWN-01: View Business Dashboard

| Field | Value |
|-------|-------|
| **Routes** | `/dashboard/owner` |
| **Click Path** | Login → Auto-redirect to dashboard |
| **Expected** | Dashboard with revenue, orders, staff metrics |
| **API Endpoints** | `GET /analytics/dashboard`, `GET /analytics/revenue` |
| **Data Effects** | None (read-only) |

### J-OWN-02: Review Daily Sales Report

| Field | Value |
|-------|-------|
| **Routes** | `/reports` → `/reports/sales` |
| **Click Path** | Sidebar → Reports → Sales Report → Select date range |
| **Expected** | Sales breakdown by category, payment method |
| **API Endpoints** | `GET /reports/sales`, `GET /reports/sales/summary` |
| **Data Effects** | None |

### J-OWN-03: Create and Approve Payroll Run

| Field | Value |
|-------|-------|
| **Routes** | `/payroll/runs` |
| **Click Path** | Payroll → New Run → Select period → Calculate → Review → Approve |
| **Expected** | Payroll run created, payslips generated |
| **API Endpoints** | `POST /workforce/payroll-runs`, `PUT /payroll-runs/:id/calculate`, `PUT /payroll-runs/:id/approve` |
| **Data Effects** | `PayrollRun`, `PayrollItem`, `Payslip` |

### J-OWN-04: View Inventory Health

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/items`, `/inventory/health-report` |
| **Click Path** | Inventory → Items → Filter low stock → View health report |
| **Expected** | Items below reorder point flagged |
| **API Endpoints** | `GET /inventory/items`, `GET /inventory/health-report` |
| **Data Effects** | None |

### J-OWN-05: View GL Accounts and Journal

| Field | Value |
|-------|-------|
| **Routes** | `/accounting/chart`, `/accounting/journal` |
| **Click Path** | Accounting → Chart of Accounts → View → Journal entries |
| **Expected** | Standard restaurant COA, journal entries visible |
| **API Endpoints** | `GET /accounting/accounts`, `GET /accounting/journal-entries` |
| **Data Effects** | None |

### J-OWN-06: Manage Settings

| Field | Value |
|-------|-------|
| **Routes** | `/settings` |
| **Click Path** | Settings → Organization → Edit name → Save |
| **Expected** | Settings page loads, updates save |
| **API Endpoints** | `GET /settings/org`, `PUT /settings/org` |
| **Data Effects** | `Organization` |

---

## MANAGER Journeys

Login: `manager@demo.com` / `demo1234`

### J-MGR-01: View Operations Dashboard

| Field | Value |
|-------|-------|
| **Routes** | `/dashboard/manager` |
| **Click Path** | Login → Dashboard |
| **Expected** | Today's orders, staff on shift, pending tasks |
| **API Endpoints** | `GET /analytics/dashboard` |
| **Data Effects** | None |

### J-MGR-02: View and Manage Staff Schedule

| Field | Value |
|-------|-------|
| **Routes** | `/workforce/scheduling` |
| **Click Path** | Workforce → Scheduling → View week → Assign shift |
| **Expected** | Weekly schedule grid, shift assignment modal |
| **API Endpoints** | `GET /workforce/shifts`, `POST /workforce/shifts` |
| **Data Effects** | `Shift` |

### J-MGR-03: Approve Leave Request

| Field | Value |
|-------|-------|
| **Routes** | `/workforce/leave` |
| **Click Path** | Workforce → Leave → Pending requests → Approve |
| **Expected** | Leave request status updated |
| **API Endpoints** | `GET /workforce/leave-requests`, `PUT /workforce/leave-requests/:id/approve` |
| **Data Effects** | `LeaveRequest` |

### J-MGR-04: Review Order History

| Field | Value |
|-------|-------|
| **Routes** | `/orders/history` |
| **Click Path** | Orders → History → Filter by date → View details |
| **Expected** | Historical orders with totals |
| **API Endpoints** | `GET /pos/orders` |
| **Data Effects** | None |

### J-MGR-05: View Inventory Alerts

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/items` |
| **Click Path** | Inventory → Items → Low stock filter |
| **Expected** | Items below threshold highlighted |
| **API Endpoints** | `GET /inventory/items?lowStock=true` |
| **Data Effects** | None |

---

## ACCOUNTANT Journeys

Login: `accountant@demo.com` / `demo1234`

### J-ACC-01: View Chart of Accounts

| Field | Value |
|-------|-------|
| **Routes** | `/accounting/chart` |
| **Click Path** | Accounting → Chart of Accounts |
| **Expected** | Tree/list of accounts with balances |
| **API Endpoints** | `GET /accounting/accounts` |
| **Data Effects** | None |

### J-ACC-02: Create Journal Entry

| Field | Value |
|-------|-------|
| **Routes** | `/accounting/journal` |
| **Click Path** | Accounting → Journal → New Entry → Add lines → Save |
| **Expected** | Balanced journal entry created |
| **API Endpoints** | `POST /accounting/journal-entries` |
| **Data Effects** | `JournalEntry`, `JournalLine` |

### J-ACC-03: View Vendor Bills

| Field | Value |
|-------|-------|
| **Routes** | `/payables/bills` |
| **Click Path** | Payables → Bills → View list |
| **Expected** | Bills from suppliers with status |
| **API Endpoints** | `GET /accounting/bills` |
| **Data Effects** | None |

### J-ACC-04: Post Bill Payment

| Field | Value |
|-------|-------|
| **Routes** | `/payables/bills/:id` |
| **Click Path** | Bills → Select bill → Pay → Enter amount → Confirm |
| **Expected** | Payment recorded, bill status updated |
| **API Endpoints** | `POST /accounting/bills/:id/pay` |
| **Data Effects** | `Bill`, `Payment`, `JournalEntry` |

### J-ACC-05: Run Financial Report

| Field | Value |
|-------|-------|
| **Routes** | `/reports` |
| **Click Path** | Reports → P&L / Balance Sheet → Select period |
| **Expected** | Financial statement renders |
| **API Endpoints** | `GET /reports/pnl`, `GET /reports/balance-sheet` |
| **Data Effects** | None |

---

## CASHIER Journeys

Login: `cashier@demo.com` / `demo1234`

### J-CSH-01: Open Cash Session

| Field | Value |
|-------|-------|
| **Routes** | `/pos/cash-sessions` |
| **Click Path** | Cash Sessions → Open Session → Enter float → Confirm |
| **Expected** | Session opened with starting float |
| **API Endpoints** | `POST /pos/cash-sessions` |
| **Data Effects** | `CashSession` |

### J-CSH-02: Create POS Order (Cash)

| Field | Value |
|-------|-------|
| **Routes** | `/orders` |
| **Click Path** | Orders → New → Add items → Checkout → Cash → Complete |
| **Expected** | Order created, cash payment recorded |
| **API Endpoints** | `POST /pos/orders`, `POST /pos/payments` |
| **Data Effects** | `Order`, `OrderItem`, `Payment`, `CashSession` |

### J-CSH-03: Create POS Order (Card)

| Field | Value |
|-------|-------|
| **Routes** | `/orders` |
| **Click Path** | Orders → New → Add items → Checkout → Card → Complete |
| **Expected** | Order created, card payment recorded |
| **API Endpoints** | `POST /pos/orders`, `POST /pos/payments` |
| **Data Effects** | `Order`, `OrderItem`, `Payment` |

### J-CSH-04: View Menu Items

| Field | Value |
|-------|-------|
| **Routes** | `/orders` (POS grid) |
| **Click Path** | Orders page loads → View menu categories → Browse items |
| **Expected** | Menu items grouped by category with prices |
| **API Endpoints** | `GET /pos/menu` |
| **Data Effects** | None |

### J-CSH-05: Close Cash Session

| Field | Value |
|-------|-------|
| **Routes** | `/pos/cash-sessions` |
| **Click Path** | Cash Sessions → Close → Count cash → Submit |
| **Expected** | Session closed, variance calculated |
| **API Endpoints** | `PUT /pos/cash-sessions/:id/close` |
| **Data Effects** | `CashSession` |

---

## WAITER Journeys

Login: `waiter@demo.com` / `demo1234`

### J-WTR-01: View Table Map

| Field | Value |
|-------|-------|
| **Routes** | `/tables` |
| **Click Path** | Tables → View floor plan |
| **Expected** | Table grid/map with status colors |
| **API Endpoints** | `GET /tables` |
| **Data Effects** | None |

### J-WTR-02: Create Order for Table

| Field | Value |
|-------|-------|
| **Routes** | `/orders` |
| **Click Path** | Tables → Select table → New Order → Add items → Send to kitchen |
| **Expected** | Order linked to table, sent to KDS |
| **API Endpoints** | `POST /pos/orders` |
| **Data Effects** | `Order`, `OrderItem` |

### J-WTR-03: Add Items to Existing Order

| Field | Value |
|-------|-------|
| **Routes** | `/orders/:id` |
| **Click Path** | Tables → Table with order → Add items → Save |
| **Expected** | Additional items added to order |
| **API Endpoints** | `PUT /pos/orders/:id/items` |
| **Data Effects** | `OrderItem` |

### J-WTR-04: View Order Status

| Field | Value |
|-------|-------|
| **Routes** | `/orders` |
| **Click Path** | Orders → View active orders → Check item status |
| **Expected** | Status per item (PENDING, PREPARING, READY) |
| **API Endpoints** | `GET /pos/orders` |
| **Data Effects** | None |

### J-WTR-05: Close Order (Request Payment)

| Field | Value |
|-------|-------|
| **Routes** | `/orders/:id` |
| **Click Path** | Table → View order → Request bill |
| **Expected** | Order marked for payment |
| **API Endpoints** | `PUT /pos/orders/:id/request-payment` |
| **Data Effects** | `Order` |

---

## CHEF Journeys

Login: `chef@demo.com` / `demo1234`

### J-CHF-01: View KDS Tickets

| Field | Value |
|-------|-------|
| **Routes** | `/kds` |
| **Click Path** | Login → Auto-redirect to KDS |
| **Expected** | Pending kitchen tickets displayed |
| **API Endpoints** | `GET /kds/tickets` |
| **Data Effects** | None |

### J-CHF-02: Mark Item as Preparing

| Field | Value |
|-------|-------|
| **Routes** | `/kds` |
| **Click Path** | KDS → Click item → Mark "Preparing" |
| **Expected** | Item status updated |
| **API Endpoints** | `PUT /kds/tickets/:id/start` |
| **Data Effects** | `KdsTicket` |

### J-CHF-03: Mark Order Ready

| Field | Value |
|-------|-------|
| **Routes** | `/kds` |
| **Click Path** | KDS → Complete all items → Mark "Ready" |
| **Expected** | Ticket moves to completed, notification sent |
| **API Endpoints** | `PUT /kds/tickets/:id/ready` |
| **Data Effects** | `KdsTicket`, `Order` |

### J-CHF-04: View Recipe Details

| Field | Value |
|-------|-------|
| **Routes** | `/kds` (recipe popup) |
| **Click Path** | KDS → Click item → View recipe |
| **Expected** | Ingredients and instructions displayed |
| **API Endpoints** | `GET /inventory/recipes/:id` |
| **Data Effects** | None |

### J-CHF-05: Recall Ticket

| Field | Value |
|-------|-------|
| **Routes** | `/kds` |
| **Click Path** | KDS → Completed tab → Recall ticket |
| **Expected** | Ticket moves back to active |
| **API Endpoints** | `PUT /kds/tickets/:id/recall` |
| **Data Effects** | `KdsTicket` |

---

## PROCUREMENT Journeys

Login: `procurement@demo.com` / `demo1234`

### J-PRO-01: View Suppliers

| Field | Value |
|-------|-------|
| **Routes** | `/procurement/suppliers` |
| **Click Path** | Procurement → Suppliers |
| **Expected** | List of suppliers with contact info |
| **API Endpoints** | `GET /inventory/vendors` |
| **Data Effects** | None |

### J-PRO-02: Create Purchase Order

| Field | Value |
|-------|-------|
| **Routes** | `/procurement/purchase-orders/new` |
| **Click Path** | Procurement → POs → New → Select supplier → Add items → Submit |
| **Expected** | PO created with SUBMITTED status |
| **API Endpoints** | `POST /inventory/purchase-orders`, `PUT /purchase-orders/:id/submit` |
| **Data Effects** | `PurchaseOrder`, `PurchaseOrderLine` |

### J-PRO-03: View PO Status

| Field | Value |
|-------|-------|
| **Routes** | `/procurement/purchase-orders` |
| **Click Path** | Procurement → POs → Filter by status |
| **Expected** | PO list with status badges |
| **API Endpoints** | `GET /inventory/purchase-orders` |
| **Data Effects** | None |

### J-PRO-04: Receive Goods

| Field | Value |
|-------|-------|
| **Routes** | `/procurement/goods-receipts` |
| **Click Path** | Procurement → Goods Receipts → Select PO → Enter quantities → Post |
| **Expected** | Receipt created, stock updated |
| **API Endpoints** | `POST /inventory/receipts`, `PUT /receipts/:id/post` |
| **Data Effects** | `Receipt`, `InventoryLedger`, `JournalEntry` |

### J-PRO-05: View Price History

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/items/:id/prices` |
| **Click Path** | Inventory → Item → Price history tab |
| **Expected** | Historical prices from receipts |
| **API Endpoints** | `GET /inventory/supplier-items/:id/prices` |
| **Data Effects** | None |

---

## STOCK_MANAGER Journeys

Login: `stock@demo.com` / `demo1234`

### J-STK-01: View Inventory Levels

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/items` |
| **Click Path** | Inventory → Items → View quantities |
| **Expected** | Current stock per item/location |
| **API Endpoints** | `GET /inventory/items` |
| **Data Effects** | None |

### J-STK-02: Create Stock Adjustment

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/adjustments` |
| **Click Path** | Inventory → Adjustments → New → Select item → Enter qty → Submit |
| **Expected** | Adjustment pending approval (or auto-applied) |
| **API Endpoints** | `POST /inventory/adjustments` |
| **Data Effects** | `InventoryAdjustment`, `InventoryLedger` |

### J-STK-03: Perform Stocktake

| Field | Value |
|-------|-------|
| **Routes** | `/stocktake` |
| **Click Path** | Stocktake → New session → Count items → Submit counts → Finalize |
| **Expected** | Variances calculated, adjustments created |
| **API Endpoints** | `POST /inventory/count-sessions`, `PUT /count-sessions/:id/finalize` |
| **Data Effects** | `CountSession`, `CountLine`, `InventoryAdjustment` |

### J-STK-04: View Lot/Expiry

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/lots` |
| **Click Path** | Inventory → Lots → Filter expiring soon |
| **Expected** | Lots with expiry dates highlighted |
| **API Endpoints** | `GET /inventory/lots` |
| **Data Effects** | None |

### J-STK-05: Record Waste

| Field | Value |
|-------|-------|
| **Routes** | `/inventory/waste` |
| **Click Path** | Inventory → Waste → New → Select items → Enter reason → Submit |
| **Expected** | Waste document created, stock reduced |
| **API Endpoints** | `POST /inventory/waste`, `PUT /waste/:id/post` |
| **Data Effects** | `InventoryWaste`, `InventoryLedger`, `JournalEntry` |

---

## Verification Status

| Role | Journeys | Status |
|------|----------|--------|
| OWNER | 6 | ⏳ To verify |
| MANAGER | 5 | ⏳ To verify |
| ACCOUNTANT | 5 | ⏳ To verify |
| CASHIER | 5 | ⏳ To verify |
| WAITER | 5 | ⏳ To verify |
| CHEF | 5 | ⏳ To verify |
| PROCUREMENT | 5 | ⏳ To verify |
| STOCK_MANAGER | 5 | ⏳ To verify |

---

## Related Documents

- [FUNCTIONAL_BACKLOG.md](./FUNCTIONAL_BACKLOG.md) — Issues found during journey execution
- [NOT_DORMANT_VERIFICATION.md](./NOT_DORMANT_VERIFICATION.md) — Module-level verification
- [ROLE_ACCESS_MODEL.md](../overview/ROLE_ACCESS_MODEL.md) — Role capabilities
- [SAMPLE_DATA_AND_SEEDS.md](../overview/SAMPLE_DATA_AND_SEEDS.md) — Demo data

---

*Created as part of Phase H1 — Functional Readiness*
