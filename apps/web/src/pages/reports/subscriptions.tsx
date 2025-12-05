import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Calendar, TrendingUp, Users, Mail } from 'lucide-react';

// Types matching backend
type ReportType = 'SHIFT_END' | 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'MONTHLY_SUMMARY' | 'FRANCHISE_WEEKLY';
type RecipientType = 'USER' | 'ROLE';
type DigestTypeFilter = 'ALL' | 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'MONTHLY_SUMMARY';

interface ReportSubscription {
  id: string;
  orgId: string;
  branchId: string | null;
  reportType: ReportType;
  deliveryChannel: 'EMAIL' | 'SLACK';
  recipientType: RecipientType;
  recipientId: string | null;
  recipientEmail: string | null;
  enabled: boolean;
  includeCSVs: boolean;
  includePDF: boolean;
  lastRunAt: string | null;
  metadata: any;
  createdAt: string;
}

interface ShiftEndReportSummary {
  id: string;
  branchId: string;
  branchName: string;
  shiftId: string;
  closedAt: string;
  totalSales: number;
  cashVariance: number;
  anomaliesCount: number;
  staffCount: number;
  closedBy: string | null;
}

interface PeriodDigestSummary {
  id: string;
  type: 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'MONTHLY_SUMMARY';
  from: string;
  to: string;
  generatedAt: string;
  branchId: string | null;
  branchName: string | null;
  totalSales: number;
  nps: number | null;
  wastageCost: number;
  orderCount: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ReportsPage() {
  const queryClient = useQueryClient();

  // State
  const [digestType, setDigestType] = useState<DigestTypeFilter>('ALL');
  
  // Default date range: last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  const [from, setFrom] = useState<string>(sevenDaysAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState<string>(today.toISOString().split('T')[0]);

  // TODO: Get from user context
  const branchId = 'branch-1';

  // Fetch report subscriptions
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<ReportSubscription[]>({
    queryKey: ['report-subscriptions', branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      
      const res = await fetch(`${API_URL}/reports/subscriptions?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      return res.json();
    },
  });

  // Fetch shift-end report history
  const { data: shiftEndReports = [], isLoading: shiftEndLoading } = useQuery<ShiftEndReportSummary[]>({
    queryKey: ['shift-end-history', branchId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      params.append('limit', '20');
      
      const res = await fetch(`${API_URL}/reports/shift-end/history?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch shift-end reports');
      return res.json();
    },
  });

  // Fetch period digest history
  const { data: periodDigests = [], isLoading: digestsLoading } = useQuery<PeriodDigestSummary[]>({
    queryKey: ['period-digests', branchId, digestType, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      if (digestType !== 'ALL') params.append('type', digestType);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      params.append('limit', '20');
      
      const res = await fetch(`${API_URL}/reports/period/history?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch period digests');
      return res.json();
    },
  });

  // Toggle subscription enabled
  const toggleSubscription = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`${API_URL}/reports/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update subscription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-subscriptions'] });
    },
  });

  // Summary stats
  const summaryStats = useMemo(() => {
    const shiftEndCount = shiftEndReports.length;
    const digestCount = periodDigests.length;
    const totalSales = periodDigests.reduce((sum, d) => sum + d.totalSales, 0);
    const npsValues = periodDigests.filter((d) => d.nps !== null).map((d) => d.nps!);
    const avgNps = npsValues.length > 0 
      ? npsValues.reduce((sum, n) => sum + n, 0) / npsValues.length 
      : null;

    return { shiftEndCount, digestCount, totalSales, avgNps };
  }, [shiftEndReports, periodDigests]);

  // Helper functions
  const getReportTypeLabel = (type: ReportType): string => {
    const labels: Record<ReportType, string> = {
      SHIFT_END: 'Shift-End',
      DAILY_SUMMARY: 'Daily Summary',
      WEEKLY_SUMMARY: 'Weekly Summary',
      MONTHLY_SUMMARY: 'Monthly Summary',
      FRANCHISE_WEEKLY: 'Franchise Weekly',
    };
    return labels[type] || type;
  };

  const getReportTypeBadgeColor = (type: ReportType): string => {
    const colors: Record<ReportType, string> = {
      SHIFT_END: 'bg-blue-100 text-blue-800',
      DAILY_SUMMARY: 'bg-green-100 text-green-800',
      WEEKLY_SUMMARY: 'bg-purple-100 text-purple-800',
      MONTHLY_SUMMARY: 'bg-orange-100 text-orange-800',
      FRANCHISE_WEEKLY: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriod = (from: string, to: string): string => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (fromDate.toDateString() === toDate.toDateString()) {
      return formatDateOnly(from);
    }
    
    return `${formatDateOnly(from)} - ${formatDateOnly(to)}`;
  };

  const getRecipientDisplay = (sub: ReportSubscription): string => {
    if (sub.recipientEmail) {
      return sub.recipientEmail;
    }
    if (sub.recipientId) {
      return sub.recipientType === 'ROLE' ? `Role: ${sub.recipientId}` : `User: ${sub.recipientId}`;
    }
    return 'N/A';
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports & Digests"
        subtitle="View shift-end reports, scheduled digests, and franchise overviews."
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Shift-End Reports</p>
              <p className="text-2xl font-bold">{summaryStats.shiftEndCount}</p>
              <p className="text-xs text-gray-500">in date range</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Scheduled Digests</p>
              <p className="text-2xl font-bold">{summaryStats.digestCount}</p>
              <p className="text-xs text-gray-500">in date range</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales (Digests)</p>
              <p className="text-2xl font-bold">
                {summaryStats.totalSales > 0 ? formatCurrency(summaryStats.totalSales) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">from period digests</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg NPS (Digests)</p>
              <p className="text-2xl font-bold">
                {summaryStats.avgNps !== null ? summaryStats.avgNps.toFixed(1) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">customer satisfaction</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Digest Type</label>
              <div className="flex gap-2">
                {(['ALL', 'DAILY_SUMMARY', 'WEEKLY_SUMMARY', 'MONTHLY_SUMMARY'] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={digestType === type ? 'default' : 'outline'}
                    onClick={() => setDigestType(type)}
                  >
                    {type === 'ALL' ? 'All' : type.split('_')[0]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        {/* Report Subscriptions (1 column) */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Report Subscriptions</h3>
          </div>

          {subscriptionsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No subscriptions configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge className={getReportTypeBadgeColor(sub.reportType)}>
                        {getReportTypeLabel(sub.reportType)}
                      </Badge>
                      <p className="text-sm text-gray-600 mt-1">
                        {getRecipientDisplay(sub)}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sub.enabled}
                        onChange={() => toggleSubscription.mutate({ id: sub.id, enabled: !sub.enabled })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {sub.includePDF && (
                      <Badge className="bg-gray-100 text-gray-700">PDF</Badge>
                    )}
                    {sub.includeCSVs && (
                      <Badge className="bg-gray-100 text-gray-700">CSV</Badge>
                    )}
                  </div>
                  {sub.lastRunAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last run: {formatDate(sub.lastRunAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Shift-End Reports & Period Digests (2 columns) */}
        <div className="md:col-span-2 space-y-6">
          {/* Shift-End Reports */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Recent Shift-End Reports</h3>
            </div>

            {shiftEndLoading ? (
              <div className="text-center py-8 text-gray-500">Loading shift-end reports...</div>
            ) : shiftEndReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No shift-end reports found</p>
                <p className="text-sm">Reports will appear once shifts are closed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Branch</th>
                      <th className="pb-3 pr-4">Total Sales</th>
                      <th className="pb-3 pr-4">Variance</th>
                      <th className="pb-3 pr-4">Anomalies</th>
                      <th className="pb-3">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {shiftEndReports.map((report) => (
                      <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-4 text-gray-600">
                          {formatDate(report.closedAt)}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {report.branchName}
                        </td>
                        <td className="py-3 pr-4">
                          {formatCurrency(report.totalSales)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={report.cashVariance !== 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {formatCurrency(Math.abs(report.cashVariance))}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={report.anomaliesCount > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}>
                            {report.anomaliesCount}
                          </Badge>
                        </td>
                        <td className="py-3 text-gray-600">
                          {report.staffCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Period Digests */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Scheduled Digests</h3>
            </div>

            {digestsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading digests...</div>
            ) : periodDigests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No period digests found</p>
                <p className="text-sm">Try adjusting your date range or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Period</th>
                      <th className="pb-3 pr-4">Branch</th>
                      <th className="pb-3 pr-4">Total Sales</th>
                      <th className="pb-3 pr-4">Orders</th>
                      <th className="pb-3">NPS</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {periodDigests.map((digest) => (
                      <tr key={digest.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <Badge className={getReportTypeBadgeColor(digest.type as ReportType)}>
                            {digest.type.split('_')[0]}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {formatPeriod(digest.from, digest.to)}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          {digest.branchName || 'Franchise'}
                        </td>
                        <td className="py-3 pr-4">
                          {formatCurrency(digest.totalSales)}
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {digest.orderCount}
                        </td>
                        <td className="py-3 text-gray-600">
                          {digest.nps !== null ? digest.nps.toFixed(1) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
