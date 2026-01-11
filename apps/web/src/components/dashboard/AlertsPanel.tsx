/**
 * Alerts Panel Component - Consolidated alerts/warnings view
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  Package, 
  DollarSign, 
  Calendar, 
  TrendingDown,
  ChevronRight,
  Bell
} from 'lucide-react';

export interface Alert {
  id: string;
  type: 'low-stock' | 'overdue-bill' | 'high-wastage' | 'reservation-spike' | 'margin-drop' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  count?: number;
  link?: string;
  createdAt?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  loading?: boolean;
  className?: string;
  maxAlerts?: number;
  onViewAll?: () => void;
}

const alertIcons: Record<Alert['type'], React.ReactNode> = {
  'low-stock': <Package className="h-4 w-4" />,
  'overdue-bill': <DollarSign className="h-4 w-4" />,
  'high-wastage': <TrendingDown className="h-4 w-4" />,
  'reservation-spike': <Calendar className="h-4 w-4" />,
  'margin-drop': <AlertTriangle className="h-4 w-4" />,
  'info': <Bell className="h-4 w-4" />,
};

const severityColors: Record<Alert['severity'], string> = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const severityDots: Record<Alert['severity'], string> = {
  low: 'bg-blue-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};

export function AlertsPanel({
  alerts,
  loading,
  className,
  maxAlerts = 5,
  onViewAll,
}: AlertsPanelProps) {
  const displayedAlerts = alerts.slice(0, maxAlerts);
  const hasMore = alerts.length > maxAlerts;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-3">
              <Bell className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-600">All Clear</p>
            <p className="text-xs text-muted-foreground mt-1">No active alerts at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="alerts-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
            {alerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600" data-testid="alerts-count">
                {alerts.length}
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2" data-testid="alerts-list">
          {displayedAlerts.map((alert) => {
            const AlertWrapper = alert.link ? Link : 'div';
            const wrapperProps = alert.link ? { href: alert.link } : {};

            return (
              <AlertWrapper
                key={alert.id}
                {...(wrapperProps as any)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-all',
                  severityColors[alert.severity],
                  alert.link && 'hover:shadow-sm cursor-pointer'
                )}
                data-testid={`alert-item-${alert.id}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {alertIcons[alert.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', severityDots[alert.severity])} />
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    {alert.count !== undefined && (
                      <span className="text-xs font-bold bg-white/50 px-1.5 py-0.5 rounded">
                        {alert.count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 opacity-80 line-clamp-1">{alert.message}</p>
                </div>
                {alert.link && (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50" />
                )}
              </AlertWrapper>
            );
          })}
        </div>
        {hasMore && (
          <button
            onClick={onViewAll}
            className="mt-3 w-full text-center text-sm text-chefcloud-blue hover:underline"
          >
            View all {alerts.length} alerts
          </button>
        )}
      </CardContent>
    </Card>
  );
}
