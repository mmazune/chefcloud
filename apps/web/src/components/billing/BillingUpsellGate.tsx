import React from 'react';
import Link from 'next/link';

interface Props {
  featureLabel: string;
  requiredPlanHint?: string;
}

export const BillingUpsellGate: React.FC<Props> = ({
  featureLabel,
  requiredPlanHint = 'a franchise-tier plan',
}) => {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-8 text-center text-xs text-slate-300">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-800 bg-slate-950/80 p-5">
        <h1 className="text-sm font-semibold text-slate-100">
          Upgrade required to use {featureLabel}
        </h1>
        <p className="mt-2 text-[11px] text-slate-400">
          This organisation is currently on a Micros plan. {featureLabel} is available on{' '}
          {requiredPlanHint}. Upgrading unlocks HQ-level control, reporting, and automation.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/billing"
            className="rounded-md border border-emerald-500 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-900/40"
          >
            View plans &amp; upgrade
          </Link>
          <Link
            href="/analytics"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
          >
            Back to analytics
          </Link>
        </div>

        <p className="mt-3 text-[10px] text-slate-500">
          If you believe this is a mistake, contact support so we can review your plan configuration.
        </p>
      </div>
    </main>
  );
};
