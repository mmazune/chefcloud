/**
 * Revenue Chart Component - Line/Area timeseries chart
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';

interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders?: number;
  label?: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading?: boolean;
  title?: string;
  height?: number;
  showOrders?: boolean;
  className?: string;
  branchLines?: Array<{
    id: string;
    name: string;
    color: string;
    data: RevenueDataPoint[];
  }>;
}

const COLORS = {
  revenue: '#2563eb', // Blue
  orders: '#10b981', // Green
  gradient: ['#2563eb', '#60a5fa'],
};

const BRANCH_COLORS = [
  '#2563eb', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
];

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrencyShort = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <p className="font-medium text-gray-900 mb-2">{formatDate(label)}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium">
            {entry.dataKey === 'orders' ? entry.value : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function RevenueChart({
  data,
  loading,
  title = 'Revenue Trend',
  height = 300,
  showOrders = false,
  className,
  branchLines,
}: RevenueChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={height} type="line" />
        </CardContent>
      </Card>
    );
  }

  // Multi-branch mode
  if (branchLines && branchLines.length > 0) {
    // Merge all branch data by date
    const dateMap = new Map<string, any>();
    branchLines.forEach((branch, _idx) => {
      branch.data.forEach((point) => {
        const existing = dateMap.get(point.date) || { date: point.date };
        existing[`revenue_${branch.id}`] = point.revenue;
        dateMap.set(point.date, existing);
      });
    });
    const mergedData = Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {branchLines.map((branch, idx) => (
                  <linearGradient
                    key={branch.id}
                    id={`gradient_${branch.id}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={BRANCH_COLORS[idx]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BRANCH_COLORS[idx]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tickFormatter={formatCurrencyShort}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {branchLines.map((branch, idx) => (
                <Area
                  key={branch.id}
                  type="monotone"
                  dataKey={`revenue_${branch.id}`}
                  name={branch.name}
                  stroke={BRANCH_COLORS[idx]}
                  fill={`url(#gradient_${branch.id})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Single line mode
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-chefcloud-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tickFormatter={formatCurrencyShort}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={COLORS.revenue}
              fill="url(#revenueGradient)"
              strokeWidth={2}
            />
            {showOrders && (
              <Area
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke={COLORS.orders}
                fill="transparent"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
