# Reference POS Side-by-Side Comparison Index

**Purpose:** Quick domain mapping between Nimbus POS and reference repos for architecture study.

**⚠️ LICENSE WARNINGS:**
- ✅ **MIT** (opensourcepos, medusa-pos-starter): Safe to reference and adapt
- ⚠️ **GPL-3.0** (nexopos, pos-awesome): Study only, DO NOT copy code
- ❌ **Unknown** (medusa-pos-react, store-pos): View structure only

---

## How to Use This Index

1. Find your domain (e.g., "Inventory FIFO")
2. Review Nimbus implementation first
3. Check reference repos for alternative approaches
4. **Respect licenses** before opening files
5. Study architecture, not code copying
6. Document learnings in completion reports

**Cross-reference:** See [REFERENCE_REPO_FILE_MAPS.md](./REFERENCE_REPO_FILE_MAPS.md) for detailed structure.

---

## Quick Domain Index

| # | Domain | Page |
|---|--------|------|
| 1 | [Authentication & Sessions](#1-authentication--sessions) | Auth methods, JWT, WebAuthn |
| 2 | [Users & RBAC](#2-users--rbac) | Role hierarchy, permissions |
| 3 | [Multi-Tenancy](#3-multi-tenancy--organizations) | Org isolation, branches |
| 4 | [Product Catalog](#4-product-catalog--menu) | Items, categories, pricing |
| 5 | [Modifiers](#5-modifiers--variations) | Toppings, options, variants |
| 6 | [Orders & Cart](#6-orders--cart--checkout) | POS workflow, order states |
| 7 | [Payments](#7-payments--refunds--split-bills) | Multi-payment, refunds |
| 8 | [Shifts & Cash](#8-shifts--cash-drawer--z-reports) | Drawer management, reconciliation |
| 9 | [Inventory](#9-inventory-management) | Stock tracking, batches |
| 10 | [FIFO Costing](#10-fifo-costing--consumption) | Recipe consumption, COGS |
| 11 | [Purchasing](#11-purchasing--pos--grn) | Suppliers, purchase orders |
| 12 | [Accounting](#12-accounting--double-entry) | GL, journals, COA |
| 13 | [Reporting](#13-reporting--analytics--exports) | Reports, BI, exports |
| 14 | [Printing](#14-receipt--kitchen-printing) | ESC/POS, thermal, KDS |
| 15 | [Offline/Sync](#15-offline-mode--sync-queues) | Service worker, queue |
| 16 | [Settings](#16-admin--settings--config) | Org config, preferences |

---

## 1. Authentication & Sessions

### 🏢 Nimbus POS

**Backend:**
- **Controller:** [services/api/src/auth/auth.controller.ts](../services/api/src/auth/auth.controller.ts)
- **Service:** [services/api/src/auth/auth.service.ts](../services/api/src/auth/auth.service.ts)
- **Models:** `User`, `Session`, `Badge`, `Passkey`, `RefreshToken`

**Methods:**
- Email/password (Argon2id hashing)
- MSR badge (magnetic stripe, PAN obfuscation)
- WebAuthn (FIDO2 passkeys)
- JWT (HS256, claims: `sub`, `orgId`, `roleLevel`, `sv`, `badgeId`)

**Key Features:**
- Session versioning (`sv` field) for instant badge revocation
- Multi-device support (web, desktop, mobile)
- Stateless JWT + Redis validation

**Frontend:**
- **Page:** [apps/web/src/pages/login.tsx](../apps/web/src/pages/login.tsx)
- **Auth Context:** `apps/web/src/contexts/AuthContext.tsx`

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Controllers/Login.php](../reference-pos/opensourcepos/app/Controllers/Login.php)
- [app/Models/Employee.php](../reference-pos/opensourcepos/app/Models/Employee.php)

**Method:** Email/password only, PHP sessions

**Differences:**
- Nimbus: Stateless JWT, multi-method auth
- opensourcepos: Traditional PHP sessions
- **License:** MIT - Safe to study session patterns

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Http/Controllers/AuthController.php](../reference-pos/nexopos/app/Http/Controllers/AuthController.php)
- Laravel Sanctum (session + API tokens)

**Method:** Email/password, Sanctum cookies + CSRF

**Differences:**
- Nimbus: Pure JWT
- nexopos: Sanctum hybrid (session + token)
- **License:** GPL - Reference only, don't copy

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** Frappe framework auth (cookie-based)

**Differences:**
- Nimbus: Custom JWT
- pos-awesome: Framework-managed
- **License:** GPL - Reference only

---

### ✅ medusa-pos-starter (MIT)

**Files:**
- [app/login.tsx](../reference-pos/medusa-pos-starter/app/login.tsx)
- `api/auth.ts`

**Method:** Medusa JWT tokens, AsyncStorage persistence

**Differences:**
- Nimbus: Custom auth
- medusa-pos-starter: Backend-provided tokens
- **License:** MIT - Safe to reference

---

## 2. Users & RBAC

### 🏢 Nimbus POS

**Models:** `User` (roleLevel: L1-L5)
- **L1:** Owner (full access)
- **L2:** Manager (admin features)
- **L3:** Supervisor (reports, staff mgmt)
- **L4:** Staff (POS, KDS only)
- **L5:** Temp (limited POS)

**Guards:**
- [services/api/src/auth/guards/roles.guard.ts](../services/api/src/auth/guards/roles.guard.ts)
- Decorator: `@Roles(RoleLevel.OWNER, RoleLevel.MANAGER)`
- Platform access: `@PlatformAccess('desktop', 'web')`

**Frontend:**
- RBAC sidebar filtering
- Route protection by role level

**Architecture:** Hierarchical (L1 inherits all lower permissions)

---

### ✅ opensourcepos (MIT)

**Method:** Binary (admin vs employee)
- Grants table for permissions

**Differences:**
- Nimbus: 5-level hierarchy
- opensourcepos: 2 levels
- **License:** MIT - Safe to reference

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Models/Role.php](../reference-pos/nexopos/app/Models/Role.php)
- [app/Models/Permission.php](../reference-pos/nexopos/app/Models/Permission.php)

**Method:** Laravel role-permission (many-to-many)
- Granular permissions (e.g., `nexopos.create.products`)

**Differences:**
- Nimbus: Role levels
- nexopos: Permission strings
- **License:** GPL - Reference only

---

## 3. Multi-Tenancy & Organizations

### 🏢 Nimbus POS

**Models:**
- `Org` (tenant)
- `Branch` (franchise location)

**Scoping:**
- All queries filtered by `orgId`
- Guards: `@OrgGuard()`, `@BranchGuard()`
- Every table has `orgId` foreign key

**Architecture:**
- Shared database, logical isolation
- Franchise support: 1 org, many branches
- Demo: Tapas (1 branch), Cafesserie (4 branches)

---

### ✅ opensourcepos (MIT)

**Method:** Multi-location (same org, different stores)

**Differences:**
- Nimbus: Multi-tenant (org isolation)
- opensourcepos: Multi-location (shared org)

---

### ⚠️ nexopos (GPL-3.0)

**Method:** Multi-unit (store-based scoping)
- Data filtered by `unit_id`

**Differences:**
- Nimbus: Org + branch hierarchy
- nexopos: Flat unit structure

---

## 4. Product Catalog & Menu

### 🏢 Nimbus POS

**Models:** `Item`, `Category`, `ItemVariant`

**Backend:**
- [services/api/src/items/items.controller.ts](../services/api/src/items/items.controller.ts)
- Categories: hierarchical tree
- Variants: size, color, etc.

**Frontend:**
- [apps/web/src/pages/inventory.tsx](../apps/web/src/pages/inventory.tsx)
- [apps/web/src/pages/pos.tsx](../apps/web/src/pages/pos.tsx) (POS menu grid)

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Controllers/Items.php](../reference-pos/opensourcepos/app/Controllers/Items.php)
- [app/Models/Item.php](../reference-pos/opensourcepos/app/Models/Item.php)
- [app/Models/Item_kit.php](../reference-pos/opensourcepos/app/Models/Item_kit.php) (bundles)

**Method:** Items + item kits, tier pricing

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/ProductService.php](../reference-pos/nexopos/app/Services/ProductService.php)
- [app/Models/Product.php](../reference-pos/nexopos/app/Models/Product.php)

**Method:** Product + unit variations (UOM system)

---

### ✅ medusa-pos-starter (MIT)

**Files:**
- [app/(tabs)/products.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/products.tsx)

**Method:** Medusa backend products, variants

---

## 5. Modifiers & Variations

### 🏢 Nimbus POS

**Models:**
- `Modifier` (e.g., "Extra Cheese")
- `ModifierGroup` (e.g., "Toppings")
- `ItemModifierGroup` (many-to-many)

**Pricing:** `Modifier.price` (can be +/- or 0)

**Frontend:** Modifier selection UI in POS

**Architecture:**
- Groups can be required/optional
- Multiple modifiers per item
- Prices added to line total

---

### ✅ opensourcepos (MIT)

**Method:** Basic attributes (no structured modifiers)

**Differences:**
- Nimbus: Full modifier groups
- opensourcepos: Custom fields only

---

### ⚠️ nexopos (GPL-3.0)

**Method:** Unit variations (size/pack), no add-on modifiers

**Differences:**
- Nimbus: Runtime modifiers (toppings)
- nexopos: Pre-defined units

---

## 6. Orders & Cart & Checkout

### 🏢 Nimbus POS

**Models:**
- `Order` (status: OPEN → CLOSED)
- `OrderLine` (itemId, qty, price, subtotal)
- `OrderLineModifier` (selected modifiers)

**Backend:**
- [services/api/src/pos/pos.controller.ts](../services/api/src/pos/pos.controller.ts)
- Endpoints: `POST /pos/orders`, `POST /pos/orders/:id/close`, `POST /pos/orders/:id/void`

**Frontend:**
- [apps/web/src/pages/pos.tsx](../apps/web/src/pages/pos.tsx)
- Zustand store: `apps/web/src/stores/posStore.ts`

**Flow:**
1. Create order (OPEN)
2. Add items/modifiers
3. Close order → payment → CLOSED
4. FIFO consumption triggered

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Controllers/Sales.php](../reference-pos/opensourcepos/app/Controllers/Sales.php)
- [app/Models/Sale.php](../reference-pos/opensourcepos/app/Models/Sale.php)

**Method:** Sale created on payment (no OPEN state)

**Differences:**
- Nimbus: Order state machine
- opensourcepos: Sale = completed transaction

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/OrdersService.php](../reference-pos/nexopos/app/Services/OrdersService.php)
- Frontend: `resources/ts/pages/dashboard/pos/`

**Method:** Order types (dine-in, takeout, delivery), complex workflows

---

### ✅ medusa-pos-starter (MIT)

**Files:**
- [app/(tabs)/cart.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/cart.tsx)
- `contexts/CartContext.tsx`

**Method:** Client-side cart + Medusa draft orders

---

## 7. Payments & Refunds & Split Bills

### 🏢 Nimbus POS

**Models:**
- `Payment` (orderId, method, amount, status)
- Methods: CASH, CARD, MOBILE_MONEY, ACCOUNT

**Features:**
- Multi-payment support (1 order, N payments)
- Refunds: `status = REFUNDED`
- Split bills: `POST /pos/orders/:id/split`

**Tab Management:**
- `Tab` model (tableNumber, status, items)
- Split creates new orders from existing lines

---

### ✅ opensourcepos (MIT)

**Method:** Multi-payment, table `sales_payments`

**Differences:**
- Nimbus: Enum payment methods
- opensourcepos: String types

---

### ⚠️ nexopos (GPL-3.0)

**Method:** Cash, card, account balance, partial payments

---

## 8. Shifts & Cash Drawer & Z-Reports

### 🏢 Nimbus POS

**Models:**
- `Shift` (cashierId, openedAt, closedAt, expectedCash, actualCash)
- `ShiftTransaction` (type: OPEN, SALE, REFUND, CLOSE)

**Backend:**
- [services/api/src/shifts/shifts.controller.ts](../services/api/src/shifts/shifts.controller.ts)
- Endpoints: `POST /shifts/open`, `POST /shifts/close`, `GET /shifts/:id/report`

**Features:**
- One active shift per cashier
- All transactions linked to shift
- Discrepancy tracking (expected vs actual)

---

### ✅ opensourcepos (MIT)

**Method:** No shift management (date-based reports only)

**Differences:**
- Nimbus: Full shift lifecycle
- opensourcepos: Manual Z-reports

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/CashRegistersService.php](../reference-pos/nexopos/app/Services/CashRegistersService.php)
- [app/Models/Register.php](../reference-pos/nexopos/app/Models/Register.php)

**Method:** Register-based opening/closing, cash flow tracking

**Differences:**
- Nimbus: Shift model
- nexopos: Register model
- **License:** GPL - Study architecture only

---

### ⚠️ pos-awesome (GPL-3.0)

**Files:**
- [doctype/pos_closing_shift/](../reference-pos/pos-awesome/posawesome/posawesome/doctype/pos_closing_shift/)

**Method:** Frappe workflow for shift closing

---

## 9. Inventory Management

### 🏢 Nimbus POS

**Models:**
- `StockBatch` (receivedAt, expiryDate, costPerUnit, qtyRemaining)
- `StockMovement` (type: IN, OUT, SALE, WASTAGE, ADJUSTMENT)

**Backend:**
- [services/api/src/inventory/inventory.service.ts](../services/api/src/inventory/inventory.service.ts)
- [services/api/src/inventory/inventory.controller.ts](../services/api/src/inventory/inventory.controller.ts)

**Architecture:**
- Batch-based tracking (not just item qty)
- Each batch: cost, received date, expiry
- Movements audit trail

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Models/Inventory.php](../reference-pos/opensourcepos/app/Models/Inventory.php)

**Method:** Transaction ledger (datetime-based), average cost

**Differences:**
- Nimbus: Batch-based FIFO
- opensourcepos: Ledger, average cost

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/ProductHistoryService.php](../reference-pos/nexopos/app/Services/ProductHistoryService.php)

**Method:** Product history table (IN/OUT), FIFO via ordering

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** ERPNext Stock Entry, batch tracking

---

## 10. FIFO Costing & Consumption

### 🏢 Nimbus POS

**Service:** [services/api/src/inventory/consumption-calculator.ts](../services/api/src/inventory/consumption-calculator.ts)

**Flow:**
1. Order closed
2. Fetch recipe ingredients
3. Select oldest batches (`receivedAt ASC`)
4. Deplete in FIFO order
5. Create `StockMovement` with COGS

**Features:**
- Recipe-based (1 beer → 330ml from oldest keg)
- COGS: `qtyUsed * batch.costPerUnit`
- Partial batch depletion
- Negative stock detection

---

### ✅ opensourcepos (MIT)

**Method:** Weighted average cost (no FIFO)

**Differences:**
- Nimbus: True FIFO with batches
- opensourcepos: Average cost

---

### ⚠️ nexopos (GPL-3.0)

**Method:** FIFO via `product_history` ordered by `created_at ASC`

**Differences:**
- Nimbus: Batch-centric
- nexopos: History entry FIFO
- **License:** GPL - Study logic only, don't copy

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** ERPNext stock valuation (FIFO configurable)

---

## 11. Purchasing & POs & GRN

### 🏢 Nimbus POS

**Models:**
- `Supplier` (name, email, phone, terms)
- `PurchaseOrder` (supplierId, status, total)
- `PurchaseOrderLine` (itemId, qty, unitCost)

**Backend:**
- [services/api/src/purchasing/purchasing.controller.ts](../services/api/src/purchasing/purchasing.controller.ts)

**Workflow:** DRAFT → SUBMITTED → APPROVED → RECEIVED

**GRN (Goods Received Note):**
- Endpoint: `POST /purchasing/orders/:id/receive`
- Creates `StockBatch` records
- Creates `StockMovement` (type: IN)

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Controllers/Suppliers.php](../reference-pos/opensourcepos/app/Controllers/Suppliers.php)
- [app/Controllers/Receivings.php](../reference-pos/opensourcepos/app/Controllers/Receivings.php)

**Method:** Direct receivings (no PO workflow)

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/ProcurementService.php](../reference-pos/nexopos/app/Services/ProcurementService.php)
- [app/Models/Procurement.php](../reference-pos/nexopos/app/Models/Procurement.php)

**Method:** Procurement approval triggers stock IN

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** ERPNext Purchase Order + Purchase Receipt

---

## 12. Accounting & Double-Entry

### 🏢 Nimbus POS

**Models:**
- `Account` (code, name, type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COGS)
- `JournalEntry` (date, description, status)
- `JournalLine` (accountId, debit, credit)

**Backend:**
- [services/api/src/accounting/accounting.service.ts](../services/api/src/accounting/accounting.service.ts)

**Rules:**
- Sum(debits) = Sum(credits) per entry
- Period locking (prevent backdated edits)

**Frontend:**
- [apps/web/src/pages/finance.tsx](../apps/web/src/pages/finance.tsx)
- Journal entry form, COA editor, trial balance

---

### ✅ opensourcepos (MIT)

**Method:** No accounting (basic expense tracking only)

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/ExpenseService.php](../reference-pos/nexopos/app/Services/ExpenseService.php)

**Method:** Expense categories, basic GL (not full double-entry)

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** ERPNext full GL, journals, double-entry

---

## 13. Reporting & Analytics & Exports

### 🏢 Nimbus POS

**Backend:**
- [services/api/src/analytics/analytics.controller.ts](../services/api/src/analytics/analytics.controller.ts)

**Reports:**
- Sales summary (date, branch, item)
- Inventory valuation
- COGS analysis
- NPS scores

**Exports:** JSON, CSV, PDF

**Frontend:**
- [apps/web/src/pages/reports.tsx](../apps/web/src/pages/reports.tsx)
- Chart.js visualizations
- SSE real-time dashboards

---

### ✅ opensourcepos (MIT)

**Files:**
- [app/Controllers/Reports.php](../reference-pos/opensourcepos/app/Controllers/Reports.php)
- `app/Models/Reports/`

**Method:** Server-rendered reports, CSV/PDF exports

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/ReportService.php](../reference-pos/nexopos/app/Services/ReportService.php)

**Method:** SPA reports, Chart.js, Excel/PDF exports

---

## 14. Receipt & Kitchen Printing

### 🏢 Nimbus POS

**Backend:**
- [packages/printer/src/index.ts](../packages/printer/src/index.ts)
- ESC/POS command builder

**Desktop:**
- [apps/desktop/src/lib/printer-client.ts](../apps/desktop/src/lib/printer-client.ts)
- Tauri native printing

**Features:**
- Thermal printer (ESC/POS)
- Bluetooth (mobile)
- Network (TCP/IP)
- Templates: Receipt, kitchen ticket

---

### ✅ opensourcepos (MIT)

**Method:** HTML receipt template, browser print

---

### ⚠️ nexopos (GPL-3.0)

**Method:** Blade templates, thermal printer via settings

---

## 15. Offline Mode & Sync Queues

### 🏢 Nimbus POS

**Backend:**
- Sync endpoint: `POST /pos/sync`
- Accepts queued operations array
- Idempotency keys prevent duplicates

**Frontend:**
- Service worker: [apps/web/public/sw.js](../apps/web/public/sw.js)
- IndexedDB queue
- Auto-sync on reconnect

**Desktop:**
- SQLite queue: [apps/desktop/src/lib/offline-db.ts](../apps/desktop/src/lib/offline-db.ts)
- Background sync worker

**Architecture:**
- Operations queued with `clientOpId`
- Retry with exponential backoff
- Conflict: server wins

---

### ⚠️ pos-awesome (GPL-3.0)

**Method:** IndexedDB + Frappe sync API

**Differences:**
- Nimbus: Service worker + SQLite
- pos-awesome: IndexedDB only
- **License:** GPL - Study offline patterns only

---

## 16. Admin & Settings & Config

### 🏢 Nimbus POS

**Backend:**
- Settings in DB: `Org`, `Branch`, `KdsStationConfig`
- Endpoints: `PATCH /orgs/:id`, `PATCH /branches/:id`

**Frontend:**
- [apps/web/src/pages/settings.tsx](../apps/web/src/pages/settings.tsx)

**Architecture:**
- Org-scoped settings
- Branch overrides
- Defaults seeded on creation

---

### ✅ opensourcepos (MIT)

**Method:** Key-value table `app_config`

---

### ⚠️ nexopos (GPL-3.0)

**Files:**
- [app/Services/Options.php](../reference-pos/nexopos/app/Services/Options.php)

**Method:** `nexopos_options` table (key-value with categories)

---

## Summary Matrix

| Feature | Nimbus | opensourcepos (MIT) | nexopos (GPL) | medusa-pos-starter (MIT) |
|---------|--------|---------------------|---------------|-------------------------|
| **Auth** | JWT + WebAuthn + MSR | Session | Sanctum | Medusa JWT |
| **RBAC** | L1-L5 | Admin/employee | Role-permission | Backend |
| **Multi-tenant** | Org + Branch | Multi-location | Multi-unit | N/A |
| **Modifiers** | Full groups | Basic attrs | Units only | N/A |
| **Shifts** | Full lifecycle | N/A | Register-based | N/A |
| **FIFO** | Batch-based | Average cost | History FIFO | N/A |
| **Accounting** | Double-entry | N/A | Basic GL | N/A |
| **KDS** | SSE real-time | N/A | Print only | N/A |
| **Offline** | SW + SQLite | N/A | N/A | N/A |

---

## Quick Navigation

**Study:**
- **Auth?** → Section 1
- **Multi-tenancy?** → Section 3
- **FIFO logic?** → Section 10
- **Offline sync?** → Section 15
- **Shifts/cash drawer?** → Section 8

**License check:**
- ✅ MIT: opensourcepos, medusa-pos-starter
- ⚠️ GPL: nexopos, pos-awesome (reference only)
- ❌ Unknown: medusa-pos-react, store-pos (view only)

---

**Last Updated:** 2025-12-25  
**See also:** [REFERENCE_REPO_FILE_MAPS.md](./REFERENCE_REPO_FILE_MAPS.md)
