/**
 * Payment Method Mix Donut Chart
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
import { CreditCard } from 'lucide-react';

interface PaymentData {
  method: string;
  amount: number;
  count: number;
}

interface PaymentMethodChartProps {
  data: PaymentData[];
  loading?: boolean;
  title?: string;
  height?: number;
  className?: string;
}

const COLORS: Record<string, string> = {
  CASH: '#10b981',
  CARD: '#2563eb',
  MOBILE_MONEY: '#f59e0b',
  BANK_TRANSFER: '#8b5cf6',
  OTHER: '#6b7280',
};

const LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: data.fill }}
        />
        <span className="font-medium">{LABELS[data.method] || data.method}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">{formatCurrency(data.amount)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Transactions:</span>
          <span className="font-medium">{data.count}</span>
        </div>
      </div>
    </div>
  );
};

export function PaymentMethodChart({
  data,
  loading,
  title = 'Payment Methods',
  height = 280,
  className,
}: PaymentMethodChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-chefcloud-blue" />
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
            <CreditCard className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No payment data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    name: LABELS[d.method] || d.method,
    value: d.amount,
    fill: COLORS[d.method] || COLORS.OTHER,
  }));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-chefcloud-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={45}
              dataKey="value"
              paddingAngle={3}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={(value) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
