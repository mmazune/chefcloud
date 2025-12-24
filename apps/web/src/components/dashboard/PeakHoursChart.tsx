/**
 * Peak Hours Chart Component - Hourly histogram
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { formatCurrency } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface HourlyData {
  hour: number;
  orders: number;
  revenue: number;
}

interface PeakHoursChartProps {
  data: HourlyData[];
  loading?: boolean;
  title?: string;
  height?: number;
  valueKey?: 'orders' | 'revenue';
  className?: string;
}

const formatHour = (hour: number): string => {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
};

const CustomTooltip = ({ active, payload, label: _label }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <p className="font-medium text-gray-900 mb-2">
        {formatHour(data.hour)} - {formatHour(data.hour + 1)}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Orders:</span>
          <span className="font-medium">{data.orders}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Revenue:</span>
          <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </div>
      </div>
    </div>
  );
};

export function PeakHoursChart({
  data,
  loading,
  title = 'Peak Hours',
  height = 250,
  valueKey = 'orders',
  className,
}: PeakHoursChartProps) {
  // Ensure we have all 24 hours
  const fullData = React.useMemo(() => {
    const hourMap = new Map(data.map((d) => [d.hour, d]));
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      orders: hourMap.get(i)?.orders || 0,
      revenue: hourMap.get(i)?.revenue || 0,
    }));
  }, [data]);

  // Find peak hour
  const peakHour = React.useMemo(() => {
    let maxIdx = 0;
    let maxVal = 0;
    fullData.forEach((d, i) => {
      if (d[valueKey] > maxVal) {
        maxVal = d[valueKey];
        maxIdx = i;
      }
    });
    return maxIdx;
  }, [fullData, valueKey]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={height} type="bar" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.orders > 0 || d.revenue > 0);

  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No hourly data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            Peak: <span className="font-medium text-chefcloud-blue">{formatHour(peakHour)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={fullData}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="hour"
              tickFormatter={(h) => (h % 4 === 0 ? formatHour(h) : '')}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) =>
                valueKey === 'revenue'
                  ? v >= 1000
                    ? `${(v / 1000).toFixed(0)}k`
                    : v
                  : v
              }
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey={valueKey} radius={[2, 2, 0, 0]}>
              {fullData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === peakHour ? '#2563eb' : '#93c5fd'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
