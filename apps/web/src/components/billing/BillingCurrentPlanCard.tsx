import React from 'react';
import { OrgSubscriptionDto } from '@/types/billing';

interface Props {
  subscription: OrgSubscriptionDto | null;
}

export const BillingCurrentPlanCard: React.FC<Props> = ({ subscription }) => {
  if (!subscription) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
        No active subscription found. Contact support to configure your plan.
      </section>
    );
  }

  const {
    planName,
    status,
    interval,
    currency,
    unitPriceCents,
    nextRenewalIso,
    trialEndsIso,
    seats,
    branchesIncluded,
    branchesUsed,
    microsOrgsIncluded,
    microsOrgsUsed,
  } = subscription;

  const price =
    unitPriceCents > 0
      ? `${currency} ${(unitPriceCents / 100).toLocaleString()} / ${
          interval === 'MONTHLY' ? 'month' : 'year'
        }`
      : 'Custom / enterprise';

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase text-slate-400">
            Current plan
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {planName}
          </div>
          <div className="mt-1 text-slate-300">{price}</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Status:{' '}
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px]">
              {status}
            </span>
          </div>
          {trialEndsIso && (
            <div className="mt-1 text-[11px] text-emerald-300">
              Trial ends: {new Date(trialEndsIso).toLocaleDateString()}
            </div>
          )}
          {nextRenewalIso && (
            <div className="mt-1 text-[11px] text-slate-400">
              Next renewal: {new Date(nextRenewalIso).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] text-slate-300 md:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">Seats</div>
          <div className="mt-1 text-slate-100">
            {seats.toLocaleString()} staff accounts
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">Branches</div>
          <div className="mt-1 text-slate-100">
            {branchesUsed}/{branchesIncluded} used
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">Micros locations</div>
          <div className="mt-1 text-slate-100">
            {microsOrgsUsed}/{microsOrgsIncluded} used
          </div>
        </div>
      </div>
    </section>
  );
};
