# opensourcepos Architecture Map

**Repository:** https://github.com/opensourcepos/opensourcepos  
**License:** MIT (✅ Safe for reference and inspiration)  
**Version Analyzed:** Commit `849439c` (master branch)  
**Last Updated:** 2025-12-25

---

## 📋 Executive Summary

**What it is:** A PHP-based web POS system built on CodeIgniter 4, designed for retail/hospitality with a focus on simplicity and ease of deployment.

**Why study it:**
- **MIT license** - Safe to reference and learn from
- Mature codebase (10+ years, production-tested)
- Classic MVC architecture (easy to understand)
- Traditional retail POS features (items, sales, inventory, cash up)
- Simple deployment (LAMP stack, no complex infrastructure)

**Best for learning:**
- Basic POS workflow (add items, checkout, print receipt)
- Cash drawer/shift management ("cashup" feature)
- Multi-payment handling
- Simple inventory tracking
- Receipt printing & barcode generation
- Role-based access control (admin vs employee with grants)

**Not ideal for:**
- Advanced accounting (no double-entry GL)
- Multi-tenancy (single-tenant only, multi-location within one org)
- Modern frontend patterns (server-rendered Blade-like views, Bootstrap 3)
- FIFO costing (uses weighted average cost)
- Mobile apps (web-only)
- Real-time features (KDS, SSE dashboards)

---

## 🏗️ Technology Stack

### Backend
- **Framework:** CodeIgniter 4.6.3 (PHP 8.1+)
- **ORM:** CodeIgniter's Query Builder (not Eloquent)
- **Database:** MySQL/MariaDB
- **Auth:** PHP sessions (not JWT)
- **Architecture:** MVC (Controllers → Models → Views)

### Frontend
- **UI Framework:** Bootstrap 3 (Bootswatch themes)
- **JavaScript:** jQuery, DataTables
- **Rendering:** Server-side (CodeIgniter views, not SPA)
- **AJAX:** Used for cart operations, search, live updates

### Key Libraries
- **Barcodes:** `picqer/php-barcode-generator` (EAN, Code128, etc.)
- **PDF Receipts:** `dompdf/dompdf`
- **Email:** CodeIgniter Email class
- **SMS:** Twilio integration via `Sms_lib`
- **Validation:** CodeIgniter validation rules
- **Security:** `ezyang/htmlpurifier` (XSS protection), reCAPTCHA

### Infrastructure
- **Deployment:** LAMP/LEMP stack, Docker container available
- **Migrations:** CodeIgniter migrations (42+ files)
- **i18n:** Multi-language support (Weblate translations)

---

## 📁 Directory Structure

```
opensourcepos/
├── app/
│   ├── Controllers/        # HTTP request handlers
│   │   ├── Sales.php       # Main POS checkout flow
│   │   ├── Items.php       # Item catalog CRUD
│   │   ├── Customers.php   # Customer management
│   │   ├── Receivings.php  # Receiving inventory (GRN)
│   │   ├── Cashups.php     # Cash drawer reconciliation
│   │   ├── Reports.php     # Reporting hub
│   │   ├── Employees.php   # User management
│   │   ├── Login.php       # Authentication
│   │   └── Config.php      # Settings UI
│   ├── Models/             # Data access layer
│   │   ├── Sale.php        # Sales transactions
│   │   ├── Item.php        # Product catalog
│   │   ├── Inventory.php   # Stock movements ledger
│   │   ├── Customer.php    # Customer records
│   │   ├── Employee.php    # User/employee records
│   │   ├── Giftcard.php    # Gift card balances
│   │   └── Attribute.php   # Custom item attributes
│   ├── Libraries/          # Business logic services
│   │   ├── Sale_lib.php    # Sale calculations, tax, totals
│   │   ├── Tax_lib.php     # Tax jurisdiction logic
│   │   ├── Receiving_lib.php  # Inventory receiving logic
│   │   ├── Item_lib.php    # Item helpers (kits, search)
│   │   ├── Barcode_lib.php # Barcode generation
│   │   └── Email_lib.php   # Email sending
│   ├── Views/              # HTML templates (server-rendered)
│   │   ├── sales/          # POS UI, receipt templates
│   │   ├── items/          # Item management UI
│   │   ├── receivings/     # Receiving UI
│   │   ├── reports/        # Report views
│   │   └── login.php       # Login page
│   ├── Database/
│   │   ├── Migrations/     # 42+ migration files
│   │   └── Seeds/          # Sample data seeders
│   ├── Language/           # Translations (40+ languages)
│   └── Config/
│       ├── Routes.php      # URL routing
│       └── OSPOS.php       # App configuration
├── public/                 # Web root
│   ├── index.php           # Entry point
│   ├── css/                # Bootstrap themes
│   └── js/                 # jQuery, DataTables
└── vendor/                 # Composer dependencies
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Authentication & Sessions

**opensourcepos:**
- **Controller:** `app/Controllers/Login.php`
- **Model:** `app/Models/Employee.php`
- **Method:** Email/password only
- **Storage:** PHP `$_SESSION` (no JWT)
- **Security:** Argon2 password hashing, optional reCAPTCHA

**Flow:**
1. User submits email/password to `Login::postIndex()`
2. `Employee::is_valid_login()` checks credentials
3. On success: `$session->set('person_id', $employee_id)`
4. Redirect to `Sales::getIndex()` (POS screen)

**Comparison to Nimbus:**
- **Nimbus:** Stateless JWT (HS256), multi-method auth (email, MSR badge, WebAuthn)
- **opensourcepos:** Stateful PHP sessions, single auth method
- **Lesson:** Session-based auth is simpler for single-server deployments but doesn't scale horizontally without sticky sessions

**Copy eligibility:** ✅ MIT - Safe to reference login flow patterns

---

### 2. Users & RBAC

**opensourcepos:**
- **Model:** `app/Models/Employee.php`
- **Grants table:** `grants` (employee_id, permission_id)
- **Permissions:** Module-level (e.g., `sales`, `reports_sales`, `items`, `config`)

**Architecture:**
- Binary roles: Admin (all grants) vs Employee (selective grants)
- `Employee::has_grant($module, $person_id)` checks permissions
- Controllers call `parent::__construct('module_name')` to enforce access

**Example permissions:**
- `sales` - Access POS screen
- `reports_sales` - View sales reports
- `items` - Manage product catalog
- `config` - Edit system settings

**Comparison to Nimbus:**
- **Nimbus:** Hierarchical levels (L1-L5), decorators (`@Roles()`)
- **opensourcepos:** Flat grant table, method-level checks
- **Lesson:** Grant-based is more flexible (fine-grained), level-based is simpler (inherited permissions)

**Copy eligibility:** ✅ MIT - Safe to reference RBAC patterns

---

### 3. Multi-Tenancy & Organizations

**opensourcepos:**
- **Architecture:** Multi-location (single org, multiple stock locations)
- **Model:** `app/Models/Stock_location.php`
- **Scope:** Items can have different stock levels per location
- **No tenant isolation** - All users share the same database

**Comparison to Nimbus:**
- **Nimbus:** Multi-tenant (orgId isolation), org + branch hierarchy
- **opensourcepos:** Single-tenant, multi-location inventory only
- **Lesson:** True multi-tenancy requires `orgId` on every table + query filters

**Copy eligibility:** ✅ MIT - Safe to reference, but not applicable (single-tenant)

---

### 4. Product Catalog & Menu

**opensourcepos:**
- **Models:** `Item.php`, `Item_kit.php`, `Attribute.php`
- **Tables:** `items`, `item_kits`, `item_kit_items`, `attribute_definitions`, `attribute_values`

**Features:**
- Individual items (SKU, barcode, cost, price)
- Item kits (bundles - e.g., "Meal Combo" = burger + fries + drink)
- Custom attributes (size, color, etc. - extensible)
- Tier pricing (customer tier 1 = $10, tier 2 = $9)
- Stock tracking per location
- Barcode generation (EAN-13, Code128)

**Controllers:**
- `Items::getIndex()` - List items (DataTables grid)
- `Items::getView($item_id)` - CRUD modal
- `Items::postSave()` - Create/update item

**Comparison to Nimbus:**
- **Nimbus:** Items + Modifiers + ModifierGroups (runtime add-ons)
- **opensourcepos:** Items + Kits + Attributes (pre-defined bundles)
- **Lesson:** Kits are good for fixed combos, modifiers for customization (e.g., pizza toppings)

**Copy eligibility:** ✅ MIT - Safe to reference catalog structure

---

### 5. Modifiers & Variations

**opensourcepos:**
- **No structured modifiers** - Uses custom attributes instead
- Attributes are item properties (size, color), not runtime add-ons
- Example: "T-Shirt" has attribute "Size" with values "S, M, L"

**Comparison to Nimbus:**
- **Nimbus:** Modifiers are runtime selections (e.g., "Extra Cheese +$2")
- **opensourcepos:** Attributes are item variants (different SKUs)
- **Lesson:** For restaurant POS, modifiers > attributes (customers customize existing items)

**Copy eligibility:** ✅ MIT - Not applicable (no modifiers)

---

### 6. Orders & Cart & Checkout

**opensourcepos:**
- **Controller:** `app/Controllers/Sales.php`
- **Library:** `app/Libraries/Sale_lib.php`
- **Models:** `Sale.php`, `Sales_items.php`, `Sales_items_taxes.php`

**Flow (Checkout):**

1. **Add items to cart:**
   - `Sales::postAdd()` → Adds item to session cart (`$_SESSION['cart']`)
   - Cart stored in memory (not DB) until sale is completed

2. **Apply discounts/taxes:**
   - `Sale_lib::calculate_totals()` → Loops through cart, applies item taxes
   - Tax jurisdictions (VAT, GST) calculated per item
   - Discounts: Percentage or fixed amount per line

3. **Add payments:**
   - `Sales::postAddPayment()` → Adds payment to session
   - Multi-payment support (e.g., $50 cash + $30 card)
   - Payment types: Cash, Check, Credit Card, Debit Card

4. **Complete sale:**
   - `Sale::save_sale()` → Writes sale to DB (`sales` table)
   - Inventory deduction: `Inventory::insert()` creates movement record (type = OUT)
   - Receipt generation: `Sales::getReceipt($sale_id)`

5. **Void/suspend:**
   - Suspend: Saves cart to `sales_suspended` table
   - Void: Marks sale as deleted, reverses inventory

**Key methods:**
- `Sales::postAdd()` - Add item to cart
- `Sales::postAddPayment()` - Add payment
- `Sale::save_sale()` - Persist transaction
- `Sales::getReceipt()` - Print/email receipt

**Comparison to Nimbus:**
- **Nimbus:** Order state machine (OPEN → CLOSED), DB-persisted cart
- **opensourcepos:** Session cart, sale created on payment
- **Lesson:** Session cart is faster but doesn't survive crashes; DB cart enables multi-device sync

**Copy eligibility:** ✅ MIT - Safe to reference checkout flow

---

### 7. Payments & Refunds & Split Bills

**opensourcepos:**
- **Model:** `Sales_payments.php`
- **Table:** `sales_payments` (sale_id, payment_type, payment_amount)

**Features:**
- Multi-payment per sale (cash + card + giftcard)
- Payment types: Cash, Check, Credit Card, Debit Card, Gift Card, Account (customer credit)
- No split bills feature (full sale or nothing)
- Refunds: "Return" creates negative sale, reverses inventory

**Comparison to Nimbus:**
- **Nimbus:** Split bills (create new orders from existing), multi-payment, refund status enum
- **opensourcepos:** Multi-payment only, no split, returns = negative sale
- **Lesson:** Split bills require order line manipulation, not just payment splitting

**Copy eligibility:** ✅ MIT - Safe to reference multi-payment logic

---

### 8. Shifts & Cash Drawer & Z-Reports

**opensourcepos:**
- **Controller:** `app/Controllers/Cashups.php`
- **Model:** `Cashup.php`
- **Table:** `cashups` (open_time, close_time, open_amount, close_amount, note)

**Flow (Cashup):**

1. **Open shift:**
   - Employee enters starting cash (e.g., $100 float)
   - `Cashup::insert()` creates record with `open_time = NOW()`

2. **Track transactions:**
   - All sales during shift linked by timestamp range
   - No explicit shift_id on sales (uses date/time filtering)

3. **Close shift:**
   - Employee counts cash, enters actual amount
   - `Cashups::getClose()` → Displays expected vs actual
   - Difference = Over/short
   - Creates closing record with `close_time = NOW()`

4. **Z-Report:**
   - `Cashups::getReport()` → Shows sales breakdown, payment types, discrepancies

**Comparison to Nimbus:**
- **Nimbus:** Shift model with cashierId FK, explicit shift transactions
- **opensourcepos:** Date-range based shifts, no FK relationship
- **Lesson:** Explicit shift_id enables multi-cashier tracking & audit trail

**Copy eligibility:** ✅ MIT - Safe to reference cash reconciliation logic

---

### 9. Inventory Management

**opensourcepos:**
- **Model:** `app/Models/Inventory.php`
- **Table:** `inventory` (trans_items, trans_user, trans_date, trans_location, trans_type)

**Architecture:**
- **Ledger-based:** Every stock movement is a row (not just qty field)
- **Trans types:** OUT (sale), IN (receiving), ADJUSTMENT (manual fix)
- Current stock: `SUM(quantity) WHERE item_id = X AND location_id = Y`

**Controllers:**
- `Receivings::postSave()` → Creates IN movement when receiving stock
- `Sales::save_sale()` → Creates OUT movement for each sold item

**Costing:**
- **Average cost method** (not FIFO)
- Cost updates on each receiving: `(old_cost * old_qty + new_cost * new_qty) / (old_qty + new_qty)`

**Comparison to Nimbus:**
- **Nimbus:** Batch-based FIFO (StockBatch model with expiry/cost tracking)
- **opensourcepos:** Ledger-based average cost
- **Lesson:** FIFO requires batch tracking; average cost is simpler but less accurate for perishables

**Copy eligibility:** ✅ MIT - Safe to reference inventory ledger pattern

---

### 10. FIFO Costing & Consumption

**opensourcepos:**
- **No FIFO** - Uses weighted average cost
- No recipe/consumption tracking (each item = 1 unit sold)

**Comparison to Nimbus:**
- **Nimbus:** Recipe-based FIFO (1 beer → 330ml from oldest keg batch)
- **opensourcepos:** Direct item sales, average cost COGS
- **Lesson:** Restaurant POS needs recipes; retail POS can skip FIFO

**Copy eligibility:** ✅ MIT - Not applicable (no FIFO)

---

### 11. Purchasing & POs & GRN

**opensourcepos:**
- **Controller:** `app/Controllers/Receivings.php`
- **Model:** `Receiving.php`, `Receivings_items.php`
- **No PO workflow** - Direct receiving only

**Flow (Receiving):**

1. **Create receiving:**
   - `Receivings::getView()` → Opens receiving modal
   - Employee selects supplier, adds items + quantities + cost

2. **Save receiving:**
   - `Receivings::postSave()` → Writes to `receivings` table
   - Creates `Inventory::IN` movements for each item
   - Updates item cost (average cost recalculation)

3. **No approval workflow** - Instant stock IN

**Comparison to Nimbus:**
- **Nimbus:** PO workflow (DRAFT → SUBMITTED → APPROVED → RECEIVED)
- **opensourcepos:** Direct receiving (no PO)
- **Lesson:** PO workflow adds control but requires more steps

**Copy eligibility:** ✅ MIT - Safe to reference receiving logic

---

### 12. Accounting & Double-Entry

**opensourcepos:**
- **No accounting module** - Basic expense tracking only
- **Model:** `Expense.php`, `Expense_categories.php`
- No GL, no journals, no double-entry

**Features:**
- Record expenses (date, amount, category, supplier, payment type)
- Expense reports (filter by date, category)

**Comparison to Nimbus:**
- **Nimbus:** Full double-entry GL (Account, JournalEntry, JournalLine)
- **opensourcepos:** Expense list only
- **Lesson:** Restaurant/enterprise POS needs GL; small retail can skip it

**Copy eligibility:** ✅ MIT - Not applicable (no accounting)

---

### 13. Reporting & Analytics & Exports

**opensourcepos:**
- **Controller:** `app/Controllers/Reports.php`
- **Views:** `app/Views/reports/`

**Available reports:**
- Sales summary (daily, monthly, by category, by item)
- Inventory valuation (current stock * cost)
- Low stock alerts
- Customer sales history
- Employee sales performance
- Profit margin (revenue - COGS)
- Tax liability
- Discounts given

**Export formats:**
- CSV
- PDF (dompdf)
- Excel (via DataTables export)
- Email report

**Comparison to Nimbus:**
- **Nimbus:** Real-time SSE dashboards, Chart.js visualizations
- **opensourcepos:** Server-rendered reports, DataTables grids
- **Lesson:** SPA + SSE = real-time updates; server-rendered = simpler deployment

**Copy eligibility:** ✅ MIT - Safe to reference report structure

---

### 14. Receipt & Kitchen Printing

**opensourcepos:**
- **Library:** `app/Libraries/Barcode_lib.php`
- **Views:** `app/Views/sales/receipt*.php`

**Features:**
- Thermal receipt templates (ESC/POS compatible)
- HTML receipt (browser print)
- PDF receipt (dompdf)
- Email receipt (HTML template)
- Barcode printing (item labels)

**Printing methods:**
1. **Browser print:** `window.print()` from receipt view
2. **Direct thermal:** ESC/POS commands (requires client-side driver)
3. **PDF download:** dompdf generates receipt.pdf

**Comparison to Nimbus:**
- **Nimbus:** Tauri desktop app sends ESC/POS via native APIs, Bluetooth mobile printing
- **opensourcepos:** Browser-based printing (less reliable for thermal)
- **Lesson:** Desktop app = better hardware control; web = easier deployment

**Copy eligibility:** ✅ MIT - Safe to reference receipt templates

---

### 15. Offline Mode & Sync Queues

**opensourcepos:**
- **No offline mode** - Requires active server connection
- Session cart lost if connection drops

**Comparison to Nimbus:**
- **Nimbus:** Service worker + IndexedDB queue, background sync
- **opensourcepos:** Online-only
- **Lesson:** Offline support requires client-side queue + conflict resolution

**Copy eligibility:** ✅ MIT - Not applicable (no offline)

---

### 16. Admin & Settings & Config

**opensourcepos:**
- **Controller:** `app/Controllers/Config.php`
- **Model:** `app_config` table (key-value pairs)

**Settings categories:**
- Company info (name, logo, address)
- Locale (language, timezone, currency, decimal symbol)
- Receipt settings (header, footer, show company name)
- Barcode settings (format, width, height)
- Email (SMTP config, templates)
- Taxes (default tax rates, jurisdictions)
- Rewards (points per dollar, redemption rate)
- Invoice numbering (prefix, sequence)

**Comparison to Nimbus:**
- **Nimbus:** Org-scoped settings, branch overrides, DB records
- **opensourcepos:** Global key-value store
- **Lesson:** Key-value = flexible but harder to query; typed settings = schema validation

**Copy eligibility:** ✅ MIT - Safe to reference config structure

---

## 🔄 Operational Flows (Step-by-Step)

### Flow 1: Complete a Sale (Checkout)

**User Story:** Cashier rings up a customer, accepts cash payment, prints receipt.

**Steps:**

1. **Open POS screen:**
   - Navigate to `/sales` → `Sales::getIndex()`
   - Session cart initialized (`$_SESSION['cart'] = []`)

2. **Add items:**
   - Search for item: `Sales::getItemSearch()` (AJAX autocomplete)
   - Click item → `Sales::postAdd()` → Item added to session cart
   - Repeat for multiple items

3. **Apply discount (optional):**
   - Enter discount % or $ → `Sale_lib::add_discount()`
   - Recalculate totals

4. **Select customer (optional):**
   - Search customer → `Sales::postSelectCustomer()`
   - Apply customer pricing tier, track rewards

5. **Add payment:**
   - Click "Cash" → `Sales::postAddPayment()`
   - Enter amount (e.g., $50)
   - If multi-payment: Add second payment (e.g., $30 card)

6. **Complete sale:**
   - Click "Finish Sale" → `Sale::save_sale()`
   - Writes to `sales`, `sales_items`, `sales_payments` tables
   - Deducts inventory: `Inventory::insert(type=OUT)`
   - Generates receipt: Redirect to `Sales::getReceipt($sale_id)`

7. **Print receipt:**
   - Browser opens receipt page (`app/Views/sales/receipt.php`)
   - User clicks print (`window.print()`)

**Key files:**
- `app/Controllers/Sales.php` (lines 481+: `postAdd()`)
- `app/Models/Sale.php` (lines 200+: `save_sale()`)
- `app/Libraries/Sale_lib.php` (lines 300+: `calculate_totals()`)

---

### Flow 2: Process a Refund

**User Story:** Customer returns a defective item, cashier refunds payment.

**Steps:**

1. **Find original sale:**
   - Navigate to `/sales/manage` → `Sales::getManage()`
   - Search by date, customer, or invoice #
   - Click sale row → View sale details

2. **Return items:**
   - Click "Return" → `Sales::getView($sale_id, 'return')`
   - System creates new sale with negative quantities
   - Original sale remains in DB (audit trail)

3. **Process refund payment:**
   - Select return payment method (usually same as original)
   - Save return → `Sale::save_sale()` with negative amounts

4. **Restore inventory:**
   - `Inventory::insert(type=IN)` for returned items
   - Stock levels updated

**Key files:**
- `app/Controllers/Sales.php` (lines 118+: `getRow()`)
- `app/Models/Sale.php` (return logic in `save_sale()`)

---

### Flow 3: Close Cash Drawer (Cashup/Z-Report)

**User Story:** At end of shift, cashier counts cash and closes register.

**Steps:**

1. **Open cashup screen:**
   - Navigate to `/cashups` → `Cashups::getIndex()`
   - If no open cashup: Click "Open Cash Drawer"

2. **Enter starting cash:**
   - `Cashups::getView()` → Modal opens
   - Enter float amount (e.g., $100)
   - `Cashup::insert()` → Creates open record

3. **Conduct sales:**
   - Normal POS operations throughout shift
   - All sales timestamped (linked to cashup by date range)

4. **Count cash:**
   - At end of shift: Click "Close Cash Drawer"
   - `Cashups::getClose()` → Shows expected cash (sales + float)
   - Employee counts actual cash, enters amount

5. **Reconcile:**
   - System calculates: `expected - actual = over/short`
   - Employee adds note (e.g., "Short $5 - customer dispute")
   - `Cashup::update()` → Saves close data

6. **View Z-Report:**
   - `Cashups::getReport($cashup_id)` → Breakdown:
     - Total sales, payment types, refunds, discounts
     - Expected vs actual cash
     - Over/short amount

**Key files:**
- `app/Controllers/Cashups.php`
- `app/Models/Cashup.php`

---

### Flow 4: Receive Inventory (GRN)

**User Story:** Stock manager receives a delivery from supplier.

**Steps:**

1. **Create receiving:**
   - Navigate to `/receivings` → `Receivings::getIndex()`
   - Click "New Receiving" → `Receivings::getView()`

2. **Select supplier:**
   - Choose supplier from dropdown
   - System loads supplier's typical items (autocomplete)

3. **Add items:**
   - Search for item → `Receivings::getItemSearch()`
   - Enter quantity received + unit cost
   - Repeat for all items in delivery

4. **Save receiving:**
   - Click "Save" → `Receivings::postSave()`
   - Writes to `receivings`, `receivings_items` tables
   - Creates `Inventory::IN` movements
   - Updates item cost (average cost recalculation)

5. **Print receiving report (optional):**
   - PDF summary of received items

**Key files:**
- `app/Controllers/Receivings.php`
- `app/Models/Receiving.php`
- `app/Libraries/Receiving_lib.php`

---

## 🔌 Extension Points

**1. Payment Gateways:**
- Add new payment type: Extend `app/Models/Enums/Payment_type.php`
- Integrate gateway: Create library in `app/Libraries/` (e.g., `Stripe_lib.php`)

**2. Custom Reports:**
- Create new report: Extend `app/Controllers/Reports.php`
- Add view: `app/Views/reports/custom_report.php`
- Use CodeIgniter Query Builder for data

**3. Receipt Templates:**
- Modify: `app/Views/sales/receipt.php`
- Add logo, custom fields, QR codes
- ESC/POS commands for thermal printers

**4. Themes:**
- Change Bootswatch theme: `app/Config/OSPOS.php` → `theme`
- Custom CSS: `public/css/` override

**5. SMS/Email Notifications:**
- Extend `app/Libraries/Sms_lib.php` (Twilio)
- Extend `app/Libraries/Email_lib.php` (SMTP)

**6. Barcode Formats:**
- Extend `app/Libraries/Barcode_lib.php`
- `picqer/php-barcode-generator` supports EAN, Code128, QR, etc.

**7. Multi-Language:**
- Add language: `app/Language/{lang_code}/`
- Translate via Weblate: https://translate.opensourcepos.org

---

## 📊 File-Path Quick Index

**Need to understand...?**

| Domain | Go to... |
|--------|----------|
| **Login flow** | `app/Controllers/Login.php`, `app/Models/Employee.php` |
| **POS checkout** | `app/Controllers/Sales.php`, `app/Libraries/Sale_lib.php` |
| **Cart management** | `app/Controllers/Sales.php` (session cart in `postAdd()`) |
| **Payment processing** | `app/Controllers/Sales.php` (`postAddPayment()`), `app/Models/Sales_payments.php` |
| **Inventory tracking** | `app/Models/Inventory.php`, `app/Controllers/Receivings.php` |
| **Product catalog** | `app/Controllers/Items.php`, `app/Models/Item.php` |
| **Cash drawer/shift** | `app/Controllers/Cashups.php`, `app/Models/Cashup.php` |
| **Receipt printing** | `app/Views/sales/receipt.php`, `app/Libraries/Barcode_lib.php` |
| **Reports** | `app/Controllers/Reports.php`, `app/Views/reports/` |
| **User/RBAC** | `app/Models/Employee.php`, `grants` table logic |
| **Settings** | `app/Controllers/Config.php`, `app_config` table |
| **Taxes** | `app/Libraries/Tax_lib.php`, `app/Models/Tax_jurisdictions.php` |
| **Email/SMS** | `app/Libraries/Email_lib.php`, `app/Libraries/Sms_lib.php` |
| **Database schema** | `app/Database/Migrations/` (42 files) |

---

## 🔄 Concept Mapping to Nimbus POS

| opensourcepos Concept | Nimbus Equivalent | Notes |
|-----------------------|-------------------|-------|
| `Sales` controller | `PosController` | Checkout flow |
| `Sale` model | `Order` model | Transaction record |
| `Sales_items` model | `OrderLine` model | Line items |
| `Sales_payments` model | `Payment` model | Multi-payment |
| `Inventory` ledger | `StockMovement` model | Stock tracking |
| `Cashup` model | `Shift` model | Cash drawer management |
| `Employee` model | `User` model | Staff accounts |
| `grants` table | `roleLevel` field | RBAC |
| Session cart (`$_SESSION`) | DB-persisted Order (OPEN status) | Cart storage |
| `Receiving` model | `PurchaseOrder` (RECEIVED status) | Inventory receiving |
| `Item` model | `Item` model | Product catalog |
| `Item_kit` model | Recipe concept (not kits) | Bundles vs recipes |
| `Attribute` model | `Modifier` model (different purpose) | Item properties vs add-ons |
| Average cost | FIFO batches | Costing method |
| `app_config` table | Org/Branch settings | Config storage |
| PHP sessions | JWT tokens | Auth method |
| Server-rendered views | React SPA | Frontend approach |

---

## ⚖️ Copy Eligibility Statement

**License:** MIT License  
**Copyright:** © 2013-2025 jekkos, objecttothis, odiea

**What you CAN do:**
- ✅ Study the architecture and design patterns
- ✅ Reference the checkout flow logic
- ✅ Learn from the RBAC implementation
- ✅ Adapt the cashup reconciliation approach
- ✅ Use as inspiration for receipt templates
- ✅ Copy/adapt code snippets (with attribution recommended)
- ✅ Fork and modify for your own projects

**What you SHOULD do:**
- Document learnings in completion reports
- Attribute inspiration when describing Nimbus features
- Recommend to others as a reference POS

**Clean-room workflow (optional but recommended):**
1. Study opensourcepos architecture (this document)
2. Close all opensourcepos files
3. Design Nimbus feature independently
4. Implement without looking at opensourcepos code
5. Compare results after implementation

---

## 🎓 Key Lessons for Nimbus

**✅ Adopt:**
- **Multi-payment flow:** Simple session-based payment accumulation
- **Cashup reconciliation:** Expected vs actual cash tracking
- **Ledger-based inventory:** Audit trail for every movement
- **Grant-based RBAC:** Flexible permission model

**❌ Avoid:**
- **Session cart:** Doesn't survive crashes, hard to sync across devices
- **Average cost:** FIFO is more accurate for restaurants (perishables)
- **No PO workflow:** Enterprise needs approval steps
- **Server-rendered UI:** SPA enables better UX (offline, real-time)

**🤔 Consider:**
- **Item kits:** Good for fixed combos (breakfast special = eggs + toast + coffee)
- **Direct receiving:** Faster than PO workflow for small operations
- **Browser printing:** Simpler deployment, but unreliable for thermal printers

---

## 📚 Further Reading

- **Official Docs:** https://github.com/opensourcepos/opensourcepos/wiki
- **Installation Guide:** `INSTALL.md` in repo
- **Database Schema:** `app/Database/Migrations/` files
- **API-like endpoints:** None (traditional MVC, not REST API)
- **Demo:** https://demo.opensourcepos.org (admin / pointofsale)

---

**Last Updated:** 2025-12-25  
**Analyzed by:** Nimbus POS Engineering Team  
**Status:** ✅ Complete - Safe for reference (MIT license)
