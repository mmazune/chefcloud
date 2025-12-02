import React from 'react';
import { BillingUsageDto } from '@/types/billing';

interface Props {
  usage: BillingUsageDto | null;
}

export const BillingUsageCard: React.FC<Props> = ({ usage }) => {
  if (!usage) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
        Usage data not available yet.
      </section>
    );
  }

  const {
    periodStartIso,
    periodEndIso,
    apiRequestsUsed,
    apiRequestsLimit,
    smsUsed,
    smsLimit,
    storageMbUsed,
    storageMbLimit,
  } = usage;

  const windowLabel = `${new Date(
    periodStartIso,
  ).toLocaleDateString()} → ${new Date(periodEndIso).toLocaleDateString()}`;

  const formatQuota = (used: number, limit: number | null, unit: string) => {
    if (limit == null) {
      return `${used.toLocaleString()} ${unit} (no limit)`;
    }
    return `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`;
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase text-slate-400">Usage</div>
          <div className="mt-1 text-[11px] text-slate-400">{windowLabel}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">API requests</div>
          <div className="mt-1 text-slate-100">
            {formatQuota(apiRequestsUsed, apiRequestsLimit, 'requests')}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">SMS</div>
          <div className="mt-1 text-slate-100">
            {formatQuota(smsUsed, smsLimit, 'messages')}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <div className="text-slate-400">Storage</div>
          <div className="mt-1 text-slate-100">
            {formatQuota(storageMbUsed, storageMbLimit, 'MB')}
          </div>
        </div>
      </div>
    </section>
  );
};
