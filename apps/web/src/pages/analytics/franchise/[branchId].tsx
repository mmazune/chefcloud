/**
 * Branch Detail Page
 * E22-FRANCHISE-FE-S3: Drill-down view for a single franchise branch
 */

import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { NextPage } from 'next';
import { usePlanCapabilities } from '@/hooks/usePlanCapabilities';
import { BillingUpsellGate } from '@/components/billing/BillingUpsellGate';
import { BillingInlineRiskBanner } from '@/components/billing/BillingInlineRiskBanner';
import { useFranchiseBranchKpis } from '@/hooks/useFranchiseBranchKpis';
import { useFranchiseBranchMultiMonthSeries } from '@/hooks/useFranchiseBranchMultiMonthSeries';
import { FranchiseBranchHeader } from '@/components/analytics/franchise/FranchiseBranchHeader';
import { FranchiseBranchTrendChart } from '@/components/analytics/franchise/FranchiseBranchTrendChart';

const FranchiseBranchPage: NextPage = () => {
  const router = useRouter();
  const { branchId } = router.query as { branchId?: string };

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const currency = 'UGX'; // later: derive from org settings

  // E24-BILLING-FE-S3: Plan capabilities for franchise analytics gating
  const { subscription, capabilities, isLoading: isLoadingPlan } = usePlanCapabilities();

  // Always call hooks - they can't be called conditionally
  const { branch, isLoading: isKpiLoading } = useFranchiseBranchKpis({
    year,
    month,
    branchId: branchId || '',
  });

  const { data: series, isLoading: isSeriesLoading } =
    useFranchiseBranchMultiMonthSeries({
      branchId: branchId || '',
      startYear: year,
      startMonth: month,
      months: 6,
      lookbackMonths: 3,
    });

  if (!branchId) {
    return null;
  }

  // E24-BILLING-FE-S3: Gate franchise branch analytics
  if (isLoadingPlan) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-400">Checking your plan permissions…</p>
        </div>
      </div>
    );
  }

  if (!capabilities.canUseFranchiseAnalytics) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <BillingUpsellGate
            featureLabel="Franchise branch analytics"
            requiredPlanHint="Franchise Core or higher"
          />
        </div>
      </div>
    );
  }

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => router.push('/analytics')}
        >
          ← Back to analytics
        </button>

        {/* E24-BILLING-FE-S5: Billing risk warning for franchise branch analytics */}
        <BillingInlineRiskBanner
          subscription={subscription}
          contextLabel="Franchise branch analytics"
        />

        {isKpiLoading && !branch ? (
          <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
            Loading branch KPIs…
          </div>
        ) : branch ? (
          <FranchiseBranchHeader branch={branch} currency={currency} />
        ) : (
          <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
            Branch not found for this period.
          </div>
        )}

        {/* Month/Year controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span className="text-slate-400">Period:</span>
          <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/50 px-3 py-1.5">
            <button
              onClick={handlePrevMonth}
              className="text-slate-400 hover:text-slate-200"
              type="button"
            >
              ‹
            </button>
            <span className="min-w-[100px] text-center">
              {new Date(year, month - 1).toLocaleString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              onClick={handleNextMonth}
              className="text-slate-400 hover:text-slate-200"
              type="button"
            >
              ›
            </button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-300">
            6-Month Trend: Budget vs Actual vs Forecast
          </h2>
          {isSeriesLoading ? (
            <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
              Loading trends…
            </div>
          ) : (
            <>
              <FranchiseBranchTrendChart data={series} currency={currency} />
              <p className="mt-2 text-xs text-slate-500">
                Last 6 months ending {month}/{year}. Forecast uses a 3-month lookback per month.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FranchiseBranchPage;
