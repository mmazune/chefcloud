/**
 * M8.1: Role Capability Configuration
 * 
 * Centralized configuration for role-specific UX:
 * - Default landing route after login
 * - Navigation groups and items
 * - Dashboard variant
 * 
 * This is the SINGLE source of truth for role-based navigation.
 * DO NOT scatter if/else role checks elsewhere.
 */

import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  Wrench,
  Calendar,
  MessageSquare,
  Settings,
  BarChart3,
  FileText,
  ShoppingCart,
  Truck,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowLeftRight,
  CalendarClock,
  Trash2,
  Hand,
  Target,
  AlertTriangle,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Job roles from backend enum
 */
export type JobRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'PROCUREMENT'
  | 'STOCK_MANAGER'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'CHEF'
  | 'WAITER'
  | 'BARTENDER'
  | 'EVENT_MANAGER';

/**
 * Navigation item definition
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

/**
 * Navigation group definition
 */
export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Role capability definition
 */
export interface RoleCapability {
  defaultRoute: string;
  dashboardVariant: string;
  navGroups: NavGroup[];
  workspaceTitle: string;
  workspaceDescription: string;
}

/**
 * Role capabilities configuration
 * Maps each JobRole to its UX configuration
 */
export const ROLE_CAPABILITIES: Record<JobRole, RoleCapability> = {
  OWNER: {
    defaultRoute: '/workspaces/owner',
    dashboardVariant: 'owner',
    workspaceTitle: 'Owner Dashboard',
    workspaceDescription: 'Full visibility across all operations, finances, and staff',
    navGroups: [
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { label: 'Analytics', href: '/analytics', icon: BarChart3 },
          { label: 'Reports', href: '/reports', icon: FileText },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Reservations', href: '/reservations', icon: Calendar },
          { label: 'Inventory', href: '/inventory', icon: Package },
        ],
      },
      {
        title: 'Finance',
        items: [
          { label: 'Finance', href: '/finance', icon: DollarSign },
          { label: 'Service Providers', href: '/service-providers', icon: Wrench },
        ],
      },
      {
        title: 'Team',
        items: [
          { label: 'Staff', href: '/staff', icon: Users },
          { label: 'Feedback', href: '/feedback', icon: MessageSquare },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { label: 'Schedule', href: '/workforce/schedule', icon: Calendar },
          { label: 'Timeclock', href: '/workforce/timeclock', icon: Clock },
          { label: 'Approvals', href: '/workforce/approvals', icon: CheckCircle },
          { label: 'Swap Approvals', href: '/workforce/swaps', icon: ArrowLeftRight },
          { label: 'Labor Reports', href: '/workforce/labor', icon: BarChart3 },
          { label: 'Labor Targets', href: '/workforce/labor-targets', icon: Target },
          { label: 'Staffing Planner', href: '/workforce/staffing-planner', icon: CalendarClock },
          { label: 'Staffing Alerts', href: '/workforce/staffing-alerts', icon: AlertTriangle },
          { label: 'Auto-Scheduler', href: '/workforce/auto-scheduler', icon: Zap },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  MANAGER: {
    defaultRoute: '/workspaces/manager',
    dashboardVariant: 'manager',
    workspaceTitle: 'Manager Dashboard',
    workspaceDescription: 'Operational oversight, staff management, and daily performance',
    navGroups: [
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { label: 'Analytics', href: '/analytics', icon: BarChart3 },
          { label: 'Reports', href: '/reports', icon: FileText },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Reservations', href: '/reservations', icon: Calendar },
          { label: 'Inventory', href: '/inventory', icon: Package },
        ],
      },
      {
        title: 'Team',
        items: [
          { label: 'Staff', href: '/staff', icon: Users },
          { label: 'Feedback', href: '/feedback', icon: MessageSquare },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { label: 'Schedule', href: '/workforce/schedule', icon: Calendar },
          { label: 'Timeclock', href: '/workforce/timeclock', icon: Clock },
          { label: 'Approvals', href: '/workforce/approvals', icon: CheckCircle },
          { label: 'Swap Approvals', href: '/workforce/swaps', icon: ArrowLeftRight },
          { label: 'Labor Reports', href: '/workforce/labor', icon: BarChart3 },
          { label: 'Labor Targets', href: '/workforce/labor-targets', icon: Target },
          { label: 'Staffing Planner', href: '/workforce/staffing-planner', icon: CalendarClock },
          { label: 'Staffing Alerts', href: '/workforce/staffing-alerts', icon: AlertTriangle },
          { label: 'Auto-Scheduler', href: '/workforce/auto-scheduler', icon: Zap },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  ACCOUNTANT: {
    defaultRoute: '/workspaces/accountant',
    dashboardVariant: 'accountant',
    workspaceTitle: 'Accountant Workspace',
    workspaceDescription: 'General ledger, financial statements, and expense tracking',
    navGroups: [
      {
        title: 'General Ledger',
        items: [
          { label: 'Chart of Accounts', href: '/finance/accounts', icon: FileText, description: 'Manage account codes and types' },
          { label: 'Journal Entries', href: '/finance/journal', icon: DollarSign, description: 'View and create journal entries' },
          { label: 'Fiscal Periods', href: '/finance/periods', icon: Calendar, description: 'Manage accounting periods' },
        ],
      },
      {
        title: 'Financial Statements',
        items: [
          { label: 'Trial Balance', href: '/finance/trial-balance', icon: BarChart3, description: 'Account balances report' },
          { label: 'Profit & Loss', href: '/finance/pnl', icon: TrendingUp, description: 'Income statement' },
          { label: 'Balance Sheet', href: '/finance/balance-sheet', icon: FileText, description: 'Assets, liabilities, equity' },
        ],
      },
      {
        title: 'Payables & Receivables',
        items: [
          { label: 'Service Providers', href: '/service-providers', icon: Wrench, description: 'Vendor bills and payments' },
          { label: 'AP Aging', href: '/finance/ap-aging', icon: TrendingUp, description: 'Accounts payable aging' },
          { label: 'AR Aging', href: '/finance/ar-aging', icon: TrendingUp, description: 'Accounts receivable aging' },
        ],
      },
      {
        title: 'Budgets & Reports',
        items: [
          { label: 'Budgets', href: '/finance', icon: DollarSign, description: 'Budget vs actual' },
          { label: 'Reports', href: '/reports', icon: FileText, description: 'Financial reports' },
          { label: 'Analytics', href: '/analytics', icon: BarChart3, description: 'Financial analytics' },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
    ],
  },

  PROCUREMENT: {
    defaultRoute: '/workspaces/procurement',
    dashboardVariant: 'procurement',
    workspaceTitle: 'Procurement Dashboard',
    workspaceDescription: 'Purchase orders, supplier management, and inventory replenishment',
    navGroups: [
      {
        title: 'Procurement',
        items: [
          { label: 'Inventory', href: '/inventory', icon: Package },
          { label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ShoppingCart },
          { label: 'Receipts', href: '/inventory/receipts', icon: Truck },
          { label: 'Transfers', href: '/inventory/transfers', icon: ArrowLeftRight },
          { label: 'Waste', href: '/inventory/waste', icon: Trash2 },
          { label: 'Service Providers', href: '/service-providers', icon: Truck },
        ],
      },
      {
        title: 'Reports',
        items: [
          { label: 'Reports', href: '/reports', icon: FileText },
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
    ],
  },

  STOCK_MANAGER: {
    defaultRoute: '/workspaces/stock-manager',
    dashboardVariant: 'stock',
    workspaceTitle: 'Stock Manager Dashboard',
    workspaceDescription: 'Inventory levels, stock movements, and waste tracking',
    navGroups: [
      {
        title: 'Inventory',
        items: [
          { label: 'Inventory', href: '/inventory', icon: Package },
          { label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: ShoppingCart },
          { label: 'Receipts', href: '/inventory/receipts', icon: Truck },
          { label: 'Transfers', href: '/inventory/transfers', icon: ArrowLeftRight },
          { label: 'Waste', href: '/inventory/waste', icon: Trash2 },
          { label: 'Reports', href: '/reports', icon: FileText },
        ],
      },
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
    ],
  },

  SUPERVISOR: {
    defaultRoute: '/workspaces/supervisor',
    dashboardVariant: 'supervisor',
    workspaceTitle: 'Supervisor Dashboard',
    workspaceDescription: 'Shift oversight, staff coordination, and floor management',
    navGroups: [
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Reservations', href: '/reservations', icon: Calendar },
          { label: 'Staff', href: '/staff', icon: Users },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { label: 'Timeclock', href: '/workforce/timeclock', icon: Clock },
          { label: 'Swap Approvals', href: '/workforce/swaps', icon: ArrowLeftRight },
        ],
      },
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  CASHIER: {
    defaultRoute: '/pos',
    dashboardVariant: 'cashier',
    workspaceTitle: 'Cashier Station',
    workspaceDescription: 'Point of sale, payments, and order management',
    navGroups: [
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { label: 'Timeclock', href: '/workforce/timeclock', icon: Clock },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  CHEF: {
    defaultRoute: '/workspaces/chef',
    dashboardVariant: 'chef',
    workspaceTitle: 'Chef Dashboard',
    workspaceDescription: 'Kitchen display, order queue, and prep management',
    navGroups: [
      {
        title: 'Kitchen',
        items: [
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { label: 'Inventory', href: '/inventory', icon: Package },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { label: 'Timeclock', href: '/workforce/timeclock', icon: Clock },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  WAITER: {
    defaultRoute: '/pos',
    dashboardVariant: 'waiter',
    workspaceTitle: 'Waiter Station',
    workspaceDescription: 'Table management, order taking, and customer service',
    navGroups: [
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Reservations', href: '/reservations', icon: Calendar },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  BARTENDER: {
    defaultRoute: '/pos',
    dashboardVariant: 'bartender',
    workspaceTitle: 'Bartender Station',
    workspaceDescription: 'Bar orders, drink prep, and tab management',
    navGroups: [
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Inventory', href: '/inventory', icon: Package },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },

  EVENT_MANAGER: {
    defaultRoute: '/workspaces/event-manager',
    dashboardVariant: 'events',
    workspaceTitle: 'Event Manager Dashboard',
    workspaceDescription: 'Event planning, reservations, and special occasions',
    navGroups: [
      {
        title: 'Events',
        items: [
          { label: 'Reservations', href: '/reservations', icon: Calendar },
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        title: 'Operations',
        items: [
          { label: 'POS', href: '/pos', icon: ShoppingCart },
          { label: 'Staff', href: '/staff', icon: Users },
        ],
      },
      {
        title: 'My Schedule',
        items: [
          { label: 'My Availability', href: '/workforce/my-availability', icon: CalendarClock },
          { label: 'My Swaps', href: '/workforce/my-swaps', icon: ArrowLeftRight },
          { label: 'Open Shifts', href: '/workforce/open-shifts', icon: Hand },
        ],
      },
      {
        title: 'Settings',
        items: [
          { label: 'Settings', href: '/settings', icon: Settings },
        ],
      },
    ],
  },
};

/**
 * Get role capabilities for a given job role
 * Falls back to MANAGER if role not found
 */
export function getRoleCapabilities(jobRole: JobRole | string | null | undefined): RoleCapability {
  if (!jobRole || !(jobRole in ROLE_CAPABILITIES)) {
    // Fallback to generic MANAGER-like experience
    return ROLE_CAPABILITIES.MANAGER;
  }
  return ROLE_CAPABILITIES[jobRole as JobRole];
}

/**
 * Get default route for a given job role
 */
export function getDefaultRoute(jobRole: JobRole | string | null | undefined): string {
  return getRoleCapabilities(jobRole).defaultRoute;
}

/**
 * Get all nav items flattened (for permission checking)
 */
export function getAllNavItems(jobRole: JobRole | string | null | undefined): NavItem[] {
  const capabilities = getRoleCapabilities(jobRole);
  return capabilities.navGroups.flatMap(group => group.items);
}

/**
 * Check if a route is accessible for a given job role
 */
export function isRouteAccessible(jobRole: JobRole | string | null | undefined, route: string): boolean {
  const navItems = getAllNavItems(jobRole);
  return navItems.some(item => route === item.href || route.startsWith(item.href + '/'));
}
