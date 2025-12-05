import { BillingPlanId } from '@/types/billing';

/**
 * Plan capabilities that control access to specific features.
 * Used to gate high-tier features (Dev Portal, Franchise analytics) based on subscription plan.
 */
export interface PlanCapabilities {
  canUseFranchiseAnalytics: boolean;
  canUseDevPortal: boolean;
  canUseKdsMultiStation: boolean;
  canUseFranchiseExports: boolean;
  canUseApiUsageAnalytics: boolean;
}

/**
 * Simple helper to classify plans into tiers.
 * Micros plans: MICROS_STARTER, MICROS_PRO => no franchise features.
 * Franchise plans: FRANCHISE_CORE, FRANCHISE_PLUS, everything else => full capabilities.
 */
function isMicrosPlan(planId: BillingPlanId | null | undefined): boolean {
  if (!planId) return false; // unknown => fail-open (do not block features)
  const id = String(planId).toUpperCase();
  return id.startsWith('MICROS_');
}

export function getPlanCapabilities(planId: BillingPlanId | null | undefined): PlanCapabilities {
  const micros = isMicrosPlan(planId);

  if (micros) {
    return {
      canUseFranchiseAnalytics: false,
      canUseDevPortal: false,
      canUseKdsMultiStation: true, // KDS still allowed, just no franchise HQ features
      canUseFranchiseExports: false,
      canUseApiUsageAnalytics: false,
    };
  }

  // Franchise / enterprise: full power
  return {
    canUseFranchiseAnalytics: true,
    canUseDevPortal: true,
    canUseKdsMultiStation: true,
    canUseFranchiseExports: true,
    canUseApiUsageAnalytics: true,
  };
}
