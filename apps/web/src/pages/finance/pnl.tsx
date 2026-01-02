/**
 * M8.2: Profit & Loss Statement Page
 * 
 * Displays the income statement with revenue, COGS, and expenses.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import { TrendingUp, TrendingDown, Download, DollarSign } from 'lucide-react';

interface PnLData {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netIncome: number;
  revenueAccounts?: Array<{ code: string; name: string; amount: number }>;
  cogsAccounts?: Array<{ code: string; name: string; amount: number }>;
  expenseAccounts?: Array<{ code: string; name: string; amount: number }>;
}

export default function ProfitLossPage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const branchId = activeBranchId || user?.branch?.id;

  // Date range state
  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pnl', branchId, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<PnLData>('/accounting/pnl', {
        params: { branchId, startDate, endDate },
      });
      return response.data;
    },
    enabled: !!user,
  });

  const grossMargin = data?.totalRevenue 
    ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) 
    : '0';
  const netMargin = data?.totalRevenue 
    ? ((data.netIncome / data.totalRevenue) * 100).toFixed(1) 
    : '0';

  const handleExport = () => {
    if (!data) return;
    
    const lines = [
      'PROFIT & LOSS STATEMENT',
      `Period: ${startDate} to ${endDate}`,
      '',
      'REVENUE',
      `  Total Revenue,${data.totalRevenue}`,
      '',
      'COST OF GOODS SOLD',
      `  Total COGS,${data.totalCogs}`,
      '',
      `GROSS PROFIT,${data.grossProfit}`,
      `Gross Margin,${grossMargin}%`,
      '',
      'OPERATING EXPENSES',
      `  Total Expenses,${data.totalExpenses}`,
      '',
      `NET INCOME,${data.netIncome}`,
      `Net Margin,${netMargin}%`,
    ];

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Profit & Loss Statement" 
          subtitle="Income statement for the selected period"
        />

        {/* Date Range Filter */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button onClick={() => refetch()}>
                Generate Report
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={!data}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-900">
                    {isLoading ? '...' : formatCurrency(data?.totalRevenue || 0)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Cost of Goods</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {isLoading ? '...' : formatCurrency(data?.totalCogs || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Gross Profit</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {isLoading ? '...' : formatCurrency(data?.grossProfit || 0)}
                  </p>
                  <p className="text-xs text-blue-600">{grossMargin}% margin</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className={data?.netIncome && data.netIncome >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${data?.netIncome && data.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Net Income
                  </p>
                  <p className={`text-2xl font-bold ${data?.netIncome && data.netIncome >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    {isLoading ? '...' : formatCurrency(data?.netIncome || 0)}
                  </p>
                  <p className={`text-xs ${data?.netIncome && data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {netMargin}% margin
                  </p>
                </div>
                {data?.netIncome && data.netIncome >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-500" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* P&L Statement */}
        <Card>
          <CardHeader>
            <CardTitle>Income Statement</CardTitle>
            <p className="text-sm text-muted-foreground">
              Period: {startDate} to {endDate}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading...</p>}
            {error && <p className="text-red-500">Failed to load P&L data</p>}
            {!isLoading && !error && data && (
              <div className="space-y-6">
                {/* Revenue Section */}
                <div>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">Revenue</h3>
                  <div className="pl-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Sales Revenue</span>
                      <span className="font-mono">{formatCurrency(data.totalRevenue)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                    <span>Total Revenue</span>
                    <span className="font-mono text-green-600">{formatCurrency(data.totalRevenue)}</span>
                  </div>
                </div>

                {/* COGS Section */}
                <div>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">Cost of Goods Sold</h3>
                  <div className="pl-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Cost of Goods Sold</span>
                      <span className="font-mono">{formatCurrency(data.totalCogs)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                    <span>Total COGS</span>
                    <span className="font-mono text-orange-600">{formatCurrency(data.totalCogs)}</span>
                  </div>
                </div>

                {/* Gross Profit */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Gross Profit</span>
                    <span className="font-mono text-blue-600">{formatCurrency(data.grossProfit)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Gross Margin: {grossMargin}%
                  </div>
                </div>

                {/* Operating Expenses */}
                <div>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">Operating Expenses</h3>
                  <div className="pl-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Operating Expenses</span>
                      <span className="font-mono">{formatCurrency(data.totalExpenses)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                    <span>Total Expenses</span>
                    <span className="font-mono text-red-600">{formatCurrency(data.totalExpenses)}</span>
                  </div>
                </div>

                {/* Net Income */}
                <div className={`p-4 rounded-lg ${data.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <div className="flex justify-between font-bold text-xl">
                    <span>Net Income</span>
                    <span className={`font-mono ${data.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(data.netIncome)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      Net Margin: {netMargin}%
                    </span>
                    <Badge variant={data.netIncome >= 0 ? 'default' : 'destructive'}>
                      {data.netIncome >= 0 ? 'Profit' : 'Loss'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/pnl
          {branchId && ` • Branch filter: ${branchId}`}
        </div>
      </AppShell>
    </RequireRole>
  );
}
