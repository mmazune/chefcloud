# nexopos Architecture Map

**Repository:** https://github.com/Blair2004/NexoPOS  
**License:** GPL-3.0 (⚠️ COPYLEFT - Reference only, DO NOT copy code)  
**Version Analyzed:** Commit `ecfcf0a` (master branch)  
**Last Updated:** 2025-12-25

---

## ⚠️ CRITICAL LICENSE WARNING

**GPL-3.0 Copyleft License**

This repository is licensed under GPL-3.0, which requires that **any derivative works MUST also be licensed under GPL-3.0**.

**DO NOT:**
- ❌ Copy code from nexopos into Nimbus POS
- ❌ Adapt algorithms or business logic directly
- ❌ Use as a "code template" for implementation

**DO:**
- ✅ Study the architecture and design patterns
- ✅ Learn from the approach to specific problems
- ✅ Document concepts in your own words
- ✅ Implement solutions independently after study

**Clean-room protocol:**
1. Study this document (nexopos architecture)
2. Close all nexopos files
3. Design Nimbus feature from scratch
4. Implement without referencing nexopos code
5. Review differences after implementation

---

## 📋 Executive Summary

**What it is:** A modern Laravel/Vue.js POS system with enterprise features, built for retail and restaurant businesses. Focuses on inventory management, procurement, and multi-unit operations.

**Why study it (architecture only):**
- Modern Laravel patterns (Services, Events, Observers)
- Complex inventory management (FIFO via product history)
- Multi-unit/multi-register architecture
- Advanced procurement workflows
- Role-permission based RBAC (granular)
- Installment payments & layaway
- Module system for extensibility

**Best for learning:**
- Service layer architecture (OrdersService, ProductService, etc.)
- Event-driven design (OrderAfterCreated, etc.)
- Multi-register cash management
- Procurement approval workflows
- FIFO inventory via history table
- Permission-based RBAC (string-based permissions)

**Not ideal for:**
- Multi-tenancy (single-tenant, multi-unit only)
- Code reference (GPL license prevents copying)

---

## 🏗️ Technology Stack

### Backend
- **Framework:** Laravel 12.0 (PHP 8.2+)
- **ORM:** Eloquent
- **Database:** MySQL/MariaDB, PostgreSQL, SQLite
- **Auth:** Laravel Sanctum (session + API tokens)
- **Architecture:** Service-oriented (Controllers → Services → Models)

### Frontend
- **Framework:** Vue.js 3 (TypeScript)
- **UI:** TailwindCSS (Dark mode support)
- **Build:** Vite
- **State:** Vuex/Pinia
- **Components:** Custom component library (`ns-*` components)

### Key Libraries
- **PDF:** dompdf / PhpSpreadsheet (Excel exports)
- **Image:** gumlet/php-image-resize
- **Math:** brick/math (precision decimal calculations)
- **Real-time:** Laravel Reverb (WebSockets)
- **Queue:** Laravel Queue (async jobs)
- **Cache:** Laravel Cache (Redis/Memcached support)

---

## 📁 Directory Structure

```
nexopos/
├── app/
│   ├── Http/
│   │   ├── Controllers/       # HTTP handlers
│   │   │   ├── Dashboard/
│   │   │   │   ├── POS/       # POS-specific controllers
│   │   │   │   ├── Orders/    # Order management
│   │   │   │   └── Products/  # Product CRUD
│   │   ├── Middleware/        # Auth, permissions
│   │   └── Requests/          # Form validation
│   ├── Services/              # Business logic layer ⭐
│   │   ├── OrdersService.php  # 114KB - Order creation, payments, refunds
│   │   ├── ProductService.php # 74KB - Product CRUD, stock operations
│   │   ├── CashRegistersService.php  # Cash drawer management
│   │   ├── ProcurementService.php    # Purchase orders
│   │   ├── CustomerService.php       # Customer operations
│   │   ├── ReportService.php         # Reporting engine
│   │   └── TaxService.php            # Tax calculations
│   ├── Models/                # Eloquent models
│   │   ├── Order.php
│   │   ├── OrderProduct.php
│   │   ├── Product.php
│   │   ├── ProductHistory.php # Key for FIFO inventory
│   │   ├── Register.php       # Cash register sessions
│   │   └── Procurement.php    # Purchase orders
│   ├── Events/                # Domain events
│   │   ├── OrderAfterCreatedEvent.php
│   │   ├── OrderAfterRefundedEvent.php
│   │   └── ProductHistoryAfterCreatedEvent.php
│   ├── Observers/             # Model observers
│   ├── Forms/                 # Dynamic form definitions
│   ├── Settings/              # Settings pages
│   ├── Enums/                 # Enums (order types, payment status)
│   └── Facades/               # Laravel facades
├── resources/
│   ├── ts/                    # TypeScript/Vue frontend
│   │   ├── pages/
│   │   │   └── dashboard/
│   │   │       └── pos/       # POS SPA
│   │   ├── components/        # Vue components
│   │   └── libraries/         # JS utilities
│   └── views/                 # Blade templates (layout only)
├── database/
│   ├── migrations/            # 100+ migrations
│   └── seeders/               # Demo data
├── routes/
│   ├── api.php                # REST API routes
│   └── web.php                # Web routes
└── modules/                   # Extension system
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Authentication & Sessions

**nexopos:**
- **Method:** Laravel Sanctum (cookie session + API tokens)
- **Model:** `App\Models\User`
- **Middleware:** `auth:sanctum`
- **Frontend:** CSRF token + session cookies

**Flow:**
1. Login via `/auth/login` → `AuthController::postSignIn()`
2. Sanctum validates credentials, creates session
3. Frontend stores CSRF token
4. API requests include `X-CSRF-TOKEN` header

**Comparison to Nimbus:**
- **Nimbus:** Stateless JWT (HS256)
- **nexopos:** Stateful Sanctum sessions (hybrid mode)
- **Lesson:** Sanctum = SPA + session auth (no CORS issues)

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 2. Users & RBAC

**nexopos:**
- **Models:** `Role`, `Permission`, `User`
- **Tables:** `users`, `roles`, `permissions`, `nexopos_permissions_roles` (pivot)
- **Architecture:** Role-permission (many-to-many)

**Permission strings (examples):**
```
nexopos.create.products
nexopos.read.products
nexopos.update.products
nexopos.delete.products
nexopos.pos
nexopos.reports.sales
nexopos.settings
```

**Checking permissions:**
```php
Auth::user()->allowedTo('nexopos.create.orders')
```

**Comparison to Nimbus:**
- **Nimbus:** Hierarchical levels (L1-L5)
- **nexopos:** Granular permissions (string-based)
- **Lesson:** Permission strings = flexible but verbose; levels = simpler but less granular

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 3. Multi-Tenancy & Organizations

**nexopos:**
- **Architecture:** Single-tenant, multi-unit
- **Model:** `Unit` (store locations, not tenants)
- **Scope:** Products/stock can be unit-specific

**Comparison to Nimbus:**
- **Nimbus:** Multi-tenant (`orgId` on every table)
- **nexopos:** Single-tenant, multi-location
- **Lesson:** Multi-unit ≠ multi-tenant (no data isolation)

**Copy eligibility:** ⚠️ GPL-3.0 - Not applicable (single-tenant)

---

### 4. Product Catalog & Menu

**nexopos:**
- **Models:** `Product`, `ProductCategory`, `ProductUnitQuantity`, `ProductGallery`
- **Features:**
  - Product variations via unit quantities (UOM system)
  - Categories (hierarchical tree)
  - Galleries (multiple images)
  - Barcode/SKU
  - Tax groups
  - Expiration tracking

**Units (UOM - Unit of Measure):**
- Base unit (e.g., "piece")
- Sub-units (e.g., "box" = 12 pieces)
- Different pricing per unit
- Stock tracked per unit

**Comparison to Nimbus:**
- **Nimbus:** Items + Modifiers (runtime add-ons)
- **nexopos:** Products + Units (predefined variations)
- **Lesson:** UOM system = good for wholesale/retail; modifiers = better for restaurants

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 5. Modifiers & Variations

**nexopos:**
- **No runtime modifiers** - Uses unit variations instead
- **Product Sub-Items:** Can attach products as components (assembly/kits)

**Comparison to Nimbus:**
- **Nimbus:** Modifier groups (e.g., pizza toppings)
- **nexopos:** Product variations (different UOMs)
- **Lesson:** For restaurant POS, modifiers > UOM variations

**Copy eligibility:** ⚠️ GPL-3.0 - Not applicable (no modifiers)

---

### 6. Orders & Cart & Checkout

**nexopos:**
- **Controller:** `Dashboard\POS\OrdersController`
- **Service:** `App\Services\OrdersService` (114KB file - complex)
- **Models:** `Order`, `OrderProduct`, `OrderPayment`, `OrderCoupon`

**Flow (Checkout):**

1. **Create order:**
   - `OrdersService::create($fields)` - Main entry point
   - Validates customer, products, payments
   - Creates `Order` record with status (hold, paid, unpaid)

2. **Order types:**
   - `takeaway` - Pickup
   - `delivery` - Delivery
   - `dine-in` - Restaurant table

3. **Product stock check:**
   - `OrdersService::checkProductStock($product)` - Fires event
   - Validates available quantity per unit

4. **Apply coupons:**
   - `OrdersService::applyCoupon($order, $code)`
   - Discount calculation, usage tracking

5. **Add payments:**
   - Multi-payment support via `OrderPayment` records
   - Partial payments enabled

6. **Complete order:**
   - Fires `OrderAfterCreatedEvent`
   - Creates `ProductHistory` entries (inventory deduction)
   - Updates customer rewards

**Key methods:**
- `OrdersService::create()` - Main creation logic
- `OrdersService::refundOrder()` - Full refund
- `OrdersService::refundOrderProduct()` - Partial refund
- `OrdersService::deleteOrder()` - Void order

**Comparison to Nimbus:**
- **Nimbus:** Order state machine (OPEN → CLOSED)
- **nexopos:** Order statuses (hold, paid, unpaid, partially_paid)
- **Lesson:** Status enum vs state machine - both valid patterns

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 7. Payments & Refunds & Split Bills

**nexopos:**
- **Model:** `OrderPayment`
- **Types:** Cash, Card, Account (customer credit)
- **Features:**
  - Multi-payment per order
  - Partial payments (installments)
  - Layaway (pay over time)
  - Refund to original payment method

**Installment payments:**
- `OrderInstalment` model
- Track scheduled payments
- Due date tracking
- Notifications for overdue

**Comparison to Nimbus:**
- **Nimbus:** Multi-payment, split bills (order splitting)
- **nexopos:** Multi-payment, installments (payment splitting)
- **Lesson:** Installments = good for layaway/financing; split bills = table service

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 8. Shifts & Cash Drawer & Z-Reports

**nexopos:**
- **Controller:** `CashRegistersController`
- **Service:** `CashRegistersService` (22KB)
- **Model:** `Register`, `RegisterHistory`

**Flow (Cash Register):**

1. **Open register:**
   - `CashRegistersService::openRegister($register_id, $amount)`
   - Creates `RegisterHistory` entry (type: opening)
   - Status: `opened`

2. **Cash operations:**
   - Cash in: `registerCashIn($register_id, $amount, $description)`
   - Cash out: `registerCashOut()`
   - All operations logged in `RegisterHistory`

3. **Track sales:**
   - All orders linked to register via `register_id` FK
   - Real-time cash flow tracking

4. **Close register:**
   - `CashRegistersService::closeRegister($register_id, $actual_amount)`
   - Calculates expected vs actual
   - Creates closing `RegisterHistory` entry
   - Status: `closed`

5. **Z-Report:**
   - `ReportService::getRegisterClosure($register_id)`
   - Breakdown: sales, refunds, cash in/out, discrepancy

**Comparison to Nimbus:**
- **Nimbus:** Shift model (shift_id FK on transactions)
- **nexopos:** Register model (register_id FK on orders)
- **Lesson:** Both patterns valid; register = device-centric, shift = cashier-centric

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 9. Inventory Management

**nexopos:**
- **Model:** `ProductHistory` ⭐ (Key table for FIFO)
- **Table:** `product_history` (operation_type, quantity, unit_price, created_at)

**Architecture:**
- **Event-driven:** Every stock operation creates `ProductHistory` entry
- **Operation types:** 
  - `sale` - Stock OUT (order completed)
  - `procurement` - Stock IN (purchase order received)
  - `adjustment` - Manual stock fix
  - `return` - Stock IN (customer return)

**FIFO Implementation:**
- When selling: Query `ProductHistory` WHERE `quantity > 0` ORDER BY `created_at ASC`
- Deplete oldest batches first
- Update `quantity` remaining in each history record

**Services:**
- `ProductService::stockAdjustment()` - Manual stock changes
- `ProductService::getProductHistory()` - View stock movements

**Comparison to Nimbus:**
- **Nimbus:** `StockBatch` model (explicit batches with expiry)
- **nexopos:** `ProductHistory` (implicit batches via timestamps)
- **Lesson:** Both FIFO approaches valid; batches = more explicit, history = simpler schema

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 10. FIFO Costing & Consumption

**nexopos:**
- **FIFO via ProductHistory ordering:**
  - `SELECT * FROM product_history WHERE product_id = X AND quantity > 0 ORDER BY created_at ASC`
  - Consume oldest entries first
  - COGS = sum of (qty_used * unit_price) from history

**No recipe system** - Direct product sales only

**Comparison to Nimbus:**
- **Nimbus:** Recipe-based (1 beer → 330ml from batch), `consumption-calculator.ts`
- **nexopos:** Direct FIFO product sales
- **Lesson:** Recipe system = essential for restaurants (prepared items)

**Copy eligibility:** ⚠️ GPL-3.0 - Reference FIFO approach only, do NOT copy code

---

### 11. Purchasing & POs & GRN

**nexopos:**
- **Controller:** `ProcurementController`
- **Service:** `ProcurementService` (40KB)
- **Models:** `Procurement`, `ProcurementProduct`

**Workflow:**

1. **Create PO:**
   - `ProcurementService::create($data)` - Creates `Procurement` record
   - Status: `pending`

2. **Add products:**
   - `ProcurementProduct` entries (product_id, quantity, purchase_price)

3. **Submit for approval (optional):**
   - Status: `pending` → `submitted`

4. **Approve:**
   - Status: `submitted` → `approved`

5. **Receive goods:**
   - `ProcurementService::procure($procurement_id)`
   - Creates `ProductHistory` entries (type: procurement, quantity IN)
   - Status: `approved` → `delivered`
   - Stock levels updated

6. **Invoice tracking:**
   - Invoice number, due date, payment tracking

**Comparison to Nimbus:**
- **Nimbus:** PO workflow (DRAFT → SUBMITTED → APPROVED → RECEIVED)
- **nexopos:** Similar workflow with optional approval
- **Lesson:** Approval workflows = better control, slower process

**Copy eligibility:** ⚠️ GPL-3.0 - Reference workflow only, do NOT copy

---

### 12. Accounting & Double-Entry

**nexopos:**
- **Basic accounting features:**
  - Expense tracking (`Expense` model)
  - Account categories (`AccountType`)
  - Cash flow history
  - No full double-entry GL

**Features:**
- Track expenses by category
- Link expenses to suppliers
- Payment method tracking
- Basic profit/loss calculation

**Comparison to Nimbus:**
- **Nimbus:** Full double-entry GL (Account, JournalEntry, JournalLine)
- **nexopos:** Basic expense tracking
- **Lesson:** Enterprise POS needs GL; small business can skip it

**Copy eligibility:** ⚠️ GPL-3.0 - Reference approach only, do NOT copy

---

### 13. Reporting & Analytics & Exports

**nexopos:**
- **Service:** `ReportService` (54KB)
- **Reports:**
  - Sales summary (daily, monthly, yearly)
  - Product performance
  - Low stock alerts
  - Cash flow report
  - Profit report (revenue - COGS)
  - Customer purchases
  - Employee performance

**Export formats:**
- Excel (PhpSpreadsheet)
- PDF (dompdf)
- CSV

**Dashboard widgets:**
- Real-time sales chart (Chart.js)
- Today's revenue
- Stock alerts
- Pending orders

**Comparison to Nimbus:**
- **Nimbus:** SSE real-time dashboards, Chart.js
- **nexopos:** Similar approach (Vue + Chart.js)
- **Lesson:** SPA + chart libraries = modern reporting UX

**Copy eligibility:** ⚠️ GPL-3.0 - Reference architecture only, do NOT copy

---

### 14. Receipt & Kitchen Printing

**nexopos:**
- **Receipt templates:** Blade views
- **Printing methods:**
  - Browser print (HTML)
  - PDF generation
  - ESC/POS thermal (client-side driver required)

**Features:**
- Custom receipt templates
- Logo/header
- QR code for order lookup
- Kitchen print for preparation

**Comparison to Nimbus:**
- **Nimbus:** Tauri native printing, ESC/POS via desktop app
- **nexopos:** Browser-based printing
- **Lesson:** Native app = better hardware control

**Copy eligibility:** ⚠️ GPL-3.0 - Reference approach only, do NOT copy

---

### 15. Offline Mode & Sync Queues

**nexopos:**
- **No built-in offline mode**
- Laravel Reverb (WebSockets) for real-time updates
- Queue system for async operations

**Comparison to Nimbus:**
- **Nimbus:** Service worker + IndexedDB queue
- **nexopos:** Online-only, real-time via WebSockets
- **Lesson:** Offline = critical for unreliable internet environments

**Copy eligibility:** ⚠️ GPL-3.0 - Not applicable (no offline)

---

### 16. Admin & Settings & Config

**nexopos:**
- **Service:** `Options` (key-value store)
- **Model:** `Option` table (`key`, `value`)

**Settings categories:**
- Company info
- Currency, locale
- Invoice numbering
- Tax rates
- Receipt templates
- Register settings

**Comparison to Nimbus:**
- **Nimbus:** Org-scoped settings (DB records)
- **nexopos:** Global key-value store
- **Lesson:** Key-value = flexible but harder to validate

**Copy eligibility:** ⚠️ GPL-3.0 - Reference approach only, do NOT copy

---

## 🔄 Operational Flows (High-Level)

### Flow 1: Complete a Sale

1. Open POS → Load products grid
2. Add products to cart (unit selection)
3. Select customer (optional, rewards)
4. Apply coupon (optional)
5. Add payment(s) → `OrdersService::create()`
6. Fires `OrderAfterCreatedEvent`
7. Creates `ProductHistory` entries (FIFO deduction)
8. Print receipt

**Key service:** `OrdersService::create()`

---

### Flow 2: Process a Refund

1. Find order → `OrdersController::getOrders()`
2. Select products to refund
3. Process refund → `OrdersService::refundOrderProduct()`
4. Reverses `ProductHistory` (stock IN)
5. Creates `OrderProductRefund` record
6. Refunds payment → `OrderPayment` adjustment

**Key service:** `OrdersService::refundOrderProduct()`

---

### Flow 3: Close Register

1. Open register closure screen
2. Enter actual cash count
3. System calculates expected (opening + sales - refunds + cash in - cash out)
4. `CashRegistersService::closeRegister()`
5. Saves discrepancy
6. View Z-Report

**Key service:** `CashRegistersService::closeRegister()`

---

### Flow 4: Receive Purchase Order

1. Create procurement → `ProcurementService::create()`
2. Add products, quantities, costs
3. Submit for approval (optional)
4. Approve (optional)
5. Receive goods → `ProcurementService::procure()`
6. Creates `ProductHistory` entries (stock IN)
7. Updates product costs

**Key service:** `ProcurementService::procure()`

---

## 🔌 Extension Points

**1. Module System:**
- Create custom modules in `modules/` directory
- Hook into events (OrderAfterCreated, etc.)
- Extend services, add routes, views

**2. Events:**
- 50+ domain events
- Listeners can modify order data, inventory, etc.

**3. Custom Fields:**
- Dynamic forms system
- Add fields to products, customers, orders

**4. Payment Gateways:**
- Implement `PaymentType` interface
- Register in settings

---

## 📊 File-Path Quick Index

| Domain | Go to... |
|--------|----------|
| **Order creation** | `app/Services/OrdersService.php` |
| **POS UI** | `resources/ts/pages/dashboard/pos/` |
| **Cash register** | `app/Services/CashRegistersService.php` |
| **Product catalog** | `app/Services/ProductService.php` |
| **Inventory FIFO** | `app/Models/ProductHistory.php` |
| **Purchase orders** | `app/Services/ProcurementService.php` |
| **Reporting** | `app/Services/ReportService.php` |
| **RBAC** | `app/Models/Role.php`, `app/Models/Permission.php` |
| **Settings** | `app/Services/Options.php` |
| **Database schema** | `database/migrations/` (100+ files) |

---

## 🔄 Concept Mapping to Nimbus POS

| nexopos Concept | Nimbus Equivalent | Notes |
|-----------------|-------------------|-------|
| `OrdersService` | `PosService` | Order creation logic |
| `Order` model | `Order` model | Transaction record |
| `OrderProduct` | `OrderLine` | Line items |
| `ProductHistory` | `StockBatch` / `StockMovement` | FIFO tracking (different approach) |
| `Register` model | `Shift` model | Cash drawer management |
| `Procurement` | `PurchaseOrder` | PO workflow |
| Role-permission | Role levels (L1-L5) | RBAC approach |
| `Unit` (UOM) | No direct equivalent | Wholesale variation system |
| Laravel Sanctum | JWT | Auth method |
| Vue SPA | React SPA | Frontend framework |

---

## ⚖️ Copy Eligibility Statement

**License:** GPL-3.0 (GNU General Public License v3.0)  
**Copyright:** © 2020-2025 Blair2004

**⚠️ COPYLEFT WARNING:**

Any code derived from nexopos MUST be licensed under GPL-3.0. Since Nimbus POS is NOT GPL-licensed, **you CANNOT copy any code from nexopos**.

**What you CAN do:**
- ✅ Study the architecture patterns
- ✅ Learn from the service layer design
- ✅ Understand the FIFO approach (concept)
- ✅ Document learnings independently

**What you CANNOT do:**
- ❌ Copy any code (functions, classes, algorithms)
- ❌ Adapt code directly
- ❌ Use as a template for implementation

**Required clean-room workflow:**
1. Study this architecture map
2. **Close all nexopos files**
3. Design Nimbus feature independently
4. Implement from scratch
5. Never look at nexopos code during implementation

---

## 🎓 Key Lessons for Nimbus (Concepts Only)

**✅ Adopt (Architecture Concepts):**
- Service layer pattern (clear separation)
- Event-driven architecture (OrderAfterCreated, etc.)
- Register-based cash management
- Permission strings for granular RBAC

**❌ Avoid (Architecture Lessons):**
- Single-tenant only (Nimbus needs multi-tenant)
- No offline mode (critical for POS)
- Complex 114KB service files (split into smaller services)

**🤔 Consider:**
- UOM system for wholesale/retail (if expanding beyond restaurants)
- Installment payments (for high-value items)
- Module system for extensibility

---

**Last Updated:** 2025-12-25  
**Analyzed by:** Nimbus POS Engineering Team  
**Status:** ⚠️ GPL-3.0 - Reference architecture only, DO NOT copy code
