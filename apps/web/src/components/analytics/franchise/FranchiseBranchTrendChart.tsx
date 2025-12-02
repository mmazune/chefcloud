/**
 * FranchiseBranchTrendChart Component
 * E22-FRANCHISE-FE-S3: Display multi-month trend chart for a single branch
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { FranchiseBranchMonthlyPoint } from '@/types/franchise';

interface Props {
  data: FranchiseBranchMonthlyPoint[];
  currency: string;
}

function formatCurrencyShort(valueCents: number, currency: string): string {
  const v = valueCents / 100;
  if (v >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${currency} ${(v / 1_000).toFixed(1)}k`;
  return `${currency} ${v.toFixed(0)}`;
}

export const FranchiseBranchTrendChart: React.FC<Props> = ({
  data,
  currency,
}) => {
  if (!data.length) {
    return (
      <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">
        No data for this branch and period.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    label: p.label,
    budget: p.budgetNetSalesCents,
    actual: p.actualNetSalesCents,
    forecast: p.forecastNetSalesCents,
  }));

  return (
    <div className="h-72 w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#cbd5e1' }} />
          <YAxis
            tickFormatter={(v: number) => formatCurrencyShort(v, currency)}
            tick={{ fontSize: 11, fill: '#cbd5e1' }}
          />
          <Tooltip
            formatter={(value: any) =>
              typeof value === 'number'
                ? formatCurrencyShort(value, currency)
                : value
            }
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
            }}
            labelStyle={{ color: '#cbd5e1' }}
          />
          <Legend iconType="line" wrapperStyle={{ fontSize: '12px' }} />
          <Line
            type="monotone"
            dataKey="budget"
            name="Budget"
            stroke="#38bdf8"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#22c55e"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#f97316"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
