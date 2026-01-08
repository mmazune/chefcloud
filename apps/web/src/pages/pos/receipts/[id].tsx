/**
 * M13.4: POS Receipt View Page
 * Print-friendly receipt display
 * Route: /pos/receipts/[id]
 */

import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TotalsSnapshot {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
  }>;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  orderId: string;
  issuedAt: string;
  totalsSnapshot: TotalsSnapshot;
  issuedBy: {
    firstName: string;
    lastName: string;
  };
}

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;

  // Fetch receipt
  const { data: receipt, isLoading, error } = useQuery<Receipt>({
    queryKey: ['pos-receipt', id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/pos/receipts/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch receipt');
      return res.json();
    },
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (!id) {
    return (
      <AppShell>
        <PageHeader title="Receipt" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>No receipt ID provided</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <PageHeader title="Receipt" />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  if (error || !receipt) {
    return (
      <AppShell>
        <PageHeader title="Receipt" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load receipt</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const { totalsSnapshot: totals } = receipt;

  return (
    <AppShell>
      <PageHeader 
        title="Receipt"
        actions={
          <div className="flex gap-2">
            <Link href="/pos">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS
              </Button>
            </Link>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="flex justify-center p-6">
        {/* Receipt Card - print-friendly */}
        <Card className="w-full max-w-md p-6 print:border-0 print:shadow-none">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold">RECEIPT</h1>
            <p className="mt-1 text-2xl font-mono font-bold text-gray-800">
              {receipt.receiptNumber}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {new Date(receipt.issuedAt).toLocaleString()}
            </p>
          </div>

          {/* Divider */}
          <div className="mb-4 border-b border-dashed border-gray-300" />

          {/* Line Items */}
          <div className="mb-4 space-y-2">
            {totals.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>
                  {item.qty} x {item.name}
                </span>
                <span>${item.lineTotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="mb-4 border-b border-dashed border-gray-300" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>${totals.tax.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-${totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>TOTAL</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-b border-dashed border-gray-300" />

          {/* Payment Methods */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-gray-600">Payment</h3>
            {totals.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{p.method}</span>
                <span>${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <div className="mb-2 border-b border-dashed border-gray-300" />
            <p className="text-xs text-gray-500">
              Served by: {receipt.issuedBy.firstName} {receipt.issuedBy.lastName}
            </p>
            <p className="mt-4 text-sm font-medium">Thank you for your visit!</p>
          </div>
        </Card>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:border-0,
          .print\\:border-0 * {
            visibility: visible;
          }
          .print\\:border-0 {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 10mm;
          }
        }
      `}</style>
    </AppShell>
  );
}
