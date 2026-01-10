/**
 * M8.2: Balance Sheet Page
 * 
 * Displays assets, liabilities, and equity.
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
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I3: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/finance/balance-sheet',
  title: 'Balance Sheet',
  primaryActions: [
    { label: 'Generate Report', testId: 'bs-generate', intent: 'view' },
    { label: 'Export CSV', testId: 'bs-export', intent: 'view' },
  ],
  apiCalls: [
    { method: 'GET', path: '/accounting/balance-sheet', trigger: 'onMount', notes: 'Load balance sheet' },
  ],
  risk: 'LOW',
  allowedRoles: ['OWNER', 'ACCOUNTANT'],
});

interface BalanceSheetData {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  assetAccounts?: Array<{ code: string; name: string; balance: number }>;
  liabilityAccounts?: Array<{ code: string; name: string; balance: number }>;
  equityAccounts?: Array<{ code: string; name: string; balance: number }>;
}

export default function BalanceSheetPage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const branchId = activeBranchId || user?.branch?.id;

  // Date state (as of date)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['balance-sheet', branchId, asOfDate],
    queryFn: async () => {
      const response = await apiClient.get<BalanceSheetData>('/accounting/balance-sheet', {
        params: { branchId, asOfDate },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Accounting equation: Assets = Liabilities + Equity
  const totalAssets = data?.totalAssets || 0;
  const totalLiabilities = data?.totalLiabilities || 0;
  const totalEquity = data?.totalEquity || 0;
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const handleExport = () => {
    if (!data) return;
    
    const lines = [
      'BALANCE SHEET',
      `As of: ${asOfDate}`,
      '',
      'ASSETS',
      `  Total Assets,${data.totalAssets}`,
      '',
      'LIABILITIES',
      `  Total Liabilities,${data.totalLiabilities}`,
      '',
      'EQUITY',
      `  Total Equity,${data.totalEquity}`,
      '',
      'LIABILITIES + EQUITY,' + (totalLiabilities + totalEquity),
    ];

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Balance Sheet" 
          subtitle="Statement of financial position"
        />

        {/* Date Filter */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div>
                <Label htmlFor="asOfDate">As of Date</Label>
                <Input
                  id="asOfDate"
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>
              <Button data-testid="bs-generate" onClick={() => refetch()}>
                Generate Report
              </Button>
              <Button data-testid="bs-export" variant="outline" onClick={handleExport} disabled={!data}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Balance Status */}
        <Card className={`mb-6 border-2 ${isBalanced ? 'border-green-500' : 'border-red-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
                <div>
                  <p className="font-semibold">
                    {isBalanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is Out of Balance'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Assets: {formatCurrency(totalAssets)} = Liabilities + Equity: {formatCurrency(totalLiabilities + totalEquity)}
                  </p>
                </div>
              </div>
              <Badge variant={isBalanced ? 'default' : 'destructive'} className="text-lg px-4 py-2">
                {isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Assets */}
          <Card>
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-800">Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading && <p className="text-muted-foreground">Loading...</p>}
              {error && <p className="text-red-500">Failed to load data</p>}
              {!isLoading && !error && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Current Assets</h4>
                    <div className="pl-4 space-y-1">
                      {data?.assetAccounts?.map((account) => (
                        <div key={account.code} className="flex justify-between text-sm">
                          <span>{account.code} - {account.name}</span>
                          <span className="font-mono">{formatCurrency(account.balance)}</span>
                        </div>
                      )) || (
                        <div className="flex justify-between text-sm">
                          <span>Total Assets</span>
                          <span className="font-mono">{formatCurrency(totalAssets)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total Assets</span>
                      <span className="font-mono text-blue-600">{formatCurrency(totalAssets)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liabilities & Equity */}
          <div className="space-y-6">
            {/* Liabilities */}
            <Card>
              <CardHeader className="bg-red-50">
                <CardTitle className="text-red-800">Liabilities</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading && <p className="text-muted-foreground">Loading...</p>}
                {!isLoading && !error && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Current Liabilities</h4>
                      <div className="pl-4 space-y-1">
                        {data?.liabilityAccounts?.map((account) => (
                          <div key={account.code} className="flex justify-between text-sm">
                            <span>{account.code} - {account.name}</span>
                            <span className="font-mono">{formatCurrency(account.balance)}</span>
                          </div>
                        )) || (
                          <div className="flex justify-between text-sm">
                            <span>Total Liabilities</span>
                            <span className="font-mono">{formatCurrency(totalLiabilities)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between font-bold">
                        <span>Total Liabilities</span>
                        <span className="font-mono text-red-600">{formatCurrency(totalLiabilities)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Equity */}
            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="text-purple-800">Equity</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading && <p className="text-muted-foreground">Loading...</p>}
                {!isLoading && !error && (
                  <div className="space-y-4">
                    <div className="pl-4 space-y-1">
                      {data?.equityAccounts?.map((account) => (
                        <div key={account.code} className="flex justify-between text-sm">
                          <span>{account.code} - {account.name}</span>
                          <span className="font-mono">{formatCurrency(account.balance)}</span>
                        </div>
                      )) || (
                        <div className="flex justify-between text-sm">
                          <span>Total Equity</span>
                          <span className="font-mono">{formatCurrency(totalEquity)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between font-bold">
                        <span>Total Equity</span>
                        <span className="font-mono text-purple-600">{formatCurrency(totalEquity)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* L+E Total */}
            <Card className="bg-muted">
              <CardContent className="p-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Liabilities + Equity</span>
                  <span className="font-mono">{formatCurrency(totalLiabilities + totalEquity)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/balance-sheet
          {branchId && ` • Branch filter: ${branchId}`}
        </div>
      </AppShell>
    </RequireRole>
  );
}
