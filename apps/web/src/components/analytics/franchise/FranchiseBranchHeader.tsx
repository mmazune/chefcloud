/**
 * FranchiseBranchHeader Component
 * E22-FRANCHISE-FE-S3: Display branch summary KPIs at top of detail page
 */

import React from 'react';
import { FranchiseOverviewBranchKpi } from '@/types/franchise';

interface Props {
  branch: FranchiseOverviewBranchKpi;
  currency: string;
}

export const FranchiseBranchHeader: React.FC<Props> = ({ branch, currency }) => {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {branch.branchName}
          </h1>
          <p className="text-xs text-slate-400">
            Detailed franchise analytics for this location.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right text-xs text-slate-300">
          <div>
            <div className="text-slate-400">Net sales</div>
            <div className="text-sm font-semibold text-slate-100">
              {currency} {(branch.netSalesCents / 100).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Margin %</div>
            <div className="text-sm font-semibold text-emerald-400">
              {branch.marginPercent.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-slate-400">Staff KPI</div>
            <div className="text-sm font-semibold text-sky-400">
              {branch.staffKpiScore?.toFixed(0) ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
