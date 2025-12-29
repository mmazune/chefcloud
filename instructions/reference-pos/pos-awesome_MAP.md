# pos-awesome Architecture Map

**Repository:** https://github.com/ucraft-com/POS-Awesome  
**License:** GPL-3.0 (⚠️ COPYLEFT - Reference only, DO NOT copy code)  
**Version Analyzed:** Commit `a86fd29` (develop branch)  
**Last Updated:** 2025-12-26

---

## ⚠️ CRITICAL LICENSE WARNING

**GPL-3.0 Copyleft License**

This repository is licensed under GPL-3.0, which requires that **any derivative works MUST also be licensed under GPL-3.0**.

**DO NOT:**
- ❌ Copy code from pos-awesome into Nimbus POS
- ❌ Adapt algorithms or business logic directly
- ❌ Use as a "code template" for implementation
- ❌ Port Vue components or Python functions

**DO:**
- ✅ Study the architecture and design patterns
- ✅ Learn from the Frappe/ERPNext integration approach
- ✅ Document concepts in your own words
- ✅ Implement solutions independently after study

**Clean-room protocol:**
1. Study this document (pos-awesome architecture)
2. Close all pos-awesome files
3. Design Nimbus feature from scratch
4. Implement without referencing pos-awesome code
5. Review differences after implementation

---

## 📋 Executive Summary

**What it is:** A Frappe/ERPNext-based POS application built with Python backend and Vue.js/Vuetify frontend. Designed as an extension/app for ERPNext, providing a modern POS interface on top of ERPNext's accounting, inventory, and ERP features.

**Why study it (architecture only):**
- **Frappe Framework integration** - Shows how to extend an existing ERP system with POS
- **DocType architecture** - ERPNext's document-based data modeling
- **Enqueue pattern** - Background job processing for invoice submission
- **Batch & serial number handling** - Advanced inventory tracking
- **Loyalty & promotions** - Customer rewards and offer engine
- **Mobile payment integration** - M-Pesa payment gateway
- **Offline-first considerations** - Draft orders and local caching

**Best for learning:**
- Building POS on top of existing ERP (ERPNext patterns)
- DocType-based architecture (declarative data models)
- Python API layer + Vue SPA structure
- Batch pricing and UOM-specific barcodes
- Weighted/scale products handling
- Customer credit notes and loyalty points
- POS offer engine (buy X get Y, discounts)
- Cash register opening/closing shifts

**Not ideal for:**
- Code reference (GPL license prevents copying)
- Standalone POS (requires full ERPNext deployment)
- Multi-tenancy (ERPNext single-tenant model)

---

## 🏗️ Technology Stack

### Backend
- **Framework:** Frappe Framework (Python 3.10+)
- **ERP System:** ERPNext Version 14
- **ORM:** Frappe ORM (document-based, not traditional SQL ORM)
- **Database:** MariaDB (via Frappe)
- **Background Jobs:** Frappe Queue (RQ - Redis Queue)
- **Architecture:** DocType + API methods (whitelisted endpoints)

### Frontend
- **Framework:** Vue.js 3
- **UI Library:** Vuetify 2.6.10
- **State Management:** Vue reactive data
- **Build:** Webpack (via Frappe build system)
- **Utilities:** Lodash 4.17.21

### Key Integrations
- **Payment:** M-Pesa mobile money (Kenya)
- **ERP Modules:** Accounts, Stock, Selling (ERPNext core)
- **Barcode:** Scanner integration via `onscan.js`
- **Printing:** Receipt printing via ERPNext print formats

### Key Libraries
- **Backend:** frappe, erpnext (dependencies)
- **Frontend:** vuetify, lodash

---

## 📁 Directory Structure

```
pos-awesome/
├── posawesome/                    # Main app directory
│   ├── config/                   # App configuration
│   │   ├── desktop.py            # Desktop icons/shortcuts
│   │   ├── pos_awesome.py        # POS-specific config
│   │   └── docs.py               # Documentation config
│   ├── posawesome/               # Core POS module
│   │   ├── api/                  # API endpoints (Python) ⭐
│   │   │   ├── posapp.py         # Main POS API (61KB - core logic)
│   │   │   ├── invoice.py        # Invoice operations (9KB)
│   │   │   ├── payment_entry.py  # Payment processing (16KB)
│   │   │   ├── customer.py       # Customer operations
│   │   │   ├── m_pesa.py         # M-Pesa integration
│   │   │   ├── status_updater.py # Order status updates
│   │   │   └── taxes.py          # Tax calculations
│   │   ├── doctype/              # Document types (data models) ⭐
│   │   │   ├── pos_opening_shift/      # Cash register opening
│   │   │   ├── pos_closing_shift/      # Cash register closing
│   │   │   ├── pos_offer/              # Promotional offers
│   │   │   ├── pos_coupon/             # Discount coupons
│   │   │   ├── referral_code/          # Referral system
│   │   │   ├── delivery_charges/       # Shipping fees
│   │   │   ├── mpesa_payment_register/ # M-Pesa logs
│   │   │   └── sales_invoice_reference/ # Invoice linking
│   │   ├── page/                 # Frappe pages
│   │   │   └── posapp/           # POS page definition
│   │   │       ├── posapp.js     # Page initialization
│   │   │       └── onscan.js     # Barcode scanner integration
│   │   └── workspace/            # Workspace definitions
│   ├── public/                   # Frontend assets
│   │   └── js/
│   │       └── posapp/
│   │           └── components/   # Vue components
│   │               └── pos/      # POS UI components
│   │                   ├── Pos.vue           # Main POS interface
│   │                   ├── Invoice.vue       # Invoice view
│   │                   ├── Payments.vue      # Payment modal
│   │                   ├── Drafts.vue        # Draft orders
│   │                   └── UpdateCustomer.vue # Customer selector
│   ├── fixtures/                 # Seed data
│   ├── templates/                # Jinja templates
│   └── translations/             # i18n files (multi-language)
├── package.json                  # Node dependencies
├── hooks.py                      # Frappe hooks (lifecycle events)
└── license.txt                   # GPL-3.0 license
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Authentication & Authorization

**pos-awesome:**
- **Method:** Frappe Framework session-based auth
- **Implementation:** ERPNext user authentication (username/password)
- **Sessions:** Server-side sessions via Frappe
- **API Auth:** Session cookies + CSRF tokens
- **Flow:**
  1. User logs into ERPNext
  2. POS app checks active session
  3. Verifies POS Profile permissions
  4. Opens POS interface for authorized users

**Nimbus POS Equivalent:**
- JWT-based auth with refresh tokens (Supabase Auth)
- Tenant-aware authentication
- `users` table with role assignments

**Key Differences:**
- pos-awesome: Session-based, tied to ERPNext user
- Nimbus: JWT stateless, multi-tenant

---

### 2. Role-Based Access Control (RBAC)

**pos-awesome:**
- **Model:** ERPNext role-permission system
- **Structure:**
  - Roles: Sales User, POS User, Cashier, etc.
  - Permissions: DocType-level (read/write/create/delete)
  - POS Profile: Limits access to specific profiles/registers
- **Key Roles:**
  - `POS User` - Can operate POS
  - `Accounts User` - Can close shifts, view payments
  - `Sales User` - Can create invoices, orders
- **Granularity:** DocType field-level permissions

**Nimbus POS Equivalent:**
- `user_roles` table with role assignments
- Permission strings in `roles.permissions` JSONB
- Tenant-scoped permissions

**Architectural Lesson:**
- POS Profile as permission boundary (similar to Nimbus "location" scoping)

---

### 3. Products & Inventory

**pos-awesome:**
- **Model:** ERPNext `Item` DocType (not POS-specific model)
- **Structure:**
  ```python
  # ERPNext Item (extended by pos-awesome)
  - item_code (barcode/SKU)
  - item_name
  - item_group (category)
  - stock_uom (base unit)
  - has_batch_no, has_serial_no
  - variant_of (template items)
  - barcodes[] (multiple barcodes per item)
    - barcode, uom, barcode_type
  ```
- **Advanced Features:**
  - **Batch-based pricing** - Different prices per batch
  - **UOM-specific barcodes** - Different barcodes for box/case/each
  - **Weighted products** - Scale items (price by weight)
  - **Template items** - Variants (size, color, etc.)
  - **Serial numbers** - Individual item tracking
- **Inventory Tracking:** Real-time stock via ERPNext Stock Ledger

**Nimbus POS Equivalent:**
- `products` table (single variant)
- `product_variants` for SKU-level tracking
- `inventory_transactions` for stock movements

**Key Differences:**
- pos-awesome: Centralized Item master (ERP model)
- Nimbus: POS-optimized product model

**Architectural Lesson:**
- Batch pricing is useful for perishables/expiring items
- UOM barcodes enable selling in different pack sizes

---

### 4. Shopping Cart & Orders

**pos-awesome:**
- **Draft State:** In-memory cart (Vue reactive state) until submission
- **Model:** ERPNext `Sales Invoice` (not "Order" - direct invoicing)
- **Cart Structure (Frontend):**
  ```javascript
  {
    items: [{
      item_code, qty, rate, amount,
      batch_no, serial_no,
      discount_percentage, discount_amount
    }],
    customer, payments[], taxes[],
    loyalty_points, coupon_code,
    delivery_charges
  }
  ```
- **Operations:**
  - Add item by barcode scan or search
  - Apply batch (FEFO logic - First Expiry First Out)
  - Apply serial numbers
  - Auto-calculate taxes
  - Apply offers/coupons
  - Hold order (save as draft)

**Nimbus POS Equivalent:**
- `orders` table with `status = 'draft'|'open'|'completed'`
- `order_items` for line items
- Cart in frontend state, persisted on server

**Key Differences:**
- pos-awesome: Direct Sales Invoice (skip order step)
- Nimbus: Order → finalize → invoice

**Architectural Lesson:**
- Direct invoicing is faster for retail (skip order intermediary)

---

### 5. Checkout & Payments

**pos-awesome:**
- **Flow:**
  1. Customer selection (optional for credit)
  2. Payment method selection (Cash, Card, Mobile Money, Credit)
  3. Multi-payment (split between methods)
  4. Submit invoice (enqueued background job)
  5. Print receipt
- **Payment Types:**
  - Cash (with change calculation)
  - Card (manual entry, no integration shown)
  - M-Pesa (API integration)
  - Customer Credit (against existing credit note)
- **Invoice Submission:**
  ```python
  # posapp.py - enqueue pattern
  enqueue(
      "posawesome.posawesome.api.invoice.submit_invoice",
      invoice_doc=invoice_doc,
      queue="short"
  )
  ```
- **Offline Support:** Drafts stored locally, submitted when online

**Nimbus POS Equivalent:**
- `payments` table with `order_id` FK
- Multiple payment methods per order
- Payment processor integrations (Stripe, Square)

**Key Differences:**
- pos-awesome: Enqueued submission (async)
- Nimbus: Synchronous payment processing

**Architectural Lesson:**
- Background invoice submission prevents UI blocking
- Multi-payment support is essential for retail

---

### 6. Customer Management

**pos-awesome:**
- **Model:** ERPNext `Customer` DocType
- **Features:**
  - Customer lookup (search by name/phone)
  - Customer groups (B2B, B2C, Wholesale)
  - Price list per customer/group
  - Credit limit tracking
  - Loyalty program enrollment
  - Credit note balance
- **API Methods:**
  - `get_customers()` - Search/filter
  - `get_customer_credit()` - Available credit
  - `get_loyalty_points()` - Rewards balance
- **Loyalty Points:**
  - Earned per transaction (configurable rate)
  - Redeemable for discount
  - Expiration dates

**Nimbus POS Equivalent:**
- `customers` table with tenant scope
- `customer_loyalty` for points
- `customer_credits` for store credit

**Key Differences:**
- pos-awesome: Full CRM integration (ERPNext)
- Nimbus: POS-focused customer data

**Architectural Lesson:**
- Customer-specific pricing (price lists) is powerful for B2B

---

### 7. Discounts & Promotions

**pos-awesome:**
- **POS Offer DocType:**
  - Offer types: Discount %, Fixed amount, Buy X Get Y, Item discount
  - Conditions: Min quantity, min amount, customer group
  - Auto-apply based on rules
- **POS Coupon DocType:**
  - Fixed code (e.g., "SAVE10")
  - One-time or multi-use
  - Customer-specific or public
- **Referral Code DocType:**
  - Referral tracking
  - Discount for referrer + referee
- **Manual Discount:**
  - Line-level or invoice-level
  - Percentage or fixed amount

**Nimbus POS Equivalent:**
- `promotions` table
- `discount_codes` for coupons
- Manual discount in `order_items.discount_amount`

**Key Differences:**
- pos-awesome: Rich offer engine with auto-apply
- Nimbus: Simpler promotion model

**Architectural Lesson:**
- Auto-apply offers improve checkout speed
- Separate offers from coupons (different UX)

---

### 8. Cash Register Management

**pos-awesome:**
- **POS Opening Shift DocType:**
  - Fields: user, pos_profile, opening_time, opening_amount
  - Cash denominations (coins/bills breakdown)
- **POS Closing Shift DocType:**
  - Fields: closing_time, expected_amount, actual_amount
  - Variance tracking (over/short)
  - Tax breakdown by type
  - Payment method breakdown
  - Print closing report
- **Workflow:**
  1. Cashier opens shift (declares starting cash)
  2. Transactions logged to shift
  3. Cashier closes shift (counts cash)
  4. System calculates variance
  5. Supervisor approves (if variance exceeds threshold)

**Nimbus POS Equivalent:**
- `cash_drawer_sessions` table
- `cash_movements` for deposits/withdrawals
- Session-level reconciliation

**Key Differences:**
- Similar architecture
- pos-awesome has denomination tracking

**Architectural Lesson:**
- Denomination tracking helps with cash handling accuracy

---

### 9. Inventory & Stock Management

**pos-awesome:**
- **Integration:** Full ERPNext Stock module
- **Features:**
  - Real-time stock levels per warehouse
  - Batch tracking (FEFO auto-selection)
  - Serial number tracking (individual items)
  - Stock reconciliation
  - Item bundling (sell kits as one item)
- **Stock Operations (via API):**
  - `get_item_stock()` - Check availability
  - `get_batch_qty()` - Batch balances
  - Auto-reserve stock on invoice creation
- **FEFO Logic:**
  - Automatically select batch with nearest expiry
  - Configurable in POS Profile

**Nimbus POS Equivalent:**
- `inventory_transactions` for stock movements
- Location-specific inventory
- Simple FIFO/LIFO costing

**Key Differences:**
- pos-awesome: Full ERP inventory (batches, serials, bundles)
- Nimbus: Lighter inventory model

**Architectural Lesson:**
- Batch tracking is critical for F&B (expiration)
- FEFO reduces waste

---

### 10. Reporting & Analytics

**pos-awesome:**
- **Built-in Reports (ERPNext):**
  - Sales Register
  - Item-wise Sales Register
  - Customer-wise Sales Register
  - Cashier Performance
  - Hourly Sales Analysis
- **POS Closing Reports:**
  - Shift summary (sales, payments, taxes)
  - Variance report
  - Export to Excel/PDF
- **No Real-time Dashboard:** Reporting is post-transaction

**Nimbus POS Equivalent:**
- `daily_summaries` aggregate table
- Custom reports via SQL views
- Real-time analytics (ChartJS/Recharts)

**Key Differences:**
- pos-awesome: ERP-style reports (batch, scheduled)
- Nimbus: Real-time analytics focus

**Architectural Lesson:**
- Shift-level summaries are valuable for accountability

---

## 🔄 Operational Flows

### Flow 1: Complete Checkout with Loyalty Points

```
1. Scan/search item → Add to cart (Vue state)
2. Apply batch (if batch item) → API: get_batch_no()
3. Add more items, repeat
4. Apply offer (auto) → API: check_offer_applicability()
5. Select customer → API: get_customer()
   └─→ Load loyalty points → API: get_loyalty_program_details()
6. Redeem points (optional) → Discount calculated
7. Apply coupon (optional) → API: check_coupon_code()
8. Select payment method(s) → Split payment
9. Submit invoice → API: submit_invoice()
   └─→ Background job: Create Sales Invoice + Payment Entry
   └─→ Update inventory (Stock Ledger Entry)
   └─→ Allocate loyalty points
10. Print receipt → ERPNext print format
11. Return to POS screen
```

**Key Operations:**
- `posapp.py:create_invoice()` - Main invoice creation
- `invoice.py:submit_invoice()` - Background submission
- `payment_entry.py:create_payment_entry()` - Payment recording

---

### Flow 2: POS Shift Closing

```
1. Cashier clicks "Close Shift"
2. System aggregates shift data:
   - Total sales count & amount
   - Payment breakdown (Cash, Card, Mobile)
   - Tax breakdown (VAT, etc.)
   - Returns/refunds
3. System calculates expected cash:
   = Opening cash + Cash sales - Cash refunds
4. Cashier counts physical cash → Enter actual amount
5. System calculates variance:
   = Actual - Expected
6. Generate closing report (PDF)
7. Submit POS Closing Shift doc
8. If variance > threshold → Notify supervisor
9. Lock POS until new shift opened
```

**Key Operations:**
- `posapp.py:get_closing_shift_data()` - Aggregate transactions
- DocType submission → Creates POS Closing Shift record

---

### Flow 3: Return/Refund Processing

```
1. Search original invoice → API: search_invoice()
2. Load invoice items
3. Select items to return (partial or full)
4. Specify reason (damaged, customer request, etc.)
5. Select refund method:
   - Cash refund
   - Customer credit note (for future purchases)
6. Create return invoice:
   - Negative Sales Invoice (qty = -1)
   - Link to original invoice
7. Process refund payment
8. Update inventory (return stock)
9. Print return receipt
```

**Key Operations:**
- `invoice.py:create_return_invoice()` - Return processing
- Inventory auto-updated via ERPNext Stock Ledger

---

## 🔌 Extension Points

### 1. Payment Gateway Integration

**Current:** M-Pesa only (Kenya mobile money)

**Extension Pattern:**
```python
# posawesome/posawesome/api/payment_gateway.py
@frappe.whitelist()
def process_payment(payment_method, amount, reference):
    if payment_method == "M-Pesa":
        return process_mpesa_payment(amount, reference)
    elif payment_method == "Stripe":
        return process_stripe_payment(amount, reference)
    # Add more gateways
```

**Nimbus Application:**
- Similar adapter pattern for payment processors
- Configurable per tenant/location

---

### 2. Custom Offer Rules

**Current:** Buy X Get Y, Percentage discount, Fixed discount

**Extension Pattern:**
- Create custom DocType: `Custom POS Offer Rule`
- Implement `apply_custom_offer()` method
- Hook into offer engine

**Nimbus Application:**
- Plugin-based promotion engine
- Custom rule DSL (e.g., "Buy 2 pizzas, get cheapest free")

---

### 3. Receipt Customization

**Current:** ERPNext print formats (Jinja templates)

**Extension Pattern:**
- Create custom print format
- Add fields to Sales Invoice (custom fields)
- Modify `posapp.py` to include custom data

**Nimbus Application:**
- React-based receipt templates
- Per-tenant receipt branding

---

### 4. Barcode Scanner Integration

**Current:** `onscan.js` library (keyboard wedge scanners)

**Extension Pattern:**
- Supports any USB HID barcode scanner
- Configurable scan prefix/suffix
- Custom barcode formats (e.g., EAN-13, Code-128)

**Nimbus Application:**
- Camera-based scanning (mobile)
- QR code support (customer lookup)

---

## 📊 File-Path Quick Index

| Feature Area | Key Files | Purpose |
|-------------|-----------|---------|
| **POS Main API** | `posawesome/posawesome/api/posapp.py` | Core POS logic (61KB), invoice creation, cart operations |
| **Invoice Operations** | `posawesome/posawesome/api/invoice.py` | Invoice submission, returns, PDF generation |
| **Payment Processing** | `posawesome/posawesome/api/payment_entry.py` | Payment entry creation, reconciliation |
| **Customer API** | `posawesome/posawesome/api/customer.py` | Customer search, loyalty points, credit |
| **Tax Calculation** | `posawesome/posawesome/api/taxes.py` | Tax computation logic |
| **M-Pesa Integration** | `posawesome/posawesome/api/m_pesa.py` | Mobile money payment gateway |
| **POS UI Component** | `posawesome/public/js/posapp/components/pos/Pos.vue` | Main POS interface (Vue) |
| **Payment Modal** | `posawesome/public/js/posapp/components/pos/Payments.vue` | Payment method selection UI |
| **Invoice View** | `posawesome/public/js/posapp/components/pos/Invoice.vue` | Invoice details display |
| **Drafts Manager** | `posawesome/public/js/posapp/components/pos/Drafts.vue` | Hold/resume orders |
| **POS Opening Shift** | `posawesome/posawesome/doctype/pos_opening_shift/` | Cash drawer opening DocType |
| **POS Closing Shift** | `posawesome/posawesome/doctype/pos_closing_shift/` | Cash drawer closing DocType |
| **POS Offer** | `posawesome/posawesome/doctype/pos_offer/` | Promotional offer DocType |
| **POS Coupon** | `posawesome/posawesome/doctype/pos_coupon/` | Discount coupon DocType |
| **Delivery Charges** | `posawesome/posawesome/doctype/delivery_charges/` | Shipping fee configuration |

---

## 🧠 Concept Mapping to Nimbus POS

| pos-awesome Concept | Nimbus POS Equivalent | Notes |
|---------------------|----------------------|-------|
| **Frappe DocType** | PostgreSQL table + TypeScript model | Frappe uses metadata-driven models; Nimbus uses SQL DDL |
| **Sales Invoice** | `orders` table (status = 'completed') | pos-awesome directly creates invoice; Nimbus has order → invoice |
| **POS Profile** | `locations` table + settings | Defines register, warehouse, price list |
| **Item** (ERPNext) | `products` + `product_variants` | ERPNext has unified item master |
| **Batch tracking** | Not implemented (could add to inventory) | Batch = lot number for expiring items |
| **Serial tracking** | Not implemented (could add) | Serial = individual item tracking (phones, laptops) |
| **Loyalty Program** | `customer_loyalty` table | Points earning/redemption |
| **Customer Credit Note** | `customer_credits` table | Store credit for returns |
| **POS Opening Shift** | `cash_drawer_sessions` (status = 'open') | Cash register opening |
| **POS Closing Shift** | `cash_drawer_sessions` (status = 'closed') | Cash reconciliation |
| **POS Offer** | `promotions` table | Auto-apply discounts |
| **POS Coupon** | `discount_codes` table | Manual coupon entry |
| **Referral Code** | Not implemented | Referral tracking system |
| **Delivery Charges** | Shipping fees in order | Distance/zone-based fees |
| **enqueue()** | Background jobs (Supabase Edge Functions or pg_cron) | Async processing |
| **M-Pesa payment** | Payment processor integration | Mobile money gateway |
| **Item Group** | `categories` table | Product categorization |
| **UOM (Unit of Measure)** | `product_variants.unit` | Box/Case/Each |
| **Weighted products** | `products.is_weighted` flag | Sold by weight (kg, lb) |
| **Template items** | `products` (parent) + `product_variants` | Variant hierarchy |

---

## ✅ Copy Eligibility Statement

**License:** GPL-3.0 (GNU General Public License v3.0)

**Eligibility:** ❌ **DO NOT COPY CODE**

**Reasoning:**
- GPL-3.0 is a **copyleft license** that requires derivative works to also be GPL-3.0
- Any code copied from pos-awesome would require Nimbus POS to be licensed as GPL-3.0
- GPL-3.0 is incompatible with proprietary or MIT-licensed projects
- ChefCloud Nimbus POS is a proprietary/commercial product

**Safe Usage:**
1. ✅ Study architecture and design patterns
2. ✅ Learn from business logic approach
3. ✅ Document concepts in this MAP file
4. ✅ Implement features independently (clean-room)
5. ❌ Do NOT copy code snippets
6. ❌ Do NOT port algorithms directly
7. ❌ Do NOT adapt Vue components

**If we need similar functionality:**
- Design the feature independently
- Implement from scratch using Nimbus architecture
- Test without referencing pos-awesome code
- Document our own implementation

---

## 🎓 Key Lessons for Nimbus POS

### 1. **Frappe DocType Pattern (Metadata-Driven Models)**
- **Lesson:** Declarative data models (JSON schema → DB schema) are powerful for extensibility
- **Application:** Consider schema-driven approach for custom fields per tenant
- **Example:** POS Offer DocType defines fields, validations, permissions in JSON

### 2. **Enqueue Pattern for Performance**
- **Lesson:** Background invoice submission prevents UI blocking during peak times
- **Application:** Use Supabase Edge Functions for async invoice finalization
- **Example:** `enqueue("submit_invoice")` returns immediately, job runs in background

### 3. **Batch Tracking for Perishables**
- **Lesson:** FEFO (First Expiry First Out) reduces waste for F&B
- **Application:** Add batch/lot tracking to Nimbus inventory
- **Example:** Auto-select batch expiring soonest when adding item to cart

### 4. **UOM-Specific Barcodes**
- **Lesson:** Different barcodes for pack sizes (box vs each) streamline checkout
- **Application:** Support multiple barcodes per product variant
- **Example:** Coke 24-pack has different barcode than single can

### 5. **Weighted Products**
- **Lesson:** Scale integration for bulk items (produce, deli)
- **Application:** Add `is_weighted` flag to products, integrate with POS scale
- **Example:** Scan barcode → Scale sends weight → Calculate price (weight × price_per_kg)

### 6. **Auto-Apply Offers**
- **Lesson:** Automatic promotion application improves checkout speed
- **Application:** Evaluate cart on each change, apply best offer
- **Example:** Customer adds 3 items → "Buy 2 Get 1 Free" auto-applies

### 7. **Multi-Payment Support**
- **Lesson:** Split payments are common in retail (cash + card)
- **Application:** Allow multiple payment records per order
- **Example:** $50 cash + $30.50 card = $80.50 total

### 8. **Shift-Level Accountability**
- **Lesson:** Cash drawer sessions with variance tracking improve accountability
- **Application:** Track expected vs actual cash, flag variances
- **Example:** Cashier counts $1,205.50, expected $1,200.00 → $5.50 over

### 9. **Denomination Tracking**
- **Lesson:** Breakdown of bills/coins helps with cash management
- **Application:** Optional denomination entry at shift close
- **Example:** 20×$20 + 10×$10 + 50×$1 = $600

### 10. **Customer-Specific Pricing**
- **Lesson:** Price lists per customer group (wholesale vs retail) are powerful
- **Application:** Add price list support to Nimbus (per customer tier)
- **Example:** B2B customer gets 20% off retail prices

### 11. **Loyalty Points Redemption**
- **Lesson:** In-cart loyalty redemption drives engagement
- **Application:** Show available points at checkout, allow redemption
- **Example:** 500 points = $5 discount

### 12. **Customer Credit Notes**
- **Lesson:** Return as store credit (vs cash refund) retains revenue
- **Application:** Track customer credit balance, allow usage at checkout
- **Example:** $20 return → Customer credit → Use on next purchase

### 13. **Referral System**
- **Lesson:** Referral codes drive customer acquisition
- **Application:** Add referral tracking, reward both parties
- **Example:** Referee gets 10% off, referrer earns $5 credit

### 14. **Offline-First Cart**
- **Lesson:** Local draft storage prevents data loss
- **Application:** IndexedDB for cart persistence
- **Example:** Network drops → Cart data safe → Resume when online

### 15. **ERPNext Integration Model**
- **Lesson:** Building POS on top of ERP provides rich features (but adds complexity)
- **Application:** Nimbus is standalone, but could integrate with ERP via API
- **Example:** Sync inventory/invoices to QuickBooks/Xero via webhook

---

## 🔍 Study Recommendations

**For Nimbus POS development team:**

1. **Batch/Lot Tracking:** Study ERPNext batch architecture (if implementing food safety features)
2. **FEFO Logic:** Understand automatic batch selection algorithm (if adding expiration tracking)
3. **Offer Engine:** Review offer applicability rules (for advanced promotions)
4. **M-Pesa Integration:** Learn mobile money patterns (for emerging market expansion)
5. **Denomination Tracking:** Study cash drawer denomination UI/UX (for cash management)
6. **Template Items:** Understand variant hierarchy (for complex product catalogs)
7. **Referral System:** Review referral tracking implementation (for growth features)
8. **Background Jobs:** Study enqueue pattern (for performance optimization)

**Do NOT:**
- Copy code from pos-awesome
- Port Python functions to TypeScript directly
- Adapt Vue components

**DO:**
- Document concepts in your own words
- Design features independently
- Implement using Nimbus architecture patterns
- Test without referencing pos-awesome code

---

## 📝 Conclusion

pos-awesome demonstrates a mature **ERP-integrated POS** architecture, leveraging Frappe/ERPNext's document-based modeling, background job processing, and extensive inventory features. While the GPL-3.0 license prevents code copying, the architectural patterns—especially **batch tracking**, **FEFO logic**, **auto-apply offers**, and **shift-level accountability**—provide valuable design inspiration for Nimbus POS.

**Remember:** This is a reference for **architecture study only**. All Nimbus POS features must be implemented independently, without copying code from pos-awesome.
