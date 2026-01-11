/**
 * Enhanced Dashboard Page - Milestone 6: ChefCloud V2 UX Upgrade
 * 
 * Enterprise-grade dashboard with:
 * - KPI cards with period comparisons
 * - Revenue timeseries chart
 * - Top items, category mix, payment methods
 * - Peak hours analysis
 * - Alerts panel
 * - Multi-branch support (Cafesserie)
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatCurrencyCompact, calculatePercentageChange } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Package, 
  Percent,
  AlertTriangle,
  CreditCard,
  Star,
  Clock,
  Building2,
  RefreshCw
} from 'lucide-react';

// Dashboard Components
import { KPICard } from '@/components/dashboard/KPICard';
import { DateRangeSelector, DateRangePreset } from '@/components/dashboard/DateRangeSelector';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { AlertsPanel, Alert } from '@/components/dashboard/AlertsPanel';
import { InsightCallout } from '@/components/dashboard/InsightCallout';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopItemsChart } from '@/components/dashboard/TopItemsChart';
import { CategoryMixChart } from '@/components/dashboard/CategoryMixChart';
import { PaymentMethodChart } from '@/components/dashboard/PaymentMethodChart';
import { PeakHoursChart } from '@/components/dashboard/PeakHoursChart';
import { BranchLeaderboard } from '@/components/dashboard/BranchLeaderboard';
import { BranchCompareChart } from '@/components/dashboard/BranchCompareChart';

// Hooks
import {
  useDashboardKPIs,
  useRevenueTimeseries,
  useTopItems,
  useCategoryMix,
  usePaymentMix,
  usePeakHours,
  useBranchRankings,
  useDashboardAlerts,
  useBranchTimeseries,
} from '@/hooks/useDashboardData';

// Helper functions
const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0];
const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Demo org detection
const CAFESSERIE_ORG_ID = '00000000-0000-4000-8000-000000000002';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeBranchId, branches, isMultiBranch, setActiveBranchId } = useActiveBranch();
  
  // Date range state
  const [datePreset, setDatePreset] = useState<DateRangePreset>(isMultiBranch ? '30d' : '7d');
  const [from, setFrom] = useState<string>(formatDateForInput(getDaysAgo(isMultiBranch ? 30 : 7)));
  const [to, setTo] = useState<string>(formatDateForInput(new Date()));

  // Compare branches for multi-branch view
  const [compareBranchIds, setCompareBranchIds] = useState<string[]>([]);

  // Get available presets based on org type
  const datePresets: DateRangePreset[] = isMultiBranch 
    ? ['7d', '30d', '90d', '180d'] 
    : ['7d', '30d', '90d'];

  // Fetch data using hooks - V2.1.1: Use activeBranchId from context
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useDashboardKPIs({ 
    from, to, branchId: activeBranchId 
  });
  
  const { data: revenueData, isLoading: revenueLoading } = useRevenueTimeseries({ 
    from, to, branchId: activeBranchId 
  });
  
  const { data: topItems, isLoading: topItemsLoading } = useTopItems({ 
    from, to, branchId: activeBranchId, limit: 10 
  });
  
  const { data: categoryMix, isLoading: categoryLoading } = useCategoryMix({ 
    from, to, branchId: activeBranchId 
  });
  
  const { data: paymentMix, isLoading: paymentLoading } = usePaymentMix({ 
    from, to, branchId: activeBranchId 
  });
  
  const { data: peakHours, isLoading: peakHoursLoading } = usePeakHours({ 
    from, to, branchId: activeBranchId 
  });
  
  const { data: alerts, isLoading: alertsLoading } = useDashboardAlerts(activeBranchId);
  
  // Multi-branch specific data
  const { data: branchRankings, isLoading: branchRankingsLoading } = useBranchRankings({ 
    from, to 
  });
  
  const { data: branchTimeseries } = useBranchTimeseries({
    from, to, branchIds: compareBranchIds,
  });

  // Compute insights
  const insights = useMemo(() => {
    const results: Array<{ type: 'positive' | 'negative' | 'neutral' | 'info'; message: string }> = [];
    
    if (kpis?.previousPeriod) {
      const revenueChange = calculatePercentageChange(kpis.revenue.week, kpis.previousPeriod.revenue);
      if (revenueChange > 5) {
        results.push({ type: 'positive', message: `Revenue up ${revenueChange.toFixed(1)}% vs last period` });
      } else if (revenueChange < -5) {
        results.push({ type: 'negative', message: `Revenue down ${Math.abs(revenueChange).toFixed(1)}% vs last period` });
      }
    }
    
    if (kpis?.lowStockCount && kpis.lowStockCount > 0) {
      results.push({ type: 'info', message: `${kpis.lowStockCount} items need restocking` });
    }
    
    return results;
  }, [kpis]);

  // V2.1.1: branches now come from ActiveBranchContext

  // Initialize compare branches when branches load
  React.useEffect(() => {
    if (branches.length >= 2 && compareBranchIds.length === 0) {
      setCompareBranchIds(branches.slice(0, 2).map(b => b.id));
    }
  }, [branches, compareBranchIds.length]);

  // Calculate delta for KPIs
  const revenueDelta = kpis?.previousPeriod 
    ? calculatePercentageChange(kpis.revenue.week, kpis.previousPeriod.revenue) 
    : undefined;
  const ordersDelta = kpis?.previousPeriod
    ? calculatePercentageChange(kpis.orders.week, kpis.previousPeriod.orders)
    : undefined;

  // Handle refresh
  const handleRefresh = () => {
    refetchKpis();
  };

  // Last updated timestamp
  const lastUpdated = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <AppShell>
      {/* Header with controls */}
      <div className="flex flex-col gap-4 mb-6" data-testid="dashboard-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title={isMultiBranch ? 'Franchise Dashboard' : 'Dashboard'}
            subtitle={`${user?.org?.name || 'ChefCloud'} — Overview`}
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="dashboard-timestamp">
            <Clock className="h-4 w-4" />
            Updated {lastUpdated}
            <button 
              onClick={handleRefresh}
              className="ml-2 p-1 hover:bg-muted rounded-md transition-colors"
              title="Refresh data"
              data-testid="dashboard-refresh-btn"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          <DateRangeSelector
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            onPresetChange={setDatePreset}
            presets={datePresets}
            activePreset={datePreset}
          />
          
          {/* V2.1.1: Use ActiveBranchContext for branch selection */}
          {isMultiBranch && branches.length > 0 && (
            <BranchSelector
              branches={branches}
              selectedBranchId={activeBranchId}
              onBranchChange={setActiveBranchId}
              allowAll={true}
              allLabel="All Branches"
            />
          )}
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {insights.map((insight, idx) => (
              <InsightCallout key={idx} type={insight.type} message={insight.message} />
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards Row - M7.2B: Responsive auto-fit grid prevents clipping on all screen sizes */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <KPICard
          label="Revenue"
          value={kpis ? formatCurrencyCompact(kpis.revenue.week) : '—'}
          fullValue={kpis ? formatCurrency(kpis.revenue.week) : undefined}
          sublabel={datePreset === '7d' ? 'Last 7 days' : datePreset === '30d' ? 'Last 30 days' : 'Period total'}
          delta={revenueDelta}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          iconBgColor="bg-green-100"
          loading={kpisLoading}
          onClick={() => router.push('/analytics')}
        />
        <KPICard
          label="Orders"
          value={kpis?.orders.week.toLocaleString() || '—'}
          delta={ordersDelta}
          icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
          iconBgColor="bg-blue-100"
          loading={kpisLoading}
        />
        <KPICard
          label="AOV"
          value={kpis ? formatCurrencyCompact(kpis.aov.week) : '—'}
          fullValue={kpis ? formatCurrency(kpis.aov.week) : undefined}
          sublabel="Avg order value"
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          iconBgColor="bg-purple-100"
          loading={kpisLoading}
        />
        <KPICard
          label="Gross Margin"
          value={kpis ? `${kpis.grossMarginPct.week.toFixed(1)}%` : '—'}
          icon={<Percent className="h-4 w-4 text-emerald-600" />}
          iconBgColor="bg-emerald-100"
          loading={kpisLoading}
          onClick={() => router.push('/analytics?view=financial')}
        />
        <KPICard
          label="COGS"
          value={kpis ? formatCurrencyCompact(kpis.cogs.week) : '—'}
          fullValue={kpis ? formatCurrency(kpis.cogs.week) : undefined}
          trendIsGood={false}
          icon={<DollarSign className="h-4 w-4 text-orange-600" />}
          iconBgColor="bg-orange-100"
          loading={kpisLoading}
        />
        <KPICard
          label="Low Stock"
          value={kpis?.lowStockCount ?? '—'}
          alert={kpis?.lowStockCount ? kpis.lowStockCount > 0 : false}
          alertMessage={kpis?.lowStockCount ? `${kpis.lowStockCount} items` : undefined}
          icon={<Package className="h-4 w-4 text-amber-600" />}
          iconBgColor="bg-amber-100"
          loading={kpisLoading}
          onClick={() => router.push('/inventory?filter=low-stock')}
        />
        <KPICard
          label="Payables Due"
          value={kpis ? formatCurrencyCompact(kpis.payablesDue.week) : '—'}
          fullValue={kpis ? formatCurrency(kpis.payablesDue.week) : undefined}
          sublabel="Next 7 days"
          icon={<CreditCard className="h-4 w-4 text-red-600" />}
          iconBgColor="bg-red-100"
          loading={kpisLoading}
          onClick={() => router.push('/finance/payables')}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <RevenueChart
          data={revenueData || []}
          loading={revenueLoading}
          title="Revenue Trend"
          height={280}
          showOrders={true}
          className="lg:col-span-2"
        />
        <AlertsPanel
          alerts={alerts || []}
          loading={alertsLoading}
          maxAlerts={4}
          onViewAll={() => router.push('/reports?view=alerts')}
        />
      </div>

      {/* Secondary Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <TopItemsChart
          items={topItems || []}
          loading={topItemsLoading}
          title="Top 10 Items"
          height={320}
          onItemClick={(item) => router.push(`/reports?view=item&id=${item.id}`)}
          className="lg:col-span-2"
        />
        <CategoryMixChart
          data={categoryMix || []}
          loading={categoryLoading}
          title="Sales by Category"
          height={280}
        />
        <PaymentMethodChart
          data={paymentMix || []}
          loading={paymentLoading}
          title="Payment Methods"
          height={280}
        />
      </div>

      {/* Peak Hours */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <PeakHoursChart
          data={peakHours || []}
          loading={peakHoursLoading}
          title="Orders by Hour"
          valueKey="orders"
          height={220}
        />
        <PeakHoursChart
          data={peakHours || []}
          loading={peakHoursLoading}
          title="Revenue by Hour"
          valueKey="revenue"
          height={220}
        />
      </div>

      {/* Multi-Branch Section (Cafesserie only) */}
      {isMultiBranch && (
        <>
          <div className="border-t pt-6 mt-2 mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-chefcloud-blue" />
              Branch Performance
            </h2>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <BranchLeaderboard
              branches={branchRankings || []}
              loading={branchRankingsLoading}
              title="Branch Rankings"
              onBranchClick={(branchId) => {
                setActiveBranchId(branchId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
            <BranchCompareChart
              branches={branchTimeseries || branches.map(b => ({ 
                id: b.id, 
                name: b.name, 
                data: [] 
              }))}
              selectedBranchIds={compareBranchIds}
              onSelectionChange={setCompareBranchIds}
              loading={false}
              title="Revenue Comparison"
              height={320}
            />
          </div>
        </>
      )}

      {/* Footer Status */}
      <div className="mt-8 rounded-lg bg-chefcloud-blue/10 border border-chefcloud-blue/20 p-4">
        <p className="text-sm text-chefcloud-blue">
          ✓ Dashboard data loaded • {isMultiBranch ? 'Multi-branch mode' : 'Single-branch mode'} • {datePreset} view
        </p>
      </div>
    </AppShell>
  );
}
