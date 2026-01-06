/**
 * M8.6: Customer Detail Page
 * 
 * View customer details, associated invoices, credit notes, and payment history.
 */
import React from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/finance';
import type { DocumentStatus } from '@/components/finance';
import {
  Users,
  ArrowLeft,
  FileText,
  Mail,
  Phone,
  MapPin,
  Clock,
  Edit,
} from 'lucide-react';
import Link from 'next/link';

interface CustomerInvoice {
  id: string;
  invoiceNumber: string | null;
  status: DocumentStatus;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  createdAt: string;
}

interface CustomerCreditNote {
  id: string;
  number: string | null;
  status: DocumentStatus;
  amount: number;
  allocatedAmount: number;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  invoices: CustomerInvoice[];
  creditNotes: CustomerCreditNote[];
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await apiClient.get<Customer>(`/accounting/customers/${id}`);
      return response.data;
    },
    enabled: !!user && !!id,
  });

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : '-';

  // Compute summary stats
  const stats = {
    totalInvoices: customer?.invoices?.length || 0,
    openInvoices: customer?.invoices?.filter(i => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID').length || 0,
    totalReceivable: customer?.invoices
      ?.filter(i => ['OPEN', 'PARTIALLY_PAID'].includes(i.status))
      .reduce((sum, i) => sum + (Number(i.totalAmount) - Number(i.paidAmount)), 0) || 0,
    totalCreditNotes: customer?.creditNotes?.length || 0,
    availableCredit: customer?.creditNotes
      ?.filter((cn: CustomerCreditNote) => cn.status === 'OPEN')
      .reduce((sum: number, cn: CustomerCreditNote) => sum + (Number(cn.amount) - Number(cn.allocatedAmount)), 0) || 0,
  };

  if (isLoading) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </AppShell>
      </RequireRole>
    );
  }

  if (!customer) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Customer not found</p>
            <Link href="/finance/customers">
              <Button className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Customers
              </Button>
            </Link>
          </div>
        </AppShell>
      </RequireRole>
    );
  }

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <div className="mb-6">
          <Link href="/finance/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>
          </Link>
        </div>

        <PageHeader
          title={customer.name}
          subtitle={`Customer Account`}
          actions={
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit Customer
            </Button>
          }
        />

        {/* Customer Info */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                {customer.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {customer.email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {customer.email}
                </p>
              )}
              {customer.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {customer.phone}
                </p>
              )}
              {customer.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {customer.address}
                </p>
              )}
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                Created {formatDate(customer.createdAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accounts Receivable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Invoices</span>
                <span className="font-medium">{stats.totalInvoices}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Invoices</span>
                <span className="font-medium text-blue-600">{stats.openInvoices}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Receivable</span>
                <span className="font-bold text-green-600">{formatCurrency(stats.totalReceivable)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Credit Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Credit Notes</span>
                <span className="font-medium">{stats.totalCreditNotes}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Available Credit</span>
                <span className="font-bold text-amber-600">{formatCurrency(stats.availableCredit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Invoices ({stats.totalInvoices})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer.invoices?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(invoice.paidAmount))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(invoice.totalAmount) - Number(invoice.paidAmount))}
                      </TableCell>
                      <TableCell>
                        <Link href={`/finance/customer-invoices/${invoice.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No invoices for this customer
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credit Notes List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Credit Notes ({stats.totalCreditNotes})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer.creditNotes?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.creditNotes.map(cn => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-medium">
                        {cn.number || `CCN-${cn.id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{formatDate(cn.createdAt)}</TableCell>
                      <TableCell>
                        <StatusBadge status={cn.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(cn.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(cn.allocatedAmount))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(Number(cn.amount) - Number(cn.allocatedAmount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No credit notes for this customer
              </p>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
