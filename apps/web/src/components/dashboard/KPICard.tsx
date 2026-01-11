/**
 * KPI Card Component - Enhanced stat card with period comparison
 * Milestone 6: ChefCloud V2 UX Upgrade
 * M7.2B: Fixed layout truncation and added tooltips for full values
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatPercentage } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  fullValue?: string; // Full unformatted value for tooltip
  sublabel?: string;
  delta?: number;
  deltaPeriod?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendIsGood?: boolean; // For COGS, lower is better
  icon?: React.ReactNode;
  iconBgColor?: string;
  alert?: boolean;
  alertMessage?: string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function KPICard({
  label,
  value,
  fullValue,
  sublabel,
  delta,
  deltaPeriod = 'vs last period',
  trend,
  trendIsGood = true,
  icon,
  iconBgColor = 'bg-chefcloud-blue/10',
  alert,
  alertMessage,
  loading,
  onClick,
  className,
}: KPICardProps) {
  // Auto-determine trend from delta if not provided
  const determinedTrend = trend || (delta !== undefined ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral') : undefined);

  // Determine if trend is positive (considering trendIsGood)
  const isPositive = determinedTrend === 'up' ? trendIsGood : !trendIsGood;
  const isNegative = determinedTrend === 'down' ? trendIsGood : !trendIsGood;

  if (loading) {
    return (
      <Card className={cn('relative overflow-hidden animate-pulse', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-muted rounded mb-2" />
          <div className="h-4 w-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Generate a stable testid from label
  const testIdBase = `kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <Card 
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-chefcloud-blue/50',
        alert && 'border-amber-400',
        className
      )}
      onClick={onClick}
      data-testid={testIdBase}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `View ${label} details` : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon && (
          <div className={cn('p-2 rounded-lg', iconBgColor)}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <div 
              className="text-2xl font-bold tracking-tight tabular-nums"
              style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}
              title={fullValue || (typeof value === 'string' ? value : String(value))}
            >
              {value}
            </div>
            {sublabel && (
              <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
            )}
            {delta !== undefined && (
              <div className="mt-2 flex items-center text-sm">
                {determinedTrend === 'up' && (
                  <>
                    <TrendingUp className={cn('mr-1 h-4 w-4', isPositive ? 'text-green-500' : 'text-red-500')} />
                    <span className={cn(isPositive ? 'text-green-500' : 'text-red-500')}>
                      +{formatPercentage(Math.abs(delta))}
                    </span>
                  </>
                )}
                {determinedTrend === 'down' && (
                  <>
                    <TrendingDown className={cn('mr-1 h-4 w-4', isNegative ? 'text-red-500' : 'text-green-500')} />
                    <span className={cn(isNegative ? 'text-red-500' : 'text-green-500')}>
                      -{formatPercentage(Math.abs(delta))}
                    </span>
                  </>
                )}
                {determinedTrend === 'neutral' && (
                  <>
                    <Minus className="mr-1 h-4 w-4 text-gray-400" />
                    <span className="text-gray-400">0%</span>
                  </>
                )}
                <span className="ml-1 text-muted-foreground">{deltaPeriod}</span>
              </div>
            )}
          </div>
        </div>
        {alert && alertMessage && (
          <div className="mt-3 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
            <AlertTriangle className="h-3 w-3" />
            {alertMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
