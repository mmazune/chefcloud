/**
 * BillingStatusBanner component
 * E24-BILLING-FE-S4
 *
 * Displays a prominent banner showing subscription status with contextual
 * CTAs for payment updates and support contact.
 */

import React from 'react';
import { OrgSubscriptionDto } from '@/types/billing';
import { getBillingStatusMeta, StatusTone } from '@/lib/billingStatusHelpers';

interface BillingStatusBannerProps {
  subscription: OrgSubscriptionDto | null | undefined;
}

/**
 * Renders a status banner based on subscription state
 * Shows different tones, messages, and CTAs depending on status
 */
export function BillingStatusBanner({ subscription }: BillingStatusBannerProps) {
  const meta = getBillingStatusMeta(subscription);

  if (!meta) {
    return null;
  }

  const { tone, label, headline, subtext, showUpdatePaymentCta, showContactSupportCta } = meta;

  // Define tone-specific styling
  const toneStyles: Record<StatusTone, string> = {
    info: 'border-blue-900/60 bg-blue-950/40 text-blue-100',
    warning: 'border-amber-900/60 bg-amber-950/40 text-amber-100',
    danger: 'border-rose-900/60 bg-rose-950/40 text-rose-100',
    success: 'border-emerald-900/60 bg-emerald-950/40 text-emerald-100',
  };

  const toneBadgeStyles: Record<StatusTone, string> = {
    info: 'bg-blue-900/70 text-blue-50',
    warning: 'bg-amber-900/70 text-amber-50',
    danger: 'bg-rose-900/70 text-rose-50',
    success: 'bg-emerald-900/70 text-emerald-50',
  };

  return (
    <aside
      aria-label="Billing status"
      className={`rounded-lg border p-4 ${toneStyles[tone]}`}
    >
      <div className="flex items-start gap-4">
        {/* Status badge */}
        <div className="shrink-0">
          <span
            className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide ${toneBadgeStyles[tone]}`}
          >
            {label}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div>
            <h3 className="text-sm font-semibold">{headline}</h3>
            <p className="mt-1 text-xs opacity-90">{subtext}</p>
          </div>

          {/* CTAs */}
          {(showUpdatePaymentCta || showContactSupportCta) && (
            <div className="flex gap-3 text-xs font-medium">
              {showUpdatePaymentCta && (
                <a
                  href="/billing/payment"
                  className="underline hover:no-underline"
                >
                  Update payment details
                </a>
              )}
              {showContactSupportCta && (
                <a
                  href="mailto:support@chefcloud.io"
                  className="underline hover:no-underline"
                >
                  Contact support
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
