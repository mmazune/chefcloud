/**
 * Category Mix Donut Chart Component
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { formatCurrency } from '@/lib/utils';
import { PieChart as PieChartIcon } from 'lucide-react';

interface CategoryData {
  name: string;
  value: number;
  count?: number;
  [key: string]: string | number | undefined;
}

interface CategoryMixChartProps {
  data: CategoryData[];
  loading?: boolean;
  title?: string;
  height?: number;
  valueType?: 'currency' | 'count' | 'percentage';
  className?: string;
}

const COLORS = [
  '#2563eb', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
];

const CustomTooltip = ({ active, payload, valueType }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0];
  const formattedValue =
    valueType === 'currency'
      ? formatCurrency(data.value)
      : valueType === 'percentage'
      ? `${data.value.toFixed(1)}%`
      : data.value;

  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.payload.fill }}
        />
        <span className="font-medium">{data.name}</span>
      </div>
      <div className="text-gray-600">
        {valueType === 'currency' ? 'Revenue: ' : valueType === 'count' ? 'Count: ' : ''}
        <span className="font-medium text-gray-900">{formattedValue}</span>
      </div>
      {data.payload.count !== undefined && (
        <div className="text-xs text-gray-500 mt-1">
          {data.payload.count} items sold
        </div>
      )}
    </div>
  );
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name: _name,
}: any) => {
  if (percent < 0.05) return null; // Don't show label for <5%

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function CategoryMixChart({
  data,
  loading,
  title = 'Category Mix',
  height = 300,
  valueType = 'currency',
  className,
}: CategoryMixChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={height} type="pie" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PieChartIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No category data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-chefcloud-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip valueType={valueType} />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={(value) => (
                <span className="text-sm text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {valueType === 'currency' && (
          <div className="mt-2 text-center text-sm text-muted-foreground">
            Total: {formatCurrency(total)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
