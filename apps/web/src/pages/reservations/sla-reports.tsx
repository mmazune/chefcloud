import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Download, TrendingUp, Users, Clock, AlertTriangle, Webhook, Bell } from 'lucide-react';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const subDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

interface SlaMetrics {
  period: { start: string; end: string };
  reservations: {
    totalCreated: number;
    avgHoldDurationMinutes: number | null;
    avgConfirmLatencyMinutes: number | null;
    noShowCount: number;
    noShowRate: number;
    cancellationCount: number;
    cancellationRate: number;
    completedCount: number;
  };
  deposits: {
    totalRequired: number;
    capturedCount: number;
    refundedCount: number;
    conversionRate: number;
  };
  webhooks: {
    totalSent: number;
    deliveredCount: number;
    failedCount: number;
    deadLetterCount: number;
    deliveryRate: number;
    avgDeliveryLatencyMs: number | null;
  };
  notifications: {
    totalQueued: number;
    sentCount: number;
    failedCount: number;
    deliveryRate: number;
  };
}

export default function SlaReportsPage() {
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [dateRange, setDateRange] = useState({
    start: formatDate(subDays(new Date(), 30)),
    end: formatDate(new Date()),
  });

  const { data: metrics, isLoading, refetch } = useQuery<SlaMetrics>({
    queryKey: ['sla-metrics', branchId, dateRange],
    queryFn: async () => {
      const res = await apiClient.get('/reservations/reports/sla', {
        params: {
          branchId,
          start: dateRange.start,
          end: dateRange.end,
        },
      });
      return res.data;
    },
    enabled: !!branchId,
  });

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/reservations/reports/sla/export', {
        params: {
          branchId,
          start: dateRange.start,
          end: dateRange.end,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sla-report-${branchId}-${dateRange.start}-${dateRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
  const formatDuration = (minutes: number | null) => 
    minutes !== null ? `${minutes.toFixed(1)} min` : 'N/A';

  if (!branchId) {
    return (
      <AppShell>
        <PageHeader
          title="SLA Reports"
          subtitle="Monitor operational KPIs and service levels"
        />
        <Card className="p-6">
          <p className="text-muted-foreground">Please select a branch to view SLA reports.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="SLA Reports"
        subtitle="Monitor operational KPIs and service levels"
        actions={
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        }
      />

      {/* Date Range Selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="start">From</Label>
            <Input
              id="start"
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
          </div>
          <div>
            <Label htmlFor="end">To</Label>
            <Input
              id="end"
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
          </div>
          <Button onClick={() => refetch()} className="mt-5">
            Apply
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p>Loading metrics...</p>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Reservation Metrics */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reservation Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Created
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.reservations.totalCreated}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.reservations.completedCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    No-Shows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.reservations.noShowCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercent(metrics.reservations.noShowRate)} rate
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cancellations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {metrics.reservations.cancellationCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercent(metrics.reservations.cancellationRate)} rate
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Timing Metrics */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timing Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Hold Duration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(metrics.reservations.avgHoldDurationMinutes)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Confirm Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(metrics.reservations.avgConfirmLatencyMinutes)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Deposit Metrics */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Deposit Metrics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.deposits.totalRequired}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Captured
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.deposits.capturedCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Refunded
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {metrics.deposits.refundedCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Conversion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercent(metrics.deposits.conversionRate)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Integration Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Webhook Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook SLA
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Sent</div>
                      <div className="text-xl font-bold">{metrics.webhooks.totalSent}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Delivery Rate</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatPercent(metrics.webhooks.deliveryRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                      <div className="text-xl font-bold text-red-600">
                        {metrics.webhooks.failedCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Dead Letter</div>
                      <div className="text-xl font-bold text-amber-600">
                        {metrics.webhooks.deadLetterCount}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notification Metrics */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification SLA
              </h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Queued</div>
                      <div className="text-xl font-bold">{metrics.notifications.totalQueued}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Delivery Rate</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatPercent(metrics.notifications.deliveryRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Sent</div>
                      <div className="text-xl font-bold">{metrics.notifications.sentCount}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                      <div className="text-xl font-bold text-red-600">
                        {metrics.notifications.failedCount}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No metrics available for the selected period.</p>
      )}
    </AppShell>
  );
}
