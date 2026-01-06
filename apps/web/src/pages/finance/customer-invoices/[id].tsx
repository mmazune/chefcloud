/**
 * M8.6: Customer Invoice Detail Page
 * 
 * Shows invoice details with open/void/receipt actions.
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

interface CustomerInvoiceDetail {
  id: string;
  number: string | null;
  customerId: string;
  customer: { id: string; name: string; email?: string };
  invoiceDate: string;
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
  receipts: Array<{
    id: string;
    amount: number;
    receivedAt: string;
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

export default function CustomerInvoiceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('BANK_TRANSFER');
  const [receiptRef, setReceiptRef] = useState('');

  // Fetch invoice details
  const { data: invoice, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-invoice', id],
    queryFn: async () => {
      const response = await apiClient.get<CustomerInvoiceDetail>(`/accounting/customer-invoices/${id}`);
      return response.data;
    },
    enabled: !!id && !!user,
  });

  // Open invoice mutation
  const openMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/accounting/customer-invoices/${id}/open`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Invoice Opened', description: 'GL entries have been created.' });
      queryClient.invalidateQueries({ queryKey: ['customer-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Open Invoice',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Void invoice mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/accounting/customer-invoices/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Invoice Voided', description: 'The invoice has been voided.' });
      setShowVoidConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['customer-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Void Invoice',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Create receipt mutation
  const receiptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/accounting/customer-receipts', {
        customerId: invoice?.customerId,
        invoiceId: id,
        amount: parseFloat(receiptAmount),
        method: receiptMethod,
        ref: receiptRef || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: 'Receipt Recorded', description: 'The receipt has been applied to the invoice.' });
      setShowReceiptModal(false);
      setReceiptAmount('');
      setReceiptRef('');
      queryClient.invalidateQueries({ queryKey: ['customer-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Record Receipt',
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

  if (error || !invoice) {
    return (
      <RequireRole minRole={RoleLevel.L4}>
        <AppShell>
          <PageHeader title="Customer Invoice" subtitle="Error loading invoice" />
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load invoice details.</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </AppShell>
      </RequireRole>
    );
  }

  const outstanding = Number(invoice.total) - Number(invoice.paidAmount);
  const canOpen = invoice.status === 'DRAFT';
  const canVoid = ['DRAFT', 'OPEN'].includes(invoice.status);
  const canReceive = ['OPEN', 'PARTIALLY_PAID'].includes(invoice.status) && outstanding > 0;

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <div className="mb-4">
          <Link href="/finance/customer-invoices" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
        </div>

        <PageHeader
          title={invoice.number || `INV-${invoice.id.slice(0, 8)}`}
          subtitle={`Invoice to ${invoice.customer.name}`}
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
                  Open Invoice
                </Button>
              )}
              {canReceive && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setReceiptAmount(outstanding.toFixed(2));
                    setShowReceiptModal(true);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Record Receipt
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
          {/* Invoice Summary */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{invoice.customer.name}</p>
                  {invoice.customer.email && <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>}
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p className="font-medium">{formatDate(invoice.invoiceDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
                {invoice.memo && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Memo</Label>
                    <p>{invoice.memo}</p>
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
                <span>{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(Number(invoice.tax))}</span>
              </div>
              <div className="flex justify-between font-medium text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(Number(invoice.total))}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Received</span>
                <span>{formatCurrency(Number(invoice.paidAmount))}</span>
              </div>
              <div className="flex justify-between font-bold text-xl border-t pt-2">
                <span>Outstanding</span>
                <span className={outstanding > 0 ? 'text-blue-600' : 'text-green-600'}>
                  {formatCurrency(outstanding)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receipts History */}
        {invoice.receipts && invoice.receipts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Receipt History
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
                  {invoice.receipts.map(receipt => (
                    <TableRow key={receipt.id}>
                      <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                      <TableCell>{receipt.method}</TableCell>
                      <TableCell>{receipt.ref || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(receipt.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Journal Entry */}
        {invoice.journalEntry && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Journal Entry
              </CardTitle>
              <CardDescription>
                Entry ID: {invoice.journalEntry.id.slice(0, 8)}
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
                  {invoice.journalEntry.lines.map((line, idx) => (
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

        {/* Receipt Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Receipt</DialogTitle>
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
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  placeholder="0.00"
                />
                {parseFloat(receiptAmount) > outstanding && (
                  <p className="text-sm text-red-600 mt-1">
                    Amount cannot exceed outstanding balance
                  </p>
                )}
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={receiptMethod} onValueChange={setReceiptMethod}>
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
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="Check number, transfer ID, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceiptModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => receiptMutation.mutate()}
                disabled={
                  receiptMutation.isPending ||
                  !receiptAmount ||
                  parseFloat(receiptAmount) <= 0 ||
                  parseFloat(receiptAmount) > outstanding
                }
              >
                {receiptMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Record Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Void Confirmation */}
        <ConfirmDialog
          open={showVoidConfirm}
          onOpenChange={setShowVoidConfirm}
          title="Void Invoice"
          description="Are you sure you want to void this invoice? This action cannot be undone. If GL entries exist, reversal entries will be created."
          confirmLabel="Void Invoice"
          onConfirm={() => voidMutation.mutate()}
          isLoading={voidMutation.isPending}
          variant="destructive"
        />
      </AppShell>
    </RequireRole>
  );
}
