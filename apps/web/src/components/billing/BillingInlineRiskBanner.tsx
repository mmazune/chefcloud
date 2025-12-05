/**
 * BillingInlineRiskBanner component
 * E24-BILLING-FE-S5
 *
 * Lightweight inline banner for cross-feature pages that shows
 * non-blocking billing risk warnings (PAST_DUE, EXPIRED, CANCELED)
 * with links to billing page and support.
 */

import React from 'react';
import Link from 'next/link';
import { OrgSubscriptionDto } from '@/types/billing';
import { isSubscriptionInRiskState, getBillingStatusMeta } from '@/lib/billingStatusHelpers';

interface Props {
  subscription: OrgSubscriptionDto | null;
  contextLabel: string; // e.g. "Developer Portal" or "Franchise analytics"
}

export const BillingInlineRiskBanner: React.FC<Props> = ({
  subscription,
  contextLabel,
}) => {
  if (!isSubscriptionInRiskState(subscription)) return null;

  const meta = getBillingStatusMeta(subscription);
  // Safety: meta may be null if status is unknown
  const tone = meta?.tone ?? 'warning';

  let borderClass = 'border-amber-700/70';
  let bgClass = 'bg-amber-950/40';
  let textClass = 'text-amber-50';

  if (tone === 'danger') {
    borderClass = 'border-rose-800/80';
    bgClass = 'bg-rose-950/40';
    textClass = 'text-rose-50';
  }

  return (
    <section
      aria-label="Billing risk notice"
      className={`mb-3 rounded-md border ${borderClass} ${bgClass} px-3 py-2 text-[11px] ${textClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="max-w-md">
          <span className="font-semibold">
            Billing issue detected for this organisation.
          </span>{' '}
          <span className="opacity-90">
            Your subscription status may impact {contextLabel} soon. Please review your billing settings to avoid interruptions.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/billing"
            className="rounded-md border border-emerald-400 px-3 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/40"
          >
            Go to billing
          </Link>
          <a
            href="mailto:support@chefcloud.app?subject=Billing%20help"
            className="rounded-md border border-slate-600 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-900/40"
          >
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
};
