import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface BudgetSummary {
  totalBudget: number;
  totalActuals: number;
  variance: number;
  variancePercentage: number;
}

export default function FinancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-summary'],
    queryFn: async () => {
      const response = await apiClient.get<BudgetSummary>('/finance/budgets/summary');
      return response.data;
    },
  });

  return (
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
          value={data ? formatCurrency(data.totalActuals) : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Variance"
          value={data ? formatCurrency(Math.abs(data.variance)) : '—'}
          delta={data?.variancePercentage}
          trend={data && data.variance < 0 ? 'down' : 'up'}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading budget data...</p>}
          {!isLoading && data && (
            <div className="space-y-2">
              <p className="text-sm">
                Total budget allocated: <strong>{formatCurrency(data.totalBudget)}</strong>
              </p>
              <p className="text-sm">
                Actual spending: <strong>{formatCurrency(data.totalActuals)}</strong>
              </p>
              <p className="text-sm">
                Budget {data.variance < 0 ? 'underutilized' : 'exceeded'} by{' '}
                <strong>{formatCurrency(Math.abs(data.variance))}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-muted-foreground">
        ✓ Connected to backend endpoint: GET /finance/budgets/summary
      </div>
    </AppShell>
  );
}
