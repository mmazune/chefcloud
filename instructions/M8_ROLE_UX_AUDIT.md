# M8 Role UX Audit: Full Product Review

**Date:** 2024-12-24  
**Milestone:** M8 - Role-Based UI Redesign (Phase A: Audit)  
**Purpose:** Comprehensive audit of all roles, UI surfaces, and mismatches  
**Status:** 🔍 AUDIT COMPLETE

---

## Executive Summary

### Critical Finding: **Generic UI Problem**

**Every user (Owner, Manager, Accountant, Procurement, Waiter, etc.) currently sees:**
- **The same navigation structure** (only hidden items differ)
- **The same dashboard** (generic KPIs, not role-optimized)
- **The same settings page** (basic profile info only)
- **No role-specific landing workspace** (everyone lands on `/dashboard`)
- **No role-specific quick actions** (no shortcuts tailored to their job)

**Impact:**
- Accountants must hunt through generic navigation to find accounting features
- Procurement staff see a revenue dashboard instead of stock alerts
- Waiters see navigation items they can't access (cluttered UX)
- Managers lack an operations-focused dashboard
- No industrial-grade accounting interface exists

---

## Part 1: Role Definitions & Responsibilities

### Role Inventory (from seedDemo.ts constants)

| Role | Level | Demo Users | Organizations |
|------|-------|------------|---------------|
| Owner | L5 | 2 | Tapas, Cafesserie |
| Manager | L4 | 2 | Tapas, Cafesserie |
| Accountant | L4 | 2 | Tapas, Cafesserie |
| Procurement | L3 | 2 | Tapas, Cafesserie |
| Stock Manager | L3 | 1 | Tapas only |
| Event Manager | L3 | 1 | Tapas only |
| Supervisor | L2 | 2 | Tapas, Cafesserie |
| Cashier | L2 | 2 | Tapas, Cafesserie |
| Chef | L2 | 2 | Tapas, Cafesserie |
| Waiter | L1 | 2 | Tapas, Cafesserie |
| Bartender | L1 | 1 | Tapas only |

**Total:** 11 unique role types, 19 demo users

---

### L5: Owner (Executive)

**Primary Responsibilities:**
- Strategic oversight of entire business
- Multi-branch performance monitoring (for franchise orgs)
- Financial health and profitability review
- Long-term planning and expansion decisions
- Executive-level reporting and board meetings

**Daily Workflows:**
1. Review consolidated P&L and balance sheet
2. Compare branch performance (for multi-branch)
3. Monitor key business metrics (revenue, margins, customer growth)
4. Review budget vs actuals
5. Approve major expenditures or initiatives

**Top KPIs:**
- Total revenue (all branches)
- Net profit margin
- Revenue per branch (franchise)
- Customer acquisition cost
- Employee retention rate
- Cash position

**Decisions Made:**
- Expansion/closure of branches
- Major capital investments
- Hire/fire executive team
- Set strategic goals

**Should NOT See:**
- POS order entry (not their job)
- Kitchen ticket details
- Individual table status
- Day-to-day stock movements
- Low-level operational alerts

**Default Landing:** Executive Dashboard (high-level KPIs, multi-branch view)

---

### L4: Manager (Operations Leader)

**Primary Responsibilities:**
- Day-to-day operations management
- Staff scheduling and performance
- Customer satisfaction
- Revenue optimization
- Budget adherence

**Daily Workflows:**
1. Morning: Review yesterday's sales and staff performance
2. Check open orders and table status
3. Monitor peak hour coverage
4. Respond to customer feedback
5. Approve staff schedules and time-off
6. Review budget alerts

**Top KPIs:**
- Daily revenue vs target
- Table turnover rate
- Staff attendance/punctuality
- Customer satisfaction (NPS)
- Labor cost % of revenue
- Inventory shortages

**Decisions Made:**
- Staff scheduling adjustments
- Approve/reject time-off requests
- Handle customer complaints
- Adjust menu pricing
- Reallocate budget

**Should NOT See:**
- General ledger details
- Vendor payment specifics
- Chart of accounts
- Franchise-wide rankings (single-branch manager)

**Default Landing:** Operations Dashboard (staff, orders, revenue trends)

---

### L4: Accountant (Finance Professional)

**Primary Responsibilities:**
- Accounts Payable (AP) management
- Accounts Receivable (AR) management
- Vendor bill entry and payment processing
- Bank reconciliation
- Financial reporting (P&L, Balance Sheet, Cashflow)
- Tax preparation
- Period close and audit trail
- Budget tracking

**Daily Workflows:**
1. Review AP aging report (overdue bills)
2. Enter new vendor bills
3. Process vendor payments
4. Reconcile bank statements
5. Review GL journal entries
6. Export financial reports for management
7. Check budget vs actuals
8. Close monthly/quarterly periods

**Top KPIs:**
- AP aging (30/60/90+ days overdue)
- AR aging
- Days Payable Outstanding (DPO)
- Days Sales Outstanding (DSO)
- Cash balance
- Budget variance %

**Decisions Made:**
- Which bills to pay (prioritize by due date)
- Approve vendor payment terms
- Resolve GL discrepancies
- Recommend budget adjustments
- Flag tax liabilities

**Should NOT See:**
- POS order entry (not their workflow)
- Menu item management
- Table reservations
- Kitchen display
- Staff shift schedules (unless payroll-related)

**Default Landing:** Accounting Workspace (AP aging, recent bills, payment queue)

**CRITICAL REQUIREMENT:** Industrial-grade accounting UI with:
- AP/AR dashboards
- Vendor bill list with filters (date, vendor, status)
- Payment processing interface
- GL/ledger browser
- Trial balance
- P&L with period comparison
- Balance sheet
- Cashflow statement
- Period close workflow
- CSV/Excel export for all reports
- Audit trail log

---

### L3: Procurement (Supply Chain)

**Primary Responsibilities:**
- Purchase order creation
- Vendor management
- Stock replenishment
- Cost negotiation
- GRN (Goods Received Note) verification
- Reorder alert response

**Daily Workflows:**
1. Check low-stock alerts
2. Create purchase orders for needed items
3. Communicate with vendors
4. Verify deliveries (GRN)
5. Review supplier performance
6. Monitor lead times

**Top KPIs:**
- Low-stock items count
- Average lead time
- Stock-out incidents
- Purchase order fulfillment rate
- Vendor on-time delivery %
- Cost per unit trends

**Decisions Made:**
- Which supplier to order from
- Order quantities (balance cost vs storage)
- Approve/reject GRNs
- Escalate quality issues

**Should NOT See:**
- Customer-facing POS
- Financial ledger details
- Payroll information
- Customer feedback (not their domain)

**Default Landing:** Procurement Dashboard (low-stock alerts, pending POs, supplier list)

---

### L3: Stock Manager (Inventory Control)

**Primary Responsibilities:**
- Physical stock tracking
- Inventory counts (cycle counts, full inventory)
- Wastage recording
- Stock movement verification
- Reorder level management
- Storage optimization

**Daily Workflows:**
1. Record stock receipts
2. Perform cycle counts
3. Record wastage/spoilage
4. Update reorder levels
5. Investigate stock discrepancies
6. Review inventory turnover

**Top KPIs:**
- Inventory accuracy %
- Wastage rate
- Inventory turnover ratio
- Stock-out incidents
- Days of inventory on hand
- Dead stock value

**Decisions Made:**
- Adjust reorder levels
- Investigate discrepancies
- Flag slow-moving items
- Recommend menu changes based on inventory

**Should NOT See:**
- Vendor payment details
- Customer POS transactions
- Financial reports
- Staff performance data

**Default Landing:** Stock Dashboard (current levels, discrepancies, wastage log)

---

### L3: Event Manager (Events & Catering)

**Primary Responsibilities:**
- Event booking and planning
- Catering orders
- Special menu creation
- Event staff coordination
- Post-event billing

**Daily Workflows:**
1. Review upcoming events
2. Coordinate with kitchen for special menus
3. Confirm event staff assignments
4. Process event invoices
5. Handle event customer inquiries

**Top KPIs:**
- Events booked this month
- Event revenue
- Event profit margin
- Event cancellation rate
- Customer satisfaction (events)

**Decisions Made:**
- Accept/decline event bookings
- Custom menu pricing
- Staff allocation for events

**Should NOT See:**
- Regular POS operations
- Stock replenishment
- Financial ledger

**Default Landing:** Events Dashboard (upcoming events, event pipeline, event revenue)

---

### L2: Supervisor (Shift Leader)

**Primary Responsibilities:**
- Shift oversight
- Staff coordination
- Quality control
- Customer issue resolution
- Break/shift handoff management

**Daily Workflows:**
1. Open/close shift
2. Assign stations to staff
3. Monitor order flow
4. Handle customer complaints
5. Approve voids/discounts
6. End-of-shift reporting

**Top KPIs:**
- Orders completed this shift
- Average order time
- Voids/discounts issued
- Staff punctuality
- Customer complaints

**Decisions Made:**
- Approve POS voids
- Reassign staff during shift
- Call in backup staff
- Escalate issues to manager

**Should NOT See:**
- Financial reports
- Vendor management
- Payroll details
- Franchise comparisons

**Default Landing:** Shift Dashboard (active orders, staff status, alerts)

---

### L2: Cashier (Payment Processing)

**Primary Responsibilities:**
- Order checkout and payment
- Payment method handling
- Receipt printing
- Shift cash reconciliation
- End-of-day reporting

**Daily Workflows:**
1. Process customer payments
2. Handle split bills
3. Reconcile cash drawer
4. Generate shift report
5. Report discrepancies

**Top KPIs:**
- Payments processed
- Payment method mix
- Cash variance
- Average transaction time
- Refunds/voids

**Decisions Made:**
- Accept payment method
- Approve small voids
- Escalate large discrepancies

**Should NOT See:**
- Inventory management
- Staff scheduling
- Vendor bills
- Financial reports

**Default Landing:** Cashier POS (payment-focused, minimal navigation)

---

### L2: Chef (Kitchen Operations)

**Primary Responsibilities:**
- Order preparation
- Recipe adherence
- Kitchen inventory usage
- Quality control
- Kitchen equipment maintenance

**Daily Workflows:**
1. Review kitchen orders (KDS)
2. Prepare dishes
3. Mark orders ready/served
4. Record ingredient usage
5. Flag low stock
6. Handle special requests

**Top KPIs:**
- Orders completed
- Average prep time
- Order accuracy %
- Food cost %
- Wastage reported

**Decisions Made:**
- Prioritize order preparation
- Substitute ingredients (if needed)
- Escalate quality issues
- Request ingredient replenishment

**Should NOT See:**
- Customer payment details
- Financial reports
- Staff schedules (unless affects kitchen)
- Vendor bills

**Default Landing:** Kitchen Display System (KDS) - order queue

---

### L1: Waiter (Front-of-House)

**Primary Responsibilities:**
- Customer service
- Order taking
- Order delivery
- Table management
- Tips collection

**Daily Workflows:**
1. Greet customers
2. Take orders (POS)
3. Deliver food/beverages
4. Handle customer requests
5. Process tips
6. Clear tables

**Top KPIs:**
- Tables served
- Average tip per table
- Order accuracy
- Customer complaints
- Orders per hour

**Decisions Made:**
- Recommend menu items
- Handle minor requests
- Escalate complaints

**Should NOT See:**
- Financial reports
- Inventory details
- Staff management
- Vendor information
- Analytics beyond personal performance

**Default Landing:** Waiter POS (simplified, table-focused)

---

### L1: Bartender (Beverage Service)

**Primary Responsibilities:**
- Beverage preparation
- Bar order taking
- Bar inventory management
- Customer interaction
- Bar cleanliness

**Daily Workflows:**
1. Take bar orders
2. Prepare beverages
3. Serve customers
4. Restock bar inventory
5. Clean bar area
6. Handle bar tabs

**Top KPIs:**
- Drinks served
- Average drink prep time
- Bar revenue
- Inventory usage
- Tips collected

**Decisions Made:**
- Recommend drinks
- Handle minor customer issues
- Request bar stock replenishment

**Should NOT See:**
- Financial reports
- Kitchen operations (unless integrated)
- Staff schedules
- Vendor bills

**Default Landing:** Bar POS (beverage-focused)

---

## Part 2: Application UI Surface Map

### Frontend Structure Analysis

**Base Path:** `apps/web/src/pages/`

| Route | File Path | Current RBAC | Current UI Focus | Components Used |
|-------|-----------|--------------|------------------|-----------------|
| `/` | `index.tsx` | Public | Landing/redirect | - |
| `/login` | `login.tsx` | Public | Authentication | Login form |
| `/dashboard` | `dashboard.tsx` | L1+ | **Generic revenue dashboard** | KPI cards, charts, alerts |
| `/pos` | `pos/index.tsx` | L1+ | POS order entry | Complex order management |
| `/analytics` | `analytics/index.tsx` | L3+ | Revenue analytics | Charts, timeseries |
| `/analytics/franchise` | `analytics/franchise/*.tsx` | L5 | Multi-branch comparison | Branch leaderboard |
| `/reports` | `reports/index.tsx` | L3+ | **Redirects to `/analytics`** | None (redirect) |
| `/reports/budgets` | `reports/budgets.tsx` | L3+ | Budget reports | Table |
| `/reports/subscriptions` | `reports/subscriptions.tsx` | L3+ | Subscription reports | Table |
| `/inventory` | `inventory/index.tsx` | L3+ | Inventory list & alerts | Data table, low-stock badges |
| `/finance` | `finance/index.tsx` | L4+ | **Only budget summary (3 KPI cards)** | Stat cards |
| `/service-providers` | `service-providers/index.tsx` | L3+ | Vendor/supplier list | Data table |
| `/reservations` | `reservations/index.tsx` | L3+ | Table bookings | Booking list |
| `/feedback` | `feedback/index.tsx` | L4+ | Customer NPS | Feedback list |
| `/staff` | `staff/index.tsx` | L3+ | Staff list | Staff cards |
| `/staff/insights` | `staff/insights.tsx` | L3+ | Staff KPIs | Performance metrics |
| `/settings` | `settings/index.tsx` | L1+ | **Basic user profile only** | 2 cards (user info, org info) |
| `/kds` | `kds/index.tsx` | L1+ | Kitchen display | Kitchen orders |
| `/hr/*` | `hr/*.tsx` | L4+ | (likely unused) | - |

**Total Pages:** ~20-25 pages

---

### Backend Endpoint Map (Controllers)

**Base Path:** `services/api/src/`

| Module | Controller | Key Endpoints | RBAC | Purpose |
|--------|------------|---------------|------|---------|
| `accounting/` | `AccountingController` | `/accounting/vendors`, `/accounting/vendor-bills`, `/accounting/vendor-payments`, `/accounting/ap/aging`, `/accounting/pnl`, `/accounting/balance-sheet` | L4+ | **Industrial accounting features** |
| `analytics/` | `AnalyticsController` | `/analytics/daily`, `/analytics/financial-summary`, `/analytics/category-mix`, `/analytics/peak-hours` | L3+ | Revenue analytics |
| `finance/` | `BudgetController` | `/finance/budgets/summary` | L4+ | Budget tracking |
| `franchise/` | `FranchiseController` | `/franchise/rankings`, `/franchise/analytics/overview`, `/franchise/branch-metrics` | L4-L5 | Multi-branch features |
| `inventory/` | `InventoryController` | `/inventory/items`, `/inventory/levels`, `/inventory/low-stock/alerts` | L3+ | Inventory management |
| `purchasing/` | `PurchasingController` | (needs inspection) | L3+ | Purchase orders |
| `pos/` | `PosController` | `/pos/orders`, `/pos/menu`, `/pos/tables` | L1+ | POS operations |
| `hr/` | `HrController` | `/hr/employees` | L4+ | Staff data |
| `staff/` | `StaffController` | `/staff/insights` | L3+ | Staff performance |
| `feedback/` | `FeedbackController` | `/feedback/analytics/nps-summary` | L4+ | Customer feedback |
| `reservations/` | `ReservationsController` | `/reservations` | L3+ | Table bookings |
| `service-providers/` | `ServiceProvidersController` | `/service-providers` | L3+ | Vendor management |

**Total Modules:** ~25+ backend modules

---

### Navigation Structure (Sidebar)

**File:** `apps/web/src/components/layout/Sidebar.tsx`

**Current Implementation:**
```tsx
const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard />, minRole: RoleLevel.L1 },
  { label: 'POS', href: '/pos', icon: <ShoppingCart />, minRole: RoleLevel.L1 },
  { label: 'Analytics', href: '/analytics', icon: <BarChart3 />, minRole: RoleLevel.L3 },
  { label: 'Reports', href: '/reports', icon: <FileText />, minRole: RoleLevel.L3 },
  { label: 'Staff', href: '/staff', icon: <Users />, minRole: RoleLevel.L3 },
  { label: 'Inventory', href: '/inventory', icon: <Package />, minRole: RoleLevel.L3 },
  { label: 'Finance', href: '/finance', icon: <DollarSign />, minRole: RoleLevel.L4 },
  { label: 'Service Providers', href: '/service-providers', icon: <Wrench />, minRole: RoleLevel.L3 },
  { label: 'Reservations', href: '/reservations', icon: <Calendar />, minRole: RoleLevel.L3 },
  { label: 'Feedback', href: '/feedback', icon: <MessageSquare />, minRole: RoleLevel.L4 },
  { label: 'Settings', href: '/settings', icon: <Settings />, minRole: RoleLevel.L1 },
];
```

**Problem:** 
- **Flat list** (no grouping by role or function)
- **Same items for everyone** (only minRole filtering applied)
- **No role-specific shortcuts** (e.g., accountant has no "AP Aging" quick link)
- **No contextual actions** (e.g., procurement has no "Create PO" button)

---

### Settings Page Analysis

**File:** `apps/web/src/pages/settings/index.tsx`

**Current Content:**
- User Information card (name, email, role level)
- Organization card (org name, branch, user ID)
- **That's it.** No preferences, no role-specific settings, no actions.

**Problem:**
- **Not a "setup menu"** - it's just a profile view
- **No org-wide settings** (tax rates, currencies, etc.)
- **No role-specific configs** (e.g., accountant can't set accounting periods)
- **No branch settings** (manager can't configure their branch)
- **No user preferences** (theme, notifications, etc.)

**Conclusion:** The "setup menus UI is the same for everyone" complaint is actually about:
1. **Missing org/branch admin pages** (e.g., `/settings/organization`, `/settings/branches`)
2. **No role-specific config pages** (e.g., `/settings/accounting-periods` for accountants)
3. **Generic settings page** that doesn't guide users to relevant features

---

## Part 3: Mismatch Analysis (Current vs Desired)

### Mismatch #1: Generic Dashboard for All Roles

**Current State:**
- **Everyone lands on `/dashboard`**
- Dashboard shows: Total revenue, orders, items sold, category mix, payment methods, peak hours
- **Focus:** Revenue-centric KPIs (good for Manager/Owner, irrelevant for Waiter/Chef/Accountant)

**Problems:**
- **Accountant** sees revenue charts instead of AP aging
- **Procurement** sees sales data instead of low-stock alerts
- **Waiter** sees org-wide metrics instead of their personal tips/tables
- **Chef** sees revenue instead of kitchen order queue

**Desired State:**
- **Owner:** Executive dashboard (multi-branch P&L, margins, growth)
- **Manager:** Operations dashboard (staff, orders, revenue, alerts)
- **Accountant:** Accounting dashboard (AP aging, bills due, bank balance, period status)
- **Procurement:** Stock dashboard (low-stock, pending POs, supplier performance)
- **Stock Manager:** Inventory dashboard (current levels, discrepancies, wastage)
- **Waiter/Cashier:** POS-focused dashboard (open orders, tables, tips)
- **Chef:** Kitchen dashboard (order queue, prep times, ingredient alerts)

---

### Mismatch #2: No Role-Specific Navigation

**Current State:**
- **Flat navigation** with 11 items
- **Same items for everyone** (only hidden if below minRole)
- **No grouping** (e.g., "Accounting" group vs "Operations" group)

**Problems:**
- **Accountant** has to hunt for accounting features:
  - "Finance" page only shows budget (not AP/AR)
  - No "Vendors" or "Bills" in sidebar
  - Must remember URL `/accounting/...` (not discoverable)
- **Procurement** sees "Service Providers" (generic) instead of "Suppliers" or "Purchase Orders"
- **Waiter** sees 11 nav items (overwhelming) when they only need POS

**Desired State:**
- **Owner:** Executive nav (Dashboard, Reports, Analytics, Settings)
- **Manager:** Operations nav (Dashboard, POS, Staff, Reservations, Inventory, Reports, Settings)
- **Accountant:** Accounting nav (Dashboard, AP, AR, Vendors, Bills, Payments, Reports, GL, Settings)
- **Procurement:** Supply nav (Dashboard, Suppliers, Purchase Orders, Inventory, GRNs, Settings)
- **Waiter:** Minimal nav (POS, My Tips, Settings)
- **Chef:** Kitchen nav (KDS, Recipes, Inventory Usage, Settings)

---

### Mismatch #3: "Finance" Page is Not an Accounting Suite

**Current State:**
- `/finance/index.tsx` shows **3 KPI cards** (budget, actual, variance)
- **That's it.** No AP, AR, vendors, bills, payments, GL, or reports.

**Backend Reality:**
- `AccountingController` **already has** industrial-grade endpoints:
  - `GET /accounting/vendors` (L4+)
  - `POST /accounting/vendor-bills` (L4+)
  - `POST /accounting/vendor-payments` (L4+)
  - `GET /accounting/ap/aging` (L4+)
  - `GET /accounting/ar/aging` (L4+)
  - `GET /accounting/trial-balance` (L4+)
  - `GET /accounting/pnl` (L4+)
  - `GET /accounting/balance-sheet` (L4+)

**Problem:**
- **Frontend does not surface these endpoints**
- **Accountant has no UI to access their tools**
- **Industrial-grade backend, consumer-grade frontend**

**Desired State:**
- `/finance` should redirect to role-specific workspace:
  - **Accountant:** `/accounting` (AP/AR dashboard)
  - **Manager:** `/finance/budgets` (budget summary)
  - **Owner:** `/finance/reports` (P&L, balance sheet)
- New pages required:
  - `/accounting/ap` - Accounts Payable dashboard
  - `/accounting/ar` - Accounts Receivable dashboard
  - `/accounting/vendors` - Vendor list
  - `/accounting/bills` - Vendor bills list
  - `/accounting/payments` - Payment processing
  - `/accounting/gl` - General ledger browser
  - `/accounting/reports` - Financial reports (P&L, balance sheet, trial balance)

---

### Mismatch #4: Reports Page is a Redirect

**Current State:**
- `/reports/index.tsx` **redirects to `/analytics`**
- Not a real reports page

**Problem:**
- **No actual report generation** (e.g., PDF/Excel export)
- **No report library** (saved reports, scheduled reports)
- **"Reports" nav item is misleading**

**Desired State:**
- `/reports` should be a **Report Library**:
  - List of available reports (Sales, Inventory, Staff, Financial)
  - Filters (date range, branch, category)
  - Export buttons (PDF, Excel, CSV)
  - Scheduled reports (email delivery)
- Keep `/analytics` for interactive dashboards
- Make `/reports` a distinct, professional reporting tool

---

### Mismatch #5: No Role-Specific Landing Routes

**Current State:**
- **Everyone lands on `/dashboard` after login**
- No role detection or routing logic

**Problem:**
- **Waiter** lands on executive dashboard (confusing)
- **Accountant** lands on revenue dashboard (wrong focus)
- **Chef** lands on analytics (irrelevant)

**Desired State:**
- **Post-login routing based on role:**
  - **L5 Owner:** `/dashboard/executive`
  - **L4 Manager:** `/dashboard/operations`
  - **L4 Accountant:** `/accounting`
  - **L3 Procurement:** `/procurement`
  - **L3 Stock Manager:** `/inventory`
  - **L2 Cashier:** `/pos?mode=cashier`
  - **L2 Chef:** `/kds`
  - **L1 Waiter:** `/pos?mode=waiter`

---

### Mismatch #6: No Role-Specific Quick Actions

**Current State:**
- **No quick action buttons** in sidebar or dashboard
- **No shortcuts** (e.g., "New PO" for procurement, "Pay Bill" for accountant)

**Problem:**
- **Users must navigate through multiple pages** to perform common tasks
- **No workflow optimization**

**Desired State:**
- **Accountant:** Quick actions in sidebar:
  - "New Vendor Bill"
  - "Process Payment"
  - "View AP Aging"
  - "Close Period"
- **Procurement:** Quick actions:
  - "Create Purchase Order"
  - "View Low Stock"
  - "Manage Suppliers"
- **Manager:** Quick actions:
  - "View Staff Schedule"
  - "Check Reservations"
  - "Review Feedback"

---

### Mismatch #7: Settings Page is Not a Setup Menu

**Current State:**
- **Settings page** = user profile view only
- **No org-wide settings** (tax rates, currencies, branches)
- **No role-specific configs**

**Problem:**
- **"Setup menus" don't exist** (user complaint is valid)
- **Admins can't configure org settings**
- **Accountants can't set accounting periods or fiscal year**

**Desired State:**
- **Settings should be role-scoped:**
  - **L5 Owner:** Organization settings (tax, currency, branches, users)
  - **L4 Accountant:** Accounting settings (chart of accounts, periods, fiscal year)
  - **L3 Procurement:** Supplier defaults, reorder settings
  - **L1-L2:** Personal settings only (theme, notifications)

---

## Part 4: Backend Capabilities Inventory

### Existing Accounting Endpoints (Ready to Use)

**Module:** `services/api/src/accounting/`

| Endpoint | Method | RBAC | Purpose | Frontend Page Needed |
|----------|--------|------|---------|---------------------|
| `/accounting/vendors` | GET | L4+ | List vendors | `/accounting/vendors` |
| `/accounting/vendors` | POST | L4+ | Create vendor | Vendor creation form |
| `/accounting/vendor-bills` | POST | L4+ | Create bill | `/accounting/bills/new` |
| `/accounting/vendor-bills/:id/open` | POST | L4+ | Open bill | Bill detail page |
| `/accounting/vendor-payments` | POST | L4+ | Create payment | `/accounting/payments/new` |
| `/accounting/ap/aging` | GET | L4+ | AP aging report | `/accounting/ap` dashboard |
| `/accounting/ar/aging` | GET | L4+ | AR aging report | `/accounting/ar` dashboard |
| `/accounting/trial-balance` | GET | L4+ | Trial balance | `/accounting/reports/trial-balance` |
| `/accounting/pnl` | GET | L4+ | P&L statement | `/accounting/reports/pnl` |
| `/accounting/balance-sheet` | GET | L4+ | Balance sheet | `/accounting/reports/balance-sheet` |

**Status:** ✅ **Backend ready, frontend missing**

---

### Existing Purchasing Endpoints

**Module:** `services/api/src/purchasing/`

| Endpoint | Method | RBAC | Purpose | Frontend Page Needed |
|----------|--------|------|---------|---------------------|
| (needs inspection) | - | L3+ | Purchase orders | `/procurement/purchase-orders` |

**Status:** ⚠️ **Needs inspection**

---

### Existing Inventory Endpoints (Already Frontend-Integrated)

**Module:** `services/api/src/inventory/`

| Endpoint | Method | RBAC | Frontend Page | Status |
|----------|--------|------|---------------|--------|
| `/inventory/items` | GET | L3+ | `/inventory` | ✅ |
| `/inventory/levels` | GET | L3+ | `/inventory` | ✅ |
| `/inventory/low-stock/alerts` | GET | L3+ | `/inventory` | ✅ |

**Status:** ✅ **Complete**

---

### Missing Backend Endpoints

| Endpoint Needed | Purpose | Priority |
|----------------|---------|----------|
| `GET /purchasing/purchase-orders` | List POs | High (for Procurement workspace) |
| `POST /purchasing/purchase-orders` | Create PO | High |
| `GET /purchasing/grns` | Goods Received Notes | Medium |
| `POST /purchasing/grns` | Record GRN | Medium |
| `GET /staff/my-performance` | Personal KPIs for waiters | Medium |
| `GET /kds/my-queue` | Chef's order queue | Low (KDS already exists) |

---

## Part 5: Root Cause Analysis

### Why is the UI the same for everyone?

**Cause 1: Flat Navigation Design**
- **Sidebar.tsx** uses a single flat array of nav items
- **Only filtering logic:** `canAccessRole(user.roleLevel, item.minRole)`
- **No grouping, no role-specific items**

**Cause 2: Single Generic Dashboard**
- **dashboard.tsx** shows revenue-focused KPIs for everyone
- **No role detection** to redirect to appropriate workspace
- **No dashboard variants** (executive, operations, accounting, etc.)

**Cause 3: Settings Page is Minimal**
- **settings/index.tsx** only shows user profile
- **No org settings, no branch settings, no role configs**
- **Not actually a "setup menu"**

**Cause 4: Finance Page is Not an Accounting Suite**
- **finance/index.tsx** only shows budget summary (3 KPI cards)
- **Does not surface AccountingController endpoints**
- **Accountants have no UI for their tools**

**Cause 5: No Post-Login Role Routing**
- **All users land on `/dashboard` after login**
- **No role detection to redirect to appropriate workspace**

**Cause 6: No Role Capability Model**
- **No central config** defining what each role should see/access
- **RBAC is only enforced via minRole** (access control, not UX optimization)
- **No "workspace" concept** (Accounting workspace, Procurement workspace, etc.)

---

## Part 6: Recommendations Summary

### Immediate Action Items

1. **Create Role Capability Model**
   - Central config file: `roleCapabilities.ts`
   - Define per-role: default route, nav groups, quick actions, dashboard widgets

2. **Implement Role-Specific Dashboards**
   - Executive dashboard (L5)
   - Operations dashboard (L4 Manager)
   - Accounting dashboard (L4 Accountant)
   - Procurement dashboard (L3)
   - Stock dashboard (L3)
   - FOH dashboard (L1-L2 waiter/cashier)
   - Kitchen dashboard (L2 chef)

3. **Build Accounting Workspace (Industrial Grade)**
   - AP dashboard (`/accounting/ap`)
   - AR dashboard (`/accounting/ar`)
   - Vendor list (`/accounting/vendors`)
   - Bill list (`/accounting/bills`)
   - Payment processing (`/accounting/payments`)
   - GL browser (`/accounting/gl`)
   - Financial reports (`/accounting/reports`)

4. **Refactor Navigation**
   - Group nav items by function (Accounting, Operations, Supply Chain, etc.)
   - Show/hide entire groups based on role
   - Add quick action buttons in sidebar

5. **Implement Post-Login Role Routing**
   - Detect role after login
   - Redirect to appropriate workspace

6. **Enhance Settings Page**
   - Role-scoped settings (org settings for L5, accounting settings for accountant, etc.)

---

## Part 7: Files to Touch (Implementation Inventory)

### Frontend Files

**Core Infrastructure:**
- `apps/web/src/lib/roleCapabilities.ts` (NEW) - Role capability model
- `apps/web/src/components/layout/Sidebar.tsx` (MODIFY) - Role-based navigation
- `apps/web/src/components/layout/AppShell.tsx` (MODIFY) - Add quick actions
- `apps/web/src/pages/_app.tsx` (MODIFY) - Post-login routing

**Dashboard Files:**
- `apps/web/src/pages/dashboard.tsx` (MODIFY) - Detect role, redirect to appropriate dashboard
- `apps/web/src/pages/dashboard/executive.tsx` (NEW) - L5 Owner dashboard
- `apps/web/src/pages/dashboard/operations.tsx` (NEW) - L4 Manager dashboard
- `apps/web/src/pages/dashboard/foh.tsx` (NEW) - L1-L2 waiter/cashier dashboard
- `apps/web/src/pages/dashboard/kitchen.tsx` (NEW) - L2 chef dashboard

**Accounting Workspace (NEW):**
- `apps/web/src/pages/accounting/index.tsx` (NEW) - Accounting landing (AP dashboard)
- `apps/web/src/pages/accounting/ap.tsx` (NEW) - Accounts Payable
- `apps/web/src/pages/accounting/ar.tsx` (NEW) - Accounts Receivable
- `apps/web/src/pages/accounting/vendors.tsx` (NEW) - Vendor list
- `apps/web/src/pages/accounting/bills.tsx` (NEW) - Bill list
- `apps/web/src/pages/accounting/payments.tsx` (NEW) - Payment processing
- `apps/web/src/pages/accounting/gl.tsx` (NEW) - General ledger
- `apps/web/src/pages/accounting/reports/index.tsx` (NEW) - Financial reports hub
- `apps/web/src/pages/accounting/reports/pnl.tsx` (NEW) - P&L
- `apps/web/src/pages/accounting/reports/balance-sheet.tsx` (NEW) - Balance sheet
- `apps/web/src/pages/accounting/reports/trial-balance.tsx` (NEW) - Trial balance

**Procurement Workspace (NEW):**
- `apps/web/src/pages/procurement/index.tsx` (NEW) - Procurement landing (low-stock dashboard)
- `apps/web/src/pages/procurement/purchase-orders.tsx` (NEW) - PO list
- `apps/web/src/pages/procurement/suppliers.tsx` (NEW) - Supplier list
- `apps/web/src/pages/procurement/grns.tsx` (NEW) - GRN list

**Settings:**
- `apps/web/src/pages/settings/index.tsx` (MODIFY) - Role-based settings landing
- `apps/web/src/pages/settings/organization.tsx` (NEW) - L5 org settings
- `apps/web/src/pages/settings/accounting.tsx` (NEW) - L4 accountant settings
- `apps/web/src/pages/settings/procurement.tsx` (NEW) - L3 procurement settings

**Reports:**
- `apps/web/src/pages/reports/index.tsx` (MODIFY) - Remove redirect, create report library

### Backend Files

**Procurement (Needs Inspection):**
- `services/api/src/purchasing/purchasing.controller.ts` (INSPECT)
- `services/api/src/purchasing/purchasing.service.ts` (INSPECT)

**Accounting (Ready to Use):**
- `services/api/src/accounting/accounting.controller.ts` (EXISTING)
- `services/api/src/accounting/accounting.service.ts` (EXISTING)

### Verification Files

**New Verifiers:**
- `scripts/verify-role-nav.ts` (NEW) - Validate nav items per role
- `scripts/verify-role-landing.ts` (NEW) - Validate default routes per role

**Updated Verifiers:**
- `scripts/verify-role-coverage.ts` (MODIFY) - Add nav/landing checks

---

## Conclusion

**Audit Complete.** Key findings:

1. ✅ **11 distinct roles identified** with clear responsibilities
2. ❌ **Generic UI serves all roles** (not role-optimized)
3. ❌ **No role-specific dashboards** (everyone sees revenue dashboard)
4. ❌ **No industrial-grade accounting UI** (backend ready, frontend missing)
5. ❌ **No role-specific navigation** (flat list, no grouping)
6. ❌ **No post-login role routing** (everyone lands on generic dashboard)
7. ❌ **Settings page is not a "setup menu"** (just profile view)

**Next Steps:**
- Proceed to **Phase B: Blueprint** (role capability model, dashboard designs, accounting workspace spec)
- Then **Phase C: Implementation Plan** (5-8 milestones with acceptance criteria)

---

**End of M8 Audit**
