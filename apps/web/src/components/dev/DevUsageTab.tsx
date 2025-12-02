import React, { useMemo } from 'react';
import { useDevUsageSummary } from '@/hooks/useDevUsageSummary';
import { DevUsageSummary as DevUsageSummaryType } from '@/types/devPortal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function buildChartData(summary: DevUsageSummaryType | null) {
  if (!summary || summary.timeseries.length === 0) return [];
  return summary.timeseries.map((p) => ({
    timestamp: p.timestamp,
    requests: p.requestCount,
    errors: p.errorCount,
  }));
}

export const DevUsageTab: React.FC = () => {
  const { range, setRange, summary, isLoading, error, reload } =
    useDevUsageSummary('24h');

  const chartData = useMemo(() => buildChartData(summary), [summary]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            API usage and error rates
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Recent traffic for this developer account. Use Sandbox for integration, then switch keys to Production.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex rounded-full border border-slate-700 p-0.5">
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${
                range === '24h'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-300'
              }`}
              onClick={() => setRange('24h')}
            >
              Last 24h
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 ${
                range === '7d'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-300'
              }`}
              onClick={() => setRange('7d')}
            >
              Last 7 days
            </button>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            onClick={reload}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
          Loading usage…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 p-3 text-xs text-rose-200">
          Failed to load usage: {error.message}
        </div>
      )}

      {!isLoading && !error && summary && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 md:grid-cols-4 text-xs">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[11px] text-slate-400">Total requests</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                {summary.totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[11px] text-slate-400">Total errors</div>
              <div className="mt-1 text-lg font-semibold text-rose-300">
                {summary.totalErrors.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                {summary.errorRatePercent.toFixed(2)}% error rate
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[11px] text-slate-400">Sandbox</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                {summary.sandboxRequests.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[11px] text-slate-400">Production</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                {summary.productionRequests.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Timeseries chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>Requests vs errors</span>
              <span>
                {new Date(summary.fromIso).toLocaleString()} →{' '}
                {new Date(summary.toIso).toLocaleString()}
              </span>
            </div>
            {chartData.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No timeseries data available yet.
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        borderColor: '#1f2937',
                        fontSize: 11,
                      }}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleString()
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="#38bdf8"
                      strokeWidth={1.6}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="errors"
                      stroke="#f97373"
                      strokeWidth={1.6}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top keys table */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/80">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
              <span>Top API keys</span>
              <span>Highest volume in selected range</span>
            </div>
            {summary.topKeys.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-500">
                No API key activity recorded in this time range.
              </div>
            ) : (
              <table className="min-w-full text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Label</th>
                    <th className="px-3 py-2 text-left">Environment</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                    <th className="px-3 py-2 text-right">Errors</th>
                    <th className="px-3 py-2 text-right">Error rate</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-950/60">
                  {summary.topKeys.map((k) => {
                    const errorRate =
                      k.requestCount > 0
                        ? (k.errorCount / k.requestCount) * 100
                        : 0;
                    return (
                      <tr key={k.keyId} className="border-t border-slate-900">
                        <td className="px-3 py-2 text-slate-100">{k.label}</td>
                        <td className="px-3 py-2">
                          {k.environment === 'PRODUCTION' ? (
                            <span className="rounded-full bg-rose-900/40 px-2 py-0.5 text-rose-200">
                              PRODUCTION
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">
                              SANDBOX
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-100">
                          {k.requestCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-300">
                          {k.errorCount.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">
                          {errorRate.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
