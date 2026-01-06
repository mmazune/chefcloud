/**
 * M8.6: Vendor Bill Detail Page
 * 
 * Shows bill details with open/void/payment actions.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, ConfirmDialog } from '@/components/finance';
import type { DocumentStatus } from '@/components/finance';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  FileText,
  DollarSign,
  CheckCircle,
  XCircle,
  CreditCard,
  BookOpen,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface VendorBillDetail {
  id: string;
  number: string | null;
  vendorId: string;
  vendor: { id: string; name: string; email?: string };
  billDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: DocumentStatus;
  memo: string | null;
  journalEntry: {
    id: string;
    lines: Array<{
      account: { code: string; name: string };
      debit: number;
      credit: number;
    }>;
  } | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: string;
    ref: string | null;
  }>;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
];

export default function VendorBillDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');

  // Fetch bill details
  const { data: bill, isLoading, error, refetch } = useQuery({
    queryKey: ['vendor-bill', id],
    queryFn: async () => {
      const response = await apiClient.get<VendorBillDetail>(`/accounting/vendor-bills/${id}`);
      return response.data;
    },
    enabled: !!id && !!user,
  });

  // Open bill mutation
  const openMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/accounting/vendor-bills/${id}/open`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Bill Opened', description: 'GL entries have been created.' });
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Open Bill',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Void bill mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/accounting/vendor-bills/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Bill Voided', description: 'The bill has been voided.' });
      setShowVoidConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Void Bill',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Create payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/accounting/vendor-payments', {
        vendorId: bill?.vendorId,
        billId: id,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        ref: paymentRef || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Payment Recorded', description: 'The payment has been applied to the bill.' });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Record Payment',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  if (isLoading) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <div className="space-y-4">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        </AppShell>
      </RequireRole>
    );
  }

  if (error || !bill) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <PageHeader title="Vendor Bill" subtitle="Error loading bill" />
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load bill details.</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </AppShell>
      </RequireRole>
    );
  }

  const outstanding = Number(bill.total) - Number(bill.paidAmount);
  const canOpen = bill.status === 'DRAFT';
  const canVoid = ['DRAFT', 'OPEN'].includes(bill.status);
  const canPay = ['OPEN', 'PARTIALLY_PAID'].includes(bill.status) && outstanding > 0;

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <div className="mb-4">
          <Link href="/finance/vendor-bills" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Vendor Bills
          </Link>
        </div>

        <PageHeader
          title={bill.number || `BILL-${bill.id.slice(0, 8)}`}
          subtitle={`Bill to ${bill.vendor.name}`}
          actions={
            <div className="flex gap-2">
              {canOpen && (
                <Button
                  onClick={() => openMutation.mutate()}
                  disabled={openMutation.isPending}
                >
                  {openMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Open Bill
                </Button>
              )}
              {canPay && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentAmount(outstanding.toFixed(2));
                    setShowPaymentModal(true);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              )}
              {canVoid && (
                <Button
                  variant="destructive"
                  onClick={() => setShowVoidConfirm(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Void
                </Button>
              )}
            </div>
          }
        />

        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {/* Bill Summary */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="font-medium">{bill.vendor.name}</p>
                  {bill.vendor.email && <p className="text-sm text-muted-foreground">{bill.vendor.email}</p>}
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={bill.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Bill Date</Label>
                  <p className="font-medium">{formatDate(bill.billDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="font-medium">{formatDate(bill.dueDate)}</p>
                </div>
                {bill.memo && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Memo</Label>
                    <p>{bill.memo}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Amounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Amounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(Number(bill.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(Number(bill.tax))}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(Number(bill.total))}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>{formatCurrency(Number(bill.paidAmount))}</span>
              </div>
              <div className="flex justify-between font-bold text-xl border-t pt-2">
                <span>Outstanding</span>
                <span className={outstanding > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(outstanding)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments History */}
        {bill.payments && bill.payments.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.payments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.paidAt)}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{payment.ref || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(payment.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Journal Entry */}
        {bill.journalEntry && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Journal Entry
              </CardTitle>
              <CardDescription>
                Entry ID: {bill.journalEntry.id.slice(0, 8)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.journalEntry.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <span className="font-mono text-sm mr-2">{line.account.code}</span>
                        {line.account.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(line.credit) > 0 ? formatCurrency(Number(line.credit)) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Outstanding balance: {formatCurrency(outstanding)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={outstanding}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
                {parseFloat(paymentAmount) > outstanding && (
                  <p className="text-sm text-red-600 mt-1">
                    Amount cannot exceed outstanding balance
                  </p>
                )}
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference (optional)</Label>
                <Input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Check number, transfer ID, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => paymentMutation.mutate()}
                disabled={
                  paymentMutation.isPending ||
                  !paymentAmount ||
                  parseFloat(paymentAmount) <= 0 ||
                  parseFloat(paymentAmount) > outstanding
                }
              >
                {paymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Void Confirmation */}
        <ConfirmDialog
          open={showVoidConfirm}
          onOpenChange={setShowVoidConfirm}
          title="Void Bill"
          description="Are you sure you want to void this bill? This action cannot be undone. If GL entries exist, reversal entries will be created."
          confirmLabel="Void Bill"
          onConfirm={() => voidMutation.mutate()}
          isLoading={voidMutation.isPending}
          variant="destructive"
        />
      </AppShell>
    </RequireRole>
  );
}
