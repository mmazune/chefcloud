/**
 * DevWebhookDeliveryPanel component for E23-DEVPORTAL-FE-S3
 * Shows webhook delivery history with filtering and retry functionality
 */

import React, { useMemo, useState } from 'react';
import {
  DevWebhookEndpointDto,
  DevWebhookDeliveryDto,
  DevWebhookDeliveryStatus,
} from '@/types/devPortal';
import { useDevWebhookDeliveries } from '@/hooks/useDevWebhookDeliveries';
import { useRetryDevWebhookDelivery } from '@/hooks/useRetryDevWebhookDelivery';

interface Props {
  endpoint: DevWebhookEndpointDto | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatRelative(dateIso: string | null): string {
  if (!dateIso) return 'Unknown';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString();
}

function statusBadge(status: DevWebhookDeliveryStatus) {
  switch (status) {
    case 'SUCCESS':
      return (
        <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-200">
          Success
        </span>
      );
    case 'FAILED':
      return (
        <span className="rounded-full bg-rose-900/40 px-2 py-0.5 text-xs text-rose-200">
          Failed
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
          Pending
        </span>
      );
  }
}

export const DevWebhookDeliveryPanel: React.FC<Props> = ({
  endpoint,
  isOpen,
  onClose,
}) => {
  const [statusFilter, setStatusFilter] =
    useState<DevWebhookDeliveryStatus | 'ALL'>('ALL');

  const { deliveries, isLoading, error, reload } = useDevWebhookDeliveries({
    endpointId: endpoint?.id ?? '',
    status: statusFilter,
    limit: 50,
  });

  const { isRetrying, error: retryError, retry } = useRetryDevWebhookDelivery(
    () => {
      // After retry, refresh list
      reload();
    },
  );

  const stats = useMemo(() => {
    const total = deliveries.length;
    const success = deliveries.filter((d) => d.status === 'SUCCESS').length;
    const failed = deliveries.filter((d) => d.status === 'FAILED').length;
    const pending = deliveries.filter((d) => d.status === 'PENDING').length;
    return { total, success, failed, pending };
  }, [deliveries]);

  if (!isOpen || !endpoint) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-xs uppercase text-slate-400">
              Webhook deliveries
            </div>
            <div className="text-sm font-semibold text-slate-100">
              {endpoint.label}
            </div>
            <div className="text-[11px] text-slate-500">{endpoint.url}</div>
          </div>
          <button
            type="button"
            className="rounded-md px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <span>
              Total: <span className="font-semibold">{stats.total}</span>
            </span>
            <span className="text-emerald-300">
              Success: <span className="font-semibold">{stats.success}</span>
            </span>
            <span className="text-rose-300">
              Failed: <span className="font-semibold">{stats.failed}</span>
            </span>
            <span className="text-slate-400">
              Pending: <span className="font-semibold">{stats.pending}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as DevWebhookDeliveryStatus | 'ALL',
                )
              }
            >
              <option value="ALL">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
            <button
              type="button"
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              onClick={() => reload()}
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="p-4 text-xs text-slate-400">Loading deliveries…</div>
        )}

        {error && !isLoading && (
          <div className="m-4 rounded border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">
            Failed to load deliveries: {error.message}
          </div>
        )}

        {!isLoading && !error && deliveries.length === 0 && (
          <div className="p-4 text-xs text-slate-400">
            No deliveries found for this endpoint yet.
          </div>
        )}

        {!isLoading && !error && deliveries.length > 0 && (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">HTTP</th>
                  <th className="px-3 py-2 text-left">Latency</th>
                  <th className="px-3 py-2 text-left">Error</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-slate-950/60">
                {deliveries.map((d: DevWebhookDeliveryDto) => (
                  <tr
                    key={d.id}
                    className="border-t border-slate-900 align-top"
                  >
                    <td className="px-3 py-2 text-slate-200">
                      {formatRelative(d.deliveredAt ?? d.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <code className="rounded bg-slate-900 px-1 py-0.5">
                        {d.eventType}
                      </code>
                    </td>
                    <td className="px-3 py-2">{statusBadge(d.status)}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {d.statusCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {d.durationMs != null ? `${d.durationMs} ms` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {d.lastErrorMessage ? (
                        <span className="line-clamp-2 break-words">
                          {d.lastErrorMessage}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.status === 'FAILED' ? (
                        <button
                          type="button"
                          className="rounded-md border border-emerald-600 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-60"
                          disabled={isRetrying}
                          onClick={() => void retry(d.id)}
                        >
                          Retry
                        </button>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {retryError && (
          <div className="border-t border-rose-900/60 bg-rose-950/40 p-3 text-[11px] text-rose-200">
            Retry failed: {retryError.message}
          </div>
        )}
      </div>
    </div>
  );
};
