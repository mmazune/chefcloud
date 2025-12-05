import { getPlanCapabilities } from '../planCapabilities';
import { BillingPlanId } from '@/types/billing';

describe('getPlanCapabilities', () => {
  it('returns restricted capabilities for MICROS_STARTER plan', () => {
    const caps = getPlanCapabilities('MICROS_STARTER' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(false);
    expect(caps.canUseDevPortal).toBe(false);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(false);
    expect(caps.canUseApiUsageAnalytics).toBe(false);
  });

  it('returns restricted capabilities for MICROS_PRO plan', () => {
    const caps = getPlanCapabilities('MICROS_PRO' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(false);
    expect(caps.canUseDevPortal).toBe(false);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(false);
    expect(caps.canUseApiUsageAnalytics).toBe(false);
  });

  it('returns full capabilities for FRANCHISE_CORE plan', () => {
    const caps = getPlanCapabilities('FRANCHISE_CORE' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(true);
    expect(caps.canUseDevPortal).toBe(true);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(true);
    expect(caps.canUseApiUsageAnalytics).toBe(true);
  });

  it('returns full capabilities for FRANCHISE_PLUS plan', () => {
    const caps = getPlanCapabilities('FRANCHISE_PLUS' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(true);
    expect(caps.canUseDevPortal).toBe(true);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(true);
    expect(caps.canUseApiUsageAnalytics).toBe(true);
  });

  it('returns full capabilities for unknown plan ID (fail-open)', () => {
    const caps = getPlanCapabilities('CUSTOM_ENTERPRISE_PLAN' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(true);
    expect(caps.canUseDevPortal).toBe(true);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(true);
    expect(caps.canUseApiUsageAnalytics).toBe(true);
  });

  it('returns full capabilities for null plan ID (fail-open)', () => {
    const caps = getPlanCapabilities(null);

    expect(caps.canUseFranchiseAnalytics).toBe(true);
    expect(caps.canUseDevPortal).toBe(true);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(true);
    expect(caps.canUseApiUsageAnalytics).toBe(true);
  });

  it('returns full capabilities for undefined plan ID (fail-open)', () => {
    const caps = getPlanCapabilities(undefined);

    expect(caps.canUseFranchiseAnalytics).toBe(true);
    expect(caps.canUseDevPortal).toBe(true);
    expect(caps.canUseKdsMultiStation).toBe(true);
    expect(caps.canUseFranchiseExports).toBe(true);
    expect(caps.canUseApiUsageAnalytics).toBe(true);
  });

  it('handles case-insensitive micros plan detection', () => {
    const caps = getPlanCapabilities('micros_starter' as BillingPlanId);

    expect(caps.canUseFranchiseAnalytics).toBe(false);
    expect(caps.canUseDevPortal).toBe(false);
  });
});
