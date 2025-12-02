/**
 * FranchiseVarianceCard Component
 * E22-FRANCHISE-FE-S1: Display top/bottom branches by variance percentage
 */

import React from 'react';
import { FranchiseBudgetVarianceResponseDto } from '@/types/franchise';

interface Props {
  variance: FranchiseBudgetVarianceResponseDto;
  currency: string;
}

export const FranchiseVarianceCard: React.FC<Props> = ({ variance, currency: _currency }) => {
  if (!variance.branches.length) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Variance Rankings</h3>
        <p className="text-sm text-slate-400">No variance data available</p>
      </div>
    );
  }

  // Sort by variance percent (descending for top performers)
  const sorted = [...variance.branches].sort((a, b) => b.variancePercent - a.variancePercent);
  const topPerformers = sorted.slice(0, 3);
  const bottomPerformers = sorted.slice(-3).reverse();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Variance Rankings</h3>

      {/* Top performers */}
      <div className="mb-4">
        <p className="text-xs text-emerald-400 font-medium mb-2">
          ▲ Top Performers (vs Budget)
        </p>
        {topPerformers.map((b) => (
          <div
            key={b.branchId}
            className="flex items-center justify-between py-1 text-xs"
          >
            <span className="text-slate-300">{b.branchName}</span>
            <span className="text-emerald-400 font-medium">
              +{b.variancePercent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Bottom performers */}
      <div>
        <p className="text-xs text-rose-400 font-medium mb-2">
          ▼ Needs Attention (vs Budget)
        </p>
        {bottomPerformers.map((b) => (
          <div
            key={b.branchId}
            className="flex items-center justify-between py-1 text-xs"
          >
            <span className="text-slate-300">{b.branchName}</span>
            <span className="text-rose-400 font-medium">
              {b.variancePercent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Total Branches</span>
          <span className="text-slate-200 font-medium">{variance.branches.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-slate-400">Period</span>
          <span className="text-slate-200 font-medium">
            {variance.year}-{String(variance.month).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};
