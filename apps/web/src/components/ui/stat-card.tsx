import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn, formatPercentage } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'number' | 'currency' | 'percentage';
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
  className,
}: StatCardProps) {
  // Auto-determine trend from delta if not provided
  const determinedTrend = trend || (delta !== undefined ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral') : undefined);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold">{value}</div>
            {delta !== undefined && (
              <div className="mt-1 flex items-center text-sm">
                {determinedTrend === 'up' && (
                  <>
                    <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                    <span className="text-green-500">{formatPercentage(Math.abs(delta))}</span>
                  </>
                )}
                {determinedTrend === 'down' && (
                  <>
                    <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
                    <span className="text-red-500">{formatPercentage(Math.abs(delta))}</span>
                  </>
                )}
                {determinedTrend === 'neutral' && (
                  <>
                    <Minus className="mr-1 h-4 w-4 text-gray-400" />
                    <span className="text-gray-400">0%</span>
                  </>
                )}
                <span className="ml-1 text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
