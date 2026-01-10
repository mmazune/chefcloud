/**
 * Role Capability Model - Single Source of Truth
 * 
 * This module defines the canonical RBAC model used by both FE and BE:
 * - RoleKey: Union type of all valid role identifiers
 * - CapabilityKey: All HIGH risk capabilities
 * - roleCapabilities: Record mapping roles to their metadata and capabilities
 * 
 * @see docs/runbooks/DEV_GUIDE.md for "RBAC Single Source of Truth"
 */

// ============================================================================
// ROLE KEYS
// ============================================================================

/**
 * Role key union - all valid role identifiers
 * Maps to NavMap runtime JSON filenames
 */
export type RoleKey =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'WAITER'
  | 'CHEF'
  | 'BARTENDER'
  | 'PROCUREMENT'
  | 'STOCK_MANAGER'
  | 'EVENT_MANAGER';

/**
 * All role keys as an array (for iteration)
 */
export const ROLE_KEYS: RoleKey[] = [
  'OWNER',
  'MANAGER',
  'ACCOUNTANT',
  'SUPERVISOR',
  'CASHIER',
  'WAITER',
  'CHEF',
  'BARTENDER',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'EVENT_MANAGER',
];

/**
 * Role level mapping (L1-L5 hierarchy)
 * L5 = Owner (highest), L1 = Basic staff (lowest)
 */
export type RoleLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export const ROLE_LEVEL_HIERARCHY: Record<RoleLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

// ============================================================================
// CAPABILITY KEYS
// ============================================================================

/**
 * HIGH risk capabilities - enforced at API level
 * Naming: DOMAIN_ACTION format
 */
export type CapabilityKey =
  // OWNER-EXCLUSIVE (L5 only)
  | 'FINANCE_PERIOD_REOPEN'
  | 'PAYROLL_POST'
  | 'REMITTANCE_SUBMIT'
  | 'BILLING_MANAGE'
  | 'API_KEY_MANAGE'
  // L5 Finance
  | 'FINANCE_PERIOD_CLOSE'
  | 'FINANCE_JOURNAL_CREATE'
  | 'FINANCE_JOURNAL_POST'
  | 'FINANCE_JOURNAL_REVERSE'
  // L4+ Manager
  | 'INVENTORY_PERIOD_CLOSE'
  | 'INVENTORY_STOCKTAKE_APPROVE'
  | 'INVENTORY_PO_APPROVE'
  | 'INVENTORY_RECEIPT_FINALIZE'
  | 'PAYROLL_RUN_CREATE'
  | 'PAYROLL_RUN_FINALIZE'
  | 'REMITTANCE_CREATE'
  | 'FINANCE_BILL_POST'
  | 'FINANCE_INVOICE_POST'
  // L3+ Supervisor
  | 'POS_ORDER_VOID'
  | 'POS_CASH_SESSION_CLOSE'
  | 'INVENTORY_TRANSFER_CREATE'
  | 'INVENTORY_WASTE_CREATE'
  | 'INVENTORY_STOCKTAKE_CREATE';

/**
 * All capability keys as an array (for iteration/validation)
 */
export const CAPABILITY_KEYS: CapabilityKey[] = [
  'FINANCE_PERIOD_REOPEN',
  'PAYROLL_POST',
  'REMITTANCE_SUBMIT',
  'BILLING_MANAGE',
  'API_KEY_MANAGE',
  'FINANCE_PERIOD_CLOSE',
  'FINANCE_JOURNAL_CREATE',
  'FINANCE_JOURNAL_POST',
  'FINANCE_JOURNAL_REVERSE',
  'INVENTORY_PERIOD_CLOSE',
  'INVENTORY_STOCKTAKE_APPROVE',
  'INVENTORY_PO_APPROVE',
  'INVENTORY_RECEIPT_FINALIZE',
  'PAYROLL_RUN_CREATE',
  'PAYROLL_RUN_FINALIZE',
  'REMITTANCE_CREATE',
  'FINANCE_BILL_POST',
  'FINANCE_INVOICE_POST',
  'POS_ORDER_VOID',
  'POS_CASH_SESSION_CLOSE',
  'INVENTORY_TRANSFER_CREATE',
  'INVENTORY_WASTE_CREATE',
  'INVENTORY_STOCKTAKE_CREATE',
];

/**
 * Minimum role level required for each capability
 */
export const CAPABILITY_LEVEL_MAP: Record<CapabilityKey, RoleLevel> = {
  // OWNER-EXCLUSIVE (L5 only)
  FINANCE_PERIOD_REOPEN: 'L5',
  PAYROLL_POST: 'L5',
  REMITTANCE_SUBMIT: 'L5',
  BILLING_MANAGE: 'L5',
  API_KEY_MANAGE: 'L5',
  // L5 Finance
  FINANCE_PERIOD_CLOSE: 'L5',
  FINANCE_JOURNAL_CREATE: 'L5',
  FINANCE_JOURNAL_POST: 'L5',
  FINANCE_JOURNAL_REVERSE: 'L5',
  // L4+ Manager
  INVENTORY_PERIOD_CLOSE: 'L4',
  INVENTORY_STOCKTAKE_APPROVE: 'L4',
  INVENTORY_PO_APPROVE: 'L4',
  INVENTORY_RECEIPT_FINALIZE: 'L4',
  PAYROLL_RUN_CREATE: 'L4',
  PAYROLL_RUN_FINALIZE: 'L4',
  REMITTANCE_CREATE: 'L4',
  FINANCE_BILL_POST: 'L4',
  FINANCE_INVOICE_POST: 'L4',
  // L3+ Supervisor
  POS_ORDER_VOID: 'L3',
  POS_CASH_SESSION_CLOSE: 'L3',
  INVENTORY_TRANSFER_CREATE: 'L3',
  INVENTORY_WASTE_CREATE: 'L3',
  INVENTORY_STOCKTAKE_CREATE: 'L3',
};

// ============================================================================
// ROLE CAPABILITIES MODEL
// ============================================================================

/**
 * Role metadata and capabilities
 */
export interface RoleCapability {
  /** Role display label */
  label: string;
  /** Role level (L1-L5) */
  level: RoleLevel;
  /** Numeric level for comparison */
  levelNum: number;
  /** Default landing route after login */
  landingRoute: string;
  /** NavMap runtime JSON filename */
  runtimeFile: string;
  /** All capabilities this role has access to */
  capabilities: CapabilityKey[];
  /** Optional feature flags for this role */
  featureFlags?: string[];
}

/**
 * Canonical role capabilities model
 * Maps each role to its metadata and allowed capabilities
 */
export const roleCapabilities: Record<RoleKey, RoleCapability> = {
  OWNER: {
    label: 'Owner',
    level: 'L5',
    levelNum: 5,
    landingRoute: '/dashboard',
    runtimeFile: 'owner.runtime.json',
    capabilities: [...CAPABILITY_KEYS], // Owner has ALL capabilities
    featureFlags: ['beta_features', 'experimental'],
  },
  MANAGER: {
    label: 'Manager',
    level: 'L4',
    levelNum: 4,
    landingRoute: '/dashboard',
    runtimeFile: 'manager.runtime.json',
    capabilities: CAPABILITY_KEYS.filter(cap => {
      const level = CAPABILITY_LEVEL_MAP[cap];
      return ROLE_LEVEL_HIERARCHY[level] <= 4;
    }),
  },
  ACCOUNTANT: {
    label: 'Accountant',
    level: 'L4',
    levelNum: 4,
    landingRoute: '/dashboard',
    runtimeFile: 'accountant.runtime.json',
    capabilities: [
      // Accountant has finance-focused L4 capabilities
      'INVENTORY_PERIOD_CLOSE',
      'FINANCE_BILL_POST',
      'FINANCE_INVOICE_POST',
      'PAYROLL_RUN_CREATE',
      'PAYROLL_RUN_FINALIZE',
      'REMITTANCE_CREATE',
    ],
  },
  SUPERVISOR: {
    label: 'Supervisor',
    level: 'L2',
    levelNum: 2,
    landingRoute: '/pos',
    runtimeFile: 'supervisor.runtime.json',
    capabilities: [
      // Supervisor has operational L3 capabilities
      'POS_ORDER_VOID',
      'POS_CASH_SESSION_CLOSE',
    ],
  },
  CASHIER: {
    label: 'Cashier',
    level: 'L2',
    levelNum: 2,
    landingRoute: '/pos',
    runtimeFile: 'cashier.runtime.json',
    capabilities: [], // No HIGH risk capabilities
  },
  WAITER: {
    label: 'Waiter',
    level: 'L1',
    levelNum: 1,
    landingRoute: '/pos',
    runtimeFile: 'waiter.runtime.json',
    capabilities: [], // No HIGH risk capabilities
  },
  CHEF: {
    label: 'Chef',
    level: 'L2',
    levelNum: 2,
    landingRoute: '/kds',
    runtimeFile: 'chef.runtime.json',
    capabilities: [], // No HIGH risk capabilities
  },
  BARTENDER: {
    label: 'Bartender',
    level: 'L1',
    levelNum: 1,
    landingRoute: '/pos',
    runtimeFile: 'bartender.runtime.json',
    capabilities: [], // No HIGH risk capabilities
  },
  PROCUREMENT: {
    label: 'Procurement',
    level: 'L3',
    levelNum: 3,
    landingRoute: '/inventory',
    runtimeFile: 'procurement.runtime.json',
    capabilities: [
      'INVENTORY_TRANSFER_CREATE',
      'INVENTORY_WASTE_CREATE',
      'INVENTORY_STOCKTAKE_CREATE',
    ],
  },
  STOCK_MANAGER: {
    label: 'Stock Manager',
    level: 'L3',
    levelNum: 3,
    landingRoute: '/inventory',
    runtimeFile: 'stock_manager.runtime.json',
    capabilities: [
      'INVENTORY_TRANSFER_CREATE',
      'INVENTORY_WASTE_CREATE',
      'INVENTORY_STOCKTAKE_CREATE',
    ],
  },
  EVENT_MANAGER: {
    label: 'Event Manager',
    level: 'L3',
    levelNum: 3,
    landingRoute: '/reservations',
    runtimeFile: 'event_manager.runtime.json',
    capabilities: [], // Reservations-focused, no HIGH risk inventory/finance
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get role capabilities by role key
 */
export function getRoleCapabilities(role: RoleKey): RoleCapability {
  return roleCapabilities[role];
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(role: RoleKey, capability: CapabilityKey): boolean {
  const roleData = roleCapabilities[role];
  if (!roleData) return false;
  return roleData.capabilities.includes(capability);
}

/**
 * Check if a role level meets the capability requirement (level-based check)
 */
export function levelHasCapability(level: RoleLevel, capability: CapabilityKey): boolean {
  const requiredLevel = CAPABILITY_LEVEL_MAP[capability];
  return ROLE_LEVEL_HIERARCHY[level] >= ROLE_LEVEL_HIERARCHY[requiredLevel];
}

/**
 * Get all roles that have a specific capability
 */
export function getRolesWithCapability(capability: CapabilityKey): RoleKey[] {
  return ROLE_KEYS.filter(role => roleHasCapability(role, capability));
}

/**
 * Validate that a capability key is valid
 */
export function isValidCapability(cap: string): cap is CapabilityKey {
  return CAPABILITY_KEYS.includes(cap as CapabilityKey);
}

/**
 * Validate that a role key is valid
 */
export function isValidRole(role: string): role is RoleKey {
  return ROLE_KEYS.includes(role as RoleKey);
}
