/**
 * M8.2: Trial Balance Page
 * 
 * Displays the trial balance report with all account balances.
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface TrialBalanceAccount {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  accounts: TrialBalanceAccount[];
  totals: {
    totalDebit: number;
    totalCredit: number;
  };
}

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'];

export default function TrialBalancePage() {
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
    queryKey: ['trial-balance', branchId, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<TrialBalanceData>('/accounting/trial-balance', {
        params: { branchId, startDate, endDate },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Group accounts by type
  const accountsByType = data?.accounts?.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, TrialBalanceAccount[]>) || {};

  const totalDebit = data?.totals?.totalDebit || 0;
  const totalCredit = data?.totals?.totalCredit || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleExport = () => {
    // Simple CSV export
    if (!data?.accounts) return;
    
    const csv = [
      ['Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance'].join(','),
      ...data.accounts.map(a => 
        [a.code, `"${a.name}"`, a.type, a.debit, a.credit, a.balance].join(',')
      ),
      ['', '', 'TOTALS', totalDebit, totalCredit, ''].join(','),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Trial Balance" 
          subtitle="Account balances report"
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
              <Button variant="outline" onClick={handleExport} disabled={!data?.accounts?.length}>
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
                    {isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Out of Balance'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Debits: {formatCurrency(totalDebit)} | Credits: {formatCurrency(totalCredit)}
                    {!isBalanced && ` | Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                  </p>
                </div>
              </div>
              <Badge variant={isBalanced ? 'default' : 'destructive'} className="text-lg px-4 py-2">
                {isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Trial Balance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Trial Balance
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {startDate} to {endDate}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading trial balance...</p>}
            {error && <p className="text-red-500">Failed to load trial balance</p>}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-[150px]">Debit</TableHead>
                    <TableHead className="text-right w-[150px]">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACCOUNT_TYPE_ORDER.map((type) => {
                    const typeAccounts = accountsByType[type];
                    if (!typeAccounts?.length) return null;
                    
                    const typeDebit = typeAccounts.reduce((sum, a) => sum + Number(a.debit), 0);
                    const typeCredit = typeAccounts.reduce((sum, a) => sum + Number(a.credit), 0);

                    return (
                      <React.Fragment key={type}>
                        {/* Type Header */}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={4} className="font-semibold text-sm">
                            {type}
                          </TableCell>
                        </TableRow>
                        {/* Accounts */}
                        {typeAccounts.map((account) => (
                          <TableRow key={account.code}>
                            <TableCell className="font-mono">{account.code}</TableCell>
                            <TableCell className="pl-8">{account.name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(account.debit) > 0 ? formatCurrency(account.debit) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(account.credit) > 0 ? formatCurrency(account.credit) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Type Subtotal */}
                        <TableRow className="border-t-2">
                          <TableCell></TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {type} Total
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(typeDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(typeCredit)}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Grand Total */}
                  <TableRow className="bg-muted font-bold text-lg">
                    <TableCell></TableCell>
                    <TableCell className="text-right">TOTAL</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/trial-balance
          {branchId && ` • Branch filter: ${branchId}`}
        </div>
      </AppShell>
    </RequireRole>
  );
}
