# M8 Role UX Blueprint: Design Specifications

**Date:** 2024-12-24  
**Milestone:** M8 - Role-Based UI Redesign (Phase B: Blueprint)  
**Purpose:** Detailed design specifications for role-based UX  
**Status:** 📐 BLUEPRINT COMPLETE

---

## Overview

This blueprint defines the **Role Capability Model**, **Role-Specific Dashboards**, **Accounting Workspace** (industrial grade), and **Navigation Architecture** for the M8 redesign.

---

## Part 1: Role Capability Model

### Design Philosophy

**Workspace Concept:**
- Each role has a **primary workspace** (landing page + navigation + workflows)
- Workspace is optimized for **daily tasks** of that role
- **No clutter:** Only show what's relevant to the job
- **Progressive disclosure:** Advanced features accessible but not prominent

**Configuration-Driven:**
- Central config file: `roleCapabilities.ts`
- **Single source of truth** for role permissions, nav items, quick actions
- **Easy to extend:** Add new roles without touching UI code

---

### Role Capability Schema

```typescript
// apps/web/src/lib/roleCapabilities.ts

export enum RoleLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  L4 = 'L4',
  L5 = 'L5',
}

export enum RoleType {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  PROCUREMENT = 'PROCUREMENT',
  STOCK = 'STOCK',
  EVENT_MANAGER = 'EVENT_MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  CASHIER = 'CASHIER',
  CHEF = 'CHEF',
  WAITER = 'WAITER',
  BARTENDER = 'BARTENDER',
}

export interface RoleCapability {
  // Identity
  roleLevel: RoleLevel;
  roleTypes: RoleType[]; // Multiple role types can share a capability
  
  // Workspace
  defaultRoute: string; // Landing page after login
  workspaceName: string; // e.g., "Accounting Workspace", "Operations Dashboard"
  
  // Navigation
  navGroups: NavGroup[]; // Sidebar navigation structure
  
  // Quick Actions
  quickActions: QuickAction[]; // Sidebar/header quick action buttons
  
  // Dashboard
  dashboardWidgets: DashboardWidget[]; // Widget config for dashboard
  
  // Features
  features: string[]; // Feature flags (e.g., 'multi-branch', 'franchise-analytics')
}

export interface NavGroup {
  label: string; // e.g., "Accounting", "Operations"
  icon?: React.ReactNode;
  items: NavItem[];
  collapsible?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string; // e.g., "New", count of pending items
}

export interface QuickAction {
  label: string;
  href?: string; // Link to page
  action?: () => void; // Or trigger function
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary'; // Button style
}

export interface DashboardWidget {
  type: 'kpi' | 'chart' | 'table' | 'alert' | 'action-list';
  title: string;
  endpoint?: string; // API endpoint to fetch data
  component?: string; // React component name
  size: 'small' | 'medium' | 'large' | 'full-width';
  order: number; // Display order
}
```

---

### Role Capability Definitions

#### L5: Owner (Executive)

```typescript
export const OWNER_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L5,
  roleTypes: [RoleType.OWNER],
  defaultRoute: '/dashboard/executive',
  workspaceName: 'Executive Dashboard',
  
  navGroups: [
    {
      label: 'Overview',
      items: [
        { label: 'Executive Dashboard', href: '/dashboard/executive', icon: <LayoutDashboard /> },
        { label: 'Multi-Branch View', href: '/franchise', icon: <Building2 /> }, // If multi-branch
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Revenue Analytics', href: '/analytics', icon: <BarChart3 /> },
        { label: 'Financial Reports', href: '/accounting/reports', icon: <FileText /> },
        { label: 'Branch Comparison', href: '/franchise/compare', icon: <GitCompare /> },
      ],
    },
    {
      label: 'Management',
      items: [
        { label: 'Staff Overview', href: '/staff', icon: <Users /> },
        { label: 'Branches', href: '/settings/branches', icon: <Building /> },
        { label: 'Organization Settings', href: '/settings/organization', icon: <Settings /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'View P&L', href: '/accounting/reports/pnl', icon: <TrendingUp />, variant: 'primary' },
    { label: 'Branch Performance', href: '/franchise', icon: <Building2 /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Total Revenue', endpoint: '/analytics/kpis', size: 'small', order: 1 },
    { type: 'kpi', title: 'Net Profit', endpoint: '/analytics/kpis', size: 'small', order: 2 },
    { type: 'kpi', title: 'Customer Growth', endpoint: '/analytics/kpis', size: 'small', order: 3 },
    { type: 'chart', title: 'Revenue by Branch', component: 'BranchRevenueChart', size: 'large', order: 4 },
    { type: 'chart', title: 'Profit Trends', component: 'ProfitTrendChart', size: 'medium', order: 5 },
    { type: 'table', title: 'Top Branches', component: 'BranchLeaderboard', size: 'medium', order: 6 },
  ],
  
  features: ['multi-branch', 'franchise-analytics', 'org-settings'],
};
```

---

#### L4: Manager (Operations)

```typescript
export const MANAGER_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L4,
  roleTypes: [RoleType.MANAGER],
  defaultRoute: '/dashboard/operations',
  workspaceName: 'Operations Dashboard',
  
  navGroups: [
    {
      label: 'Operations',
      items: [
        { label: 'Operations Dashboard', href: '/dashboard/operations', icon: <LayoutDashboard /> },
        { label: 'POS', href: '/pos', icon: <ShoppingCart /> },
        { label: 'Reservations', href: '/reservations', icon: <Calendar /> },
      ],
    },
    {
      label: 'Staff',
      items: [
        { label: 'Staff Overview', href: '/staff', icon: <Users /> },
        { label: 'Staff Insights', href: '/staff/insights', icon: <UserCheck /> },
        { label: 'Schedules', href: '/staff/schedules', icon: <Clock /> },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Revenue Analytics', href: '/analytics', icon: <BarChart3 /> },
        { label: 'Reports', href: '/reports', icon: <FileText /> },
        { label: 'Customer Feedback', href: '/feedback', icon: <MessageSquare /> },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Inventory Levels', href: '/inventory', icon: <Package /> },
        { label: 'Service Providers', href: '/service-providers', icon: <Wrench /> },
      ],
    },
    {
      label: 'Finance',
      items: [
        { label: 'Budgets', href: '/finance/budgets', icon: <DollarSign /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'View Schedule', href: '/staff/schedules', icon: <Clock /> },
    { label: 'Check Reservations', href: '/reservations', icon: <Calendar /> },
    { label: 'Today\'s Revenue', href: '/analytics', icon: <TrendingUp /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Today\'s Revenue', endpoint: '/analytics/daily', size: 'small', order: 1 },
    { type: 'kpi', title: 'Orders Completed', endpoint: '/analytics/daily', size: 'small', order: 2 },
    { type: 'kpi', title: 'Staff On Duty', endpoint: '/staff/on-duty', size: 'small', order: 3 },
    { type: 'kpi', title: 'Table Occupancy', endpoint: '/reservations/occupancy', size: 'small', order: 4 },
    { type: 'alert', title: 'Alerts', component: 'AlertsPanel', size: 'medium', order: 5 },
    { type: 'chart', title: 'Revenue Trends', component: 'RevenueChart', size: 'large', order: 6 },
    { type: 'action-list', title: 'Quick Actions', component: 'QuickActionList', size: 'medium', order: 7 },
  ],
  
  features: ['staff-management', 'reservations', 'feedback'],
};
```

---

#### L4: Accountant (Finance)

```typescript
export const ACCOUNTANT_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L4,
  roleTypes: [RoleType.ACCOUNTANT],
  defaultRoute: '/accounting', // AP dashboard
  workspaceName: 'Accounting Workspace',
  
  navGroups: [
    {
      label: 'Accounting',
      items: [
        { label: 'Accounts Payable', href: '/accounting/ap', icon: <FileInput />, badge: '5' }, // 5 bills due
        { label: 'Accounts Receivable', href: '/accounting/ar', icon: <FileOutput /> },
        { label: 'Vendors', href: '/accounting/vendors', icon: <Building /> },
        { label: 'Bills', href: '/accounting/bills', icon: <Receipt /> },
        { label: 'Payments', href: '/accounting/payments', icon: <CreditCard /> },
        { label: 'General Ledger', href: '/accounting/gl', icon: <BookOpen /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Profit & Loss', href: '/accounting/reports/pnl', icon: <TrendingUp /> },
        { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', icon: <Scale /> },
        { label: 'Trial Balance', href: '/accounting/reports/trial-balance', icon: <ListChecks /> },
        { label: 'Cashflow', href: '/accounting/reports/cashflow', icon: <Wallet /> },
      ],
    },
    {
      label: 'Period Management',
      items: [
        { label: 'Accounting Periods', href: '/accounting/periods', icon: <Calendar /> },
        { label: 'Period Close', href: '/accounting/period-close', icon: <Lock /> },
        { label: 'Audit Trail', href: '/accounting/audit', icon: <Shield /> },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Chart of Accounts', href: '/settings/chart-of-accounts', icon: <List /> },
        { label: 'Tax Settings', href: '/settings/tax', icon: <Percent /> },
        { label: 'Accounting Preferences', href: '/settings/accounting', icon: <Settings /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'New Bill', href: '/accounting/bills/new', icon: <Plus />, variant: 'primary' },
    { label: 'Pay Bill', href: '/accounting/payments/new', icon: <CreditCard /> },
    { label: 'View AP Aging', href: '/accounting/ap', icon: <Clock /> },
    { label: 'Export P&L', action: () => {}, icon: <Download /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Bills Due This Week', endpoint: '/accounting/ap/aging', size: 'small', order: 1 },
    { type: 'kpi', title: 'Total AP Balance', endpoint: '/accounting/ap/aging', size: 'small', order: 2 },
    { type: 'kpi', title: 'Cash Balance', endpoint: '/accounting/cash-balance', size: 'small', order: 3 },
    { type: 'table', title: 'AP Aging Summary', component: 'APAgingTable', size: 'large', order: 4 },
    { type: 'table', title: 'Recent Bills', component: 'RecentBillsTable', size: 'medium', order: 5 },
    { type: 'action-list', title: 'Payment Queue', component: 'PaymentQueueList', size: 'medium', order: 6 },
  ],
  
  features: ['accounting', 'financial-reports', 'period-close'],
};
```

---

#### L3: Procurement (Supply Chain)

```typescript
export const PROCUREMENT_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L3,
  roleTypes: [RoleType.PROCUREMENT],
  defaultRoute: '/procurement',
  workspaceName: 'Procurement Dashboard',
  
  navGroups: [
    {
      label: 'Procurement',
      items: [
        { label: 'Procurement Dashboard', href: '/procurement', icon: <LayoutDashboard />, badge: '12' }, // 12 low-stock items
        { label: 'Purchase Orders', href: '/procurement/purchase-orders', icon: <FileText /> },
        { label: 'Suppliers', href: '/procurement/suppliers', icon: <Building /> },
        { label: 'GRNs', href: '/procurement/grns', icon: <PackageCheck /> },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Stock Levels', href: '/inventory', icon: <Package /> },
        { label: 'Low Stock Alerts', href: '/inventory/alerts', icon: <AlertTriangle /> },
        { label: 'Stock Movements', href: '/inventory/movements', icon: <TrendingUp /> },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Supplier Performance', href: '/procurement/analytics', icon: <BarChart3 /> },
        { label: 'Cost Trends', href: '/procurement/cost-trends', icon: <TrendingDown /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'Create PO', href: '/procurement/purchase-orders/new', icon: <Plus />, variant: 'primary' },
    { label: 'View Low Stock', href: '/inventory/alerts', icon: <AlertTriangle /> },
    { label: 'Record GRN', href: '/procurement/grns/new', icon: <PackageCheck /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Low Stock Items', endpoint: '/inventory/low-stock/alerts', size: 'small', order: 1 },
    { type: 'kpi', title: 'Pending POs', endpoint: '/procurement/purchase-orders', size: 'small', order: 2 },
    { type: 'kpi', title: 'Awaiting GRN', endpoint: '/procurement/grns/pending', size: 'small', order: 3 },
    { type: 'table', title: 'Low Stock Alerts', component: 'LowStockTable', size: 'large', order: 4 },
    { type: 'table', title: 'Pending Purchase Orders', component: 'PendingPOTable', size: 'medium', order: 5 },
    { type: 'chart', title: 'Supplier Performance', component: 'SupplierPerformanceChart', size: 'medium', order: 6 },
  ],
  
  features: ['procurement', 'purchase-orders', 'supplier-management'],
};
```

---

#### L3: Stock Manager (Inventory Control)

```typescript
export const STOCK_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L3,
  roleTypes: [RoleType.STOCK],
  defaultRoute: '/inventory',
  workspaceName: 'Inventory Dashboard',
  
  navGroups: [
    {
      label: 'Inventory',
      items: [
        { label: 'Stock Levels', href: '/inventory', icon: <Package /> },
        { label: 'Stock Movements', href: '/inventory/movements', icon: <TrendingUp /> },
        { label: 'Wastage', href: '/inventory/wastage', icon: <Trash2 /> },
        { label: 'Cycle Counts', href: '/inventory/counts', icon: <ClipboardList /> },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Inventory Turnover', href: '/inventory/turnover', icon: <RefreshCw /> },
        { label: 'Discrepancies', href: '/inventory/discrepancies', icon: <AlertCircle /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'Record Receipt', href: '/inventory/receipts/new', icon: <Plus />, variant: 'primary' },
    { label: 'Record Wastage', href: '/inventory/wastage/new', icon: <Trash2 /> },
    { label: 'Start Cycle Count', href: '/inventory/counts/new', icon: <ClipboardList /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Total Stock Value', endpoint: '/inventory/value', size: 'small', order: 1 },
    { type: 'kpi', title: 'Discrepancies', endpoint: '/inventory/discrepancies', size: 'small', order: 2 },
    { type: 'kpi', title: 'Wastage This Month', endpoint: '/inventory/wastage', size: 'small', order: 3 },
    { type: 'table', title: 'Current Stock Levels', component: 'StockLevelsTable', size: 'large', order: 4 },
    { type: 'chart', title: 'Inventory Turnover', component: 'TurnoverChart', size: 'medium', order: 5 },
    { type: 'alert', title: 'Discrepancies', component: 'DiscrepancyAlerts', size: 'medium', order: 6 },
  ],
  
  features: ['inventory', 'stock-counts', 'wastage-tracking'],
};
```

---

#### L2: Supervisor (Shift Leader)

```typescript
export const SUPERVISOR_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L2,
  roleTypes: [RoleType.SUPERVISOR],
  defaultRoute: '/dashboard/shift',
  workspaceName: 'Shift Dashboard',
  
  navGroups: [
    {
      label: 'Shift',
      items: [
        { label: 'Shift Dashboard', href: '/dashboard/shift', icon: <LayoutDashboard /> },
        { label: 'POS', href: '/pos', icon: <ShoppingCart /> },
        { label: 'Staff Status', href: '/staff/status', icon: <Users /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'View POS', href: '/pos', icon: <ShoppingCart />, variant: 'primary' },
    { label: 'Approve Void', action: () => {}, icon: <XCircle /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Orders This Shift', endpoint: '/analytics/shift', size: 'small', order: 1 },
    { type: 'kpi', title: 'Staff On Duty', endpoint: '/staff/on-duty', size: 'small', order: 2 },
    { type: 'table', title: 'Active Orders', component: 'ActiveOrdersTable', size: 'large', order: 3 },
    { type: 'action-list', title: 'Pending Approvals', component: 'ApprovalQueue', size: 'medium', order: 4 },
  ],
  
  features: ['shift-management', 'order-approval'],
};
```

---

#### L2: Cashier (Payment Processing)

```typescript
export const CASHIER_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L2,
  roleTypes: [RoleType.CASHIER],
  defaultRoute: '/pos?mode=cashier',
  workspaceName: 'Cashier POS',
  
  navGroups: [
    {
      label: 'Cashier',
      items: [
        { label: 'POS', href: '/pos?mode=cashier', icon: <ShoppingCart /> },
        { label: 'My Shift', href: '/cashier/shift', icon: <Clock /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'Process Payment', href: '/pos', icon: <CreditCard />, variant: 'primary' },
    { label: 'Reconcile Cash', href: '/cashier/reconcile', icon: <DollarSign /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Payments Processed', endpoint: '/cashier/shift-stats', size: 'small', order: 1 },
    { type: 'kpi', title: 'Cash Collected', endpoint: '/cashier/shift-stats', size: 'small', order: 2 },
    { type: 'table', title: 'Pending Checkouts', component: 'PendingCheckoutsTable', size: 'large', order: 3 },
  ],
  
  features: ['pos-cashier', 'cash-reconciliation'],
};
```

---

#### L2: Chef (Kitchen Operations)

```typescript
export const CHEF_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L2,
  roleTypes: [RoleType.CHEF],
  defaultRoute: '/kds',
  workspaceName: 'Kitchen Display',
  
  navGroups: [
    {
      label: 'Kitchen',
      items: [
        { label: 'Kitchen Display', href: '/kds', icon: <ChefHat /> },
        { label: 'Recipes', href: '/kitchen/recipes', icon: <BookOpen /> },
        { label: 'Inventory Usage', href: '/kitchen/usage', icon: <Package /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'View Orders', href: '/kds', icon: <ChefHat />, variant: 'primary' },
    { label: 'Record Usage', href: '/kitchen/usage/new', icon: <MinusCircle /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Orders in Queue', endpoint: '/kds/stats', size: 'small', order: 1 },
    { type: 'kpi', title: 'Avg Prep Time', endpoint: '/kds/stats', size: 'small', order: 2 },
    { type: 'table', title: 'Order Queue', component: 'KDSOrderQueue', size: 'full-width', order: 3 },
  ],
  
  features: ['kds', 'recipe-management', 'ingredient-tracking'],
};
```

---

#### L1: Waiter (Front-of-House)

```typescript
export const WAITER_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L1,
  roleTypes: [RoleType.WAITER],
  defaultRoute: '/pos?mode=waiter',
  workspaceName: 'Waiter POS',
  
  navGroups: [
    {
      label: 'Waiter',
      items: [
        { label: 'POS', href: '/pos?mode=waiter', icon: <ShoppingCart /> },
        { label: 'My Tips', href: '/waiter/tips', icon: <DollarSign /> },
        { label: 'My Performance', href: '/waiter/performance', icon: <TrendingUp /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'Take Order', href: '/pos', icon: <Plus />, variant: 'primary' },
    { label: 'View My Tips', href: '/waiter/tips', icon: <DollarSign /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'My Orders Today', endpoint: '/waiter/stats', size: 'small', order: 1 },
    { type: 'kpi', title: 'My Tips Today', endpoint: '/waiter/stats', size: 'small', order: 2 },
    { type: 'table', title: 'My Active Orders', component: 'MyOrdersTable', size: 'large', order: 3 },
  ],
  
  features: ['pos-waiter', 'tips-tracking'],
};
```

---

#### L1: Bartender (Bar Service)

```typescript
export const BARTENDER_CAPABILITY: RoleCapability = {
  roleLevel: RoleLevel.L1,
  roleTypes: [RoleType.BARTENDER],
  defaultRoute: '/pos?mode=bartender',
  workspaceName: 'Bar POS',
  
  navGroups: [
    {
      label: 'Bar',
      items: [
        { label: 'Bar POS', href: '/pos?mode=bartender', icon: <Wine /> },
        { label: 'Bar Inventory', href: '/bar/inventory', icon: <Package /> },
        { label: 'My Tips', href: '/bar/tips', icon: <DollarSign /> },
      ],
    },
  ],
  
  quickActions: [
    { label: 'Take Order', href: '/pos', icon: <Plus />, variant: 'primary' },
    { label: 'Bar Stock Check', href: '/bar/inventory', icon: <Package /> },
  ],
  
  dashboardWidgets: [
    { type: 'kpi', title: 'Drinks Served Today', endpoint: '/bar/stats', size: 'small', order: 1 },
    { type: 'kpi', title: 'Bar Revenue Today', endpoint: '/bar/stats', size: 'small', order: 2 },
    { type: 'table', title: 'Bar Orders', component: 'BarOrdersTable', size: 'large', order: 3 },
  ],
  
  features: ['pos-bartender', 'bar-inventory'],
};
```

---

### Role Detection Logic

```typescript
// apps/web/src/lib/roleCapabilities.ts

export function getRoleCapability(user: User): RoleCapability {
  // Detect role type from email or explicit role field
  const roleType = detectRoleType(user);
  
  // Find matching capability
  const capabilities: RoleCapability[] = [
    OWNER_CAPABILITY,
    MANAGER_CAPABILITY,
    ACCOUNTANT_CAPABILITY,
    PROCUREMENT_CAPABILITY,
    STOCK_CAPABILITY,
    SUPERVISOR_CAPABILITY,
    CASHIER_CAPABILITY,
    CHEF_CAPABILITY,
    WAITER_CAPABILITY,
    BARTENDER_CAPABILITY,
  ];
  
  const capability = capabilities.find((cap) => 
    cap.roleTypes.includes(roleType)
  );
  
  // Fallback to level-based capability if no role type match
  if (!capability) {
    return getLevelBasedCapability(user.roleLevel);
  }
  
  return capability;
}

function detectRoleType(user: User): RoleType {
  // Check explicit role field if exists
  if (user.roleType) {
    return user.roleType as RoleType;
  }
  
  // Detect from email (for demo users)
  const email = user.email.toLowerCase();
  if (email.includes('owner')) return RoleType.OWNER;
  if (email.includes('manager')) return RoleType.MANAGER;
  if (email.includes('accountant')) return RoleType.ACCOUNTANT;
  if (email.includes('procurement')) return RoleType.PROCUREMENT;
  if (email.includes('stock')) return RoleType.STOCK;
  if (email.includes('eventmgr')) return RoleType.EVENT_MANAGER;
  if (email.includes('supervisor')) return RoleType.SUPERVISOR;
  if (email.includes('cashier')) return RoleType.CASHIER;
  if (email.includes('chef')) return RoleType.CHEF;
  if (email.includes('waiter')) return RoleType.WAITER;
  if (email.includes('bartender')) return RoleType.BARTENDER;
  
  // Default to manager for L4+, waiter for L1
  if (user.roleLevel === 'L5' || user.roleLevel === 'L4') {
    return RoleType.MANAGER;
  }
  return RoleType.WAITER;
}
```

---

## Part 2: Industrial-Grade Accounting Workspace

### Accounting Workspace Architecture

**Landing Page:** `/accounting` (redirects to `/accounting/ap` - Accounts Payable dashboard)

**Workspace Structure:**

```
/accounting/
├── index.tsx              (redirect to /ap)
├── ap.tsx                 (Accounts Payable dashboard)
├── ar.tsx                 (Accounts Receivable dashboard)
├── vendors/
│   ├── index.tsx          (vendor list)
│   └── [id].tsx           (vendor detail)
├── bills/
│   ├── index.tsx          (bill list)
│   ├── new.tsx            (create bill form)
│   └── [id].tsx           (bill detail)
├── payments/
│   ├── index.tsx          (payment list)
│   └── new.tsx            (payment processing)
├── gl/
│   ├── index.tsx          (general ledger browser)
│   └── [accountId].tsx    (account detail/transactions)
├── reports/
│   ├── index.tsx          (reports hub)
│   ├── pnl.tsx            (P&L statement)
│   ├── balance-sheet.tsx  (Balance sheet)
│   ├── trial-balance.tsx  (Trial balance)
│   └── cashflow.tsx       (Cashflow statement)
├── periods/
│   ├── index.tsx          (period list)
│   └── close.tsx          (period close workflow)
└── audit.tsx              (audit trail log)
```

---

### AP Dashboard (`/accounting/ap`)

**Purpose:** Primary landing page for accountants, shows AP aging and action items

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Accounts Payable                              [Export CSV] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Total AP     │  │ Due This Week│  │ Overdue      │     │
│  │ UGX 45.2M   │  │ UGX 12.3M   │  │ UGX 3.1M    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ AP Aging Summary                        [View Details]││
│  ├─────────────┬────────┬────────┬────────┬──────────────┤│
│  │ Vendor      │ Current│ 30 Days│ 60 Days│ 90+ Days     ││
│  ├─────────────┼────────┼────────┼────────┼──────────────┤│
│  │ ABC Supplies│ 5.2M   │ 2.1M   │ 1.0M   │ 0.5M         ││
│  │ XYZ Foods   │ 3.4M   │ 1.8M   │ 0.0M   │ 0.0M         ││
│  │ ...         │ ...    │ ...    │ ...    │ ...          ││
│  └─────────────┴────────┴────────┴────────┴──────────────┘│
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Bills Due This Week                    [View All Bills]││
│  ├────────┬───────────┬──────────┬────────┬──────────────┤│
│  │ Bill # │ Vendor    │ Due Date │ Amount │ Action       ││
│  ├────────┼───────────┼──────────┼────────┼──────────────┤│
│  │ B-001  │ ABC Supply│ Dec 26   │ 1.2M   │ [Pay Now]    ││
│  │ B-003  │ XYZ Foods │ Dec 27   │ 850K   │ [Pay Now]    ││
│  │ ...    │ ...       │ ...      │ ...    │ ...          ││
│  └────────┴───────────┴──────────┴────────┴──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ KPI cards (Total AP, Due This Week, Overdue)
- ✅ AP Aging table (bucketed by 0/30/60/90+ days)
- ✅ Bills due this week (actionable, "Pay Now" button)
- ✅ Export CSV button (all data)
- ✅ Drill-down to bill detail

**API Endpoints:**
- `GET /accounting/ap/aging` (already exists)
- `GET /accounting/vendor-bills?status=OPEN&dueDate[lte]=YYYY-MM-DD` (filter bills)

---

### AR Dashboard (`/accounting/ar`)

**Similar to AP Dashboard, but for receivables:**
- AR aging summary (customer invoices)
- Outstanding invoices
- Collection actions

**API Endpoints:**
- `GET /accounting/ar/aging` (already exists)
- `GET /accounting/customer-invoices` (needs creation)

---

### Vendor List (`/accounting/vendors`)

**Purpose:** Manage vendor master data

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Vendors                                   [+ New Vendor]    │
├─────────────────────────────────────────────────────────────┤
│  [Search vendors...] [Filter: All ▾]                       │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Vendor Name     │ Contact       │ Balance   │ Actions  ││
│  ├─────────────────┼───────────────┼───────────┼──────────┤│
│  │ ABC Supplies    │ John Doe      │ UGX 5.2M  │ [View]   ││
│  │ XYZ Foods Ltd.  │ Jane Smith    │ UGX 3.4M  │ [View]   ││
│  │ ...             │ ...           │ ...       │ ...      ││
│  └─────────────────┴───────────────┴───────────┴──────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Data table with search/filter
- ✅ Vendor creation form
- ✅ Vendor detail page (bills, payments, contact info)

**API Endpoints:**
- `GET /accounting/vendors` (already exists)
- `POST /accounting/vendors` (already exists)
- `GET /accounting/vendors/:id` (needs creation)

---

### Bill List (`/accounting/bills`)

**Purpose:** List all vendor bills (open, paid, voided)

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Vendor Bills                                [+ New Bill]    │
├─────────────────────────────────────────────────────────────┤
│  [Search bills...] [Status: All ▾] [Vendor: All ▾]         │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Bill #│ Vendor   │ Date     │ Due Date │ Amount│Status││
│  ├───────┼──────────┼──────────┼──────────┼───────┼──────┤│
│  │ B-001 │ ABC Sup. │ Dec 15   │ Dec 26   │ 1.2M  │OPEN  ││
│  │ B-002 │ XYZ Food │ Dec 18   │ Dec 28   │ 850K  │PAID  ││
│  │ ...   │ ...      │ ...      │ ...      │ ...   │...   ││
│  └───────┴──────────┴──────────┴──────────┴───────┴──────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Data table with filters (status, vendor, date range)
- ✅ Bill creation form (multi-step: vendor → line items → submit)
- ✅ Bill detail page (view PDF, approve, pay, void)
- ✅ Status badges (OPEN, PAID, VOID, OVERDUE)

**API Endpoints:**
- `GET /accounting/vendor-bills` (needs creation)
- `POST /accounting/vendor-bills` (already exists)
- `GET /accounting/vendor-bills/:id` (needs creation)
- `POST /accounting/vendor-bills/:id/open` (already exists)
- `POST /accounting/vendor-bills/:id/void` (needs creation)

---

### Payment Processing (`/accounting/payments/new`)

**Purpose:** Process vendor payment (single or batch)

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Process Vendor Payment                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Select Vendor                                      │
│  ┌─────────────────────────────────────────────────────────┐
│  │ Vendor: [ABC Supplies ▾]                                │
│  │                                                          │
│  │ Outstanding Bills:                                       │
│  │ ☐ B-001 (Dec 26) - UGX 1.2M                             │
│  │ ☐ B-003 (Dec 30) - UGX 850K                             │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
│  Step 2: Payment Details                                    │
│  ┌─────────────────────────────────────────────────────────┐
│  │ Amount:      [1,200,000]                                │
│  │ Method:      [Bank Transfer ▾]                          │
│  │ Reference:   [TXN-12345]                                │
│  │ Payment Date:[Dec 24, 2024]                             │
│  │ Memo:        [Payment for invoice B-001]                │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
│  [Cancel]                                   [Submit Payment]│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Vendor selection dropdown
- ✅ Outstanding bills checkbox list
- ✅ Payment method (CASH, BANK_TRANSFER, MOBILE_MONEY, CHECK)
- ✅ Reference number (bank txn ID)
- ✅ Memo field
- ✅ Auto-mark bills as PAID

**API Endpoints:**
- `POST /accounting/vendor-payments` (already exists)
- `GET /accounting/vendor-bills?vendorId=X&status=OPEN` (needs creation)

---

### General Ledger Browser (`/accounting/gl`)

**Purpose:** Browse chart of accounts and view transactions

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ General Ledger                          [Export Ledger]    │
├─────────────────────────────────────────────────────────────┤
│  [Search accounts...] [Date Range: Dec 2024 ▾]             │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Account Code│ Name            │ Debit    │ Credit      ││
│  ├─────────────┼─────────────────┼──────────┼─────────────┤│
│  │ 1000        │ Cash            │ 12.5M    │ 0           ││
│  │ 1100        │ Accounts Receiv.│ 8.2M     │ 0           ││
│  │ 2000        │ Accounts Payable│ 0        │ 45.2M       ││
│  │ ...         │ ...             │ ...      │ ...         ││
│  └─────────────┴─────────────────┴──────────┴─────────────┘│
│                                                             │
│  [View Transactions] (select account to drill down)        │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Chart of accounts list
- ✅ Debit/Credit totals per account
- ✅ Drill-down to account detail (all transactions)
- ✅ Date range filter

**API Endpoints:**
- `GET /accounting/chart-of-accounts` (needs creation)
- `GET /accounting/gl/accounts/:code/transactions` (needs creation)

---

### Financial Reports Hub (`/accounting/reports`)

**Purpose:** Access all financial reports

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Financial Reports                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ P&L        │  │ Balance    │  │ Trial      │           │
│  │ Statement  │  │ Sheet      │  │ Balance    │           │
│  │            │  │            │  │            │           │
│  │ [View]     │  │ [View]     │  │ [View]     │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Cashflow   │  │ AP Aging   │  │ AR Aging   │           │
│  │ Statement  │  │ Report     │  │ Report     │           │
│  │            │  │            │  │            │           │
│  │ [View]     │  │ [View]     │  │ [View]     │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

### P&L Statement (`/accounting/reports/pnl`)

**Purpose:** Profit & Loss statement with period comparison

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Profit & Loss Statement              [Export PDF] [Excel]  │
├─────────────────────────────────────────────────────────────┤
│  Period: [Dec 1, 2024] to [Dec 31, 2024]                   │
│  Compare to: [Nov 1, 2024] to [Nov 30, 2024]              │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Account            │ Dec 2024  │ Nov 2024  │ Change (%)││
│  ├────────────────────┼───────────┼───────────┼───────────┤│
│  │ Revenue            │           │           │           ││
│  │   Sales Revenue    │  125.4M   │  118.2M   │  +6.1%    ││
│  │   Service Revenue  │   15.2M   │   14.8M   │  +2.7%    ││
│  │ Total Revenue      │  140.6M   │  133.0M   │  +5.7%    ││
│  │                    │           │           │           ││
│  │ Cost of Goods Sold │           │           │           ││
│  │   Food Costs       │   42.3M   │   39.1M   │  +8.2%    ││
│  │   Beverage Costs   │   12.1M   │   11.5M   │  +5.2%    ││
│  │ Total COGS         │   54.4M   │   50.6M   │  +7.5%    ││
│  │                    │           │           │           ││
│  │ Gross Profit       │   86.2M   │   82.4M   │  +4.6%    ││
│  │                    │           │           │           ││
│  │ Operating Expenses │           │           │           ││
│  │   Salaries         │   35.2M   │   34.8M   │  +1.1%    ││
│  │   Rent             │   10.0M   │   10.0M   │   0.0%    ││
│  │   Utilities        │    5.3M   │    4.9M   │  +8.2%    ││
│  │ Total OpEx         │   50.5M   │   49.7M   │  +1.6%    ││
│  │                    │           │           │           ││
│  │ Net Profit         │   35.7M   │   32.7M   │  +9.2%    ││
│  │ Net Margin         │   25.4%   │   24.6%   │  +0.8pp   ││
│  └────────────────────┴───────────┴───────────┴───────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Date range selector (from/to)
- ✅ Period comparison (optional, compare to previous month/quarter/year)
- ✅ Hierarchical account display (revenue → sub-accounts)
- ✅ Totals and subtotals (COGS, Gross Profit, OpEx, Net Profit)
- ✅ Change % column
- ✅ Export PDF/Excel

**API Endpoints:**
- `GET /accounting/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD` (already exists)

---

### Balance Sheet (`/accounting/reports/balance-sheet`)

**Purpose:** Balance sheet (assets, liabilities, equity)

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Balance Sheet                        [Export PDF] [Excel]  │
├─────────────────────────────────────────────────────────────┤
│  As of: [Dec 31, 2024]                                      │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Assets                                                  ││
│  │   Current Assets                                        ││
│  │     Cash                              12.5M             ││
│  │     Accounts Receivable                8.2M             ││
│  │     Inventory                         15.3M             ││
│  │   Total Current Assets                               36.0M│
│  │                                                         ││
│  │   Fixed Assets                                          ││
│  │     Equipment                         25.0M             ││
│  │     Furniture                          8.5M             ││
│  │   Total Fixed Assets                                 33.5M│
│  │                                                         ││
│  │ Total Assets                                         69.5M│
│  │                                                         ││
│  │ Liabilities                                             ││
│  │   Current Liabilities                                   ││
│  │     Accounts Payable                  45.2M             ││
│  │     Short-term Loans                   5.0M             ││
│  │   Total Current Liabilities                          50.2M│
│  │                                                         ││
│  │ Equity                                                  ││
│  │   Owner's Equity                      15.0M             ││
│  │   Retained Earnings                    4.3M             ││
│  │   Total Equity                                       19.3M│
│  │                                                         ││
│  │ Total Liabilities + Equity                           69.5M│
│  └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ As-of date selector
- ✅ Hierarchical display (Assets → Current → sub-accounts)
- ✅ Balance check (Assets = Liabilities + Equity)
- ✅ Export PDF/Excel

**API Endpoints:**
- `GET /accounting/balance-sheet?asOf=YYYY-MM-DD` (already exists)

---

### Trial Balance (`/accounting/reports/trial-balance`)

**Purpose:** List all GL accounts with debit/credit totals (verify GL balance)

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Trial Balance                        [Export PDF] [Excel]  │
├─────────────────────────────────────────────────────────────┤
│  As of: [Dec 31, 2024]                                      │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Account Code│ Account Name      │ Debit    │ Credit    ││
│  ├─────────────┼───────────────────┼──────────┼───────────┤│
│  │ 1000        │ Cash              │  12.5M   │  0        ││
│  │ 1100        │ Accounts Receiv.  │   8.2M   │  0        ││
│  │ 1200        │ Inventory         │  15.3M   │  0        ││
│  │ 2000        │ Accounts Payable  │  0       │ 45.2M     ││
│  │ 3000        │ Owner's Equity    │  0       │ 15.0M     ││
│  │ ...         │ ...               │  ...     │ ...       ││
│  ├─────────────┴───────────────────┼──────────┼───────────┤│
│  │ Total                            │  125.3M  │  125.3M   ││
│  └──────────────────────────────────┴──────────┴───────────┘│
│                                                             │
│  ✅ Trial Balance is balanced (Debit = Credit)             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ As-of date selector
- ✅ All GL accounts with debit/credit
- ✅ Balance verification (Debit total = Credit total)
- ✅ Export PDF/Excel

**API Endpoints:**
- `GET /accounting/trial-balance?asOf=YYYY-MM-DD` (already exists)

---

### Period Management (`/accounting/periods`)

**Purpose:** Manage accounting periods (monthly/quarterly close)

**Features:**
- ✅ List periods (Jan 2024, Feb 2024, Q1 2024, etc.)
- ✅ Period status (OPEN, CLOSED, LOCKED)
- ✅ Period close workflow (validate, reconcile, close)
- ✅ Reopen period (with audit trail)

**API Endpoints:**
- `GET /accounting/periods` (needs creation)
- `POST /accounting/periods/:id/close` (needs creation)
- `POST /accounting/periods/:id/reopen` (needs creation)

---

### Audit Trail (`/accounting/audit`)

**Purpose:** View all accounting transactions with user/timestamp

**Features:**
- ✅ Filterable log (date, user, action type)
- ✅ Immutable audit trail (no deletion)
- ✅ Export audit log

**API Endpoints:**
- `GET /accounting/audit-trail` (needs creation)

---

## Part 3: Dashboard Widget Library

### Widget Component Specifications

**KPI Card:**
```tsx
<KPICard
  title="Total Revenue"
  value="UGX 125.4M"
  delta="+6.1%"
  trend="up"
  icon={<DollarSign />}
  href="/analytics/revenue"
/>
```

**Chart Widget:**
```tsx
<ChartWidget
  title="Revenue Trends"
  type="line"
  endpoint="/analytics/timeseries"
  params={{ from, to, branchId }}
  height={300}
/>
```

**Table Widget:**
```tsx
<TableWidget
  title="Low Stock Items"
  endpoint="/inventory/low-stock/alerts"
  columns={['Item', 'Current', 'Reorder Level', 'Action']}
  actions={[{ label: 'Create PO', href: '/procurement/purchase-orders/new?itemId=' }]}
/>
```

**Alert Panel:**
```tsx
<AlertPanel
  endpoint="/alerts"
  maxItems={5}
  types={['LOW_STOCK', 'OVERDUE_BILL', 'STAFF_ABSENT']}
/>
```

---

## Part 4: Navigation Architecture

### Sidebar Redesign

**Collapsible Groups:**
```tsx
<NavGroup label="Accounting" icon={<DollarSign />} collapsible>
  <NavItem label="Accounts Payable" href="/accounting/ap" badge="5" />
  <NavItem label="Accounts Receivable" href="/accounting/ar" />
  <NavItem label="Vendors" href="/accounting/vendors" />
  <NavItem label="Bills" href="/accounting/bills" />
  <NavItem label="Payments" href="/accounting/payments" />
  <NavItem label="General Ledger" href="/accounting/gl" />
</NavGroup>
```

**Quick Action Buttons (Header):**
```tsx
<QuickActionBar>
  <QuickAction label="New Bill" href="/accounting/bills/new" icon={<Plus />} variant="primary" />
  <QuickAction label="Pay Bill" href="/accounting/payments/new" icon={<CreditCard />} />
  <QuickAction label="Export P&L" action={exportPnL} icon={<Download />} />
</QuickActionBar>
```

---

## Part 5: Post-Login Routing Logic

```typescript
// apps/web/src/lib/postLoginRouting.ts

export function getPostLoginRoute(user: User): string {
  const capability = getRoleCapability(user);
  return capability.defaultRoute;
}

// In _app.tsx or AuthContext:
useEffect(() => {
  if (user && router.pathname === '/login') {
    const defaultRoute = getPostLoginRoute(user);
    router.push(defaultRoute);
  }
}, [user]);
```

---

## Part 6: Settings Redesign

### Settings Hub (`/settings`)

**Role-Based Landing:**
- **L5 Owner:** `/settings/organization` (tax, currency, branches)
- **L4 Accountant:** `/settings/accounting` (chart of accounts, periods, fiscal year)
- **L3 Procurement:** `/settings/procurement` (default suppliers, reorder settings)
- **L1-L2:** `/settings/profile` (personal preferences only)

**Settings Pages:**
- `/settings/organization` - Org-wide settings (L5 only)
- `/settings/branches` - Branch management (L5 only)
- `/settings/accounting` - Accounting config (L4 Accountant)
- `/settings/chart-of-accounts` - COA management (L4 Accountant)
- `/settings/tax` - Tax rates (L4 Accountant)
- `/settings/procurement` - Procurement defaults (L3)
- `/settings/profile` - User profile (all users)
- `/settings/notifications` - Notification preferences (all users)

---

## Conclusion

**Blueprint Complete.** Key deliverables:

1. ✅ **Role Capability Model** with 11 role definitions
2. ✅ **Role-Specific Dashboards** (Executive, Operations, Accounting, Procurement, Stock, FOH, Kitchen)
3. ✅ **Industrial-Grade Accounting Workspace** (14 pages, 20+ features)
4. ✅ **Navigation Architecture** (collapsible groups, quick actions)
5. ✅ **Dashboard Widget Library** (KPI, Chart, Table, Alert components)
6. ✅ **Post-Login Routing Logic**
7. ✅ **Settings Redesign** (role-scoped settings)

**Next Steps:**
- Proceed to **Phase C: Implementation Plan** (break into 5-8 milestones with acceptance criteria)

---

**End of M8 Blueprint**
