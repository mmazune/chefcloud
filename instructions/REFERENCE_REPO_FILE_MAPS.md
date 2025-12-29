# Reference POS Repository File Maps

**Purpose:** Quick navigation guide to locate specific functionality in each reference repo.

**License Summary:**
- ✅ **MIT (OK to reference):** opensourcepos, medusa-pos-starter
- ⚠️ **GPL-3.0 (reference only):** nexopos, pos-awesome
- ❌ **Unknown (do not copy):** medusa-pos-react, store-pos

---

## How to Use This Document

1. **Find the domain** you're researching (e.g., "Inventory FIFO")
2. **Check license** for each repo before opening files
3. **Navigate to paths** listed below
4. **Study architecture patterns** (not code copying)
5. **Cross-reference** with Nimbus implementation in `/instructions/REFERENCE_SIDE_BY_SIDE_INDEX.md`

---

## 1. opensourcepos (PHP/CodeIgniter) ✅ MIT

**Repo:** `reference-pos/opensourcepos/`  
**License:** MIT (safe to reference)  
**Tech Stack:** PHP 8.1, CodeIgniter 4, MySQL, jQuery  
**Architecture:** MVC pattern, traditional server-rendered views

### Top-Level Structure

```
opensourcepos/
├── app/
│   ├── Controllers/        # HTTP controllers (Sales, Items, Customers, etc.)
│   ├── Models/            # Database models and business logic
│   ├── Views/             # Server-rendered templates
│   ├── Config/            # Routes, database config
│   ├── Database/
│   │   ├── Migrations/    # Schema migrations
│   │   └── Seeds/         # Sample data
│   ├── Language/          # i18n translations (40+ languages)
│   └── Helpers/           # Utility functions
├── public/                # Web root (index.php, assets)
└── tests/                 # PHPUnit tests
```

### Core POS Flows

**Sales/Orders:**
- Entry point: [app/Controllers/Sales.php](../reference-pos/opensourcepos/app/Controllers/Sales.php)
- Model: [app/Models/Sale.php](../reference-pos/opensourcepos/app/Models/Sale.php)
- Views: `app/Views/sales/` (register.php, receipt.php, suspended.php)
- Payment processing: `Sale.php` → `sale_payments` table
- Receipt printing: `app/Views/sales/receipt.php` (HTML/CSS template)

**Product Catalog:**
- Controller: [app/Controllers/Items.php](../reference-pos/opensourcepos/app/Controllers/Items.php)
- Model: [app/Models/Item.php](../reference-pos/opensourcepos/app/Models/Item.php)
- Item kits (bundles): [app/Models/Item_kit.php](../reference-pos/opensourcepos/app/Models/Item_kit.php)
- Pricing tiers: `Item.php` → `item_quantities` table

**Inventory:**
- Model: [app/Models/Inventory.php](../reference-pos/opensourcepos/app/Models/Inventory.php)
- Stock movements: `inventory` table (datetime-based ledger)
- Location tracking: Multi-location support via `stock_locations`
- **No FIFO:** Uses average cost method

**Customers:**
- Controller: [app/Controllers/Customers.php](../reference-pos/opensourcepos/app/Controllers/Customers.php)
- Model: [app/Models/Customer.php](../reference-pos/opensourcepos/app/Models/Customer.php)
- Loyalty/rewards: [app/Models/Customer_rewards.php](../reference-pos/opensourcepos/app/Models/Customer_rewards.php)

### Auth/Users/RBAC

- Controller: [app/Controllers/Login.php](../reference-pos/opensourcepos/app/Controllers/Login.php)
- Model: [app/Models/Employee.php](../reference-pos/opensourcepos/app/Models/Employee.php)
- Permissions: Simple role-based (admin vs employee)
- Multi-store: Employees can be assigned to locations

### Shifts/Cash Drawer

- Not implemented (manual reconciliation only)
- Z-reports via sales reports module

### Purchasing

- Suppliers: [app/Controllers/Suppliers.php](../reference-pos/opensourcepos/app/Controllers/Suppliers.php)
- Receivings (GRN): [app/Controllers/Receivings.php](../reference-pos/opensourcepos/app/Controllers/Receivings.php)
- Model: [app/Models/Receiving.php](../reference-pos/opensourcepos/app/Models/Receiving.php)

### Reporting

- Base: [app/Controllers/Reports.php](../reference-pos/opensourcepos/app/Controllers/Reports.php)
- Models: `app/Models/Reports/` (Inventory_summary, Sales_summary, etc.)
- Exports: CSV, PDF (via mPDF library)

### Printing

- Receipt templates: `app/Views/sales/receipt.php`
- Thermal printer: ESC/POS commands (basic)
- Kitchen tickets: Not implemented

### Settings/Config

- Config: `app/Config/` (App.php, Database.php, Routes.php)
- Store settings: Database table `app_config`
- Tax rates: [app/Controllers/Taxes.php](../reference-pos/opensourcepos/app/Controllers/Taxes.php)

---

## 2. nexopos (Laravel/Vue) ⚠️ GPL-3.0

**Repo:** `reference-pos/nexopos/`  
**License:** GPL-3.0 (REFERENCE ONLY - do not copy code)  
**Tech Stack:** Laravel 10, Vue 3, Tailwind CSS, MySQL  
**Architecture:** Service-oriented, REST API + SPA frontend

### Top-Level Structure

```
nexopos/
├── app/
│   ├── Http/Controllers/  # API controllers
│   ├── Services/          # Business logic layer
│   ├── Models/            # Eloquent models
│   ├── Events/            # Event-driven architecture
│   ├── Listeners/         # Event handlers
│   ├── Jobs/              # Queue jobs
│   ├── Forms/             # Form definitions
│   └── Settings/          # Settings management
├── database/
│   ├── migrations/        # Schema migrations
│   └── seeders/           # Demo data
├── resources/
│   ├── ts/                # TypeScript Vue components
│   │   ├── pages/         # SPA pages
│   │   └── components/    # Reusable components
│   └── views/             # Blade templates (minimal)
├── routes/
│   ├── api.php            # API routes
│   └── web.php            # Web routes
└── tests/                 # PHPUnit + Pest tests
```

### Core POS Flows

**Sales/Orders:**
- Service: [app/Services/OrdersService.php](../reference-pos/nexopos/app/Services/OrdersService.php)
- Controller: [app/Http/Controllers/Dashboard/OrdersController.php](../reference-pos/nexopos/app/Http/Controllers/Dashboard/OrdersController.php)
- Model: [app/Models/Order.php](../reference-pos/nexopos/app/Models/Order.php)
- Frontend: `resources/ts/pages/dashboard/pos/` (POS interface)
- Payment: Multi-payment support (cash, card, account)
- Order types: Takeout, delivery, dine-in

**Product Catalog:**
- Service: [app/Services/ProductService.php](../reference-pos/nexopos/app/Services/ProductService.php)
- Model: [app/Models/Product.php](../reference-pos/nexopos/app/Models/Product.php)
- Categories: [app/Models/ProductCategory.php](../reference-pos/nexopos/app/Models/ProductCategory.php)
- Variations: Product units system (unit groups, sub-units)
- Modifiers: Not implemented (product-level only)

**Inventory:**
- Service: [app/Services/ProductHistoryService.php](../reference-pos/nexopos/app/Services/ProductHistoryService.php)
- FIFO costing: Implemented via `product_history` table
- Stock flow: `products_histories` tracks IN/OUT movements
- Adjustments: [app/Services/InventoryService.php](../reference-pos/nexopos/app/Services/InventoryService.php)

**Customers:**
- Service: [app/Services/CustomerService.php](../reference-pos/nexopos/app/Services/CustomerService.php)
- Model: [app/Models/Customer.php](../reference-pos/nexopos/app/Models/Customer.php)
- Account balances: Customer credit/debt tracking
- Groups: Customer group pricing

### Auth/Users/RBAC

- Controller: [app/Http/Controllers/AuthController.php](../reference-pos/nexopos/app/Http/Controllers/AuthController.php)
- Model: [app/Models/User.php](../reference-pos/nexopos/app/Models/User.php)
- Permissions: [app/Models/Permission.php](../reference-pos/nexopos/app/Models/Permission.php)
- Roles: [app/Models/Role.php](../reference-pos/nexopos/app/Models/Role.php)
- Multi-store: Full multi-unit support with store assignments

### Shifts/Cash Drawer

- Service: [app/Services/CashRegistersService.php](../reference-pos/nexopos/app/Services/CashRegistersService.php)
- Model: [app/Models/Register.php](../reference-pos/nexopos/app/Models/Register.php)
- Register history: `registers_history` table
- Opening/closing: Full cash flow tracking
- Z-reports: Built-in via registers module

### Purchasing

- Service: [app/Services/ProcurementService.php](../reference-pos/nexopos/app/Services/ProcurementService.php)
- Controller: [app/Http/Controllers/Dashboard/ProcurementController.php](../reference-pos/nexopos/app/Http/Controllers/Dashboard/ProcurementController.php)
- Model: [app/Models/Procurement.php](../reference-pos/nexopos/app/Models/Procurement.php)
- Suppliers: [app/Models/Provider.php](../reference-pos/nexopos/app/Models/Provider.php)
- GRN: Automatic stock updates on procurement approval

### Accounting

- Service: [app/Services/ExpenseService.php](../reference-pos/nexopos/app/Services/ExpenseService.php)
- Model: [app/Models/Expense.php](../reference-pos/nexopos/app/Models/Expense.php)
- COA: [app/Models/AccountType.php](../reference-pos/nexopos/app/Models/AccountType.php)
- Journals: Basic expense tracking (not full double-entry)

### Reporting

- Service: [app/Services/ReportService.php](../reference-pos/nexopos/app/Services/ReportService.php)
- Dashboard: `resources/ts/pages/dashboard/reports/`
- Sales reports: Daily, monthly, annual
- Inventory reports: Stock value, low stock alerts
- Exports: PDF, Excel via Laravel Excel

### Printing

- Receipts: Blade templates → PDF
- Kitchen tickets: Order printing to specific printers
- Thermal: ESC/POS support via settings

### Offline/Sync

- Not implemented (SPA requires internet)

### Settings/Config

- Settings: [app/Services/Options.php](../reference-pos/nexopos/app/Services/Options.php)
- Frontend: `resources/ts/pages/dashboard/settings/`
- Database: `nexopos_options` table
- Currency: Multi-currency support

---

## 3. pos-awesome (Frappe/ERPNext) ⚠️ GPL-3.0

**Repo:** `reference-pos/posawesome/`  
**License:** GPL-3.0 (REFERENCE ONLY - do not copy code)  
**Tech Stack:** Python, Frappe Framework, MariaDB, Vue.js  
**Architecture:** Frappe DocType system, ERP integration

### Top-Level Structure

```
posawesome/
├── posawesome/
│   ├── posawesome/
│   │   ├── doctype/           # Entity definitions
│   │   │   ├── pos_closing_shift/
│   │   │   ├── pos_offer/
│   │   │   ├── pos_coupon/
│   │   │   └── ...
│   │   ├── page/              # Custom pages
│   │   │   └── posapp/        # Main POS interface
│   │   └── api/               # Python API methods
│   ├── public/                # Static assets
│   └── config/                # App configuration
├── setup.py                   # Python package setup
└── requirements.txt           # Dependencies
```

### Core POS Flows

**Sales/Orders:**
- DocType: `posawesome/posawesome/doctype/pos_invoice/` (extends ERPNext Sales Invoice)
- Frontend: `posawesome/posawesome/page/posapp/` (Vue.js SPA)
- Integration: Uses ERPNext's Sales Invoice workflow
- Offline mode: LocalStorage + sync queue

**Product Catalog:**
- Uses ERPNext Item doctype (no custom implementation)
- Item groups, variants, UOM conversions
- Price lists: ERPNext pricing rules

**Inventory:**
- Uses ERPNext Stock Entry
- Warehouse management via ERPNext
- FIFO/LIFO: Configurable via ERPNext

**Customers:**
- Uses ERPNext Customer doctype
- Customer groups, credit limits
- Loyalty points: ERPNext integration

### Auth/Users/RBAC

- Uses Frappe's user/role system
- Permissions: Frappe Permission Manager
- Multi-company: ERPNext company entity

### Shifts/Cash Drawer

- DocType: [posawesome/posawesome/doctype/pos_closing_shift/](../reference-pos/pos-awesome/posawesome/posawesome/doctype/pos_closing_shift/)
- Shift opening/closing workflow
- Cash reconciliation reports

### Purchasing

- Uses ERPNext Purchase Order, Purchase Receipt
- Supplier management: ERPNext Supplier doctype

### Accounting

- Full ERPNext accounting integration
- GL entries, COA, financial reports
- Double-entry bookkeeping via ERPNext

### Reporting

- ERPNext report builder
- Custom POS reports in `posawesome/posawesome/report/`

### Printing

- Frappe print formats
- Thermal printer via POS Awesome print server

### Offline/Sync

- Implemented via IndexedDB
- Sync queue: `posawesome/posawesome/page/posapp/pos_controller.js`

### Settings/Config

- DocType: `POS Awesome Settings`
- Configuration: `posawesome/config/pos_awesome.py`

---

## 4. medusa-pos-starter (Expo/React Native) ✅ MIT

**Repo:** `reference-pos/medusa-pos-starter/`  
**License:** MIT (safe to reference)  
**Tech Stack:** Expo SDK, React Native, TypeScript, Medusa.js backend  
**Architecture:** Mobile-first, headless commerce integration

### Top-Level Structure

```
medusa-pos-starter/
├── app/                   # Expo Router pages
│   ├── (tabs)/           # Tab navigation
│   │   ├── cart.tsx      # Shopping cart
│   │   ├── orders.tsx    # Order history
│   │   ├── products.tsx  # Product catalog
│   │   └── settings.tsx  # Configuration
│   ├── login.tsx         # Authentication
│   ├── checkout/         # Checkout flow
│   └── orders/           # Order details
├── components/           # Reusable React components
├── api/                  # Medusa API client
├── contexts/             # React contexts (cart, auth)
├── hooks/                # Custom React hooks
├── constants/            # App constants
└── utils/                # Utility functions
```

### Core POS Flows

**Sales/Orders:**
- Cart: [app/(tabs)/cart.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/cart.tsx)
- Checkout: [app/checkout/[draftOrderId].tsx](../reference-pos/medusa-pos-starter/app/checkout/[draftOrderId].tsx)
- Orders: [app/(tabs)/orders.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/orders.tsx)
- API: `api/orders.ts` (Medusa draft orders)

**Product Catalog:**
- Products: [app/(tabs)/products.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/products.tsx)
- Product details: [app/product-details.tsx](../reference-pos/medusa-pos-starter/app/product-details.tsx)
- Search: Product filtering via Medusa API

**Inventory:**
- Managed by Medusa backend (not in mobile app)

**Customers:**
- Customer lookup: [app/customer-lookup.tsx](../reference-pos/medusa-pos-starter/app/customer-lookup.tsx)
- API: `api/customers.ts`

### Auth/Users/RBAC

- Login: [app/login.tsx](../reference-pos/medusa-pos-starter/app/login.tsx)
- API: `api/auth.ts` (Medusa store auth)
- No RBAC in mobile app (backend handles)

### Shifts/Cash Drawer

- Not implemented

### Purchasing

- Not in POS app (backend admin only)

### Accounting

- Not in POS app

### Reporting

- Basic order history only

### Printing

- Not implemented

### Offline/Sync

- Not implemented (requires internet)

### Settings/Config

- Settings: [app/(tabs)/settings.tsx](../reference-pos/medusa-pos-starter/app/(tabs)/settings.tsx)
- Setup wizard: [app/setup-wizard.tsx](../reference-pos/medusa-pos-starter/app/setup-wizard.tsx)
- Region, sales channel, stock location config

---

## 5. medusa-pos-react (Vite/React) ❌ UNKNOWN LICENSE

**Repo:** `reference-pos/medusa-pos-react/`  
**License:** UNKNOWN (do not copy code)  
**Tech Stack:** React, Vite, TypeScript, Medusa.js  
**Architecture:** Web SPA, headless commerce

### Top-Level Structure

```
medusa-pos-react/
├── src/
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom hooks
│   ├── services/        # API services
│   ├── store/           # State management
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities
├── public/              # Static assets
└── index.html           # Entry point
```

### Core POS Flows

**Sales/Orders:**
- Location: `src/pages/` and `src/components/pos/`
- Medusa integration via `src/services/`

**Product Catalog:**
- Product grid: `src/components/products/`

**⚠️ WARNING:** No license file found. Treat as proprietary. View structure only.

---

## 6. store-pos (Electron/Desktop) ❌ UNKNOWN LICENSE

**Repo:** `reference-pos/store-pos/`  
**License:** UNKNOWN (do not copy code)  
**Tech Stack:** Electron, HTML/CSS/JS, Node.js backend  
**Architecture:** Desktop app (Windows/macOS/Linux)

### Top-Level Structure

```
store-pos/
├── api/                 # Backend API
├── assets/              # Frontend assets
├── public/              # Static files
├── index.html           # Main HTML
├── renderer.js          # Electron renderer
├── server.js            # Backend server
└── start.js             # Electron main process
```

### Core POS Flows

**Sales/Orders:**
- Frontend: `assets/` (HTML/CSS/JS)
- Backend: `api/` (Node.js)

**⚠️ WARNING:** No license file found. Treat as proprietary. View structure only.

---

## Quick Reference: Where to Find...

| Feature | opensourcepos | nexopos | pos-awesome | medusa-pos-starter |
|---------|--------------|---------|-------------|-------------------|
| **POS UI** | Views/sales/register.php | resources/ts/pages/dashboard/pos/ | posawesome/page/posapp/ | app/(tabs)/cart.tsx |
| **Order model** | Models/Sale.php | Models/Order.php | ERPNext POS Invoice | api/orders.ts |
| **Inventory** | Models/Inventory.php | Services/InventoryService.php | ERPNext Stock | Backend only |
| **Auth** | Controllers/Login.php | Controllers/AuthController.php | Frappe User | app/login.tsx |
| **Shifts** | N/A | Services/CashRegistersService.php | doctype/pos_closing_shift/ | N/A |
| **Printing** | Views/sales/receipt.php | Blade templates | Frappe print | N/A |
| **Reports** | Controllers/Reports.php | Services/ReportService.php | ERPNext reports | Order history |

---

## Navigation Tips

### For PHP Developers (opensourcepos)
1. Start with `app/Controllers/` to find entry points
2. Check `app/Models/` for database logic
3. Views are in `app/Views/`
4. Database schema: `app/Database/Migrations/`

### For Laravel Developers (nexopos)
1. Routes in `routes/api.php` and `routes/web.php`
2. Business logic in `app/Services/`
3. Frontend in `resources/ts/`
4. Migrations in `database/migrations/`

### For Python Developers (pos-awesome)
1. DocTypes in `posawesome/posawesome/doctype/`
2. API methods in `posawesome/posawesome/api/`
3. Frontend in `posawesome/posawesome/page/posapp/`
4. Refer to Frappe/ERPNext docs for architecture

### For React Developers (medusa-pos-starter)
1. Pages in `app/` (Expo Router)
2. Components in `components/`
3. API calls in `api/`
4. State in `contexts/`

---

## License Reminders

**Before opening any file:**

1. ✅ **opensourcepos, medusa-pos-starter:** MIT - Safe to reference, study, and adapt patterns
2. ⚠️ **nexopos, pos-awesome:** GPL-3.0 - Study architecture only, do not copy code
3. ❌ **medusa-pos-react, store-pos:** Unknown - View structure only, do not copy

**When in doubt:** Check `/reference-pos/MANIFEST.json` for license details.

---

**Last Updated:** 2025-12-25  
**See also:** `/instructions/REFERENCE_SIDE_BY_SIDE_INDEX.md` for domain-specific comparisons with Nimbus POS
