import React, { useState } from 'react';
import { BillingPlanDto, BillingPlanId } from '@/types/billing';
import { usePlanChange } from '@/hooks/usePlanChange';
import { OrgSubscriptionDto } from '@/types/billing';

interface Props {
  plans: BillingPlanDto[];
  currentPlanId: BillingPlanId | null;
}

export const BillingPlansGrid: React.FC<Props> = ({
  plans,
  currentPlanId,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanDto | null>(
    null,
  );
  const {
    quote,
    isQuoting,
    isChanging,
    error,
    requestQuote,
    confirmChange,
    clearQuote,
  } = usePlanChange();

  const onSelectPlan = async (plan: BillingPlanDto) => {
    setSelectedPlan(plan);
    await requestQuote(plan.id);
  };

  const onConfirm = async () => {
    if (!selectedPlan) return;
    const res: OrgSubscriptionDto | null = await confirmChange(
      selectedPlan.id,
    );
    if (res) {
      setSelectedPlan(null);
    }
  };

  const onCancel = () => {
    setSelectedPlan(null);
    clearQuote();
  };

  if (!plans || plans.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
        No plans configured. Contact support.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Available plans
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Upgrade or downgrade your plan. Changes apply from the next billing
            cycle unless otherwise shown.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const price =
            plan.priceCents > 0
              ? `${plan.currency} ${(plan.priceCents / 100).toLocaleString()} / ${
                  plan.interval === 'MONTHLY' ? 'month' : 'year'
                }`
              : 'Custom / enterprise';

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-lg border p-3 ${
                plan.isRecommended
                  ? 'border-emerald-500 bg-slate-950'
                  : 'border-slate-800 bg-slate-950/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {plan.name}
                  </div>
                  <div className="text-[11px] text-slate-400">{price}</div>
                </div>
                {plan.isRecommended && (
                  <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-200">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-300">
                {plan.description}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-300">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="mt-3 flex-1" />
              <div className="mt-3">
                {isCurrent ? (
                  <button
                    type="button"
                    className="w-full rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300"
                    disabled
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-md border border-emerald-500 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
                    onClick={() => void onSelectPlan(plan)}
                    disabled={isQuoting || isChanging}
                  >
                    {isQuoting && selectedPlan?.id === plan.id
                      ? 'Preparing quote…'
                      : 'Change to this plan'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
            <div className="mb-2 text-sm font-semibold text-slate-100">
              Confirm plan change
            </div>
            <p className="mb-2 text-[11px] text-slate-400">
              You are changing to{' '}
              <span className="font-semibold">{selectedPlan.name}</span>.
            </p>

            {quote ? (
              <div className="mb-3 space-y-1 text-[11px]">
                <div>
                  Proration:{' '}
                  <span
                    className={
                      quote.prorationCents >= 0
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }
                  >
                    {quote.currency}{' '}
                    {(quote.prorationCents / 100).toLocaleString()}
                  </span>
                </div>
                <div>
                  Effective from:{' '}
                  {new Date(quote.effectiveFromIso).toLocaleString()}
                </div>
                {quote.note && (
                  <div className="text-slate-400">{quote.note}</div>
                )}
              </div>
            ) : (
              <div className="mb-3 text-[11px] text-slate-400">
                {isQuoting
                  ? 'Preparing quote…'
                  : 'No quote available yet. Try again or contact support.'}
              </div>
            )}

            {error && (
              <div className="mb-2 rounded border border-rose-900/60 bg-rose-950/40 p-2 text-[11px] text-rose-200">
                {error.message}
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
                onClick={onCancel}
                disabled={isChanging}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-emerald-500 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
                onClick={() => void onConfirm()}
                disabled={isChanging || !quote}
              >
                {isChanging ? 'Applying…' : 'Confirm change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
