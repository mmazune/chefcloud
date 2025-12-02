/**
 * FranchiseBudgetTable Component
 * E22-FRANCHISE-FE-S1/S3: Display budget vs actual variance per branch
 */

import React from 'react';
import Link from 'next/link';
import { FranchiseBudgetVarianceResponseDto } from '@/types/franchise';

interface Props {
  variance: FranchiseBudgetVarianceResponseDto;
  currency: string; // e.g. "UGX"
}

export const FranchiseBudgetTable: React.FC<Props> = ({ variance, currency }) => {
  if (!variance.branches.length) {
    return (
      <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
        No budget data for this month.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-2 text-left">Branch</th>
            <th className="px-4 py-2 text-right">Budget</th>
            <th className="px-4 py-2 text-right">Actual</th>
            <th className="px-4 py-2 text-right">Variance</th>
            <th className="px-4 py-2 text-right">Variance %</th>
          </tr>
        </thead>
        <tbody className="bg-slate-950/50">
          {variance.branches.map((b) => {
            const positive = b.varianceAmountCents >= 0;
            const varianceLabel = positive ? '+' : '';
            return (
              <tr key={b.branchId} className="border-t border-slate-900">
                <td className="px-4 py-2 text-slate-100">
                  <Link
                    href={`/analytics/franchise/${b.branchId}`}
                    className="hover:text-sky-400 hover:underline"
                  >
                    {b.branchName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-slate-300">
                  {currency} {(b.budgetAmountCents / 100).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-slate-300">
                  {currency} {(b.actualNetSalesCents / 100).toLocaleString()}
                </td>
                <td
                  className={`px-4 py-2 text-right ${
                    positive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {varianceLabel}
                  {currency} {(Math.abs(b.varianceAmountCents) / 100).toLocaleString()}
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    positive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {varianceLabel}
                  {b.variancePercent.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
