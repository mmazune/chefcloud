# medusa-pos-starter Architecture Map

**Repository:** https://github.com/Agilo/medusa-pos-starter  
**License:** MIT (✅ Safe for reference and inspiration)  
**Version Analyzed:** Commit `7d44f9b` (master branch)  
**Last Updated:** 2025-12-26

---

## 📋 Executive Summary

**What it is:** A lightweight, mobile-first POS application built with **Expo/React Native**, designed to connect directly to Medusa v2 Admin REST API. Runs on iOS/Android tablets and phones, providing in-store sales functionality without requiring backend modifications.

**Why study it:**
- **MIT license** - Safe to reference and learn from
- **Mobile-first architecture** - Expo + React Native (cross-platform)
- **Medusa v2 integration** - Headless commerce POS extension
- **Modern React patterns** - Expo Router, React Query, React Hook Form
- **Offline-ready** - AsyncStorage persistence, optimistic updates
- **Zero backend changes** - Uses existing Medusa Admin API

**Best for learning:**
- Mobile POS architecture (tablet/phone optimized)
- Headless commerce integration (Medusa.js)
- Expo Router file-based routing
- React Query for API state management
- Setup wizard UX (first-run configuration)
- Barcode scanning (device camera)
- Draft order workflow (Medusa API pattern)
- Region/sales channel selection

**Not ideal for:**
- Complex cash drawer management (simplified model)
- Multi-register operations (single-device focus)
- Kitchen display integration (no KDS)
- Advanced inventory features (relies on Medusa backend)

---

## 🏗️ Technology Stack

### Frontend (Mobile App)
- **Framework:** Expo SDK 54 + React Native 0.81
- **Routing:** Expo Router 6.0 (file-based routing)
- **UI Framework:** NativeWind 4.2 (Tailwind for React Native)
- **Icons:** Lucide React Native
- **State Management:** React Query 5.80 (TanStack Query)
- **Form Handling:** React Hook Form 7.58 + Zod validation
- **API Client:** Medusa JS SDK 2.10.2
- **Persistence:** AsyncStorage + React Query Persist

### Medusa Backend (Required)
- **Backend:** Medusa v2 (headless commerce platform)
- **Database:** PostgreSQL (via Medusa)
- **API:** REST API (Medusa Admin routes)
- **Auth:** Medusa Admin authentication (email/password)

### Key Libraries
- **Camera:** expo-camera (barcode scanning)
- **Search:** fuse.js (fuzzy search)
- **Haptics:** expo-haptics (tactile feedback)
- **Secure Storage:** expo-secure-store (credentials)
- **Carousel:** react-native-reanimated-carousel
- **Toast:** react-native-toast-message
- **Date Picker:** react-native-ui-datepicker

### Platforms
- **iOS:** 15.0+
- **Android:** 11+ (API level 30+)
- **Web:** Progressive Web App (via Expo)

---

## 📁 Directory Structure

```
medusa-pos-starter/
├── app/                          # Expo Router pages ⭐
│   ├── (tabs)/                   # Tab navigator
│   │   ├── index.tsx             # Products tab (main POS)
│   │   ├── cart.tsx              # Shopping cart
│   │   └── orders.tsx            # Order history
│   ├── checkout/                 # Checkout flow
│   │   └── [draftOrderId].tsx    # Checkout screen (dynamic route)
│   ├── orders/                   # Order details
│   │   └── [orderId].tsx         # Order detail view
│   ├── settings/                 # App settings
│   │   └── index.tsx             # Region/channel selection, logout
│   ├── login.tsx                 # Medusa Admin login
│   ├── setup-wizard.tsx          # Initial setup (region, sales channel)
│   ├── customer-lookup.tsx       # Customer search/add
│   ├── product-details.tsx       # Product variant selection
│   ├── _layout.tsx               # Root layout (auth check)
│   └── +not-found.tsx            # 404 page
├── components/                   # Reusable UI components
│   ├── ui/                       # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── form/                     # Form components
│   │   └── FormField.tsx
│   ├── setup-wizard/             # Wizard steps
│   │   ├── RegionStep.tsx
│   │   ├── SalesChannelStep.tsx
│   │   └── StockLocationStep.tsx
│   ├── icons/                    # Custom icons
│   └── skeletons/                # Loading states
├── contexts/                     # React contexts
│   ├── CartContext.tsx           # Shopping cart state
│   ├── AuthContext.tsx           # Authentication state
│   └── ConfigContext.tsx         # App configuration (region, etc.)
├── hooks/                        # Custom React hooks
│   ├── api/                      # API query hooks
│   │   ├── useProducts.ts
│   │   ├── useOrders.ts
│   │   ├── useCustomers.ts
│   │   └── useDraftOrder.ts
│   ├── useCart.ts                # Cart operations
│   └── useAuth.ts                # Auth operations
├── maestro/                      # API layer (Medusa SDK wrapper) ⭐
│   └── pos/
│       ├── client.ts             # Medusa SDK instance
│       ├── products.ts           # Product queries
│       ├── orders.ts             # Order/draft order operations
│       ├── customers.ts          # Customer operations
│       └── auth.ts               # Authentication
├── utils/                        # Utility functions
│   ├── currency.ts               # Price formatting
│   ├── barcode.ts                # Barcode parsing
│   └── validation.ts             # Zod schemas
├── constants/                    # App constants
│   └── config.ts                 # Default configuration
├── assets/                       # Static assets
│   ├── images/
│   └── fonts/
├── config/                       # Expo config
│   └── app.config.ts             # App.json alternative
├── package.json                  # Dependencies
├── tailwind.config.js            # NativeWind config
└── README.md
```

---

## 🎯 Core Domain Mappings to Nimbus POS

### 1. Authentication & Authorization

**medusa-pos-starter:**
- **Method:** Medusa Admin authentication (email + password)
- **Implementation:**
  ```typescript
  // maestro/pos/auth.ts
  const login = async (email: string, password: string) => {
    const response = await medusaClient.admin.auth.createSession({
      email, password
    });
    await SecureStore.setItemAsync('session_token', response.token);
  };
  ```
- **Session Storage:** expo-secure-store (encrypted on device)
- **Auth Flow:**
  1. User enters email/password
  2. POST to `/admin/auth` → JWT token
  3. Store token in SecureStore
  4. Attach token to all API requests (Authorization header)
  5. Refresh on expiry (handled by Medusa SDK)
- **No RBAC:** Uses Medusa Admin permissions (admin users only)

**Nimbus POS Equivalent:**
- Supabase Auth (JWT-based)
- `users` table with role assignments
- Tenant-scoped auth

**Key Differences:**
- medusa-pos-starter: Single-tenant admin login
- Nimbus: Multi-tenant with RBAC

**Architectural Lesson:**
- Medusa Admin API requires admin-level auth (not customer-facing)
- Secure token storage is critical for mobile (expo-secure-store)

---

### 2. Setup Wizard (Initial Configuration)

**medusa-pos-starter:**
- **Flow:**
  1. **Region Selection** - Choose currency/tax region (US, EU, etc.)
  2. **Sales Channel Selection** - Choose channel (POS, Online, Wholesale)
  3. **Stock Location Selection** - Choose warehouse/store location
- **Implementation:**
  - Wizard shown on first launch (if no config in AsyncStorage)
  - User selections stored in AsyncStorage
  - All subsequent API calls scoped to selected region/channel/location
- **Config Storage:**
  ```typescript
  // AsyncStorage
  {
    region_id: "reg_01HXXX",
    sales_channel_id: "sc_01HYYY",
    stock_location_id: "sloc_01HZZZ"
  }
  ```

**Nimbus POS Equivalent:**
- Initial device setup (select tenant, location)
- Store in local storage or device config

**Key Differences:**
- medusa-pos-starter: Per-device configuration
- Nimbus: Per-user/tenant configuration

**Architectural Lesson:**
- Setup wizard improves onboarding UX
- Region/channel selection is critical for multi-region merchants

---

### 3. Products & Catalog

**medusa-pos-starter:**
- **Model:** Medusa `Product` + `ProductVariant`
- **Structure:**
  ```typescript
  Product {
    id, title, description, thumbnail,
    variants: [
      { id, title, prices: [ { amount, currency_code } ], inventory_quantity }
    ],
    options: [ { id, title, values } ], // e.g., Size: S/M/L
    collection, tags, categories
  }
  ```
- **Features:**
  - Product search (fuzzy with fuse.js)
  - Barcode scan → product lookup (by SKU or barcode field)
  - Variant selection (size, color, etc.)
  - Image display (thumbnail + gallery)
  - Stock availability check (per variant, per location)
- **API Queries:**
  - `GET /admin/products` (list with search/filter)
  - `GET /admin/products/:id` (single product with variants)
- **Pricing:** Region-specific prices (Medusa price lists)

**Nimbus POS Equivalent:**
- `products` + `product_variants` tables
- Barcode scanning via product.barcode
- Tenant-scoped products

**Key Differences:**
- medusa-pos-starter: Headless commerce product model (rich metadata)
- Nimbus: POS-optimized product model

**Architectural Lesson:**
- Variant selection UX is critical (show options as buttons/swatches)
- Region-based pricing simplifies multi-currency

---

### 4. Shopping Cart

**medusa-pos-starter:**
- **State Management:** React Context + AsyncStorage persistence
- **Cart Structure:**
  ```typescript
  Cart {
    draft_order_id: string | null,  // Medusa draft order ID
    items: [
      { variant_id, quantity, unit_price, product }
    ],
    customer_id: string | null,
    region_id, sales_channel_id,
    discounts: [ { code, amount } ],
    shipping_methods: [],
    totals: { subtotal, tax, total }
  }
  ```
- **Operations:**
  - Add item → Update local cart state
  - Change quantity → Recalculate totals
  - Remove item → Update state
  - Apply discount code → Validate with Medusa API
  - Attach customer → Update cart context
- **Persistence:** AsyncStorage (survives app restart)
- **Sync with Medusa:** Cart converted to draft order on checkout

**Nimbus POS Equivalent:**
- Cart in React state (frontend) + `orders` (backend draft)
- `order_items` for line items

**Key Differences:**
- medusa-pos-starter: Local cart → draft order on checkout
- Nimbus: Server-side cart (orders table with status=draft)

**Architectural Lesson:**
- Client-side cart is fast for mobile (no network latency)
- Sync to server on checkout (atomic operation)

---

### 5. Customer Lookup & Management

**medusa-pos-starter:**
- **Model:** Medusa `Customer`
- **Features:**
  - Search customers (by name, email, phone)
  - Add new customer (quick form: name, email, phone)
  - Attach customer to cart/order
  - View customer order history (past orders)
- **API Queries:**
  - `GET /admin/customers?q=search_term` (search)
  - `POST /admin/customers` (create)
  - `GET /admin/customers/:id/orders` (order history)
- **UI Flow:**
  1. Tap "Add Customer" button
  2. Search modal appears
  3. Type name/email → Fuzzy search results
  4. Select customer → Attach to cart
  5. Or: Tap "New Customer" → Quick create form

**Nimbus POS Equivalent:**
- `customers` table with tenant scope
- Customer search/create in POS UI

**Key Differences:**
- Similar architecture
- medusa-pos-starter has simpler customer model (no loyalty, no credit)

**Architectural Lesson:**
- Quick customer creation is essential (don't interrupt checkout flow)
- Search by phone is critical (customers may not remember email)

---

### 6. Draft Orders & Checkout

**medusa-pos-starter:**
- **Medusa Draft Order Pattern:**
  1. Cart items accumulated locally
  2. On checkout → Create Medusa draft order:
     ```typescript
     POST /admin/draft-orders
     {
       region_id, sales_channel_id,
       items: [ { variant_id, quantity } ],
       customer_id, discounts, shipping_methods
     }
     ```
  3. Draft order created with status `open`
  4. Navigate to checkout screen (`/checkout/[draftOrderId]`)
  5. Payment collection (in-app or external)
  6. Complete draft order:
     ```typescript
     POST /admin/draft-orders/:id/complete
     ```
  7. Draft order converted to Order (status `pending`)
  8. Order fulfillment triggered (if configured)

**Nimbus POS Equivalent:**
- `orders` table with status = 'open' (active order)
- Finalize → status = 'completed', create invoice

**Key Differences:**
- medusa-pos-starter: Draft order → Order (Medusa workflow)
- Nimbus: Order → Invoice (direct)

**Architectural Lesson:**
- Draft orders are useful for quote/layaway scenarios
- Medusa's draft order API handles tax/discount calculations server-side

---

### 7. Payments

**medusa-pos-starter:**
- **Payment Collection:**
  - **Manual entry** (cash, card terminal) - No integration shown
  - **Payment amount input** - User enters amount
  - **Payment method selection** - Cash, Card, Other
  - **No payment processor integration** in starter (placeholder for Stripe Terminal, etc.)
- **Payment Recording:**
  - Draft order completion assumes payment collected externally
  - Payment details added to draft order before completion
- **Multi-payment:** Not shown (single payment method per order)

**Nimbus POS Equivalent:**
- `payments` table with payment processor integration
- Stripe/Square/Cash payments
- Multi-payment support

**Key Differences:**
- medusa-pos-starter: Placeholder (payment integration left to merchant)
- Nimbus: Full payment processing (Stripe, Square)

**Architectural Lesson:**
- Mobile POS often integrates with external card readers (Stripe Terminal, Square)
- Payment flow: Amount entry → External reader → Confirmation

---

### 8. Order Management & History

**medusa-pos-starter:**
- **Order List:**
  - Fetch completed orders: `GET /admin/orders`
  - Filter by date range (date picker)
  - Filter by status (pending, completed, canceled)
  - Display: Order number, date, customer, total, status
- **Order Details:**
  - View line items, payments, fulfillment status
  - No refund/return UI (would use Medusa Admin for that)
- **UI:**
  - FlashList (optimized for long lists)
  - Pull-to-refresh
  - Infinite scroll (pagination)

**Nimbus POS Equivalent:**
- `orders` table with filtering
- Order history in POS UI

**Key Differences:**
- Similar architecture
- medusa-pos-starter relies on Medusa Admin for advanced order ops (refunds, etc.)

**Architectural Lesson:**
- Date range filtering is essential for order history
- FlashList (or RecyclerView) for performance with large datasets

---

### 9. Barcode Scanning

**medusa-pos-starter:**
- **Implementation:** expo-camera (device camera)
- **Flow:**
  1. Tap barcode icon → Camera modal opens
  2. Point camera at barcode
  3. expo-camera detects barcode → Fires callback
  4. Search products by barcode (SKU or custom barcode field)
  5. Add product to cart automatically
  6. Close camera modal
- **Supported Formats:** EAN-13, Code-128, QR (via expo-camera)
- **Haptic Feedback:** Vibration on successful scan (expo-haptics)

**Nimbus POS Equivalent:**
- Camera-based scanning (mobile)
- USB scanner support (desktop)

**Key Differences:**
- Similar mobile scanning approach
- Nimbus may need USB HID scanner support for desktop

**Architectural Lesson:**
- Camera scanning is seamless on mobile (no external hardware)
- Haptic feedback improves UX (confirms scan)

---

### 10. Inventory Management

**medusa-pos-starter:**
- **Inventory:** Managed by Medusa backend
- **Stock Checks:**
  - `GET /admin/inventory-items?variant_id=X&location_id=Y`
  - Display stock availability per variant, per location
  - Prevent overselling (check stock before adding to cart)
- **No POS-side Inventory Ops:** Stock adjustments done in Medusa Admin
- **Real-time Stock:** API calls on product load (not cached)

**Nimbus POS Equivalent:**
- `inventory_transactions` for stock movements
- Real-time stock checks

**Key Differences:**
- medusa-pos-starter: Read-only inventory (managed externally)
- Nimbus: POS can adjust inventory (receiving, counts)

**Architectural Lesson:**
- Headless POS relies on backend for inventory authority
- Stock checks should be real-time (prevent overselling)

---

### 11. Offline Support & Data Persistence

**medusa-pos-starter:**
- **Persistence Layer:**
  - **AsyncStorage:** Cart data, app config (region, channel)
  - **React Query Persist:** API response caching
- **Offline Handling:**
  - Products/customers cached via React Query
  - Cart persisted locally
  - Orders require network (draft order creation)
- **Sync Strategy:**
  - On app open → Refresh cached data
  - On network restore → Retry failed mutations
- **No Offline Queue:** Orders not queued for offline submission

**Nimbus POS Equivalent:**
- IndexedDB for local cart
- Offline queue for order submission
- Service worker for PWA offline

**Key Differences:**
- medusa-pos-starter: Limited offline (read-only cache)
- Nimbus: Full offline queue (submit when online)

**Architectural Lesson:**
- Mobile apps benefit from aggressive caching (React Query)
- AsyncStorage for critical data (cart, config)
- Offline order submission requires queue + sync logic

---

## 🔄 Operational Flows

### Flow 1: Complete Sale with Barcode Scan

```
1. Cashier taps "Scan Barcode" button
2. Camera modal opens (expo-camera)
3. Scan product barcode → Barcode detected
4. Search products: GET /admin/products?barcode=12345
5. Product found → Add to cart (local state)
6. Repeat for more items
7. Tap "Checkout" button
8. Customer lookup modal (optional)
   └─→ Search customer by name/phone
   └─→ Select customer → Attach to cart
9. Tap "Proceed to Payment"
10. Create draft order:
    POST /admin/draft-orders { items, customer_id, region_id }
    └─→ Draft order ID returned
11. Navigate to /checkout/[draftOrderId]
12. Display order summary (items, tax, total)
13. Select payment method (Cash, Card)
14. Enter payment amount
15. Tap "Complete Order"
16. Complete draft order:
    POST /admin/draft-orders/:id/complete
    └─→ Order created (status: pending)
17. Show success screen with order number
18. Clear cart (local state)
19. Return to products tab
```

**Key API Calls:**
- `GET /admin/products?barcode=X` - Product lookup
- `GET /admin/customers?q=name` - Customer search
- `POST /admin/draft-orders` - Create draft order
- `POST /admin/draft-orders/:id/complete` - Finalize order

---

### Flow 2: Setup Wizard (First Launch)

```
1. User opens app for first time
2. Check AsyncStorage for config → Not found
3. Navigate to /setup-wizard
4. Step 1: Region Selection
   - Fetch regions: GET /admin/regions
   - Display list (US, EU, etc.)
   - User selects region → Store in state
5. Step 2: Sales Channel Selection
   - Fetch sales channels: GET /admin/sales-channels
   - Display list (POS, Online, Wholesale)
   - User selects channel → Store in state
6. Step 3: Stock Location Selection
   - Fetch stock locations: GET /admin/stock-locations
   - Display list (Store #1, Warehouse, etc.)
   - User selects location → Store in state
7. Tap "Complete Setup"
8. Save config to AsyncStorage:
   { region_id, sales_channel_id, stock_location_id }
9. Navigate to /login
10. User logs in with Medusa Admin credentials
11. Navigate to /(tabs) → Products tab (main POS)
```

**Key Storage:**
- AsyncStorage: `{ region_id, sales_channel_id, stock_location_id }`
- SecureStore: `{ session_token }`

---

### Flow 3: Order History Filtering

```
1. User taps "Orders" tab
2. Fetch orders: GET /admin/orders?limit=20&offset=0
3. Display orders in FlashList (optimized list)
4. User taps "Filter by Date"
5. Date picker modal opens (react-native-ui-datepicker)
6. User selects date range (start, end)
7. Apply filter:
   GET /admin/orders?created_at[gte]=2024-01-01&created_at[lte]=2024-12-31
8. Update order list with filtered results
9. User taps order → Navigate to /orders/[orderId]
10. Display order details:
    - Line items (product, qty, price)
    - Customer info
    - Payment details
    - Fulfillment status
11. Back to order list
```

**Key UX:**
- Pull-to-refresh (refresh order list)
- Infinite scroll (load more orders)
- Date range picker (essential for history)

---

## 🔌 Extension Points

### 1. Payment Processor Integration

**Current:** Manual payment entry (no processor)

**Extension Pattern:**
```typescript
// hooks/api/usePayment.ts
const processPayment = async (amount: number, method: PaymentMethod) => {
  if (method === 'stripe_terminal') {
    // Stripe Terminal SDK integration
    const result = await StripeTerminal.collectPayment(amount);
    return result;
  } else if (method === 'square') {
    // Square SDK integration
    const result = await Square.processPayment(amount);
    return result;
  }
  // Default: manual entry
  return { success: true, method };
};
```

**Nimbus Application:**
- Similar adapter pattern for payment processors
- Stripe Terminal for mobile card readers
- Square for integrated POS systems

---

### 2. Printer Integration (Receipts)

**Current:** No receipt printing

**Extension Pattern:**
- **iOS/Android:** Use bluetooth printer (e.g., Star Micronics)
- **Library:** `react-native-star-prn` or `@react-native-community/print`
- **Receipt Template:** React component → ESC/POS commands

**Nimbus Application:**
- Cloud-based receipt rendering (HTML → PDF → print)
- Mobile: Bluetooth printer integration
- Desktop: USB printer support

---

### 3. Kitchen Display System (KDS) Integration

**Current:** No KDS integration

**Extension Pattern:**
- On order completion → POST to KDS webhook
- KDS displays order items for preparation
- Real-time updates via WebSocket (Medusa Subscriber)

**Nimbus Application:**
- SSE for real-time KDS updates
- Order status: `pending` → `preparing` → `ready` → `completed`

---

### 4. Loyalty Program

**Current:** No loyalty features (Medusa doesn't have built-in loyalty)

**Extension Pattern:**
- Custom loyalty service (external)
- On order complete → Award points (API call)
- Customer lookup → Display points balance
- Redemption → Apply discount code

**Nimbus Application:**
- `customer_loyalty` table
- Points earning/redemption in POS UI

---

## 📊 File-Path Quick Index

| Feature Area | Key Files | Purpose |
|-------------|-----------|---------|
| **Main POS UI** | `app/(tabs)/index.tsx` | Product grid, search, barcode scan |
| **Cart View** | `app/(tabs)/cart.tsx` | Shopping cart display, quantity adjustment |
| **Checkout** | `app/checkout/[draftOrderId].tsx` | Checkout flow, payment, order completion |
| **Order History** | `app/(tabs)/orders.tsx` | Order list with filters |
| **Order Details** | `app/orders/[orderId].tsx` | Single order view |
| **Customer Lookup** | `app/customer-lookup.tsx` | Customer search/create modal |
| **Product Details** | `app/product-details.tsx` | Variant selection, add to cart |
| **Setup Wizard** | `app/setup-wizard.tsx` | Initial configuration (region, channel, location) |
| **Login** | `app/login.tsx` | Medusa Admin authentication |
| **Settings** | `app/settings/index.tsx` | Region/channel change, logout |
| **Cart Context** | `contexts/CartContext.tsx` | Global cart state management |
| **Auth Context** | `contexts/AuthContext.tsx` | Authentication state, token management |
| **Config Context** | `contexts/ConfigContext.tsx` | App configuration (region, channel, location) |
| **Medusa Client** | `maestro/pos/client.ts` | Medusa SDK instance, API config |
| **Product Queries** | `maestro/pos/products.ts` | Product search, fetch, barcode lookup |
| **Order Operations** | `maestro/pos/orders.ts` | Draft order creation, completion |
| **Customer Queries** | `maestro/pos/customers.ts` | Customer search, create |
| **Auth Methods** | `maestro/pos/auth.ts` | Login, logout, session management |

---

## 🧠 Concept Mapping to Nimbus POS

| medusa-pos-starter Concept | Nimbus POS Equivalent | Notes |
|----------------------------|----------------------|-------|
| **Medusa Admin Auth** | Supabase Auth | Medusa uses admin login; Nimbus uses tenant-scoped auth |
| **Draft Order** | `orders` (status = 'open') | Medusa's draft order is pre-order quote |
| **Order** | `orders` (status = 'completed') | Finalized order |
| **Product Variant** | `product_variants` | SKU-level product |
| **Region** | Tenant-level currency/tax config | Medusa's region = multi-currency support |
| **Sales Channel** | Location or channel grouping | POS, Online, Wholesale |
| **Stock Location** | `locations.id` (inventory location) | Warehouse/store |
| **Customer** | `customers` table | Customer data |
| **AsyncStorage** | localStorage (web) or IndexedDB | Client-side persistence |
| **React Query Persist** | Custom cache layer | API response caching |
| **Expo Router** | Next.js App Router | File-based routing |
| **expo-camera** | Browser WebRTC (web) or native camera | Barcode scanning |
| **expo-secure-store** | Encrypted localStorage or Keychain | Secure token storage |
| **FlashList** | react-window or virtuoso | Optimized list rendering |
| **Medusa JS SDK** | Custom API client (fetch/axios) | API wrapper |

---

## ✅ Copy Eligibility Statement

**License:** MIT License

**Eligibility:** ✅ **SAFE FOR REFERENCE AND INSPIRATION**

**Reasoning:**
- MIT is a permissive open-source license
- Allows copying, modification, and commercial use
- Only requires attribution in source distributions
- ChefCloud Nimbus POS can learn from and adapt code patterns

**Safe Usage:**
1. ✅ Study architecture and design patterns
2. ✅ Learn from code structure and organization
3. ✅ Adapt React Native patterns to web/desktop
4. ✅ Reference API integration patterns
5. ✅ Use as inspiration for mobile POS UX
6. ⚠️ If copying substantial code, include MIT license notice
7. ⚠️ Adapt for Nimbus architecture (don't copy-paste blindly)

**Recommended Usage:**
- Study file structure and routing (Expo Router → Next.js App Router)
- Learn React Query patterns for API state
- Adapt cart context pattern to Nimbus state management
- Reference barcode scanning approach (camera integration)
- Learn from setup wizard UX (onboarding flow)

---

## 🎓 Key Lessons for Nimbus POS

### 1. **Setup Wizard for Onboarding**
- **Lesson:** Multi-step wizard improves first-run experience
- **Application:** Nimbus device setup (select tenant, location, printer)
- **Example:** Region → Sales Channel → Stock Location (3-step flow)

### 2. **File-Based Routing (Expo Router)**
- **Lesson:** File-based routing simplifies navigation structure
- **Application:** Next.js App Router for Nimbus web app
- **Example:** `app/checkout/[draftOrderId].tsx` → dynamic route

### 3. **React Query for API State**
- **Lesson:** React Query handles caching, loading, error states elegantly
- **Application:** Use in Nimbus frontend for API calls
- **Example:** `useQuery(['products'], fetchProducts)` with auto-refetch

### 4. **AsyncStorage + React Query Persist**
- **Lesson:** Layered persistence (config in AsyncStorage, API cache in React Query)
- **Application:** IndexedDB for cart, localStorage for config
- **Example:** Cart survives app restart, API cache reduces network calls

### 5. **Camera-Based Barcode Scanning**
- **Lesson:** Device camera replaces dedicated scanner on mobile
- **Application:** Nimbus mobile app with camera scanner
- **Example:** expo-camera or WebRTC (browser) for barcode detection

### 6. **Headless Commerce Integration**
- **Lesson:** POS can be thin client to headless backend (Medusa, Shopify, etc.)
- **Application:** Nimbus as POS for existing e-commerce platforms
- **Example:** Draft order API pattern (create → complete workflow)

### 7. **Region-Based Pricing**
- **Lesson:** Multi-currency support via region selection
- **Application:** Nimbus multi-currency for international merchants
- **Example:** Product prices differ by region (USD vs EUR)

### 8. **Sales Channel Scoping**
- **Lesson:** Products/inventory scoped to sales channel (POS vs Online)
- **Application:** Nimbus location-based product visibility
- **Example:** Store #1 sees different products than Store #2

### 9. **Draft Order Workflow**
- **Lesson:** Draft orders enable quotes, layaway, on-hold orders
- **Application:** Nimbus "hold order" feature (save for later)
- **Example:** Customer wants to think → Save draft → Resume later

### 10. **FlashList for Performance**
- **Lesson:** Optimized list rendering for large datasets (products, orders)
- **Application:** react-window or virtuoso for Nimbus order history
- **Example:** 10,000 orders → Only render visible rows

### 11. **Haptic Feedback for Mobile**
- **Lesson:** Vibration confirms actions (barcode scan, button press)
- **Application:** Nimbus mobile app with haptic feedback
- **Example:** Scan success → Short vibration

### 12. **Customer Quick Create**
- **Lesson:** Minimal form for fast customer creation (name, email, phone)
- **Application:** Nimbus quick customer form (don't interrupt checkout)
- **Example:** Modal with 3 fields → Create → Attach to order

### 13. **Date Range Filtering**
- **Lesson:** Date picker for order history filtering
- **Application:** Nimbus order history with date range
- **Example:** react-native-ui-datepicker or date-fns range picker

### 14. **Pull-to-Refresh Pattern**
- **Lesson:** Mobile UX pattern for refreshing data
- **Application:** Nimbus mobile order list
- **Example:** Pull down → Refresh orders

### 15. **NativeWind for Tailwind on Mobile**
- **Lesson:** Tailwind CSS utility classes work on React Native
- **Application:** Consistent styling between web/mobile Nimbus
- **Example:** `className="bg-blue-500 p-4"` works on iOS/Android

---

## 🔍 Study Recommendations

**For Nimbus POS development team:**

1. **Expo Router:** Study file-based routing (if building mobile app)
2. **React Query:** Learn caching and state management patterns
3. **Medusa Integration:** Understand headless commerce API patterns
4. **Draft Order Workflow:** Study quote/hold order use cases
5. **Camera Scanning:** Review expo-camera or WebRTC barcode scanning
6. **AsyncStorage Persistence:** Learn mobile offline-first patterns
7. **Setup Wizard UX:** Study multi-step onboarding flow
8. **FlashList Performance:** Understand virtual list rendering
9. **Region-Based Pricing:** Learn multi-currency architecture
10. **Sales Channel Scoping:** Study channel-based product filtering

**Safe to reference (MIT license):**
- ✅ Code structure and organization
- ✅ API integration patterns (Medusa SDK usage)
- ✅ React component patterns
- ✅ State management approach
- ✅ UI/UX flows (setup wizard, checkout)

---

## 📝 Conclusion

medusa-pos-starter demonstrates a **mobile-first, headless POS** architecture, leveraging Expo/React Native for cross-platform mobile apps and Medusa v2's Admin API for backend operations. The **MIT license** makes it safe for reference and inspiration, and the architectural patterns—especially **setup wizard**, **React Query caching**, **camera-based scanning**, and **draft order workflow**—provide valuable design guidance for Nimbus POS mobile expansion.

**Key Takeaway:** Headless commerce APIs (Medusa, Shopify) can power POS frontends without custom backend development, making this a viable pattern for Nimbus as a multi-platform POS solution.
