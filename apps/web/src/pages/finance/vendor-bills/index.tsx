/**
 * M8.6: Vendor Bills (AP) List Page
 * 
 * Lists vendor bills with filtering and status management.
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
import { StatusBadge, ExportButton, BranchFilter } from '@/components/finance';
import type { DocumentStatus } from '@/components/finance';
import { Search, FileText, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface Vendor {
  id: string;
  name: string;
}

interface VendorBill {
  id: string;
  number: string | null;
  vendorId: string;
  vendor: Vendor;
  billDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: DocumentStatus;
  memo: string | null;
  journalEntry: { id: string } | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOID', label: 'Void' },
];

export default function VendorBillsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState<string | null>(activeBranchId);

  // Fetch vendors for filter
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiClient.get<Vendor[]>('/accounting/vendors');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch vendor bills
  const { data: bills, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor-bills', statusFilter, vendorFilter, branchFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (vendorFilter !== 'all') params.vendorId = vendorFilter;
      if (branchFilter) params.branchId = branchFilter;

      const response = await apiClient.get<VendorBill[]>('/accounting/vendor-bills', { params });
      return response.data;
    },
    enabled: !!user,
  });

  // Filter bills by search term
  const filteredBills = bills?.filter(bill => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      bill.number?.toLowerCase().includes(searchLower) ||
      bill.vendor.name.toLowerCase().includes(searchLower) ||
      bill.memo?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Compute summary stats
  const stats = {
    total: filteredBills.length,
    open: filteredBills.filter(b => b.status === 'OPEN').length,
    partiallyPaid: filteredBills.filter(b => b.status === 'PARTIALLY_PAID').length,
    totalOutstanding: filteredBills
      .filter(b => ['OPEN', 'PARTIALLY_PAID'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.total) - Number(b.paidAmount)), 0),
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (error) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <PageHeader title="Vendor Bills" subtitle="Error loading bills" />
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load vendor bills. Please try again.</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </AppShell>
      </RequireRole>
    );
  }

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader
          title="Vendor Bills"
          subtitle="Manage accounts payable"
          actions={
            <div className="flex gap-2">
              <ExportButton
                endpoint="/accounting/export/vendor-bills"
                filename="vendor-bills"
                params={{ branchId: branchFilter || undefined }}
              />
              <Button onClick={() => router.push('/finance/vendor-bills/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New Bill
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Bills</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Partially Paid</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.partiallyPaid}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by number, vendor, or memo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors?.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <BranchFilter
                value={branchFilter}
                onChange={setBranchFilter}
                className="w-[180px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bills Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Bills ({filteredBills.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No vendor bills found</p>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all' || vendorFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first vendor bill to get started'}
                </p>
                <Button onClick={() => router.push('/finance/vendor-bills/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Bill
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Bill Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map(bill => {
                    const outstanding = Number(bill.total) - Number(bill.paidAmount);
                    const isOverdue = new Date(bill.dueDate) < new Date() && outstanding > 0;

                    return (
                      <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link href={`/finance/vendor-bills/${bill.id}`} className="hover:underline">
                            {bill.number || `BILL-${bill.id.slice(0, 8)}`}
                          </Link>
                        </TableCell>
                        <TableCell>{bill.vendor.name}</TableCell>
                        <TableCell>{formatDate(bill.billDate)}</TableCell>
                        <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(bill.dueDate)}
                          {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={bill.status} />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(bill.total))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(bill.paidAmount))}</TableCell>
                        <TableCell className="text-right font-medium">
                          {outstanding > 0 ? formatCurrency(outstanding) : '-'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/finance/vendor-bills/${bill.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
