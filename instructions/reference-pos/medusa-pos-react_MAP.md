# medusa-pos-react Architecture Map

**Repository:** https://github.com/pavlotsyhanok/medusa-pos-react  
**License:** UNKNOWN (❌ Assume proprietary/all rights reserved)  
**Version Analyzed:** Commit `6fd9df1` (pos/develop branch)  
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
- Learn high-level patterns (file organization, module structure)
- Do NOT reference specific code implementations
- Implement features independently from scratch

---

## 📋 Executive Summary

**What it is:** A React-based web POS application designed for **B2B flows**, built on top of Medusa backend API. Features Stripe POS terminal integration, Progressive Web App (PWA) support for mobile/tablet/desktop, and specialized B2B workflows (customer groups, price lists, pre-orders).

**Why study it (architecture only):**
- **B2B-focused POS** - Unique customer group pricing, credit limits
- **Stripe Terminal integration** - Physical card reader integration pattern
- **PWA architecture** - Single codebase for mobile/tablet/desktop
- **Modular design** - Feature-based module structure
- **Draft order workflow** - Pre-orders, backorders, fund authentication
- **Sales rep analytics** - Performance tracking and goal setting

**Best for learning:**
- B2B POS architecture (vs retail)
- Stripe Terminal integration patterns
- PWA for cross-platform POS
- Modular React app structure (modules/ directory)
- Customer group pricing (price lists)
- Pre-order/backorder workflows
- Sales representative tracking

**Not ideal for:**
- Code reference (no license = proprietary)
- Multi-tenancy patterns (single-tenant focus)
- Cash drawer management (card-focused)

---

## 🏗️ Technology Stack

### Frontend
- **Framework:** React 18.3 (web-based PWA)
- **Router:** React Router DOM 6.23
- **Build:** Vite 5.2
- **UI Library:** Medusa UI 4.0 (Medusa's component library)
- **Icons:** Medusa Icons 2.1
- **State Management:** React Query 4.36 (TanStack Query)
- **API Client:** medusa-react 9.0.18 (official Medusa hooks) + axios
- **Styling:** TailwindCSS 3.4 (with Medusa UI preset)
- **Payment:** Stripe JS 4.9 + Stripe React Elements 2.8

### Backend (Medusa)
- **Backend:** Medusa v1.20 (headless commerce API)
- **Database:** PostgreSQL (via Medusa)
- **API:** Medusa REST API (Admin + Store routes)

### Mobile/Desktop
- **PWA:** vite-plugin-pwa 0.20 (Progressive Web App)
- **Native Wrappers:** CapacitorJS 6.0 (planned for device APIs)
- **Future:** React Native (noted in roadmap)

### Key Integrations
- **Payment Hardware:** Stripe Terminal (POS card readers)
- **Barcode:** Scanner integration (implementation not visible in structure)

---

## 📁 Directory Structure

```
medusa-pos-react/
├── src/
│   ├── modules/                    # Feature modules ⭐
│   │   ├── login/                  # Authentication
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── registration/           # Customer registration (in-store)
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── main-page/              # Main POS interface
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── shopping-pannel/        # Product catalog/cart
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── cart/               # Cart sub-module
│   │   │   └── product-grid/       # Product display
│   │   ├── checkout/               # Checkout flow
│   │   │   ├── components/
│   │   │   │   ├── PaymentForm.tsx
│   │   │   │   ├── CustomerInfo.tsx
│   │   │   │   └── OrderSummary.tsx
│   │   │   ├── hooks/
│   │   │   └── terminal/           # Stripe Terminal integration
│   │   ├── draft-orders/           # Draft order management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── list/               # Draft order list
│   │   ├── draft-orders-notes/     # Draft order notes
│   │   ├── existing-customers/     # Customer lookup
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── type-of-customers/      # Customer type selector (B2B/B2C)
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── credit-card/            # Credit card processing
│   │   │   └── components/
│   │   ├── customer-order-notes/   # Order notes
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── terminals/              # Terminal management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── connection/         # Terminal connection
│   │   │   ├── reader-display/     # Display management
│   │   │   └── payment/            # Payment processing
│   │   └── success/                # Success screen
│   │       └── components/
│   ├── components/                 # Shared UI components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── lib/                        # Utilities and helpers
│   │   ├── api/                    # API clients
│   │   ├── hooks/                  # Global hooks
│   │   └── utils/                  # Helper functions
│   ├── routes/                     # Route definitions
│   │   └── index.tsx
│   ├── app/                        # App initialization
│   │   └── App.tsx
│   ├── styles/                     # Global styles
│   └── test/                       # Tests
│       └── component/
├── public/
│   └── coming-soon/                # Marketing assets
│       ├── thumbnail-image.jpg
│       ├── preview.png
│       ├── pos-layout.png
│       └── pos-flows.png
├── docs/                           # Documentation
├── package.json
├── vite.config.ts                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── capacitor.config.ts             # CapacitorJS config (planned)
└── README.md
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Authentication & Authorization

**medusa-pos-react:**
- **Method:** Medusa Admin authentication (session-based)
- **Implementation:**
  - Login module (`modules/login/`)
  - Admin user credentials (email/password)
  - Session cookie stored in browser
  - Route protection via auth context
- **No RBAC Visible:** Admin-level access (no granular permissions shown)
- **Security:** Admin login → Full POS access

**Nimbus POS Equivalent:**
- JWT-based auth (Supabase)
- Role-based access control
- Tenant-scoped permissions

**Key Differences:**
- medusa-pos-react: Admin-level auth (single role)
- Nimbus: Multi-role, tenant-scoped

**Architectural Lesson:**
- Admin authentication is simplest for small teams
- RBAC needed for multi-cashier operations

---

### 2. B2B Customer Management

**medusa-pos-react:**
- **Customer Types Module:** `modules/type-of-customers/`
  - Guest checkout
  - B2B customer (with customer group)
  - B2C customer
- **Customer Registration:** `modules/registration/`
  - In-store new customer registration
  - Capture: Name, email, phone, company (B2B)
  - Store payment method (Stripe)
  - Assign customer group (for pricing)
- **Existing Customers:** `modules/existing-customers/`
  - Customer search/lookup
  - Load customer data (credit limit, price list)
  - View order history
- **Customer Groups:**
  - Wholesale, Retail, VIP (pricing tiers)
  - Applied price list per group
- **Credit Limits:**
  - B2B customers have credit limits
  - Enforce limit at checkout

**Nimbus POS Equivalent:**
- `customers` table with customer type
- `customer_groups` for pricing tiers (could add)
- Credit limit tracking

**Key Differences:**
- medusa-pos-react: Strong B2B focus (groups, credit limits)
- Nimbus: Simpler customer model (no groups yet)

**Architectural Lesson:**
- Customer groups enable tiered pricing (wholesale vs retail)
- Credit limits are essential for B2B (prevent over-extension)

---

### 3. Products & Pricing

**medusa-pos-react:**
- **Product Catalog:**
  - Product grid module (`modules/shopping-pannel/product-grid/`)
  - Search, filter, browse
  - Barcode scan (integration not visible)
- **Price Lists (B2B):**
  - Customer group-specific pricing
  - Wholesale prices vs retail prices
  - Price list applied based on customer selection
- **Variants:**
  - Size, color, etc. (standard Medusa variants)
- **Inventory:**
  - Stock availability checks
  - Prevent overselling

**Nimbus POS Equivalent:**
- `products` + `product_variants`
- Could add price list support for customer groups

**Key Differences:**
- medusa-pos-react: Price list architecture (B2B)
- Nimbus: Single price per product (retail focus)

**Architectural Lesson:**
- Price lists enable dynamic pricing (customer-specific)
- B2B often requires wholesale pricing tier

---

### 4. Shopping Cart & Draft Orders

**medusa-pos-react:**
- **Shopping Panel:** `modules/shopping-pannel/`
  - Cart sub-module (`cart/`)
  - Add/remove items
  - Quantity adjustment
  - Apply discounts (manual or coupon)
- **Draft Orders:** `modules/draft-orders/`
  - Save cart as draft order (hold, quote)
  - Resume draft order later
  - Draft order notes (`modules/draft-orders-notes/`)
  - Draft order list view
- **Pre-Orders & Backorders:**
  - Authenticate payment method (Stripe)
  - Store payment method for future charge
  - Order status: Pending → Pre-Order → Fulfilled
- **Cart Features:**
  - Line-level discounts
  - Order-level discounts (coupon)
  - Shipping quotes (based on Medusa backend)

**Nimbus POS Equivalent:**
- `orders` with status = 'draft'|'open'|'completed'
- Cart in frontend state

**Key Differences:**
- medusa-pos-react: Draft orders are first-class (B2B quotes)
- Nimbus: Simpler draft model (hold orders)

**Architectural Lesson:**
- Draft orders are powerful for B2B (quotes, approvals)
- Payment method storage enables pre-orders (charge later)

---

### 5. Checkout & Payments

**medusa-pos-react:**
- **Checkout Module:** `modules/checkout/`
  - Customer info capture
  - Payment form (Stripe Elements)
  - Order summary (items, tax, total)
  - Discount application
  - Shipping selection (if applicable)
- **Stripe Terminal Integration:** `modules/terminals/`
  - **Terminal connection** (`terminals/connection/`)
    - Discover Stripe readers (Bluetooth, USB, WiFi)
    - Connect to reader
    - Display connection status
  - **Payment processing** (`terminals/payment/`)
    - Collect payment via terminal
    - Process card transaction
    - Handle errors (declined, timeout)
  - **Reader display** (`terminals/reader-display/`)
    - Update terminal display (amount, status)
    - Customer-facing screen
- **Credit Card Module:** `modules/credit-card/`
  - Card input (manual entry, if no terminal)
  - Save payment method (for pre-orders)
- **Payment Methods:**
  - Card (Stripe Terminal or manual)
  - Stored payment method (pre-orders)
  - Cash (if supported, not visible in structure)

**Nimbus POS Equivalent:**
- `payments` table
- Stripe/Square integration
- Multi-payment support

**Key Differences:**
- medusa-pos-react: Stripe Terminal focus (physical readers)
- Nimbus: Multiple payment processors (Stripe, Square, Cash)

**Architectural Lesson:**
- Stripe Terminal integration requires:
  1. Reader discovery (Bluetooth/USB/WiFi)
  2. Connection management (reader connection/disconnection)
  3. Payment collection (collectPaymentMethod API)
  4. Display updates (customer-facing screen)
- Stored payment methods enable pre-order workflow

---

### 6. Order Management

**medusa-pos-react:**
- **Order Tracking:**
  - Order history (completed orders)
  - Draft orders (quotes, pre-orders)
  - Order status: Draft → Pending → Processing → Fulfilled
- **Order Notes:** `modules/customer-order-notes/`
  - Add notes to orders (customer requests, special instructions)
  - Internal notes (staff communication)
- **Order Operations:**
  - View order details
  - Reorder (copy previous order to cart)
  - Refunds/returns (likely handled in Medusa Admin)

**Nimbus POS Equivalent:**
- `orders` table with status workflow
- Order notes in `order_items.notes` or separate table

**Key Differences:**
- Similar order management structure
- medusa-pos-react has dedicated notes module

**Architectural Lesson:**
- Order notes are valuable for B2B (special instructions)
- Draft → Pending → Fulfilled workflow is standard

---

### 7. Discounts & Promotions

**medusa-pos-react:**
- **Discount Application:**
  - Manual discounts (cashier applies %)
  - Coupon codes (customer provides)
  - Price list discounts (customer group-based)
- **Discount Types:**
  - Line-level (per item)
  - Order-level (entire cart)
  - Percentage or fixed amount
- **Promotion Rules:**
  - Likely managed in Medusa backend (promotion engine)

**Nimbus POS Equivalent:**
- `promotions` table
- Manual discount in order_items

**Key Differences:**
- medusa-pos-react: Relies on Medusa promotion engine
- Nimbus: Custom promotion logic

**Architectural Lesson:**
- Separation of discount types (manual vs automatic vs coupon)

---

### 8. Sales Representative Analytics

**medusa-pos-react:**
- **Sales Rep Tracking:**
  - Track sales by representative (mentioned in README)
  - Performance metrics (sales volume, conversion rate)
  - Goal setting (configurable targets)
- **Analytics (Planned):**
  - Scoring system for sales reps
  - Leaderboards (gamification)
- **Implementation:** Not visible in current codebase (roadmap item)

**Nimbus POS Equivalent:**
- Could add `sales_rep` field to orders
- Analytics dashboard for performance

**Key Differences:**
- medusa-pos-react: B2B sales rep focus (commission tracking)
- Nimbus: General POS (no rep tracking yet)

**Architectural Lesson:**
- Sales rep tracking is critical for B2B (commission, performance)
- Configurable goals drive sales behavior

---

### 9. Terminals & Hardware Management

**medusa-pos-react:**
- **Terminals Module:** `modules/terminals/`
  - Manage Stripe Terminal readers
  - Connection lifecycle (connect → use → disconnect)
  - Reader discovery (list available readers)
  - Reader display updates (show amount, status)
- **Payment Hardware:**
  - Stripe Reader S700 (WiFi/Bluetooth)
  - BBPOS WisePad 3 (mobile)
  - Verifone P400 (countertop)
- **Connection Flow:**
  1. Discover readers (scan for Bluetooth/WiFi)
  2. Select reader
  3. Connect to reader
  4. Monitor connection status
  5. Use for payment
  6. Disconnect when done

**Nimbus POS Equivalent:**
- Could add terminal management module
- Stripe Terminal SDK integration

**Key Differences:**
- medusa-pos-react: Dedicated terminal management
- Nimbus: Payment processor integration (no dedicated terminal module)

**Architectural Lesson:**
- Terminal management requires dedicated module (complex lifecycle)
- Reader discovery UI is essential (select from multiple readers)
- Connection status monitoring prevents errors

---

### 10. Progressive Web App (PWA)

**medusa-pos-react:**
- **PWA Features:**
  - Install on device (mobile, tablet, desktop)
  - Offline support (service worker)
  - App-like experience (no browser chrome)
- **Configuration:** `vite-plugin-pwa`
  - Manifest file (app name, icon, theme)
  - Service worker (cache assets)
  - Offline fallback page
- **Platforms:**
  - Mobile (iOS Safari, Android Chrome)
  - Tablet (iPad, Android tablets)
  - Desktop (Chrome, Edge, Safari)

**Nimbus POS Equivalent:**
- Could add PWA support (Next.js + next-pwa)

**Key Differences:**
- medusa-pos-react: PWA-first (single codebase for all platforms)
- Nimbus: Web app (could add PWA features)

**Architectural Lesson:**
- PWA enables cross-platform deployment (no app store)
- Service worker caching improves performance
- Install prompt drives adoption (feels like native app)

---

## 🔄 Operational Flows

### Flow 1: B2B Checkout with Stripe Terminal

```
1. Select customer type: B2B
2. Search existing customer → Select customer
   └─→ Load customer group → Apply wholesale price list
3. Browse products (product grid)
4. Add items to cart → Prices reflect wholesale discount
5. Add more items
6. Apply coupon (optional) → Additional discount
7. Navigate to checkout
8. Review order summary (items, prices, tax, total)
9. Select payment method: Card (Stripe Terminal)
10. Connect to Stripe Terminal reader:
    - Discover readers → List available
    - Select reader → Connect
    - Reader displays "Ready"
11. Collect payment:
    - Terminal displays amount on customer screen
    - Customer inserts/taps card
    - Terminal processes payment
    - Payment approved → Return to app
12. Complete order:
    - POST to Medusa API (create order)
    - Order ID returned
13. Show success screen (order number)
14. Option: Email receipt to customer
15. Disconnect terminal reader
16. Clear cart, return to main screen
```

**Key Steps:**
- Customer selection → Price list applied
- Terminal connection → Reader discovery
- Payment collection → Stripe Terminal SDK
- Order completion → Medusa API

---

### Flow 2: Pre-Order/Backorder with Payment Authentication

```
1. Customer selects out-of-stock item (backorder)
2. Add to cart (backorder flag)
3. Navigate to checkout
4. Payment method: Store card for future charge
5. Enter card details (Stripe Elements)
6. Authenticate payment method:
   - Stripe creates PaymentMethod
   - No charge (just authorization)
   - Store PaymentMethod ID with order
7. Create draft order (status: Pre-Order)
8. When stock arrives:
   - Admin charges stored PaymentMethod
   - Order status → Fulfilled
9. Customer notified (email)
```

**Key Concept:**
- Payment method storage (charge later)
- Pre-order status (pending fulfillment)

---

### Flow 3: Draft Order (Quote) Workflow

```
1. Customer browses products
2. Adds items to cart
3. Customer wants to think about purchase
4. Cashier saves as draft order:
   - POST to Medusa API (create draft order)
   - Draft order ID returned
   - Add notes (customer name, callback date)
5. Draft order saved to list
6. Customer returns later (same day or next day)
7. Cashier loads draft orders list
8. Search for customer's draft
9. Resume draft order → Load cart
10. Customer approves → Proceed to checkout
11. Complete order (convert draft to order)
```

**Key Concept:**
- Draft orders as quotes/hold orders
- Resume later (multi-session workflow)

---

## 🔌 Extension Points

### 1. Square Terminal Integration

**Current:** Stripe Terminal only

**Extension Pattern:**
- Create `modules/terminals/square/` module
- Implement Square Terminal SDK
- Adapter pattern for payment terminals (Stripe vs Square)

**Nimbus Application:**
- Multi-processor terminal support
- User selects payment processor in settings

---

### 2. Barcode Scanner Hardware

**Current:** Implementation not visible

**Extension Pattern:**
- USB HID barcode scanner (keyboard wedge)
- Camera-based scanning (PWA camera API)
- Dedicated scanner module

**Nimbus Application:**
- Similar barcode scanning architecture

---

### 3. Kitchen Display System (KDS)

**Current:** No KDS integration

**Extension Pattern:**
- WebSocket connection to KDS
- Order items sent on completion
- Real-time status updates

**Nimbus Application:**
- SSE for KDS (Nimbus already has this)

---

### 4. Sales Rep Reporting Dashboard

**Current:** Planned (not implemented)

**Extension Pattern:**
- `modules/analytics/` module
- Sales rep performance metrics
- Goal tracking, leaderboards

**Nimbus Application:**
- Daily summaries by staff member
- Performance analytics

---

## 📊 File-Path Quick Index

| Feature Area | Key Module/Directory | Purpose |
|-------------|---------------------|---------|
| **Authentication** | `src/modules/login/` | Admin login, session management |
| **Customer Registration** | `src/modules/registration/` | In-store new customer signup |
| **Customer Lookup** | `src/modules/existing-customers/` | Search, select existing customers |
| **Customer Type** | `src/modules/type-of-customers/` | B2B/B2C/Guest selector |
| **Main POS UI** | `src/modules/main-page/` | Primary POS interface |
| **Product Grid** | `src/modules/shopping-pannel/product-grid/` | Product catalog, search |
| **Shopping Cart** | `src/modules/shopping-pannel/cart/` | Cart management |
| **Checkout** | `src/modules/checkout/` | Checkout flow, payment |
| **Stripe Terminal** | `src/modules/terminals/` | Terminal connection, payment |
| **Terminal Connection** | `src/modules/terminals/connection/` | Reader discovery, connect |
| **Terminal Payment** | `src/modules/terminals/payment/` | Payment processing |
| **Terminal Display** | `src/modules/terminals/reader-display/` | Customer-facing display |
| **Credit Card** | `src/modules/credit-card/` | Manual card entry |
| **Draft Orders** | `src/modules/draft-orders/` | Draft order management |
| **Draft Order Notes** | `src/modules/draft-orders-notes/` | Notes on drafts |
| **Customer Order Notes** | `src/modules/customer-order-notes/` | Order-specific notes |
| **Success Screen** | `src/modules/success/` | Order confirmation |
| **Shared Components** | `src/components/` | Reusable UI components |
| **API Utilities** | `src/lib/api/` | API client, helpers |

---

## 🧠 Concept Mapping to Nimbus POS

| medusa-pos-react Concept | Nimbus POS Equivalent | Notes |
|--------------------------|----------------------|-------|
| **Medusa Admin Auth** | Supabase Auth | Admin-level login |
| **Customer Groups** | Not implemented (could add) | B2B pricing tiers |
| **Price Lists** | Not implemented (could add) | Group-specific pricing |
| **Draft Orders** | `orders` (status = 'draft') | Hold orders, quotes |
| **Pre-Orders** | Not implemented | Backorder workflow |
| **Stripe Terminal** | Payment processor integration | Card reader hardware |
| **Payment Method Storage** | Stripe PaymentMethod storage | For pre-orders |
| **B2B Customer** | `customers.customer_type` | Customer segmentation |
| **Credit Limit** | Not implemented (could add) | B2B credit tracking |
| **Sales Rep** | Not implemented (could add) | Track by staff member |
| **Order Notes** | `order_items.notes` or separate | Special instructions |
| **PWA** | Not implemented (could add) | Progressive Web App |
| **Medusa React Hooks** | Custom React Query hooks | API state management |
| **Vite Build** | Next.js build | Modern bundler |

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
1. ✅ Study architecture and module structure (high-level only)
2. ✅ Learn from design patterns (folder organization, module separation)
3. ✅ Document concepts in this MAP file
4. ✅ Implement features independently (clean-room)
5. ❌ Do NOT copy code snippets (even small ones)
6. ❌ Do NOT port components or functions
7. ❌ Do NOT adapt algorithms

**If we need similar functionality:**
- Design the feature independently (no reference to this code)
- Implement from scratch using Nimbus architecture
- Test without referencing this repository
- Document our own implementation

---

## 🎓 Key Lessons for Nimbus POS

### 1. **B2B Customer Group Pricing**
- **Lesson:** Price lists per customer group enable wholesale/retail pricing
- **Application:** Add customer groups to Nimbus for tiered pricing
- **Example:** Wholesale group gets 20% off retail prices

### 2. **Credit Limit Enforcement**
- **Lesson:** B2B customers need credit limits (prevent over-extension)
- **Application:** Add `credit_limit` to customers table, enforce at checkout
- **Example:** Customer has $10,000 credit limit, order $2,000 → Approved

### 3. **Draft Order as Quote**
- **Lesson:** Draft orders serve as quotes in B2B (not just hold orders)
- **Application:** Enhance Nimbus draft orders with quote workflow
- **Example:** Customer gets quote → Approves later → Convert to order

### 4. **Stripe Terminal Integration Pattern**
- **Lesson:** Terminal management requires dedicated module (connection, payment, display)
- **Application:** If adding Stripe Terminal to Nimbus, create terminal module
- **Example:** Discover readers → Connect → Collect payment → Disconnect

### 5. **Payment Method Storage (Pre-Orders)**
- **Lesson:** Store payment method for future charge (backorders, subscriptions)
- **Application:** Add payment method storage for Nimbus pre-orders
- **Example:** Customer orders out-of-stock item → Store card → Charge when available

### 6. **Sales Rep Performance Tracking**
- **Lesson:** B2B POS needs sales rep analytics (commission, goals)
- **Application:** Add `sales_rep_id` to orders, build analytics dashboard
- **Example:** Rep A sold $50,000 this month, goal $60,000 (83% to goal)

### 7. **Order Notes for Custom Requests**
- **Lesson:** B2B orders often have special instructions (notes field is critical)
- **Application:** Add order notes to Nimbus
- **Example:** "Deliver to warehouse, attention: John Smith"

### 8. **PWA for Cross-Platform Deployment**
- **Lesson:** PWA enables single codebase for mobile/tablet/desktop
- **Application:** Add PWA manifest to Nimbus for installable app
- **Example:** Cashier installs on iPad → App icon on home screen

### 9. **Modular Architecture (Feature Modules)**
- **Lesson:** Feature-based modules improve code organization
- **Application:** Organize Nimbus by feature (checkout/, orders/, customers/)
- **Example:** `modules/checkout/` contains all checkout-related code

### 10. **Medusa Integration Pattern**
- **Lesson:** Headless commerce backend simplifies POS development
- **Application:** Nimbus could integrate with Medusa, Shopify, WooCommerce
- **Example:** Use Medusa as backend, Nimbus as POS frontend

---

## 🔍 Study Recommendations

**For Nimbus POS development team:**

1. **B2B Workflows:** Study customer group pricing, credit limits (if targeting B2B)
2. **Stripe Terminal:** Review terminal integration pattern (if adding card readers)
3. **PWA Architecture:** Learn PWA benefits (if expanding to mobile/tablet)
4. **Draft Order Workflow:** Understand quote/pre-order use cases
5. **Modular Structure:** Study feature-based module organization
6. **Sales Rep Tracking:** Review performance analytics (if adding staff tracking)
7. **Payment Method Storage:** Learn Stripe PaymentMethod API (for pre-orders)
8. **Order Notes:** Study note management patterns

**Critical Reminder:**
- ❌ Do NOT reference code from this repository
- ❌ Do NOT copy patterns directly
- ✅ Study concepts ONLY
- ✅ Implement independently

**Safe Approach:**
- Read this MAP document (architecture overview)
- Close repository files
- Design Nimbus features from scratch
- Implement without looking at medusa-pos-react code
- Test independently

---

## 📝 Conclusion

medusa-pos-react demonstrates a **B2B-focused web POS** architecture with **Stripe Terminal integration**, **customer group pricing**, and **PWA deployment**. The **UNKNOWN license status** (no LICENSE file) means we must treat it as proprietary and avoid all code copying. However, the architectural concepts—especially **B2B customer groups**, **credit limits**, **draft orders as quotes**, and **Stripe Terminal patterns**—provide valuable design inspiration for Nimbus POS if we decide to expand into B2B markets or add card reader support.

**Remember:** This is a reference for **architecture patterns ONLY**. All Nimbus POS features must be implemented independently, without copying any code from medusa-pos-react.
