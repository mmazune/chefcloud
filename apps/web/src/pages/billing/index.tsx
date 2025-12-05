import React from 'react';
import { useBillingOverview } from '@/hooks/useBillingOverview';
import { BillingPlansGrid } from '@/components/billing/BillingPlansGrid';
import { BillingCurrentPlanCard } from '@/components/billing/BillingCurrentPlanCard';
import { BillingUsageCard } from '@/components/billing/BillingUsageCard';
import { BillingStatusBanner } from '@/components/billing/BillingStatusBanner';

const BillingPage: React.FC = () => {
  const { plans, subscription, usage, isLoading, error, reload } =
    useBillingOverview();

  return (
    <main id="main-content" role="main" className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Billing &amp; subscription
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage your ChefCloud plan, seats, and usage. Only owners and
            finance admins should change plans.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
          onClick={reload}
          disabled={isLoading}
        >
          Refresh
        </button>
      </header>

      {/* E24-BILLING-FE-S4: Status banner (renders nothing when subscription is null) */}
      <BillingStatusBanner subscription={subscription} />

      {isLoading && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
          Loading billing data…
        </div>
      )}

      {error && !isLoading && (
        <div className="mb-4 rounded-lg border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">
          Failed to load billing data: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
            <BillingCurrentPlanCard subscription={subscription} />
            <BillingUsageCard usage={usage} />
          </div>

          <BillingPlansGrid
            plans={plans}
            currentPlanId={subscription?.planId ?? null}
          />
        </div>
      )}
    </main>
  );
};

export default BillingPage;
