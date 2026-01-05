/**
 * M11.2: Purchase Order Detail Page
 * 
 * Features:
 * - Show PO header with status, vendor, dates
 * - Show PO lines with item, qty ordered/received, unit cost
 * - Progress bars for partial receiving
 * - Create Receipt CTA
 * - Submit/Approve/Cancel actions based on RBAC
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { ArrowLeft, Check, X, Send, Package } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface PurchaseOrderLine {
  id: string;
  itemId: string;
  item: { id: string; sku: string | null; name: string };
  inputUom: { id: string; code: string };
  qtyOrderedInput: string;
  qtyOrderedBase: string;
  qtyReceivedBase: string;
  unitCost: string;
  extendedCost: string;
  allowOverReceipt: boolean;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  vendor: { id: string; name: string };
  branchId: string;
  branch: { id: string; name: string };
  expectedAt: string | null;
  notes: string | null;
  totalAmount: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  lines: PurchaseOrderLine[];
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  APPROVED: 'default',
  PARTIALLY_RECEIVED: 'default',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
};

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  // Fetch PO
  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const response = await apiClient.get<PurchaseOrder>(`/inventory/procurement/purchase-orders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </AppShell>
    );
  }

  if (!po) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Purchase order not found</div>
      </AppShell>
    );
  }

  const canReceive = ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status);

  return (
    <AppShell>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inventory/purchase-orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            PO {po.poNumber}
            <Badge variant={STATUS_COLORS[po.status] || 'secondary'}>{po.status}</Badge>
          </h1>
          <p className="text-muted-foreground">Vendor: {po.vendor?.name}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        {po.status === 'DRAFT' && isL3OrAbove && (
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            <Send className="h-4 w-4 mr-2" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        )}
        {po.status === 'PENDING_APPROVAL' && isL4OrAbove && (
          <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            <Check className="h-4 w-4 mr-2" />
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </Button>
        )}
        {['DRAFT', 'PENDING_APPROVAL'].includes(po.status) && isL4OrAbove && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Cancel this PO?')) cancelMutation.mutate();
            }}
            disabled={cancelMutation.isPending}
          >
            <X className="h-4 w-4 mr-2" />
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}
        {canReceive && (
          <Link href={`/inventory/receipts?poId=${po.id}`}>
            <Button variant="outline">
              <Package className="h-4 w-4 mr-2" /> Create Receipt
            </Button>
          </Link>
        )}
      </div>

      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.vendor?.name || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{po.branch?.name || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">${parseFloat(po.totalAmount || '0').toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {po.notes && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <p className="text-sm">
              <span className="font-medium">Notes:</span> {po.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* PO Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Order Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded">
            <div className="grid grid-cols-7 gap-2 p-3 bg-muted font-medium text-sm">
              <span>Item</span>
              <span className="text-right">Qty Ordered</span>
              <span>UOM</span>
              <span className="text-right">Qty Received</span>
              <span>Progress</span>
              <span className="text-right">Unit Cost</span>
              <span className="text-right">Extended</span>
            </div>
            {po.lines.map((line) => {
              const orderedBase = parseFloat(line.qtyOrderedBase);
              const receivedBase = parseFloat(line.qtyReceivedBase);
              const progress = orderedBase > 0 ? Math.round((receivedBase / orderedBase) * 100) : 0;

              return (
                <div key={line.id} className="grid grid-cols-7 gap-2 p-3 border-t items-center text-sm">
                  <span>{line.item?.sku ? `${line.item.sku} - ` : ''}{line.item?.name}</span>
                  <span className="text-right">{parseFloat(line.qtyOrderedInput).toLocaleString()}</span>
                  <span>{line.inputUom?.code}</span>
                  <span className="text-right">{receivedBase.toLocaleString()}</span>
                  <span>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground">{progress}%</span>
                  </span>
                  <span className="text-right">${parseFloat(line.unitCost).toFixed(2)}</span>
                  <span className="text-right font-medium">${parseFloat(line.extendedCost).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="grid grid-cols-7 gap-2 p-3 border-t bg-muted/50 font-medium text-sm">
              <span className="col-span-6 text-right">Total:</span>
              <span className="text-right">${parseFloat(po.totalAmount || '0').toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
