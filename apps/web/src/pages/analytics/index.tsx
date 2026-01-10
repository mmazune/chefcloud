import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { usePlanCapabilities } from '@/hooks/usePlanCapabilities';
import { BillingUpsellGate } from '@/components/billing/BillingUpsellGate';
import { BillingInlineRiskBanner } from '@/components/billing/BillingInlineRiskBanner';
import { useFranchiseBudgetVariance } from '@/hooks/useFranchiseBudgetVariance';
import { useFranchiseForecast } from '@/hooks/useFranchiseForecast';
import { useFranchiseMultiMonthSeries } from '@/hooks/useFranchiseMultiMonthSeries';
import { FranchiseBudgetTable } from '@/components/analytics/franchise/FranchiseBudgetTable';
import { FranchiseVarianceCard } from '@/components/analytics/franchise/FranchiseVarianceCard';
import { FranchiseForecastCard } from '@/components/analytics/franchise/FranchiseForecastCard';
import { FranchiseMultiMonthChart } from '@/components/analytics/franchise/FranchiseMultiMonthChart';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I3: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/analytics',
  title: 'Franchise Analytics',
  primaryActions: [
    { label: 'Export CSV', testId: 'analytics-export-csv', intent: 'export' },
    { label: 'Date Range Filter', testId: 'analytics-date-filter', intent: 'view' },
  ],
  apiCalls: [
    { method: 'GET', path: '/analytics/daily', trigger: 'onMount', notes: 'Fetch daily metrics' },
    { method: 'GET', path: '/analytics/branches', trigger: 'onMount', notes: 'Fetch branch metrics' },
    { method: 'GET', path: '/analytics/franchise/budget', trigger: 'onMount', notes: 'Fetch budget variance' },
    { method: 'GET', path: '/analytics/franchise/forecast', trigger: 'onMount', notes: 'Fetch forecast' },
  ],
  risk: 'LOW',
  allowedRoles: ['OWNER', 'MANAGER'],
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DailyMetricPoint {
  date: string;
  totalSales: number;
  avgCheck?: number;
  ordersCount?: number;
  nps?: number | null;
}

// Helper to get date in YYYY-MM-DD format
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper to get date N days ago
const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

interface BranchMetric {
  branchId: string;
  branchName: string;
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  grossMarginPercent: number;
  kdsSlaScore: number;
  staffScore: number;
  nps: number | null;
  wastagePercent: number;
}

interface FinancialSummary {
  currency: string;
  period: {
    from: string;
    to: string;
  };
  pnl: {
    revenue: number;
    cogs: number;
    grossMargin: number;
    grossMarginPct: number;
    operatingExpenses: number;
    netProfit: number;
    netProfitPct: number;
  };
  budget: {
    totalBudget: number;
    totalActual: number;
    varianceAmount: number;
    variancePct: number;
    byCategory: Array<{
      category: string;
      budget: number;
      actual: number;
      variance: number;
      variancePct: number;
    }>;
  } | null;
}

interface RiskSummary {
  totalEvents: number;
  bySeverity: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  byType: { type: string; count: number }[];
  byBranch: { branchId: string; branchName: string; count: number; criticalCount: number }[];
  topStaff: {
    employeeId: string;
    name: string;
    branchName: string;
    count: number;
    criticalCount: number;
  }[];
}

interface RiskEvent {
  id: string;
  occurredAt: string;
  branchName: string;
  employeeName?: string | null;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO' | 'WARN';
  description?: string | null;
}

export default function AnalyticsPage() {
  // E24-BILLING-FE-S3: Plan capabilities for franchise analytics gating
  const { subscription, capabilities, isLoading: isLoadingPlan } = usePlanCapabilities();

  // View toggle state
  const [view, setView] = useState<'overview' | 'branches' | 'financial' | 'risk' | 'franchise'>('overview');

  // Get user context for branchId
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  // Date range state
  const [from, setFrom] = useState<string>(formatDateForInput(getDaysAgo(30)));
  const [to, setTo] = useState<string>(formatDateForInput(new Date()));

  // Franchise analytics date selector (E22-FRANCHISE-FE-S1)
  const currentDate = new Date();
  const [franchiseYear, setFranchiseYear] = useState<number>(currentDate.getFullYear());
  const [franchiseMonth, setFranchiseMonth] = useState<number>(currentDate.getMonth() + 1);
  
  // Franchise view mode (E22-FRANCHISE-FE-S2)
  const [franchiseViewMode, setFranchiseViewMode] = useState<'current' | 'multi'>('current');

  // Fetch daily metrics for overview
  const { data: metrics = [], isLoading } = useQuery<DailyMetricPoint[]>({
    queryKey: ['analytics-daily', from, to, branchId],
    queryFn: async () => {
      const params: Record<string, string> = {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/analytics/daily-metrics', { params });
      return res.data;
    },
    enabled: view === 'overview' && !!user,
  });

  // Fetch branch metrics for comparison view
  const { data: branchMetrics = [], isLoading: isLoadingBranches } = useQuery<BranchMetric[]>({
    queryKey: ['analytics-branches', from, to],
    queryFn: async () => {
      const params = {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      const res = await apiClient.get('/franchise/branch-metrics', { params });
      return res.data;
    },
    enabled: view === 'branches' && !!user,
  });

  // Fetch financial summary for financial view
  const { data: financialSummary, isLoading: financialLoading } = useQuery<FinancialSummary>({
    queryKey: ['analytics-financial', from, to, branchId],
    queryFn: async () => {
      const params: Record<string, string> = {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/analytics/financial-summary', { params });
      return res.data;
    },
    enabled: view === 'financial' && !!user,
  });

  // Fetch risk summary for risk view
  const { data: riskSummary, isLoading: riskSummaryLoading } = useQuery<RiskSummary>({
    queryKey: ['analytics-risk-summary', from, to],
    queryFn: async () => {
      const params = {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      const res = await apiClient.get('/analytics/risk-summary', { params });
      return res.data;
    },
    enabled: view === 'risk' && !!user,
  });

  // Fetch risk events for risk view
  const { data: riskEvents = [], isLoading: riskEventsLoading } = useQuery<RiskEvent[]>({
    queryKey: ['analytics-risk-events', from, to],
    queryFn: async () => {
      const params = {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      const res = await apiClient.get('/analytics/risk-events', { params });
      return res.data;
    },
    enabled: view === 'risk' && !!user,
  });

  // Fetch franchise analytics data (E22-FRANCHISE-FE-S1)
  const { data: franchiseVariance, isLoading: isFranchiseVarianceLoading } = 
    useFranchiseBudgetVariance({
      year: franchiseYear,
      month: franchiseMonth,
    });

  const { data: franchiseForecast, isLoading: isFranchiseForecastLoading } = 
    useFranchiseForecast({
      year: franchiseYear,
      month: franchiseMonth,
      lookbackMonths: 3,
    });

  // Fetch multi-month series for trend view (E22-FRANCHISE-FE-S2)
  const multiMonths = 6;
  const { data: franchiseMultiSeries, isLoading: isFranchiseMultiLoading } =
    useFranchiseMultiMonthSeries({
      startYear: franchiseYear,
      startMonth: franchiseMonth,
      months: multiMonths,
      lookbackMonths: 3,
    });

  // Quick date range buttons
  const setQuickRange = (days: number) => {
    setFrom(formatDateForInput(getDaysAgo(days)));
    setTo(formatDateForInput(new Date()));
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (metrics.length === 0) {
      return {
        totalSales: 0,
        avgDailySales: 0,
        avgCheck: 0,
        avgNPS: null,
      };
    }

    const totalSales = metrics.reduce((sum, m) => sum + m.totalSales, 0);
    const daysWithSales = metrics.filter((m) => m.totalSales > 0).length;
    const avgDailySales = daysWithSales > 0 ? totalSales / daysWithSales : 0;

    // Calculate weighted average check
    const totalOrders = metrics.reduce((sum, m) => sum + (m.ordersCount || 0), 0);
    const avgCheck = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Calculate average NPS
    const npsValues = metrics.filter((m) => m.nps !== null && m.nps !== undefined).map((m) => m.nps!);
    const avgNPS = npsValues.length > 0 
      ? npsValues.reduce((sum, n) => sum + n, 0) / npsValues.length 
      : null;

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      avgCheck: Math.round(avgCheck * 100) / 100,
      avgNPS: avgNPS !== null ? Math.round(avgNPS * 10) / 10 : null,
    };
  }, [metrics]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date for chart (shorter format)
  const formatChartDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter metrics with NPS data for NPS chart
  const npsMetrics = useMemo(() => {
    return metrics.filter((m) => m.nps !== null && m.nps !== undefined);
  }, [metrics]);

  // Branch summary stats
  const branchSummary = useMemo(() => {
    if (branchMetrics.length === 0) {
      return {
        topBySales: null,
        topByNPS: null,
        avgMargin: 0,
        avgKdsSla: 0,
      };
    }

    const sortedBySales = [...branchMetrics].sort((a, b) => b.totalSales - a.totalSales);
    const withNPS = branchMetrics.filter((b) => b.nps !== null);
    const sortedByNPS = withNPS.sort((a, b) => (b.nps || 0) - (a.nps || 0));

    const totalSales = branchMetrics.reduce((sum, b) => sum + b.totalSales, 0);
    const weightedMargin = branchMetrics.reduce(
      (sum, b) => sum + b.grossMarginPercent * b.totalSales,
      0
    );
    const avgKdsSla =
      branchMetrics.reduce((sum, b) => sum + b.kdsSlaScore, 0) / branchMetrics.length;

    return {
      topBySales: sortedBySales[0],
      topByNPS: sortedByNPS[0] || null,
      avgMargin: totalSales > 0 ? weightedMargin / totalSales : 0,
      avgKdsSla,
    };
  }, [branchMetrics]);

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        subtitle="Sales and performance trends across your branches."
      />

      {/* View Toggle */}
      <div role="tablist" aria-label="Analytics sections" className="mb-4 flex gap-2">
        <Button
          role="tab"
          id="analytics-tab-overview"
          aria-selected={view === 'overview'}
          aria-controls="analytics-tabpanel-overview"
          tabIndex={view === 'overview' ? 0 : -1}
          variant={view === 'overview' ? 'default' : 'outline'}
          onClick={() => setView('overview')}
        >
          Overview
        </Button>
        <Button
          role="tab"
          id="analytics-tab-branches"
          aria-selected={view === 'branches'}
          aria-controls="analytics-tabpanel-branches"
          tabIndex={view === 'branches' ? 0 : -1}
          variant={view === 'branches' ? 'default' : 'outline'}
          onClick={() => setView('branches')}
        >
          By Branch
        </Button>
        <Button
          role="tab"
          id="analytics-tab-financial"
          aria-selected={view === 'financial'}
          aria-controls="analytics-tabpanel-financial"
          tabIndex={view === 'financial' ? 0 : -1}
          variant={view === 'financial' ? 'default' : 'outline'}
          onClick={() => setView('financial')}
        >
          Financial
        </Button>
        <Button
          role="tab"
          id="analytics-tab-risk"
          aria-selected={view === 'risk'}
          aria-controls="analytics-tabpanel-risk"
          tabIndex={view === 'risk' ? 0 : -1}
          variant={view === 'risk' ? 'default' : 'outline'}
          onClick={() => setView('risk')}
        >
          Risk
        </Button>
        <Button
          role="tab"
          id="analytics-tab-franchise"
          aria-selected={view === 'franchise'}
          aria-controls="analytics-tabpanel-franchise"
          tabIndex={view === 'franchise' ? 0 : -1}
          variant={view === 'franchise' ? 'default' : 'outline'}
          onClick={() => setView('franchise')}
        >
          Franchise
        </Button>
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
              <label className="text-sm font-medium mb-2 block">Quick Ranges</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickRange(7)}
                >
                  Last 7 days
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickRange(30)}
                >
                  Last 30 days
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickRange(90)}
                >
                  Last 90 days
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.totalSales)}</p>
                  <p className="text-xs text-gray-500">in period</p>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Daily Sales</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.avgDailySales)}</p>
                  <p className="text-xs text-gray-500">per day</p>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Check Size</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.avgCheck)}</p>
                  <p className="text-xs text-gray-500">per order</p>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average NPS</p>
              {isLoading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <>
                  <p className="text-2xl font-bold">
                    {summaryStats.avgNPS !== null ? summaryStats.avgNPS.toFixed(1) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">customer score</p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {view === 'overview' && (
        <div
          role="tabpanel"
          id="analytics-tabpanel-overview"
          aria-labelledby="analytics-tab-overview"
        >
          {/* Sales Trend Chart */}
          <Card className="mb-6">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Sales Trend</h2>
          <p className="text-sm text-muted-foreground">
            Daily revenue for the selected period.
          </p>
        </div>
        <div className="p-4 h-72">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : metrics.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatChartDate}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => formatChartDate(label)}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="totalSales" 
                  name="Total Sales" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

          {/* Average Check & NPS Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Average Check Trend */}
        <Card>
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Average Check Size</h2>
            <p className="text-sm text-muted-foreground">
              Average ticket value per day.
            </p>
          </div>
          <div className="p-4 h-60">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : metrics.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatChartDate}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => formatChartDate(label)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgCheck" 
                    name="Avg Check" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* NPS Trend */}
        <Card>
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">NPS Trend</h2>
            <p className="text-sm text-muted-foreground">
              Daily Net Promoter Score from customer feedback.
            </p>
          </div>
          <div className="p-4 h-60">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading chart...
              </div>
            ) : npsMetrics.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No NPS data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={npsMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatChartDate}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis domain={[0, 10]} />
                  <Tooltip 
                    formatter={(value: number) => value.toFixed(1)}
                    labelFormatter={(label) => formatChartDate(label)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="nps" 
                    name="NPS Score" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
        </div>
      )}

      {view === 'branches' && (
        <div
          role="tabpanel"
          id="analytics-tabpanel-branches"
          aria-labelledby="analytics-tab-branches"
        >
          {/* Branch Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Branch (Sales)</p>
                  {isLoadingBranches ? (
                    <p className="text-lg font-semibold">Loading...</p>
                  ) : branchSummary.topBySales ? (
                    <>
                      <p className="text-lg font-semibold">{branchSummary.topBySales.branchName}</p>
                      <p className="text-sm text-green-600">
                        {formatCurrency(branchSummary.topBySales.totalSales)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">—</p>
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Top Branch (NPS)</p>
                  {isLoadingBranches ? (
                    <p className="text-lg font-semibold">Loading...</p>
                  ) : branchSummary.topByNPS ? (
                    <>
                      <p className="text-lg font-semibold">{branchSummary.topByNPS.branchName}</p>
                      <p className="text-sm text-orange-600">
                        {branchSummary.topByNPS.nps?.toFixed(1) || '—'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">—</p>
                  )}
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Gross Margin</p>
                  <p className="text-2xl font-bold">
                    {isLoadingBranches ? '—' : `${branchSummary.avgMargin.toFixed(1)}%`}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg KDS SLA</p>
                  <p className="text-2xl font-bold">
                    {isLoadingBranches ? '—' : `${branchSummary.avgKdsSla.toFixed(1)}%`}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-purple-600" />
              </div>
            </Card>
          </div>

          {/* Branch Rankings Table */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Branch Performance Rankings</h2>
              <p className="text-sm text-muted-foreground">
                Compare key metrics across all branches for the selected period.
              </p>
            </div>
            <div className="overflow-x-auto">
              {isLoadingBranches ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading branch metrics...
                </div>
              ) : branchMetrics.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No branch data for this period
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Rank</th>
                      <th className="p-3 text-left text-sm font-medium">Branch</th>
                      <th className="p-3 text-right text-sm font-medium">Sales</th>
                      <th className="p-3 text-right text-sm font-medium">Margin %</th>
                      <th className="p-3 text-right text-sm font-medium">KDS SLA %</th>
                      <th className="p-3 text-right text-sm font-medium">Staff Score</th>
                      <th className="p-3 text-right text-sm font-medium">NPS</th>
                      <th className="p-3 text-right text-sm font-medium">Wastage %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...branchMetrics]
                      .sort((a, b) => b.totalSales - a.totalSales)
                      .map((branch, index) => (
                        <tr
                          key={branch.branchId}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-3 text-sm font-medium">{index + 1}</td>
                          <td className="p-3 text-sm font-medium">{branch.branchName}</td>
                          <td className="p-3 text-sm text-right">
                            {formatCurrency(branch.totalSales)}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {branch.grossMarginPercent.toFixed(1)}%
                          </td>
                          <td className="p-3 text-sm text-right">
                            {branch.kdsSlaScore.toFixed(1)}%
                          </td>
                          <td className="p-3 text-sm text-right">
                            {branch.staffScore.toFixed(1)}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {branch.nps !== null ? branch.nps.toFixed(1) : '—'}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {branch.wastagePercent.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      )}

      {view === 'financial' && (
        <div
          role="tabpanel"
          id="analytics-tabpanel-financial"
          aria-labelledby="analytics-tab-financial"
        >
          {/* Financial Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Revenue</div>
              <div className="text-2xl font-bold mt-2">
                {financialLoading || !financialSummary
                  ? '…'
                  : formatCurrency(financialSummary.pnl.revenue)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Gross Margin</div>
              <div className="text-2xl font-bold mt-2">
                {financialLoading || !financialSummary
                  ? '…'
                  : `${financialSummary.pnl.grossMarginPct.toFixed(1)}%`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {financialLoading || !financialSummary
                  ? ''
                  : formatCurrency(financialSummary.pnl.grossMargin)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Operating Expenses</div>
              <div className="text-2xl font-bold mt-2">
                {financialLoading || !financialSummary
                  ? '…'
                  : formatCurrency(financialSummary.pnl.operatingExpenses)}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Net Profit</div>
              <div className="text-2xl font-bold mt-2">
                {financialLoading || !financialSummary
                  ? '…'
                  : formatCurrency(financialSummary.pnl.netProfit)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {financialLoading || !financialSummary
                  ? ''
                  : `Margin: ${financialSummary.pnl.netProfitPct.toFixed(1)}%`}
              </div>
            </Card>
          </div>

          {/* Budget vs Actual Table */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Budget vs Actual by Category</h2>
                <p className="text-sm text-muted-foreground">
                  For the selected period.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              {financialLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading financial data…
                </div>
              ) : !financialSummary?.budget || financialSummary.budget.byCategory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No budget data for this period. Budget tracking is typically monthly.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="p-3 text-left text-xs font-medium uppercase tracking-wide">
                        Category
                      </th>
                      <th className="p-3 text-right text-xs font-medium uppercase tracking-wide">
                        Budget
                      </th>
                      <th className="p-3 text-right text-xs font-medium uppercase tracking-wide">
                        Actual
                      </th>
                      <th className="p-3 text-right text-xs font-medium uppercase tracking-wide">
                        Variance
                      </th>
                      <th className="p-3 text-right text-xs font-medium uppercase tracking-wide">
                        Variance %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialSummary.budget.byCategory.map((row) => {
                      const isOver = row.variance > 0; // overspend
                      return (
                        <tr key={row.category} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm font-medium">{row.category}</td>
                          <td className="p-3 text-sm text-right">
                            {formatCurrency(row.budget)}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {formatCurrency(row.actual)}
                          </td>
                          <td
                            className={`p-3 text-sm text-right ${
                              isOver ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {formatCurrency(row.variance)}
                          </td>
                          <td
                            className={`p-3 text-sm text-right ${
                              isOver ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {row.variancePct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      )}

      {view === 'risk' && (
        <div
          role="tabpanel"
          id="analytics-tabpanel-risk"
          aria-labelledby="analytics-tab-risk"
        >
          {/* Risk Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Total Risk Events</div>
              <div className="text-2xl font-bold mt-2">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.totalEvents}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Critical</div>
              <div className="text-2xl font-bold mt-2 text-red-600">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.bySeverity.CRITICAL}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">High + Critical</div>
              <div className="text-2xl font-bold mt-2 text-orange-600">
                {riskSummaryLoading || !riskSummary
                  ? '…'
                  : riskSummary.bySeverity.HIGH + riskSummary.bySeverity.CRITICAL}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Branches Impacted</div>
              <div className="text-2xl font-bold mt-2">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.byBranch.length}
              </div>
            </Card>
          </div>

          {/* By Branch & By Staff Tables */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* By Branch */}
            <Card>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Risk by Branch</h2>
                <p className="text-sm text-muted-foreground">
                  Branches with the most risk events
                </p>
              </div>
              <div className="overflow-x-auto">
                {riskSummaryLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : !riskSummary || riskSummary.byBranch.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No branch data for this period
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium">Branch</th>
                        <th className="p-3 text-right text-sm font-medium">Total Events</th>
                        <th className="p-3 text-right text-sm font-medium">Critical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskSummary.byBranch.map((branch) => (
                        <tr key={branch.branchId} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm font-medium">{branch.branchName}</td>
                          <td className="p-3 text-sm text-right">{branch.count}</td>
                          <td className="p-3 text-sm text-right text-red-600 font-medium">
                            {branch.criticalCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* Top Staff */}
            <Card>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Top Staff with Risk Events</h2>
                <p className="text-sm text-muted-foreground">
                  Staff members flagged most frequently
                </p>
              </div>
              <div className="overflow-x-auto">
                {riskSummaryLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : !riskSummary || riskSummary.topStaff.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No staff data for this period
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium">Staff Name</th>
                        <th className="p-3 text-left text-sm font-medium">Branch</th>
                        <th className="p-3 text-right text-sm font-medium">Total</th>
                        <th className="p-3 text-right text-sm font-medium">Critical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskSummary.topStaff.map((staff) => (
                        <tr key={staff.employeeId} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm font-medium">{staff.name}</td>
                          <td className="p-3 text-sm">{staff.branchName}</td>
                          <td className="p-3 text-sm text-right">{staff.count}</td>
                          <td className="p-3 text-sm text-right text-red-600 font-medium">
                            {staff.criticalCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* Risk Events Table */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Recent Risk Events</h2>
              <p className="text-sm text-muted-foreground">
                Individual anomaly events for the selected period
              </p>
            </div>
            <div className="overflow-x-auto">
              {riskEventsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading events...</div>
              ) : riskEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No risk events for this period
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Date/Time</th>
                      <th className="p-3 text-left text-sm font-medium">Branch</th>
                      <th className="p-3 text-left text-sm font-medium">Staff</th>
                      <th className="p-3 text-left text-sm font-medium">Type</th>
                      <th className="p-3 text-left text-sm font-medium">Severity</th>
                      <th className="p-3 text-left text-sm font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskEvents.map((event) => {
                      const severityColors = {
                        LOW: 'bg-gray-100 text-gray-800',
                        MEDIUM: 'bg-yellow-100 text-yellow-800',
                        HIGH: 'bg-red-100 text-red-800',
                        CRITICAL: 'bg-red-600 text-white font-bold',
                        INFO: 'bg-blue-100 text-blue-800',
                        WARN: 'bg-yellow-100 text-yellow-800',
                      };
                      
                      return (
                        <tr key={event.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm">
                            {new Date(event.occurredAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 text-sm">{event.branchName}</td>
                          <td className="p-3 text-sm">{event.employeeName || '—'}</td>
                          <td className="p-3 text-sm">
                            {event.type.replace(/_/g, ' ')}
                          </td>
                          <td className="p-3 text-sm">
                            <Badge
                              className={severityColors[event.severity] || severityColors.LOW}
                            >
                              {event.severity}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {event.description || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      )}

      {view === 'risk' && (
        <>
          {/* Risk Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Total Risk Events</div>
              <div className="text-2xl font-bold mt-2">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.totalEvents}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Critical</div>
              <div className="text-2xl font-bold mt-2 text-red-600">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.bySeverity.CRITICAL}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">High + Critical</div>
              <div className="text-2xl font-bold mt-2 text-orange-600">
                {riskSummaryLoading || !riskSummary
                  ? '…'
                  : riskSummary.bySeverity.HIGH + riskSummary.bySeverity.CRITICAL}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Branches Impacted</div>
              <div className="text-2xl font-bold mt-2">
                {riskSummaryLoading || !riskSummary ? '…' : riskSummary.byBranch.length}
              </div>
            </Card>
          </div>

          {/* By Branch & By Staff Tables */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* By Branch Table */}
            <Card>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Risk Events by Branch</h2>
                <p className="text-sm text-muted-foreground">
                  Branches sorted by critical events
                </p>
              </div>
              <div className="overflow-x-auto">
                {riskSummaryLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading branch data…
                  </div>
                ) : !riskSummary || riskSummary.byBranch.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No risk events by branch
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium">Branch</th>
                        <th className="p-3 text-right text-sm font-medium">Total</th>
                        <th className="p-3 text-right text-sm font-medium">Critical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...riskSummary.byBranch]
                        .sort((a, b) => {
                          if (b.criticalCount !== a.criticalCount) {
                            return b.criticalCount - a.criticalCount;
                          }
                          return b.count - a.count;
                        })
                        .map((branch) => (
                          <tr key={branch.branchId} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium">{branch.branchName}</td>
                            <td className="p-3 text-sm text-right">{branch.count}</td>
                            <td className="p-3 text-sm text-right text-red-600 font-semibold">
                              {branch.criticalCount}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* Top Staff Table */}
            <Card>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Top Staff by Risk Events</h2>
                <p className="text-sm text-muted-foreground">
                  Staff sorted by critical events
                </p>
              </div>
              <div className="overflow-x-auto">
                {riskSummaryLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading staff data…
                  </div>
                ) : !riskSummary || riskSummary.topStaff.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No staff-related risk events
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-3 text-left text-sm font-medium">Staff</th>
                        <th className="p-3 text-left text-sm font-medium">Branch</th>
                        <th className="p-3 text-right text-sm font-medium">Total</th>
                        <th className="p-3 text-right text-sm font-medium">Critical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...riskSummary.topStaff]
                        .sort((a, b) => {
                          if (b.criticalCount !== a.criticalCount) {
                            return b.criticalCount - a.criticalCount;
                          }
                          return b.count - a.count;
                        })
                        .map((staff) => (
                          <tr key={staff.employeeId} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium">{staff.name}</td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {staff.branchName}
                            </td>
                            <td className="p-3 text-sm text-right">{staff.count}</td>
                            <td className="p-3 text-sm text-right text-red-600 font-semibold">
                              {staff.criticalCount}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          {/* Risk Events Table */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Risk Events Detail</h2>
              <p className="text-sm text-muted-foreground">
                Individual anomaly and anti-theft events for the selected period
              </p>
            </div>
            <div className="overflow-x-auto">
              {riskEventsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading risk events…
                </div>
              ) : riskEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No risk events for this period
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Date/Time</th>
                      <th className="p-3 text-left text-sm font-medium">Branch</th>
                      <th className="p-3 text-left text-sm font-medium">Staff</th>
                      <th className="p-3 text-left text-sm font-medium">Type</th>
                      <th className="p-3 text-left text-sm font-medium">Severity</th>
                      <th className="p-3 text-left text-sm font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskEvents.map((event) => {
                      const date = new Date(event.occurredAt);
                      const severityColor =
                        event.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : event.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800 border-orange-200'
                          : event.severity === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200';

                      return (
                        <tr key={event.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 text-sm">
                            {date.toLocaleDateString()} {date.toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-sm">{event.branchName}</td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {event.employeeName || '—'}
                          </td>
                          <td className="p-3 text-sm">{event.type}</td>
                          <td className="p-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold border ${severityColor}`}
                            >
                              {event.severity}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {event.description || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Franchise Analytics View (E22-FRANCHISE-FE-S1) */}
      {view === 'franchise' && (
        <div
          role="tabpanel"
          id="analytics-tabpanel-franchise"
          aria-labelledby="analytics-tab-franchise"
        >
          {/* E24-BILLING-FE-S3: Plan gating for franchise analytics */}
          {isLoadingPlan ? (
            <Card className="p-6">
              <p className="text-slate-400">Checking your plan permissions…</p>
            </Card>
          ) : !capabilities.canUseFranchiseAnalytics ? (
            <BillingUpsellGate
              featureLabel="Franchise analytics"
              requiredPlanHint="Franchise Core or higher"
            />
          ) : (
            <>
              {/* E24-BILLING-FE-S5: Billing risk warning for franchise analytics */}
              <BillingInlineRiskBanner
                subscription={subscription}
                contextLabel="Franchise analytics"
              />

              {/* Month/Year Selector */}
              <Card className="p-4 mb-6">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Year</label>
                  <Input
                    type="number"
                    min="2020"
                    max="2099"
                    value={franchiseYear}
                    onChange={(e) => setFranchiseYear(parseInt(e.target.value) || franchiseYear)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Month</label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={franchiseMonth}
                    onChange={(e) => setFranchiseMonth(parseInt(e.target.value) || franchiseMonth)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const now = new Date();
                      setFranchiseYear(now.getFullYear());
                      setFranchiseMonth(now.getMonth() + 1);
                    }}
                  >
                    Current Month
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Franchise Analytics Cards */}
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">
                  Franchise budgets, variance & forecast
                </h2>
                <p className="text-sm text-slate-400">
                  Compare performance by branch and track trends over time
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-700 p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 transition-colors ${
                    franchiseViewMode === 'current'
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                  onClick={() => setFranchiseViewMode('current')}
                >
                  Current month
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 transition-colors ${
                    franchiseViewMode === 'multi'
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                  onClick={() => setFranchiseViewMode('multi')}
                >
                  Last 6 months
                </button>
              </div>
            </header>

            {franchiseViewMode === 'current' ? (
              <>
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Budget vs Actual Table (2 columns) */}
                  <div className="lg:col-span-2">
                    {isFranchiseVarianceLoading || !franchiseVariance ? (
                      <Card className="p-8">
                        <div className="text-center text-slate-400">
                          Loading budget variance…
                        </div>
                      </Card>
                    ) : (
                      <FranchiseBudgetTable variance={franchiseVariance} currency="UGX" />
                    )}
                  </div>

                  {/* Variance & Forecast Cards (1 column) */}
                  <div className="space-y-4">
                    {isFranchiseVarianceLoading || !franchiseVariance ? (
                      <Card className="p-8">
                        <div className="text-center text-slate-400 text-sm">
                          Loading variance rankings…
                        </div>
                      </Card>
                    ) : (
                      <FranchiseVarianceCard variance={franchiseVariance} currency="UGX" />
                    )}

                    {isFranchiseForecastLoading || !franchiseForecast ? (
                      <Card className="p-8">
                        <div className="text-center text-slate-400 text-sm">
                          Loading forecast…
                        </div>
                      </Card>
                    ) : (
                      <FranchiseForecastCard forecast={franchiseForecast} currency="UGX" />
                    )}
                  </div>
                </div>

                {/* CSV Export Links */}
                <Card className="p-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a
                      href={`${API_URL}/franchise/export/budgets-variance.csv?year=${franchiseYear}&month=${franchiseMonth}`}
                      className="rounded border border-slate-700 px-3 py-2 hover:bg-slate-800 transition-colors"
                      download
                    >
                      📥 Download Budget Variance CSV
                    </a>
                    <a
                      href={`${API_URL}/franchise/export/forecast.csv?year=${franchiseYear}&month=${franchiseMonth}`}
                      className="rounded border border-slate-700 px-3 py-2 hover:bg-slate-800 transition-colors"
                      download
                    >
                      📥 Download Forecast CSV
                    </a>
                    <a
                      href={`${API_URL}/franchise/export/budgets.csv?year=${franchiseYear}&month=${franchiseMonth}`}
                      className="rounded border border-slate-700 px-3 py-2 hover:bg-slate-800 transition-colors"
                      download
                    >
                      📥 Download Budgets CSV
                    </a>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Exports are for current month only
                  </p>
                </Card>
              </>
            ) : (
              <div className="space-y-3">
                {isFranchiseMultiLoading ? (
                  <Card className="p-8">
                    <div className="text-center text-slate-400">
                      Loading multi-month series…
                    </div>
                  </Card>
                ) : (
                  <FranchiseMultiMonthChart data={franchiseMultiSeries} currency="UGX" />
                )}
                <p className="text-xs text-slate-500">
                  Last {multiMonths} months. Forecast uses a 3-month lookback per month.
                </p>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
