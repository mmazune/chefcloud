/**
 * Unit tests for billingStatusHelpers
 * E24-BILLING-FE-S4, E24-BILLING-FE-S5
 */

import { getBillingStatusMeta, isSubscriptionInRiskState } from './billingStatusHelpers';
import { OrgSubscriptionDto } from '@/types/billing';

describe('getBillingStatusMeta', () => {
  it('returns null when subscription is null', () => {
    const result = getBillingStatusMeta(null);
    expect(result).toBeNull();
  });

  it('returns null when subscription is undefined', () => {
    const result = getBillingStatusMeta(undefined as any);
    expect(result).toBeNull();
  });

  describe('IN_TRIAL status', () => {
    it('returns correct metadata for trial subscription', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-123',
        orgId: 'org-123',
        planId: 'FRANCHISE_CORE',
        status: 'IN_TRIAL',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('info');
      expect(result?.label).toBe('Trial');
      expect(result?.showUpdatePaymentCta).toBe(true);
      expect(result?.showContactSupportCta).toBe(false);
      expect(result?.headline).toContain('trial');
      expect(result?.subtext).toContain('trial');
    });
  });

  describe('PAST_DUE status', () => {
    it('returns correct metadata for past due subscription', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-456',
        orgId: 'org-456',
        planId: 'FRANCHISE_PLUS',
        status: 'PAST_DUE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('warning');
      expect(result?.label).toBe('Payment issue');
      expect(result?.showUpdatePaymentCta).toBe(true);
      expect(result?.showContactSupportCta).toBe(true);
      expect(result?.headline).toContain('past due');
      expect(result?.subtext).toContain('payment details');
    });
  });

  describe('EXPIRED status', () => {
    it('returns correct metadata for expired subscription', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-789',
        orgId: 'org-789',
        planId: 'MICROS_PRO',
        status: 'EXPIRED',
        currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('danger');
      expect(result?.label).toBe('Expired');
      expect(result?.showUpdatePaymentCta).toBe(true);
      expect(result?.showContactSupportCta).toBe(true);
      expect(result?.headline).toContain('expired');
      expect(result?.subtext).toContain('payment details');
    });
  });

  describe('CANCELED status', () => {
    it('returns correct metadata for canceled subscription', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-abc',
        orgId: 'org-abc',
        planId: 'FRANCHISE_CORE',
        status: 'CANCELED',
        canceledAt: new Date().toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('danger');
      expect(result?.label).toBe('Canceled');
      expect(result?.showUpdatePaymentCta).toBe(true);
      expect(result?.showContactSupportCta).toBe(true);
      expect(result?.headline).toContain('canceled');
      expect(result?.subtext).toContain('reactivate');
    });
  });

  describe('ACTIVE status', () => {
    it('returns correct metadata for active subscription', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-def',
        orgId: 'org-def',
        planId: 'FRANCHISE_PLUS',
        status: 'ACTIVE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('success');
      expect(result?.label).toBe('Active');
      expect(result?.showUpdatePaymentCta).toBe(false);
      expect(result?.showContactSupportCta).toBe(false);
      expect(result?.headline).toContain('active');
      expect(result?.subtext).toContain('billing date');
    });
  });

  describe('Unknown status', () => {
    it('treats unknown status as active', () => {
      const subscription: OrgSubscriptionDto = {
        id: 'sub-xyz',
        orgId: 'org-xyz',
        planId: 'ENTERPRISE_CUSTOM',
        status: 'UNKNOWN_STATUS' as any,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = getBillingStatusMeta(subscription);

      expect(result).not.toBeNull();
      expect(result?.tone).toBe('success');
      expect(result?.showUpdatePaymentCta).toBe(false);
      expect(result?.showContactSupportCta).toBe(false);
    });
  });
});

describe('isSubscriptionInRiskState', () => {
  it('returns false for null subscription', () => {
    expect(isSubscriptionInRiskState(null)).toBe(false);
  });

  it('returns true for PAST_DUE subscription', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-pastdue',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'PAST_DUE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(true);
  });

  it('returns true for EXPIRED subscription', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-expired',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'EXPIRED',
      currentPeriodStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(true);
  });

  it('returns true for CANCELED subscription', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-canceled',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'CANCELED',
      canceledAt: new Date().toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(true);
  });

  it('returns false for IN_TRIAL subscription', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-trial',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'IN_TRIAL',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(false);
  });

  it('returns false for ACTIVE subscription', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-active',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(false);
  });

  it('returns false for unknown subscription status', () => {
    const subscription: OrgSubscriptionDto = {
      id: 'sub-unknown',
      orgId: 'org-123',
      planId: 'FRANCHISE_CORE',
      status: 'UNKNOWN' as any,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isSubscriptionInRiskState(subscription)).toBe(false);
  });
});
