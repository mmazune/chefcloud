/**
 * HIGH Risk Capability Constants
 * 
 * This module re-exports from @chefcloud/contracts (the single source of truth)
 * and provides backward-compatible aliases for existing BE code.
 * 
 * @see packages/contracts/src/rbac/roleCapabilities.ts for the canonical model
 * @see CapabilitiesGuard for enforcement
 * @see HighRiskAuditService for audit logging
 */

// Re-export from shared contracts (single source of truth)
export {
  type CapabilityKey,
  type RoleKey,
  type RoleLevel,
  CAPABILITY_KEYS,
  CAPABILITY_LEVEL_MAP,
  ROLE_KEYS,
  ROLE_LEVEL_HIERARCHY,
  roleCapabilities,
  getRoleCapabilities,
  roleHasCapability,
  levelHasCapability,
  getRolesWithCapability,
  isValidCapability,
  isValidRole,
} from '@chefcloud/contracts';

import { 
  type CapabilityKey,
  CAPABILITY_KEYS,
  CAPABILITY_LEVEL_MAP,
  type RoleLevel,
  ROLE_LEVEL_HIERARCHY,
} from '@chefcloud/contracts';

/**
 * HIGH risk capabilities enum (backward-compatible alias)
 * 
 * @deprecated Use CapabilityKey type from @chefcloud/contracts instead
 */
export enum HighRiskCapability {
  // ===== OWNER-EXCLUSIVE Capabilities =====
  FINANCE_PERIOD_REOPEN = 'FINANCE_PERIOD_REOPEN',
  PAYROLL_POST = 'PAYROLL_POST',
  REMITTANCE_SUBMIT = 'REMITTANCE_SUBMIT',
  BILLING_MANAGE = 'BILLING_MANAGE',
  API_KEY_MANAGE = 'API_KEY_MANAGE',

  // ===== L5 Capabilities =====
  FINANCE_PERIOD_CLOSE = 'FINANCE_PERIOD_CLOSE',
  FINANCE_JOURNAL_CREATE = 'FINANCE_JOURNAL_CREATE',
  FINANCE_JOURNAL_POST = 'FINANCE_JOURNAL_POST',
  FINANCE_JOURNAL_REVERSE = 'FINANCE_JOURNAL_REVERSE',

  // ===== L4+ Capabilities =====
  INVENTORY_PERIOD_CLOSE = 'INVENTORY_PERIOD_CLOSE',
  INVENTORY_STOCKTAKE_APPROVE = 'INVENTORY_STOCKTAKE_APPROVE',
  INVENTORY_PO_APPROVE = 'INVENTORY_PO_APPROVE',
  INVENTORY_RECEIPT_FINALIZE = 'INVENTORY_RECEIPT_FINALIZE',
  PAYROLL_RUN_CREATE = 'PAYROLL_RUN_CREATE',
  PAYROLL_RUN_FINALIZE = 'PAYROLL_RUN_FINALIZE',
  REMITTANCE_CREATE = 'REMITTANCE_CREATE',
  FINANCE_BILL_POST = 'FINANCE_BILL_POST',
  FINANCE_INVOICE_POST = 'FINANCE_INVOICE_POST',

  // ===== L3+ Capabilities =====
  POS_ORDER_VOID = 'POS_ORDER_VOID',
  POS_CASH_SESSION_CLOSE = 'POS_CASH_SESSION_CLOSE',
  INVENTORY_TRANSFER_CREATE = 'INVENTORY_TRANSFER_CREATE',
  INVENTORY_WASTE_CREATE = 'INVENTORY_WASTE_CREATE',
  INVENTORY_STOCKTAKE_CREATE = 'INVENTORY_STOCKTAKE_CREATE',
}

/**
 * Capability to minimum role level mapping
 * @deprecated Use CAPABILITY_LEVEL_MAP from @chefcloud/contracts instead
 */
export const CAPABILITY_ROLE_MAP: Record<HighRiskCapability, 'L5' | 'L4' | 'L3'> = 
  CAPABILITY_LEVEL_MAP as Record<HighRiskCapability, 'L5' | 'L4' | 'L3'>;

/**
 * Check if a user's role level meets the capability requirement
 * @deprecated Use levelHasCapability from @chefcloud/contracts instead
 */
export function hasCapability(userRoleLevel: string, capability: HighRiskCapability): boolean {
  const capKey = capability as CapabilityKey;
  const requiredLevel = CAPABILITY_LEVEL_MAP[capKey];
  if (!requiredLevel) return false;
  
  const userLevel = ROLE_LEVEL_HIERARCHY[userRoleLevel as RoleLevel] || 0;
  const requiredLevelNum = ROLE_LEVEL_HIERARCHY[requiredLevel] || 5;
  
  return userLevel >= requiredLevelNum;
}

/**
 * Get all capabilities for a given role level
 * @deprecated Use getRoleCapabilities from @chefcloud/contracts instead
 */
export function getCapabilitiesForRole(roleLevel: string): HighRiskCapability[] {
  const userLevel = ROLE_LEVEL_HIERARCHY[roleLevel as RoleLevel] || 0;
  
  return CAPABILITY_KEYS.filter(cap => {
    const requiredLevel = CAPABILITY_LEVEL_MAP[cap];
    const requiredLevelNum = ROLE_LEVEL_HIERARCHY[requiredLevel] || 5;
    return userLevel >= requiredLevelNum;
  }) as HighRiskCapability[];
}
