/**
 * M34-FE-PARITY-S2 (G1): Finance Budgets & Variance View
 * 
 * Finance-facing page for budgets, actuals, and variance using E22 analytics data.
 * Makes franchise analytics budget data discoverable from Finance/Reports verticals.
 */

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { useFranchiseBudgetVariance } from '@/hooks/useFranchiseBudgetVariance';
import { FranchiseBudgetTable } from '@/components/analytics/franchise/FranchiseBudgetTable';
import { FranchiseVarianceCard } from '@/components/analytics/franchise/FranchiseVarianceCard';
import { usePlanCapabilities } from '@/hooks/usePlanCapabilities';
import { BillingUpsellGate } from '@/components/billing/BillingUpsellGate';

export default function FinanceBudgetsPage() {
  // Default to current month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // JS months are 0-indexed

  const { capabilities } = usePlanCapabilities();
  const hasAnalytics = capabilities?.canUseFranchiseAnalytics ?? false;

  const { data, isLoading, error } = useFranchiseBudgetVariance({ year, month });

  // Month/year picker helpers
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Budgets & Variance"
          subtitle="Finance view of budget vs actual performance across branches."
          actions={
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Period:</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2"
                aria-label="Select month"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-input bg-background px-3 py-2"
                aria-label="Select year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {!hasAnalytics ? (
          <BillingUpsellGate 
            featureLabel="Franchise Analytics & Budgets" 
            requiredPlanHint="a franchise-tier plan (Pro or Enterprise)"
          />
        ) : (
          <>
            {error && (
              <Card className="p-4 border-destructive/40 bg-destructive/10">
                <p className="text-sm text-destructive">
                  Failed to load budgets for this period. Please try again.
                </p>
              </Card>
            )}

            {isLoading && (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading budget data...</p>
              </Card>
            )}

            {data && (
              <>
                <FranchiseVarianceCard
                  variance={data}
                  currency="UGX"
                />

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Branch Breakdown</h2>
                  <FranchiseBudgetTable
                    variance={data}
                    currency="UGX"
                  />
                </Card>

                <Card className="p-4 bg-muted/30">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    About This View
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This view shows budget vs actual sales and variance for the selected month.
                    Positive variance means actual sales exceeded budget.
                    For Tapas demo, November 2024 data shows strong performance at Kololo Rooftop (+12.3% variance)
                    and stable performance at CBD (+3.2% variance).
                  </p>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
