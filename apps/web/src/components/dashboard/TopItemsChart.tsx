/**
 * Top Items Bar Chart Component
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
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag, ChevronRight } from 'lucide-react';

interface TopItem {
  id: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  category?: string;
  marginPct?: number;
}

interface TopItemsChartProps {
  items: TopItem[];
  loading?: boolean;
  title?: string;
  height?: number;
  limit?: number;
  onItemClick?: (item: TopItem) => void;
  showViewAll?: boolean;
  className?: string;
}

const COLORS = [
  '#2563eb', // Blue
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
  '#bfdbfe',
  '#dbeafe',
  '#eff6ff',
  '#f0f9ff',
  '#f8fafc',
  '#fafafa',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <p className="font-medium text-gray-900 mb-1">{item.name}</p>
      {item.category && (
        <p className="text-xs text-muted-foreground mb-2">{item.category}</p>
      )}
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Revenue:</span>
          <span className="font-medium">{formatCurrency(item.totalRevenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Quantity:</span>
          <span className="font-medium">{item.totalQuantity}</span>
        </div>
        {item.marginPct !== undefined && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Margin:</span>
            <span className="font-medium">{item.marginPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function TopItemsChart({
  items,
  loading,
  title = 'Top Selling Items',
  height = 350,
  limit = 10,
  onItemClick,
  showViewAll = true,
  className,
}: TopItemsChartProps) {
  const displayedItems = items.slice(0, limit);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={height} type="bar" />
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No sales data yet</p>
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
            <ShoppingBag className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
          {showViewAll && (
            <Link 
              href="/reports?view=top-items" 
              className="text-sm text-chefcloud-blue hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={displayedItems}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(v).replace('UGX', '').trim()}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
              width={120}
              tickFormatter={(v) => (v.length > 18 ? v.slice(0, 16) + '...' : v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar
              dataKey="totalRevenue"
              radius={[0, 4, 4, 0]}
              onClick={(data) => {
                const item = displayedItems.find((i) => i.name === data?.name);
                if (item) onItemClick?.(item);
              }}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              {displayedItems.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
