/**
 * M8.6: Vendor Detail Page
 * 
 * View vendor details, associated bills, credit notes, and payment history.
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
  Truck,
  ArrowLeft,
  FileText,
  Mail,
  Phone,
  MapPin,
  Clock,
  Edit,
} from 'lucide-react';
import Link from 'next/link';

interface VendorBill {
  id: string;
  billNumber: string | null;
  status: DocumentStatus;
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  createdAt: string;
}

interface VendorCreditNote {
  id: string;
  number: string | null;
  status: DocumentStatus;
  amount: number;
  allocatedAmount: number;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  bills: VendorBill[];
  creditNotes: VendorCreditNote[];
}

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const response = await apiClient.get<Vendor>(`/accounting/vendors/${id}`);
      return response.data;
    },
    enabled: !!user && !!id,
  });

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : '-';

  // Compute summary stats
  const stats = {
    totalBills: vendor?.bills?.length || 0,
    openBills: vendor?.bills?.filter(b => b.status === 'OPEN' || b.status === 'PARTIALLY_PAID').length || 0,
    totalOutstanding: vendor?.bills
      ?.filter(b => ['OPEN', 'PARTIALLY_PAID'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.totalAmount) - Number(b.paidAmount)), 0) || 0,
    totalCreditNotes: vendor?.creditNotes?.length || 0,
    availableCredit: vendor?.creditNotes
      ?.filter((cn: VendorCreditNote) => cn.status === 'OPEN')
      .reduce((sum: number, cn: VendorCreditNote) => sum + (Number(cn.amount) - Number(cn.allocatedAmount)), 0) || 0,
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

  if (!vendor) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <div className="text-center py-12">
            <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Vendor not found</p>
            <Link href="/finance/vendors">
              <Button className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Vendors
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
          <Link href="/finance/vendors">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Vendors
            </Button>
          </Link>
        </div>

        <PageHeader
          title={vendor.name}
          subtitle={`Vendor Account`}
          actions={
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit Vendor
            </Button>
          }
        />

        {/* Vendor Info */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
                {vendor.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {vendor.email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {vendor.email}
                </p>
              )}
              {vendor.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {vendor.phone}
                </p>
              )}
              {vendor.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {vendor.address}
                </p>
              )}
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                Created {formatDate(vendor.createdAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accounts Payable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bills</span>
                <span className="font-medium">{stats.totalBills}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Bills</span>
                <span className="font-medium text-blue-600">{stats.openBills}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</span>
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
                <span className="font-bold text-green-600">{formatCurrency(stats.availableCredit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bills List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Bills ({stats.totalBills})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendor.bills?.length > 0 ? (
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
                  {vendor.bills.map(bill => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">
                        {bill.billNumber || `BILL-${bill.id.slice(0, 8)}`}
                      </TableCell>
                      <TableCell>{formatDate(bill.createdAt)}</TableCell>
                      <TableCell>{formatDate(bill.dueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(bill.totalAmount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(bill.paidAmount))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(bill.totalAmount) - Number(bill.paidAmount))}
                      </TableCell>
                      <TableCell>
                        <Link href={`/finance/vendor-bills/${bill.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No bills for this vendor
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
            {vendor.creditNotes?.length > 0 ? (
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
                  {vendor.creditNotes.map(cn => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-medium">
                        {cn.number || `VCN-${cn.id.slice(0, 8)}`}
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
                No credit notes for this vendor
              </p>
            )}
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
