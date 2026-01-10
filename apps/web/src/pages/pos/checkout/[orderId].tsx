/**
 * M13.4: POS Checkout Page
 * Payment flow for a specific order
 * Route: /pos/checkout/[orderId]
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Banknote, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I2: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/pos/checkout/[orderId]',
  title: 'POS Checkout',
  primaryActions: [
    { label: 'Pay Cash', testId: 'checkout-pay-cash', intent: 'create' },
    { label: 'Pay Card', testId: 'checkout-pay-card', intent: 'create' },
    { label: 'Pay Mobile', testId: 'checkout-pay-mobile', intent: 'create' },
    { label: 'Complete Sale', testId: 'checkout-complete', intent: 'update' },
    { label: 'Back to POS', testId: 'checkout-back', intent: 'navigate' },
  ],
  apiCalls: [
    { method: 'GET', path: '/pos/orders/:id', trigger: 'onMount', notes: 'Fetch order' },
    { method: 'POST', path: '/pos/orders/:id/payments', trigger: 'onAction', notes: 'Add payment' },
    { method: 'POST', path: '/pos/orders/:id/complete', trigger: 'onAction', notes: 'Complete order' },
  ],
  risk: 'HIGH',
  allowedRoles: ['OWNER', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'WAITER', 'BARTENDER'],
  parent: '/pos',
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    amountCents: number;
    method: string;
    posStatus: string;
    capturedCents: number;
  }>;
}

interface CreatePaymentResponse {
  id: string;
  method: string;
  amountCents: number;
  capturedCents: number;
  posStatus: string;
  providerRef?: string;
}

// Helper to generate idempotency keys
function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const queryClient = useQueryClient();

  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingCardPaymentId, setPendingCardPaymentId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Fetch order details
  const { data: order, isLoading: orderLoading, error: orderError } = useQuery<OrderDetail>({
    queryKey: ['pos-order', orderId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/pos/orders/${orderId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch order');
      return res.json();
    },
    enabled: !!orderId,
    refetchInterval: 5000, // Poll for payment updates
  });

  // Create payment mutation
  const createPayment = useMutation({
    mutationFn: async ({ method, amountCents, cardToken }: { 
      method: 'CASH' | 'CARD'; 
      amountCents: number;
      cardToken?: string;
    }) => {
      const idempotencyKey = generateIdempotencyKey(`checkout-${orderId}-${method}`);
      const res = await fetch(`${API_URL}/pos/orders/${orderId}/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ 
          method, 
          amountCents,
          ...(cardToken && { cardToken }),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Payment failed');
      }
      return res.json() as Promise<CreatePaymentResponse>;
    },
    onSuccess: (data) => {
      setPaymentError(null);
      queryClient.invalidateQueries({ queryKey: ['pos-order', orderId] });
      
      // If card payment needs capture, track it
      if (data.method === 'CARD' && data.posStatus === 'AUTHORIZED') {
        setPendingCardPaymentId(data.id);
      }
    },
    onError: (err: Error) => {
      setPaymentError(err.message);
    },
  });

  // Capture payment mutation (for card)
  const capturePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`${API_URL}/pos/payments/${paymentId}/capture`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Capture failed');
      }
      return res.json();
    },
    onSuccess: () => {
      setPaymentError(null);
      setPendingCardPaymentId(null);
      queryClient.invalidateQueries({ queryKey: ['pos-order', orderId] });
    },
    onError: (err: Error) => {
      setPaymentError(err.message);
    },
  });

  // Issue receipt mutation
  const issueReceipt = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/pos/orders/${orderId}/receipt`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Receipt issuance failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/pos/receipts/${data.id}`);
    },
    onError: (err: Error) => {
      setPaymentError(err.message);
    },
  });

  // Calculate amounts
  const totalCents = useMemo(() => {
    if (!order) return 0;
    return Math.round(order.total * 100);
  }, [order]);

  const paidCents = useMemo(() => {
    if (!order?.payments) return 0;
    return order.payments
      .filter(p => p.posStatus === 'CAPTURED')
      .reduce((sum, p) => sum + p.capturedCents, 0);
  }, [order]);

  const remainingCents = useMemo(() => {
    return Math.max(0, totalCents - paidCents);
  }, [totalCents, paidCents]);

  const isFullyPaid = remainingCents === 0 && totalCents > 0;

  // Handle cash payment
  const handleCashPayment = useCallback(() => {
    const amount = customAmount ? Math.round(parseFloat(customAmount) * 100) : remainingCents;
    if (amount <= 0) return;
    createPayment.mutate({ method: 'CASH', amountCents: amount });
    setCustomAmount('');
  }, [createPayment, remainingCents, customAmount]);

  // Handle card payment
  const handleCardPayment = useCallback(() => {
    const amount = customAmount ? Math.round(parseFloat(customAmount) * 100) : remainingCents;
    if (amount <= 0) return;
    // Use test-token-success for development
    createPayment.mutate({ 
      method: 'CARD', 
      amountCents: amount,
      cardToken: 'test-token-success',
    });
    setCustomAmount('');
  }, [createPayment, remainingCents, customAmount]);

  // Handle capture
  const handleCapture = useCallback(() => {
    if (pendingCardPaymentId) {
      capturePayment.mutate(pendingCardPaymentId);
    }
  }, [capturePayment, pendingCardPaymentId]);

  // Handle receipt issuance
  const handleIssueReceipt = useCallback(() => {
    issueReceipt.mutate();
  }, [issueReceipt]);

  const isProcessing = createPayment.isPending || capturePayment.isPending || issueReceipt.isPending;

  if (!orderId) {
    return (
      <AppShell>
        <PageHeader title="Checkout" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>No order ID provided</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  if (orderLoading) {
    return (
      <AppShell>
        <PageHeader title="Checkout" />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppShell>
    );
  }

  if (orderError || !order) {
    return (
      <AppShell>
        <PageHeader title="Checkout" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load order</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader 
        title={`Checkout - Order #${order.orderNumber}`}
        actions={
          <Link href="/pos">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to POS
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 p-6 md:grid-cols-2">
        {/* Order Summary */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
          
          <div className="space-y-2 border-b pb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span>${(item.total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Status */}
          {order.payments.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-600">Payments</h3>
              {order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {p.method === 'CARD' ? <CreditCard className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                    {p.method}
                  </span>
                  <span className="flex items-center gap-2">
                    ${(p.capturedCents / 100).toFixed(2)}
                    <Badge variant={p.posStatus === 'CAPTURED' ? 'default' : 'secondary'}>
                      {p.posStatus}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Remaining Balance */}
          {remainingCents > 0 && (
            <div className="mt-4 flex justify-between rounded-lg bg-amber-50 p-3 text-amber-800">
              <span className="font-medium">Remaining</span>
              <span className="font-bold">${(remainingCents / 100).toFixed(2)}</span>
            </div>
          )}

          {/* Fully Paid State */}
          {isFullyPaid && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 p-4 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Order Fully Paid</span>
            </div>
          )}
        </Card>

        {/* Payment Actions */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Payment</h2>

          {paymentError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          )}

          {/* Pending Card Capture */}
          {pendingCardPaymentId && (
            <div className="mb-4">
              <Alert>
                <AlertDescription>
                  Card authorized. Click Capture to complete the transaction.
                </AlertDescription>
              </Alert>
              <Button 
                className="mt-3 w-full" 
                onClick={handleCapture}
                disabled={isProcessing}
              >
                {capturePayment.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Capture Payment
              </Button>
            </div>
          )}

          {/* Payment Buttons (when not fully paid and no pending capture) */}
          {!isFullyPaid && !pendingCardPaymentId && (
            <>
              {/* Custom Amount Input */}
              <div className="mb-4">
                <label className="mb-1 block text-sm text-gray-600">
                  Custom Amount (leave empty for full remaining)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`$${(remainingCents / 100).toFixed(2)}`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  size="lg"
                  className="h-24 text-lg"
                  variant="outline"
                  onClick={handleCashPayment}
                  disabled={isProcessing || remainingCents === 0}
                >
                  {createPayment.isPending && createPayment.variables?.method === 'CASH' ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Banknote className="mr-2 h-6 w-6" />
                  )}
                  Pay Cash
                </Button>

                <Button
                  size="lg"
                  className="h-24 text-lg"
                  onClick={handleCardPayment}
                  disabled={isProcessing || remainingCents === 0}
                >
                  {createPayment.isPending && createPayment.variables?.method === 'CARD' ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-6 w-6" />
                  )}
                  Pay Card
                </Button>
              </div>
            </>
          )}

          {/* Issue Receipt Button (when fully paid) */}
          {isFullyPaid && (
            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={handleIssueReceipt}
              disabled={isProcessing}
            >
              {issueReceipt.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Issue Receipt
            </Button>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
