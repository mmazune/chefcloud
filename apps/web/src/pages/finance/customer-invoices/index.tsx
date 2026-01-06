/**
 * M8.6: Customer Invoices (AR) List Page
 * 
 * Lists customer invoices with filtering and status management.
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

interface Customer {
  id: string;
  name: string;
}

interface CustomerInvoice {
  id: string;
  number: string | null;
  customerId: string;
  customer: Customer;
  invoiceDate: string;
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

export default function CustomerInvoicesPage() {
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState<string | null>(activeBranchId);

  // Fetch customers for filter
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get<Customer[]>('/accounting/customers');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch invoices
  const { data: invoices, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-invoices', statusFilter, customerFilter, branchFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (customerFilter !== 'all') params.customerId = customerFilter;
      if (branchFilter) params.branchId = branchFilter;

      const response = await apiClient.get<CustomerInvoice[]>('/accounting/customer-invoices', { params });
      return response.data;
    },
    enabled: !!user,
  });

  // Filter invoices by search term
  const filteredInvoices = invoices?.filter(invoice => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.number?.toLowerCase().includes(searchLower) ||
      invoice.customer.name.toLowerCase().includes(searchLower) ||
      invoice.memo?.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Compute summary stats
  const stats = {
    total: filteredInvoices.length,
    open: filteredInvoices.filter(i => i.status === 'OPEN').length,
    partiallyPaid: filteredInvoices.filter(i => i.status === 'PARTIALLY_PAID').length,
    totalOutstanding: filteredInvoices
      .filter(i => ['OPEN', 'PARTIALLY_PAID'].includes(i.status))
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.paidAmount)), 0),
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  if (error) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <PageHeader title="Customer Invoices" subtitle="Error loading invoices" />
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load invoices. Please try again.</p>
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
          title="Customer Invoices"
          subtitle="Manage accounts receivable"
          actions={
            <div className="flex gap-2">
              <ExportButton
                endpoint="/accounting/export/customer-invoices"
                filename="customer-invoices"
                params={{ branchId: branchFilter || undefined }}
              />
              <Button onClick={() => router.push('/finance/customer-invoices/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New Invoice
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Invoices</p>
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
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalOutstanding)}</p>
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
                  placeholder="Search by number, customer, or memo..."
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

              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Invoices ({filteredInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all' || customerFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first invoice to get started'}
                </p>
                <Button onClick={() => router.push('/finance/customer-invoices/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(invoice => {
                    const outstanding = Number(invoice.total) - Number(invoice.paidAmount);
                    const isOverdue = new Date(invoice.dueDate) < new Date() && outstanding > 0;

                    return (
                      <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link href={`/finance/customer-invoices/${invoice.id}`} className="hover:underline">
                            {invoice.number || `INV-${invoice.id.slice(0, 8)}`}
                          </Link>
                        </TableCell>
                        <TableCell>{invoice.customer.name}</TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(invoice.dueDate)}
                          {isOverdue && <span className="ml-2 text-xs">(Overdue)</span>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status} />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(invoice.total))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(invoice.paidAmount))}</TableCell>
                        <TableCell className="text-right font-medium">
                          {outstanding > 0 ? formatCurrency(outstanding) : '-'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/finance/customer-invoices/${invoice.id}`}>
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
