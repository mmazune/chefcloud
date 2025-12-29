# store-pos Architecture Map

**Repository:** https://github.com/tngoman/Store-POS  
**License:** UNKNOWN (❌ Assume proprietary/all rights reserved)  
**Version Analyzed:** Commit `45d304b` (master branch)  
**Last Updated:** 2025-12-26

---

## ⚠️ CRITICAL LICENSE WARNING

**No License File Found - Assume Proprietary**

This repository does **NOT** have a LICENSE file, which means it is **NOT open source** and should be treated as proprietary/all rights reserved.

**DO NOT:**
- ❌ Copy ANY code from this repository
- ❌ Adapt algorithms or business logic
- ❌ Use as a code template
- ❌ Port components or functions
- ❌ Assume any permission to use

**DO:**
- ✅ Study the architecture and design patterns ONLY
- ✅ Learn from the structural approach
- ✅ Document concepts in your own words
- ✅ Implement solutions independently after study

**Legal Note:**
Without an explicit license, the repository author retains all rights. Using code from this repository could result in copyright infringement.

**Safe Usage:**
- View structure and architecture only
- Learn high-level patterns (file organization, database choice)
- Do NOT reference specific code implementations
- Implement features independently from scratch

---

## 📋 Executive Summary

**What it is:** A **desktop POS application** built with **Electron**, designed for Windows PCs running on a local network with a centralized database. Features offline-capable architecture using NeDB (embedded NoSQL database), receipt printing, barcode scanning, and basic multi-user support with staff permissions.

**Why study it (architecture only):**
- **Electron desktop architecture** - Cross-platform desktop app pattern
- **NeDB embedded database** - Offline-first, file-based NoSQL
- **Multi-PC network POS** - Centralized database shared across terminals
- **Express local server** - Embedded API server within Electron app
- **Barcode scanner integration** - USB HID scanner support
- **Receipt printing** - Thermal printer integration (ESC/POS)
- **Open tabs (orders)** - Hold orders for later completion
- **Transaction history** - Date range filtering, till/cashier breakdown

**Best for learning:**
- Electron POS architecture (desktop app)
- Embedded database pattern (NeDB)
- Local API server (Express within Electron)
- Multi-PC shared database on network
- Offline-first desktop POS design
- Thermal printer integration
- USB barcode scanner handling

**Not ideal for:**
- Code reference (no license = proprietary)
- Cloud-based architecture (local network only)
- Advanced inventory (basic stock tracking)
- Multi-tenancy (single-store only)

---

## 🏗️ Technology Stack

### Frontend (Desktop UI)
- **Framework:** Vanilla JavaScript (jQuery)
- **UI Library:** Bootstrap 3 (via plugins)
- **Desktop Shell:** Electron 22.3+
- **Templating:** HTML + inline JavaScript

### Backend (Embedded API Server)
- **Server:** Express.js (Node.js)
- **Database:** NeDB (embedded NoSQL, file-based)
- **File Uploads:** express-fileupload, multer
- **Real-time:** Socket.IO (for multi-PC sync)
- **Background Jobs:** async library

### Desktop Platform
- **Shell:** Electron (Chromium + Node.js)
- **Target OS:** Windows (primary), macOS/Linux (portable)
- **Build:** electron-builder, electron-packager
- **Installer:** electron-winstaller (MSI for Windows)

### Key Libraries
- **Database:** nedb (1.8.0) - In-memory/persistent NoSQL
- **Server:** express (4.19.2), http, https
- **PDF/Print:** jspdf (2.3.1), print-js (1.0.63)
- **Barcode:** jsbarcode (3.11.0)
- **Canvas:** html2canvas (1.0.0-rc.5)
- **Utilities:** moment (2.29.4), btoa, jquery (3.4.1)
- **Network:** macaddress (0.2.9), is-port-reachable (2.0.1)

### Hardware Integrations
- **Barcode Scanners:** USB HID (keyboard wedge mode)
- **Receipt Printers:** ESC/POS thermal printers (via print-js)

---

## 📁 Directory Structure

```
store-pos/
├── api/                           # Express API routes ⭐
│   ├── transactions.js            # Transaction CRUD operations
│   ├── inventory.js               # Product/inventory management
│   ├── customers.js               # Customer database
│   ├── users.js                   # Staff user management
│   ├── categories.js              # Product categories
│   └── settings.js                # App settings (store info, etc.)
├── assets/                        # Frontend assets
│   ├── css/                       # Stylesheets
│   ├── js/                        # JavaScript files
│   ├── fonts/                     # Web fonts
│   ├── images/                    # Icons, logos
│   └── plugins/                   # jQuery plugins
│       ├── bootstrap/             # Bootstrap 3
│       ├── bootstrap-select/      # Enhanced select boxes
│       ├── chosen/                # Dropdown library
│       ├── dataTables/            # Table plugin
│       ├── daterangepicker/       # Date range picker
│       ├── jq-keyboard/           # On-screen keyboard
│       ├── jquery-ui/             # jQuery UI
│       └── onscreen-keyboard/     # Virtual keyboard
├── public/                        # Public files
│   └── uploads/
│       └── product_image/         # Product image uploads
├── installers/                    # Electron installer scripts
│   └── setupEvents.js             # Windows installer hooks
├── screenshots/                   # Documentation screenshots
├── start.js                       # Electron main process ⭐
├── server.js                      # Express server initialization
├── index.html                     # Main app HTML (loaded by Electron)
├── package.json                   # Node.js dependencies
└── README.md
```

### Database Files (Created at Runtime)
```
%APPDATA%/POS/server/databases/     # Windows AppData folder
├── transactions.db                 # NeDB transaction database
├── inventory.db                    # NeDB product database
├── customers.db                    # NeDB customer database
├── users.db                        # NeDB user database
├── categories.db                   # NeDB category database
└── settings.db                     # NeDB settings database
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Architecture: Electron + NeDB Embedded

**store-pos:**
- **Electron Shell:**
  - Main process (start.js) - Node.js backend
  - Renderer process (index.html + assets/) - Frontend UI
  - IPC communication (main ↔ renderer)
- **Embedded Express Server:**
  - Server runs inside Electron app (server.js)
  - API routes (api/*.js)
  - Listens on localhost:PORT (e.g., http://localhost:3000)
  - Frontend makes AJAX calls to localhost API
- **NeDB Database:**
  - File-based NoSQL (JSON documents)
  - One .db file per collection (transactions.db, inventory.db, etc.)
  - Stored in `process.env.APPDATA/POS/server/databases/`
  - In-memory caching + disk persistence
  - Auto-indexing (ensures unique _id)

**Nimbus POS Equivalent:**
- Cloud-based (Supabase PostgreSQL)
- Web app (browser-based)
- Could add Electron wrapper for desktop

**Key Differences:**
- store-pos: Desktop app, local database
- Nimbus: Cloud app, centralized database

**Architectural Lesson:**
- Electron + NeDB enables offline-first desktop POS
- Embedded server keeps all logic in one app (no separate backend)
- NeDB is fast for small datasets (< 10,000 records)

---

### 2. Multi-PC Network Architecture

**store-pos:**
- **Network Setup:**
  - One PC acts as "server" (hosts database)
  - Other PCs connect as "clients" (access shared database)
  - Database files stored on network share (SMB/CIFS)
  - All PCs run same Electron app
  - NeDB supports concurrent access (file locking)
- **Configuration:**
  - Server PC: Database path = local `%APPDATA%/POS/`
  - Client PCs: Database path = network path `\\\\SERVER\\POS\\`
- **Sync:**
  - Socket.IO for real-time updates (optional)
  - NeDB file locking prevents conflicts
- **Offline Tolerance:**
  - If network drops, PCs can work offline (local cache)
  - Resync when network restored

**Nimbus POS Equivalent:**
- Cloud-based (no network share needed)
- Real-time sync via Supabase subscriptions

**Key Differences:**
- store-pos: Local network, file-based sync
- Nimbus: Cloud sync, database-level transactions

**Architectural Lesson:**
- File-based databases can work on network shares (SMB)
- File locking is critical to prevent corruption
- Local network POS is viable for small businesses (no internet required)

---

### 3. Authentication & User Management

**store-pos:**
- **Users API:** `api/users.js`
- **User Model:**
  ```javascript
  User {
    _id: int,
    username: string,
    password: string,  // Plain text (⚠️ not hashed)
    fullname: string,
    permissions: {
      inventory: boolean,
      customers: boolean,
      transactions: boolean,
      users: boolean,
      settings: boolean
    }
  }
  ```
- **Default User:** Username/password both = "admin"
- **Permissions:** Boolean flags for feature access
- **Session:** No session management (app-level login)

**Nimbus POS Equivalent:**
- `users` table with hashed passwords (bcrypt)
- JWT session tokens
- Role-based permissions

**Key Differences:**
- store-pos: Simple user model, plain-text passwords (⚠️ insecure)
- Nimbus: Secure auth with hashing, JWT tokens

**Architectural Lesson:**
- Desktop apps need user management (multi-cashier)
- Boolean permissions are simplest RBAC model
- ⚠️ Plain-text passwords are insecure (should use bcrypt/argon2)

---

### 4. Products & Inventory

**store-pos:**
- **Inventory API:** `api/inventory.js`
- **Product Model:**
  ```javascript
  Product {
    _id: int,
    name: string,
    price: number,
    category: string,
    quantity: number,         // Current stock
    stock: int,               // 0 = track stock, 1 = don't track
    img: string,              // Image filename
    barcode: string           // (likely added, not visible in API)
  }
  ```
- **Features:**
  - Add/edit/delete products
  - Upload product images (multer)
  - Search products (by name, category)
  - Barcode lookup (scan to find product)
  - Stock tracking (optional per product)
  - Bulk import (not shown in code)
- **Inventory Ops:**
  - Stock decremented on sale
  - No FIFO/LIFO costing (simple quantity tracking)
  - No purchase orders or receiving (manual stock adjustment)

**Nimbus POS Equivalent:**
- `products` + `product_variants` tables
- `inventory_transactions` for stock movements
- Automatic stock adjustment on sale

**Key Differences:**
- store-pos: Simple stock tracking (quantity field)
- Nimbus: Transaction-based inventory (audit trail)

**Architectural Lesson:**
- Simple quantity field is sufficient for basic inventory
- Stock tracking flag allows non-inventory items (services)

---

### 5. Shopping Cart & Open Tabs (Hold Orders)

**store-pos:**
- **Transactions API:** `api/transactions.js`
- **Transaction Model:**
  ```javascript
  Transaction {
    _id: int,
    ref_number: string,     // Tab reference (for on-hold)
    customer: string,       // Customer ID or "0" (guest)
    till: string,           // Register/till ID
    cashier: string,        // Staff username
    items: [
      { product_id, name, price, quantity, total }
    ],
    subtotal: number,
    tax: number,
    discount: number,
    total: number,
    payment_method: string, // Cash, Card
    status: int,            // 0 = on-hold, 1 = completed, 2 = void
    date: timestamp
  }
  ```
- **Open Tabs (On-Hold Orders):**
  - Status = 0, ref_number != ""
  - List endpoint: `/api/transactions/on-hold`
  - Resume: Load transaction → Populate cart → Edit → Complete
- **Customer Orders:**
  - Status = 0, customer != "0", ref_number = ""
  - Customer places order, pays later
  - List endpoint: `/api/transactions/customer-orders`

**Nimbus POS Equivalent:**
- `orders` table with status = 'open'|'completed'|'void'
- `order_items` for line items

**Key Differences:**
- store-pos: Single transaction document (items array)
- Nimbus: Normalized (orders + order_items tables)

**Architectural Lesson:**
- "On-hold" transactions are useful for busy restaurants (start order, park, resume)
- Reference number enables quick tab lookup

---

### 6. Checkout & Payments

**store-pos:**
- **Payment Flow:**
  1. Cart populated (items added)
  2. Select customer (optional)
  3. Apply discount (optional, manual %)
  4. Calculate tax (fixed rate, from settings)
  5. Select payment method (Cash, Card)
  6. Enter payment amount (if cash, calculate change)
  7. Complete transaction → Save to transactions.db
  8. Print receipt (jspdf + print-js)
  9. Update inventory (decrement stock)
  10. Clear cart
- **Payment Methods:**
  - Cash (with change calculation)
  - Card (no integration, manual entry)
  - No multi-payment (single method per transaction)
- **Receipt Printing:**
  - Generate PDF (jspdf)
  - Send to printer (print-js)
  - ESC/POS thermal printer support

**Nimbus POS Equivalent:**
- `payments` table with payment processor integration
- Multi-payment support
- Cloud receipt rendering

**Key Differences:**
- store-pos: Manual payment entry, local printing
- Nimbus: Payment processor integration, cloud printing

**Architectural Lesson:**
- Local receipt printing requires PDF generation + print API
- Thermal printers use ESC/POS command language

---

### 7. Customer Management

**store-pos:**
- **Customers API:** `api/customers.js`
- **Customer Model:**
  ```javascript
  Customer {
    _id: int,
    name: string,
    email: string,
    phone: string,
    address: string
  }
  ```
- **Features:**
  - Add/edit/delete customers
  - Search customers (by name, phone, email)
  - Attach customer to transaction (order tracking)
  - View customer purchase history (filter transactions by customer)
- **No Loyalty/Credit:** Basic customer database only

**Nimbus POS Equivalent:**
- `customers` table with tenant scope
- Customer loyalty points, store credit

**Key Differences:**
- store-pos: Basic customer database (no loyalty)
- Nimbus: Advanced customer features (loyalty, credit)

**Architectural Lesson:**
- Basic customer database is sufficient for order tracking
- Loyalty/credit are value-add features (not essential)

---

### 8. Transaction History & Reporting

**store-pos:**
- **Transaction Filtering:**
  - By date range (daterangepicker)
  - By till (register)
  - By cashier (staff member)
  - By status (completed, on-hold, void)
- **Transaction List:**
  - Display all transactions (DataTables plugin)
  - Search by customer, ref number, amount
  - Export to CSV/Excel (DataTables export)
- **Reports (Basic):**
  - Daily sales summary (sum of completed transactions)
  - Cashier performance (sales by staff)
  - Till breakdown (sales by register)
  - No advanced analytics (charts, trends)

**Nimbus POS Equivalent:**
- `orders` table with filtering
- `daily_summaries` aggregate table
- Advanced analytics (charts, insights)

**Key Differences:**
- store-pos: Basic filtering and export
- Nimbus: Rich analytics and visualizations

**Architectural Lesson:**
- Date range filtering is essential for transaction history
- DataTables plugin provides search/sort/export out of box

---

### 9. Staff Permissions (RBAC)

**store-pos:**
- **Permission Model:**
  - Boolean flags per feature area
  - Permissions: inventory, customers, transactions, users, settings
- **Enforcement:**
  - Frontend-only (hide UI elements)
  - No backend permission checks (API is open)
- **Granularity:**
  - Feature-level (all-or-nothing per module)
  - No row-level or action-level permissions

**Nimbus POS Equivalent:**
- `user_roles` with granular permissions
- Backend permission checks (API route guards)

**Key Differences:**
- store-pos: Simple boolean permissions, frontend only
- Nimbus: Fine-grained RBAC, backend enforced

**Architectural Lesson:**
- Boolean permissions are simple but limited
- Backend enforcement is critical for security (frontend checks can be bypassed)

---

### 10. Categories

**store-pos:**
- **Categories API:** `api/categories.js`
- **Category Model:**
  ```javascript
  Category {
    _id: int,
    name: string
  }
  ```
- **Features:**
  - Add/edit/delete categories
  - Assign products to categories
  - Filter products by category (frontend)

**Nimbus POS Equivalent:**
- `categories` table with hierarchy support

**Key Differences:**
- store-pos: Flat category structure
- Nimbus: Nested categories (parent-child)

**Architectural Lesson:**
- Flat categories are sufficient for small catalogs
- Nested categories needed for large catalogs (department → category → subcategory)

---

### 11. Settings & Configuration

**store-pos:**
- **Settings API:** `api/settings.js`
- **Settings Model:**
  ```javascript
  Settings {
    store_name: string,
    store_address: string,
    store_phone: string,
    tax_rate: number,       // Percentage (e.g., 8.5 = 8.5%)
    currency_symbol: string,
    receipt_header: string,
    receipt_footer: string
  }
  ```
- **Configuration:**
  - Single settings document (no multi-tenant)
  - Loaded on app start
  - Editable via settings page

**Nimbus POS Equivalent:**
- `tenants` table with settings JSONB
- Per-tenant configuration

**Key Differences:**
- store-pos: Single-store settings
- Nimbus: Multi-tenant configuration

**Architectural Lesson:**
- Single settings document is simple for single-store
- Multi-tenant requires settings per tenant

---

## 🔄 Operational Flows

### Flow 1: Complete Sale with Barcode Scanner

```
1. Cashier scans barcode (USB scanner)
   └─→ Barcode sent as keyboard input
2. Frontend captures barcode → Search product:
   GET /api/inventory/products → Filter by barcode
3. Product found → Add to cart (frontend array)
4. Scan more items, repeat
5. Cart populated → Show subtotal
6. Cashier applies discount (optional):
   - Enter discount % → Recalculate total
7. Cashier selects payment method: Cash
8. Enter cash amount received: $50.00
9. Calculate change: $50.00 - $48.50 = $1.50
10. Click "Complete Sale"
11. Create transaction:
    POST /api/transactions
    {
      items: [...], subtotal, tax, discount, total,
      payment_method: "Cash", status: 1 (completed),
      cashier, till, date
    }
12. Transaction saved → NeDB writes to transactions.db
13. Update inventory:
    For each item: 
      - GET /api/inventory/product/:id
      - Decrement quantity
      - PUT /api/inventory/product (update stock)
14. Generate receipt (jspdf):
    - Store header (from settings)
    - Transaction details (items, total)
    - Store footer (from settings)
15. Print receipt (print-js → thermal printer)
16. Display change amount: $1.50
17. Clear cart → Return to main screen
```

**Key Operations:**
- Barcode scan → Product lookup
- Stock decrement (per item)
- Receipt generation (PDF)
- Thermal printing (ESC/POS)

---

### Flow 2: Hold Order (Open Tab)

```
1. Cashier starts order → Adds items to cart
2. Customer wants to continue shopping → Hold order
3. Cashier clicks "Hold Order" button
4. Enter reference number: "Table 5"
5. Create transaction:
   POST /api/transactions
   {
     items: [...], ref_number: "Table 5",
     status: 0 (on-hold), date
   }
6. Transaction saved (on-hold)
7. Clear cart
8. Customer returns later
9. Cashier clicks "Open Tabs"
10. List on-hold transactions:
    GET /api/transactions/on-hold
11. Display tabs with ref_number (e.g., "Table 5")
12. Cashier selects tab → Load transaction
13. Populate cart with items from transaction
14. Add more items or edit quantities (optional)
15. Proceed to checkout → Complete sale
16. Update transaction:
    PUT /api/transactions
    { status: 1 (completed), payment_method, ... }
17. Print receipt, update inventory
18. Clear cart
```

**Key Concept:**
- On-hold transactions enable multi-step orders
- Reference number allows quick lookup

---

### Flow 3: Customer Order (Pay Later)

```
1. Customer places order → Cashier enters items
2. Select customer:
   - Search customers: GET /api/customers?q=name
   - Select customer → Attach to transaction
3. Customer wants to pay later (credit customer)
4. Create transaction:
   POST /api/transactions
   {
     items: [...], customer: customer_id,
     status: 0 (pending), ref_number: "" (not on-hold),
     date
   }
5. Transaction saved (pending payment)
6. Customer returns later to pay
7. Cashier clicks "Customer Orders"
8. List pending customer orders:
   GET /api/transactions/customer-orders
9. Display orders by customer
10. Select order → Load transaction
11. Collect payment → Update transaction:
    PUT /api/transactions
    { status: 1 (completed), payment_method, ... }
12. Print receipt
```

**Key Concept:**
- Customer orders track credit sales (pay later)
- Filter: status = 0, customer != "0", ref_number = ""

---

## 🔌 Extension Points

### 1. Cloud Sync (Multi-Store)

**Current:** Local network only (file-based database)

**Extension Pattern:**
- Add cloud sync service (Firebase, Supabase, MongoDB Atlas)
- Sync NeDB → Cloud database (background job)
- Conflict resolution (last-write-wins or manual merge)

**Nimbus Application:**
- Nimbus is already cloud-first (Supabase)
- Could add offline mode with IndexedDB + sync queue

---

### 2. Payment Processor Integration

**Current:** Manual cash/card entry

**Extension Pattern:**
- Integrate Stripe Terminal or Square SDK
- Card reader connection (USB, Bluetooth)
- Payment processing via API

**Nimbus Application:**
- Already has Stripe/Square support
- Could add desktop card reader support

---

### 3. Kitchen Display System (KDS)

**Current:** No KDS integration

**Extension Pattern:**
- On transaction complete → Send to KDS (Socket.IO emit)
- KDS displays order items
- Order status updates (preparing → ready)

**Nimbus Application:**
- Nimbus already has SSE-based KDS

---

### 4. Advanced Inventory (Purchase Orders, FIFO)

**Current:** Simple stock tracking (quantity field)

**Extension Pattern:**
- Add purchase orders (receiving workflow)
- Implement FIFO costing (track cost per unit)
- Stock movements audit trail

**Nimbus Application:**
- Nimbus has `inventory_transactions` for audit trail
- Could add purchase order workflow

---

## 📊 File-Path Quick Index

| Feature Area | Key Files | Purpose |
|-------------|-----------|---------|
| **Electron Main** | `start.js` | Electron main process, window creation |
| **Express Server** | `server.js` | Express server initialization |
| **Transactions** | `api/transactions.js` | Transaction CRUD, on-hold, customer orders |
| **Inventory** | `api/inventory.js` | Product management, stock tracking |
| **Customers** | `api/customers.js` | Customer database CRUD |
| **Users** | `api/users.js` | Staff user management, permissions |
| **Categories** | `api/categories.js` | Product categories |
| **Settings** | `api/settings.js` | Store settings, tax rate, receipt config |
| **Frontend UI** | `index.html` | Main app HTML (loaded by Electron) |
| **Installer** | `installers/setupEvents.js` | Windows installer hooks |
| **Assets** | `assets/` | CSS, JS, images, plugins |
| **Uploads** | `public/uploads/product_image/` | Product image storage |

---

## 🧠 Concept Mapping to Nimbus POS

| store-pos Concept | Nimbus POS Equivalent | Notes |
|-------------------|----------------------|-------|
| **Electron App** | Web app (could add Electron wrapper) | Desktop vs cloud architecture |
| **NeDB Database** | PostgreSQL (Supabase) | Embedded NoSQL vs cloud SQL |
| **Express Server (embedded)** | Supabase Edge Functions / Next.js API | Local API vs cloud API |
| **Transaction** | `orders` table | Single document vs normalized tables |
| **On-Hold Transaction** | `orders` (status = 'open') | Hold order workflow |
| **Customer Order** | `orders` (status = 'pending_payment') | Pay later workflow |
| **Product** | `products` + `product_variants` | Flat product vs variant hierarchy |
| **Category** | `categories` table | Flat categories |
| **User** | `users` table | Staff user management |
| **Permissions** | `user_roles.permissions` JSONB | Boolean flags vs granular permissions |
| **Settings** | `tenants` settings JSONB | Single-store vs multi-tenant |
| **Till** | `locations.id` | Register/location tracking |
| **Cashier** | `users.id` (assigned to order) | Staff tracking |
| **Receipt Printing** | Cloud receipt rendering | Local PDF vs cloud HTML→PDF |
| **Barcode Scanner** | USB HID scanner or camera | Hardware integration |
| **Network Sync** | Supabase real-time subscriptions | File sync vs database sync |

---

## ✅ Copy Eligibility Statement

**License:** UNKNOWN (No LICENSE file)

**Eligibility:** ❌ **DO NOT COPY ANY CODE**

**Reasoning:**
- No explicit license = All rights reserved (proprietary)
- Copyright law assumes no permission without license
- Copying code could result in legal liability
- ChefCloud Nimbus POS must avoid copyright infringement

**Safe Usage:**
1. ✅ Study architecture and design patterns (high-level only)
2. ✅ Learn from Electron + NeDB approach (desktop POS pattern)
3. ✅ Document concepts in this MAP file
4. ✅ Implement features independently (clean-room)
5. ❌ Do NOT copy code snippets (even small ones)
6. ❌ Do NOT port API routes or database logic
7. ❌ Do NOT adapt algorithms

**If we need similar functionality:**
- Design the feature independently (no reference to this code)
- Implement from scratch using Nimbus architecture
- Test without referencing this repository
- Document our own implementation

---

## 🎓 Key Lessons for Nimbus POS

### 1. **Electron + NeDB for Desktop POS**
- **Lesson:** Desktop apps with embedded databases enable offline-first POS
- **Application:** If Nimbus needs offline desktop version, Electron + IndexedDB/NeDB
- **Example:** Electron shell → Next.js app → Local SQLite/NeDB for offline

### 2. **Embedded Express Server Pattern**
- **Lesson:** Express server inside Electron provides local API
- **Application:** Could run Nimbus backend locally (offline mode)
- **Example:** Electron main process → Express server → Local database

### 3. **Network File Sharing for Multi-PC POS**
- **Lesson:** NeDB files on network share enable multi-PC POS without cloud
- **Application:** SMB/CIFS shared database for local network POS
- **Example:** Server PC hosts database → Client PCs access via network path

### 4. **On-Hold Transactions (Open Tabs)**
- **Lesson:** Status flag + reference number enable hold/resume workflow
- **Application:** Nimbus already has this (orders with status = 'open')
- **Example:** "Table 5" → Hold order → Resume later

### 5. **Customer Orders (Pay Later)**
- **Lesson:** Separate workflow for credit customers (place order, pay later)
- **Application:** Add "pending_payment" status to Nimbus orders
- **Example:** B2B customer orders today → Pays on invoice terms (Net 30)

### 6. **Simple Permissions (Boolean Flags)**
- **Lesson:** Feature-level boolean permissions are simple RBAC
- **Application:** Nimbus has granular permissions, but boolean flags are easier for small teams
- **Example:** `{ inventory: true, users: false }` → Cashier can manage products, not users

### 7. **Receipt Printing (jspdf + print-js)**
- **Lesson:** Local receipt printing requires PDF generation + print API
- **Application:** Nimbus could add desktop printing via Electron
- **Example:** Generate PDF → Send to thermal printer (ESC/POS)

### 8. **Barcode Scanner (USB HID)**
- **Lesson:** USB scanners work as keyboard input (no special integration)
- **Application:** Nimbus desktop app can support USB scanners out of box
- **Example:** Scanner sends barcode as keystrokes → Input field captures

### 9. **Transaction Filtering (Date, Till, Cashier)**
- **Lesson:** Multi-dimensional filtering improves transaction lookup
- **Application:** Nimbus already has date filtering, could add till/cashier filters
- **Example:** Show all transactions for "Register 1" on "2024-12-26"

### 10. **Settings as Single Document**
- **Lesson:** Single settings document simplifies configuration (single-tenant)
- **Application:** Nimbus uses per-tenant settings (JSONB in tenants table)
- **Example:** `{ store_name, tax_rate, receipt_header }`

### 11. **Product Image Uploads (multer)**
- **Lesson:** File upload middleware enables product images
- **Application:** Nimbus uses Supabase Storage for images
- **Example:** Upload image → Store in `/uploads/products/` → Reference in database

### 12. **DataTables for Transaction History**
- **Lesson:** DataTables plugin provides search/sort/export out of box
- **Application:** Nimbus uses custom tables, but DataTables is powerful for admin
- **Example:** Transaction list with search, column sort, CSV export

### 13. **Socket.IO for Real-Time Sync**
- **Lesson:** WebSocket sync for multi-PC updates (order created → notify other PCs)
- **Application:** Nimbus uses Supabase subscriptions (similar pattern)
- **Example:** PC 1 creates order → PC 2 sees new order immediately

### 14. **Till-Level Tracking**
- **Lesson:** Track transactions by register/till (accountability)
- **Application:** Nimbus has `locations` table, could add till/register field
- **Example:** "Register 1" sold $5,000 today, "Register 2" sold $3,000

### 15. **Cashier-Level Tracking**
- **Lesson:** Track transactions by staff member (performance, accountability)
- **Application:** Nimbus already tracks orders by user (created_by)
- **Example:** "Alice" sold $2,000 today, "Bob" sold $1,500

---

## 🔍 Study Recommendations

**For Nimbus POS development team:**

1. **Electron Architecture:** Study if building desktop/offline version of Nimbus
2. **NeDB Embedded Database:** Learn file-based NoSQL for offline-first apps
3. **Network File Sharing:** Understand multi-PC POS with shared database
4. **On-Hold Workflow:** Review hold/resume order patterns
5. **Receipt Printing:** Study local printing (jspdf, print-js, ESC/POS)
6. **USB Barcode Scanners:** Learn keyboard wedge integration
7. **Boolean Permissions:** Consider simpler RBAC for small teams
8. **Transaction Filtering:** Study multi-dimensional filtering UX

**Critical Reminder:**
- ❌ Do NOT reference code from this repository
- ❌ Do NOT copy patterns directly
- ✅ Study concepts ONLY
- ✅ Implement independently

**Safe Approach:**
- Read this MAP document (architecture overview)
- Close repository files
- Design Nimbus features from scratch
- Implement without looking at store-pos code
- Test independently

---

## 📝 Conclusion

store-pos demonstrates a **desktop POS architecture** using **Electron + NeDB**, enabling offline-first, multi-PC operations on a local network. The **UNKNOWN license status** (no LICENSE file) means we must treat it as proprietary and avoid all code copying. However, the architectural concepts—especially **embedded database**, **local API server**, **network file sharing**, **on-hold transactions**, and **local receipt printing**—provide valuable design inspiration for Nimbus POS if we decide to build an offline-capable desktop version.

**Key Takeaway:** Desktop POS apps with embedded databases (NeDB, SQLite) enable offline operation and local network deployments, which are valuable for businesses without reliable internet. If Nimbus expands to offline/desktop, the Electron + embedded database pattern is a proven approach.

**Remember:** This is a reference for **architecture patterns ONLY**. All Nimbus POS features must be implemented independently, without copying any code from store-pos.
