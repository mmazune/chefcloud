/**
 * M8.2: Chart of Accounts Page
 * 
 * Displays all accounts in the organization's chart of accounts
 * with ability to filter by type and view balances.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'EXPENSE';
  parentId: string | null;
  isActive: boolean;
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-green-100 text-green-800',
  COGS: 'bg-orange-100 text-orange-800',
  EXPENSE: 'bg-yellow-100 text-yellow-800',
};

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: accounts, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await apiClient.get<Account[]>('/accounting/accounts');
      return response.data;
    },
    enabled: !!user,
  });

  // Filter accounts
  const filteredAccounts = accounts?.filter(account => {
    const matchesSearch = 
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || account.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  // Group accounts by type for summary
  const accountsByType = accounts?.reduce((acc, account) => {
    acc[account.type] = (acc[account.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Chart of Accounts" 
          subtitle="Manage account codes and classifications"
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-6 mb-6">
          {Object.entries(accountsByType).map(([type, count]) => (
            <Card key={type} className="cursor-pointer hover:bg-accent/50" onClick={() => setTypeFilter(type)}>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">{type}</p>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="COGS">COGS</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setTypeFilter('all'); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Accounts ({filteredAccounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading accounts...</p>}
            {error && <p className="text-red-500">Failed to load accounts</p>}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono font-medium">{account.code}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <Badge className={ACCOUNT_TYPE_COLORS[account.type] || ''}>
                            {account.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={account.isActive ? 'default' : 'secondary'}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/accounts
        </div>
      </AppShell>
    </RequireRole>
  );
}
