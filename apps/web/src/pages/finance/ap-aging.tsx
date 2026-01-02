/**
 * M8.2: AP Aging Page
 * 
 * Displays accounts payable aging report.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TrendingDown, AlertTriangle } from 'lucide-react';

interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface VendorAging {
  vendorId: string;
  vendorName: string;
  aging: AgingBucket;
}

interface APAgingData {
  vendors: VendorAging[];
  totals: AgingBucket;
}

export default function APAgingPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ap-aging'],
    queryFn: async () => {
      const response = await apiClient.get<APAgingData>('/accounting/ap/aging');
      return response.data;
    },
    enabled: !!user,
  });

  const totals = data?.totals || { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
  const hasOverdue = (totals.days30 + totals.days60 + totals.days90 + totals.over90) > 0;

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Accounts Payable Aging" 
          subtitle="Outstanding vendor bills by age"
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Current</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.current)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">1-30 Days</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.days30)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">31-60 Days</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.days60)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">61-90 Days</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(totals.days90)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Over 90 Days</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(totals.over90)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Warning if overdue */}
        {hasOverdue && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                You have overdue payables totaling {formatCurrency(totals.days30 + totals.days60 + totals.days90 + totals.over90)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Total Outstanding */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-6 w-6 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Outstanding AP</p>
                  <p className="text-3xl font-bold">{formatCurrency(totals.total)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor Details Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vendor Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading aging data...</p>}
            {error && <p className="text-red-500">Failed to load aging data</p>}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30</TableHead>
                    <TableHead className="text-right">31-60</TableHead>
                    <TableHead className="text-right">61-90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!data?.vendors || data.vendors.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No outstanding payables
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.vendors.map((vendor) => (
                      <TableRow key={vendor.vendorId}>
                        <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vendor.aging.current)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vendor.aging.days30)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vendor.aging.days60)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vendor.aging.days90)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vendor.aging.over90)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(vendor.aging.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Totals Row */}
                  {data?.vendors && data.vendors.length > 0 && (
                    <TableRow className="bg-muted font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.current)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.days30)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.days60)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.days90)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.over90)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.total)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/ap/aging
        </div>
      </AppShell>
    </RequireRole>
  );
}
