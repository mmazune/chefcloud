/**
 * Branch Compare Chart - Multi-branch revenue comparison
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { BranchMultiSelector } from './BranchSelector';
import { formatCurrency } from '@/lib/utils';
import { GitCompare } from 'lucide-react';

interface BranchData {
  id: string;
  name: string;
  data: Array<{
    date: string;
    revenue: number;
  }>;
}

interface BranchCompareChartProps {
  branches: BranchData[];
  selectedBranchIds: string[];
  onSelectionChange: (branchIds: string[]) => void;
  loading?: boolean;
  title?: string;
  height?: number;
  className?: string;
}

const COLORS = [
  '#2563eb', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
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
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function BranchCompareChart({
  branches,
  selectedBranchIds,
  onSelectionChange,
  loading,
  title = 'Branch Comparison',
  height = 350,
  className,
}: BranchCompareChartProps) {
  // Get branch info for selector
  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name }));

  // Filter to selected branches
  const selectedBranches = branches.filter((b) => selectedBranchIds.includes(b.id));

  // Merge data by date
  const mergedData = React.useMemo(() => {
    const dateMap = new Map<string, any>();

    selectedBranches.forEach((branch) => {
      branch.data.forEach((point) => {
        const existing = dateMap.get(point.date) || { date: point.date };
        existing[branch.id] = point.revenue;
        dateMap.set(point.date, existing);
      });
    });

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [selectedBranches]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={height} type="line" />
        </CardContent>
      </Card>
    );
  }

  if (branches.length < 2) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitCompare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              At least 2 branches required for comparison
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <BranchMultiSelector
            branches={branchOptions}
            selectedBranchIds={selectedBranchIds}
            onBranchChange={onSelectionChange}
            maxSelections={3}
          />
        </div>

        {selectedBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Select branches to compare
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              {selectedBranches.map((branch, idx) => (
                <Line
                  key={branch.id}
                  type="monotone"
                  dataKey={branch.id}
                  name={branch.name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
