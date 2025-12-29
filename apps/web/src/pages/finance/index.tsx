import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';

interface BudgetSummary {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
}

export default function FinancePage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  
  // Use activeBranchId if set, otherwise fall back to user's branch
  const branchId = activeBranchId || user?.branch?.id;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-summary', branchId, year, month],
    queryFn: async () => {
      const response = await apiClient.get<BudgetSummary>('/finance/budgets/summary', {
        params: { branchId, year, month },
      });
      return response.data;
    },
    enabled: !!branchId && !!user,
  });

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader title="Finance" subtitle="Budget tracking and financial overview" />
      
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard
          label="Total Budget"
          value={data ? formatCurrency(data.totalBudget) : '—'}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Actual Spending"
          value={data ? formatCurrency(data.totalActual) : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Variance"
          value={data ? formatCurrency(Math.abs(data.totalVariance)) : '—'}
          delta={data?.totalVariancePercent}
          trend={data && data.totalVariance < 0 ? 'down' : 'up'}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading budget data...</p>}
          {!isLoading && error && (
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">No budget data available for this period.</p>
              <p className="text-xs">
                To see budget data, ensure budgets are configured for {branchId ? 'this branch' : 'your organization'} 
                for {month}/{year}.
              </p>
            </div>
          )}
          {!isLoading && !error && data && (
            <div className="space-y-2">
              <p className="text-sm">
                Total budget allocated: <strong>{formatCurrency(data.totalBudget)}</strong>
              </p>
              <p className="text-sm">
                Actual spending: <strong>{formatCurrency(data.totalActual)}</strong>
              </p>
              <p className="text-sm">
                Budget {data.totalVariance < 0 ? 'underutilized' : 'exceeded'} by{' '}
                <strong>{formatCurrency(Math.abs(data.totalVariance))}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-muted-foreground">
        ✓ Connected to backend: GET /finance/budgets/summary (branchId={branchId}, year={year}, month={month})
      </div>
      </AppShell>
    </RequireRole>
  );
}
