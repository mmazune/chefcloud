/**
 * HIGH Risk Capability Constants
 * 
 * Defines capabilities for HIGH risk actions that require server-side enforcement.
 * These are enforced via @RequireCapability decorator and CapabilitiesGuard.
 * 
 * Naming convention: DOMAIN_ACTION format for consistency.
 * 
 * @see CapabilitiesGuard for enforcement
 * @see HighRiskAuditService for audit logging
 */

/**
 * HIGH risk capabilities enum
 * Each capability maps to one or more HIGH risk actions from NavMap runtime
 */
export enum HighRiskCapability {
  // ===== OWNER-EXCLUSIVE Capabilities =====
  /** Reopen a closed accounting period - OWNER ONLY */
  FINANCE_PERIOD_REOPEN = 'FINANCE_PERIOD_REOPEN',
  
  /** Post payroll to accounting - OWNER ONLY */
  PAYROLL_POST = 'PAYROLL_POST',
  
  /** Submit tax/benefit remittances - OWNER ONLY */
  REMITTANCE_SUBMIT = 'REMITTANCE_SUBMIT',
  
  /** Manage SaaS subscription (billing) - OWNER ONLY */
  BILLING_MANAGE = 'BILLING_MANAGE',
  
  /** Manage API keys for integrations - OWNER ONLY */
  API_KEY_MANAGE = 'API_KEY_MANAGE',

  // ===== L5 (Owner/Manager) Capabilities =====
  /** Close accounting period */
  FINANCE_PERIOD_CLOSE = 'FINANCE_PERIOD_CLOSE',
  
  /** Create/post journal entries */
  FINANCE_JOURNAL_CREATE = 'FINANCE_JOURNAL_CREATE',
  
  /** Post journal entries (irreversible) */
  FINANCE_JOURNAL_POST = 'FINANCE_JOURNAL_POST',
  
  /** Reverse journal entries */
  FINANCE_JOURNAL_REVERSE = 'FINANCE_JOURNAL_REVERSE',

  // ===== L4+ (Manager+) Capabilities =====
  /** Close inventory period - posts to GL */
  INVENTORY_PERIOD_CLOSE = 'INVENTORY_PERIOD_CLOSE',
  
  /** Approve stocktakes - posts adjustments */
  INVENTORY_STOCKTAKE_APPROVE = 'INVENTORY_STOCKTAKE_APPROVE',
  
  /** Create/approve purchase orders */
  INVENTORY_PO_APPROVE = 'INVENTORY_PO_APPROVE',
  
  /** Finalize receipts - posts to stock */
  INVENTORY_RECEIPT_FINALIZE = 'INVENTORY_RECEIPT_FINALIZE',
  
  /** Create payroll runs */
  PAYROLL_RUN_CREATE = 'PAYROLL_RUN_CREATE',
  
  /** Finalize payroll runs */
  PAYROLL_RUN_FINALIZE = 'PAYROLL_RUN_FINALIZE',
  
  /** Create remittances */
  REMITTANCE_CREATE = 'REMITTANCE_CREATE',
  
  /** Post bills to AP */
  FINANCE_BILL_POST = 'FINANCE_BILL_POST',
  
  /** Post invoices to AR */
  FINANCE_INVOICE_POST = 'FINANCE_INVOICE_POST',

  // ===== L3+ Capabilities =====
  /** Void orders */
  POS_ORDER_VOID = 'POS_ORDER_VOID',
  
  /** Close cash sessions */
  POS_CASH_SESSION_CLOSE = 'POS_CASH_SESSION_CLOSE',
  
  /** Create inventory transfers */
  INVENTORY_TRANSFER_CREATE = 'INVENTORY_TRANSFER_CREATE',
  
  /** Record inventory waste */
  INVENTORY_WASTE_CREATE = 'INVENTORY_WASTE_CREATE',
  
  /** Create stocktakes */
  INVENTORY_STOCKTAKE_CREATE = 'INVENTORY_STOCKTAKE_CREATE',
}

/**
 * Capability to minimum role level mapping
 * L5 = Owner, L4 = Manager, L3 = Supervisor-level
 */
export const CAPABILITY_ROLE_MAP: Record<HighRiskCapability, 'L5' | 'L4' | 'L3'> = {
  // OWNER-EXCLUSIVE (L5 only)
  [HighRiskCapability.FINANCE_PERIOD_REOPEN]: 'L5',
  [HighRiskCapability.PAYROLL_POST]: 'L5',
  [HighRiskCapability.REMITTANCE_SUBMIT]: 'L5',
  [HighRiskCapability.BILLING_MANAGE]: 'L5',
  [HighRiskCapability.API_KEY_MANAGE]: 'L5',
  
  // L5 (but Manager with L4 cannot do)
  [HighRiskCapability.FINANCE_PERIOD_CLOSE]: 'L5',
  [HighRiskCapability.FINANCE_JOURNAL_CREATE]: 'L5',
  [HighRiskCapability.FINANCE_JOURNAL_POST]: 'L5',
  [HighRiskCapability.FINANCE_JOURNAL_REVERSE]: 'L5',
  
  // L4+ (Manager+)
  [HighRiskCapability.INVENTORY_PERIOD_CLOSE]: 'L4',
  [HighRiskCapability.INVENTORY_STOCKTAKE_APPROVE]: 'L4',
  [HighRiskCapability.INVENTORY_PO_APPROVE]: 'L4',
  [HighRiskCapability.INVENTORY_RECEIPT_FINALIZE]: 'L4',
  [HighRiskCapability.PAYROLL_RUN_CREATE]: 'L4',
  [HighRiskCapability.PAYROLL_RUN_FINALIZE]: 'L4',
  [HighRiskCapability.REMITTANCE_CREATE]: 'L4',
  [HighRiskCapability.FINANCE_BILL_POST]: 'L4',
  [HighRiskCapability.FINANCE_INVOICE_POST]: 'L4',
  
  // L3+ (Supervisor-level)
  [HighRiskCapability.POS_ORDER_VOID]: 'L3',
  [HighRiskCapability.POS_CASH_SESSION_CLOSE]: 'L3',
  [HighRiskCapability.INVENTORY_TRANSFER_CREATE]: 'L3',
  [HighRiskCapability.INVENTORY_WASTE_CREATE]: 'L3',
  [HighRiskCapability.INVENTORY_STOCKTAKE_CREATE]: 'L3',
};

/**
 * Check if a user's role level meets the capability requirement
 */
export function hasCapability(userRoleLevel: string, capability: HighRiskCapability): boolean {
  const requiredLevel = CAPABILITY_ROLE_MAP[capability];
  const hierarchy = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  
  const userLevel = hierarchy[userRoleLevel as keyof typeof hierarchy] || 0;
  const requiredLevelNum = hierarchy[requiredLevel as keyof typeof hierarchy] || 5;
  
  return userLevel >= requiredLevelNum;
}

/**
 * Get all capabilities for a given role level
 */
export function getCapabilitiesForRole(roleLevel: string): HighRiskCapability[] {
  return Object.entries(CAPABILITY_ROLE_MAP)
    .filter(([, reqLevel]) => hasCapability(roleLevel, Object.keys(CAPABILITY_ROLE_MAP).find(k => CAPABILITY_ROLE_MAP[k as HighRiskCapability] === reqLevel) as HighRiskCapability))
    .map(([cap]) => cap as HighRiskCapability);
}
