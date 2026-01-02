/**
 * M8.2: Accountant Workspace
 * 
 * Main workspace landing page for accountants with:
 * - KPIs (total revenue, expenses, AP/AR aging)
 * - Quick links to accounting functions
 * - Recent journal entries
 * - Period status
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  PlusCircle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface TrialBalanceData {
  accounts: Array<{
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: { totalDebit: number; totalCredit: number };
}

interface PnLData {
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netIncome: number;
}

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
}

interface JournalEntry {
  id: string;
  date: string;
  memo: string | null;
  source: string | null;
  lines: Array<{
    account: { code: string; name: string };
    debit: number;
    credit: number;
  }>;
}

export default function AccountantWorkspace() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const branchId = activeBranchId || user?.branch?.id;

  // Current date range (current month)
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  // Fetch Trial Balance
  const { data: trialBalance, isLoading: loadingTB } = useQuery({
    queryKey: ['trial-balance', branchId, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<TrialBalanceData>('/accounting/trial-balance', {
        params: { branchId, startDate, endDate },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch P&L
  const { data: pnl } = useQuery({
    queryKey: ['pnl', branchId, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<PnLData>('/accounting/pnl', {
        params: { branchId, startDate, endDate },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch Fiscal Periods
  const { data: periods } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: async () => {
      const response = await apiClient.get<FiscalPeriod[]>('/accounting/periods');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch Recent Journal Entries
  const { data: recentEntries } = useQuery({
    queryKey: ['recent-journal-entries', branchId],
    queryFn: async () => {
      const response = await apiClient.get<JournalEntry[]>('/accounting/journal', {
        params: { branchId, limit: 5 },
      });
      return response.data;
    },
    enabled: !!user,
  });

  // Calculate KPIs
  const totalDebit = trialBalance?.totals?.totalDebit || 0;
  const totalCredit = trialBalance?.totals?.totalCredit || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  
  const revenue = pnl?.totalRevenue || 0;
  const expenses = (pnl?.totalCogs || 0) + (pnl?.totalExpenses || 0);
  const netIncome = pnl?.netIncome || 0;

  // Find current open period
  const currentPeriod = periods?.find(p => p.status === 'OPEN');

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Accountant Workspace" 
          subtitle="General ledger, financial statements, and expense tracking"
        />

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <StatCard
            label="Total Revenue (MTD)"
            value={formatCurrency(revenue)}
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          />
          <StatCard
            label="Total Expenses (MTD)"
            value={formatCurrency(expenses)}
            icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          />
          <StatCard
            label="Net Income (MTD)"
            value={formatCurrency(netIncome)}
            delta={revenue > 0 ? (netIncome / revenue) * 100 : 0}
            trend={netIncome >= 0 ? 'up' : 'down'}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Trial Balance</p>
                <p className="text-lg font-semibold">
                  {loadingTB ? '...' : isBalanced ? 'Balanced' : 'Out of Balance'}
                </p>
              </div>
              {isBalanced ? (
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions + Period Status */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/finance/journal?new=true">
                <Button variant="outline" className="w-full justify-start">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Journal Entry
                </Button>
              </Link>
              <Link href="/finance/trial-balance">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View Trial Balance
                </Button>
              </Link>
              <Link href="/finance/pnl">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View P&L Statement
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Current Period */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Period</CardTitle>
            </CardHeader>
            <CardContent>
              {currentPeriod ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{currentPeriod.name}</span>
                    <Badge variant={currentPeriod.status === 'OPEN' ? 'default' : 'secondary'}>
                      {currentPeriod.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(currentPeriod.startDate).toLocaleDateString()} - {new Date(currentPeriod.endDate).toLocaleDateString()}
                  </p>
                  <Link href="/finance/periods">
                    <Button variant="link" className="p-0 h-auto">
                      Manage Periods <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No open period found</p>
              )}
            </CardContent>
          </Card>

          {/* Navigation Cards */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Reports</CardTitle>
              <CardDescription>Financial statements and analytics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/finance/accounts">
                <Button variant="ghost" className="w-full justify-between">
                  Chart of Accounts <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/finance/balance-sheet">
                <Button variant="ghost" className="w-full justify-between">
                  Balance Sheet <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="ghost" className="w-full justify-between">
                  All Reports <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Journal Entries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-lg">Recent Journal Entries</CardTitle>
              <CardDescription>Latest accounting transactions</CardDescription>
            </div>
            <Link href="/finance/journal">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentEntries && recentEntries.length > 0 ? (
              <div className="space-y-3">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-sm">
                        {entry.memo || entry.source || 'Manual Entry'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString()} • {entry.lines?.length || 0} lines
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(entry.lines?.reduce((sum, l) => sum + Number(l.debit), 0) || 0)}
                      </p>
                      <Link href={`/finance/journal/${entry.id}`}>
                        <Button variant="link" size="sm" className="p-0 h-auto">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No journal entries found. Create your first entry to get started.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: /accounting/trial-balance, /accounting/pnl, /accounting/periods, /accounting/journal
          {branchId && ` • Branch filter: ${branchId}`}
        </div>
      </AppShell>
    </RequireRole>
  );
}
