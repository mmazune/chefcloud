/**
 * Billing status helper functions
 * E24-BILLING-FE-S4
 */

import { OrgSubscriptionDto } from '@/types/billing';

export type StatusTone = 'info' | 'warning' | 'danger' | 'success';

export interface StatusMeta {
  tone: StatusTone;
  label: string;
  headline: string;
  subtext: string;
  showUpdatePaymentCta: boolean;
  showContactSupportCta: boolean;
}

/**
 * Maps subscription status to UI metadata for the billing status banner
 */
export function getBillingStatusMeta(
  subscription: OrgSubscriptionDto | null | undefined,
): StatusMeta | null {
  if (!subscription) {
    return null;
  }

  const { status } = subscription;

  switch (status) {
    case 'IN_TRIAL':
      return {
        tone: 'info',
        label: 'Trial',
        headline: 'You are currently in a trial period',
        subtext:
          'Update your payment details to continue using ChefCloud after your trial ends.',
        showUpdatePaymentCta: true,
        showContactSupportCta: false,
      };

    case 'PAST_DUE':
      return {
        tone: 'warning',
        label: 'Payment issue',
        headline: 'Payment is past due',
        subtext:
          'Your most recent payment failed. Please update your payment details to avoid service interruption.',
        showUpdatePaymentCta: true,
        showContactSupportCta: true,
      };

    case 'EXPIRED':
      return {
        tone: 'danger',
        label: 'Expired',
        headline: 'Your subscription has expired',
        subtext:
          'Your subscription ended and you no longer have access to paid features. Update your payment details to restore access.',
        showUpdatePaymentCta: true,
        showContactSupportCta: true,
      };

    case 'CANCELED':
      return {
        tone: 'danger',
        label: 'Canceled',
        headline: 'Your subscription has been canceled',
        subtext:
          'Your subscription was canceled and will not renew. Contact support if you want to reactivate.',
        showUpdatePaymentCta: true,
        showContactSupportCta: true,
      };

    case 'ACTIVE':
      return {
        tone: 'success',
        label: 'Active',
        headline: 'Your subscription is active',
        subtext: 'All features are available and your next billing date is coming up.',
        showUpdatePaymentCta: false,
        showContactSupportCta: false,
      };

    default:
      // Unknown status - treat as active (fail-safe)
      return {
        tone: 'success',
        label: 'Active',
        headline: 'Your subscription is active',
        subtext: 'All features are available.',
        showUpdatePaymentCta: false,
        showContactSupportCta: false,
      };
  }
}

/**
 * Determines if a subscription is in a risky state that requires user attention
 * E24-BILLING-FE-S5
 */
export function isSubscriptionInRiskState(
  subscription: OrgSubscriptionDto | null,
): boolean {
  if (!subscription) return false;
  switch (subscription.status) {
    case 'PAST_DUE':
    case 'EXPIRED':
    case 'CANCELED':
      return true;
    default:
      return false;
  }
}
