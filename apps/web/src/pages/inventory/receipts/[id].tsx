/**
 * M11.2: Receipt Detail Page
 * 
 * Features:
 * - Show receipt header with status, PO reference, dates
 * - Show receipt lines with quantities received
 * - Post receipt action (L3+)
 * - Void receipt action (L4+)
 * - Show ledger entries after posting
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { ArrowLeft, Check, X, Package } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface ReceiptLine {
  id: string;
  itemId: string;
  item: { id: string; sku: string | null; name: string };
  locationId: string;
  location: { id: string; code: string; name: string };
  inputUom: { id: string; code: string };
  qtyReceivedInput: string;
  qtyReceivedBase: string;
  unitCost: string;
  extendedCost: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  status: string;
  purchaseOrderId: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
    vendor: { id: string; name: string };
    branch: { id: string; name: string };
  };
  referenceNumber: string | null;
  notes: string | null;
  receivedAt: string;
  postedAt: string | null;
  postedBy?: { firstName: string; lastName: string } | null;
  createdAt: string;
  lines: ReceiptLine[];
}

interface LedgerEntry {
  id: string;
  itemId: string;
  item: { name: string };
  locationId: string;
  location: { code: string };
  txnType: string;
  qtyDelta: string;
  costDelta: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
};

export default function ReceiptDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  // Fetch receipt
  const { data: receipt, isLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const response = await apiClient.get<Receipt>(`/inventory/procurement/receipts/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch ledger entries (if posted)
  const { data: ledgerEntries } = useQuery({
    queryKey: ['receipt-ledger', id],
    queryFn: async () => {
      const response = await apiClient.get<LedgerEntry[]>(`/inventory/ledger/entries?receiptId=${id}`);
      return response.data;
    },
    enabled: !!id && receipt?.status === 'POSTED',
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/procurement/receipts/${id}/post`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['receipt-ledger', id] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/procurement/receipts/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', id] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </AppShell>
    );
  }

  if (!receipt) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Receipt not found</div>
      </AppShell>
    );
  }

  // Calculate totals
  const totalCost = receipt.lines.reduce((sum, line) => sum + parseFloat(line.extendedCost || '0'), 0);

  return (
    <AppShell>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inventory/receipts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Receipt {receipt.receiptNumber}
            <Badge variant={STATUS_COLORS[receipt.status] || 'secondary'}>{receipt.status}</Badge>
          </h1>
          <p className="text-muted-foreground">From PO {receipt.purchaseOrder?.poNumber}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        {receipt.status === 'DRAFT' && isL3OrAbove && (
          <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
            <Check className="h-4 w-4 mr-2" />
            {postMutation.isPending ? 'Posting...' : 'Post Receipt'}
          </Button>
        )}
        {receipt.status === 'POSTED' && isL4OrAbove && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Void this receipt? This will reverse the inventory ledger entries.')) {
                voidMutation.mutate();
              }
            }}
            disabled={voidMutation.isPending}
          >
            <X className="h-4 w-4 mr-2" />
            {voidMutation.isPending ? 'Voiding...' : 'Void Receipt'}
          </Button>
        )}
      </div>

      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{receipt.purchaseOrder?.vendor?.name || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{receipt.purchaseOrder?.branch?.name || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Received At</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{new Date(receipt.receivedAt).toLocaleDateString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">${totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reference/Notes */}
      {(receipt.referenceNumber || receipt.notes) && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            {receipt.referenceNumber && (
              <p className="text-sm">
                <span className="font-medium">Reference:</span> {receipt.referenceNumber}
              </p>
            )}
            {receipt.notes && (
              <p className="text-sm">
                <span className="font-medium">Notes:</span> {receipt.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receipt Lines */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receipt Lines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded">
            <div className="grid grid-cols-7 gap-2 p-3 bg-muted font-medium text-sm">
              <span>Item</span>
              <span>Location</span>
              <span className="text-right">Qty (Input)</span>
              <span className="text-right">UOM</span>
              <span className="text-right">Qty (Base)</span>
              <span className="text-right">Unit Cost</span>
              <span className="text-right">Extended</span>
            </div>
            {receipt.lines.map((line) => (
              <div key={line.id} className="grid grid-cols-7 gap-2 p-3 border-t items-center text-sm">
                <span>
                  {line.item?.sku ? `${line.item.sku} - ` : ''}
                  {line.item?.name}
                </span>
                <span>{line.location?.code}</span>
                <span className="text-right">{parseFloat(line.qtyReceivedInput).toLocaleString()}</span>
                <span className="text-right">{line.inputUom?.code}</span>
                <span className="text-right">{parseFloat(line.qtyReceivedBase).toLocaleString()}</span>
                <span className="text-right">${parseFloat(line.unitCost).toFixed(2)}</span>
                <span className="text-right font-medium">${parseFloat(line.extendedCost).toFixed(2)}</span>
              </div>
            ))}
            <div className="grid grid-cols-7 gap-2 p-3 border-t bg-muted/50 font-medium text-sm">
              <span className="col-span-6 text-right">Total:</span>
              <span className="text-right">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Entries (if posted) */}
      {receipt.status === 'POSTED' && ledgerEntries && ledgerEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded">
              <div className="grid grid-cols-5 gap-2 p-3 bg-muted font-medium text-sm">
                <span>Item</span>
                <span>Location</span>
                <span>Type</span>
                <span className="text-right">Qty Delta</span>
                <span className="text-right">Cost Delta</span>
              </div>
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-5 gap-2 p-3 border-t items-center text-sm">
                  <span>{entry.item?.name}</span>
                  <span>{entry.location?.code}</span>
                  <span>
                    <Badge variant="outline">{entry.txnType}</Badge>
                  </span>
                  <span className="text-right text-green-600">+{parseFloat(entry.qtyDelta).toLocaleString()}</span>
                  <span className="text-right text-green-600">+${parseFloat(entry.costDelta).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Posted by{' '}
              {receipt.postedBy ? `${receipt.postedBy.firstName} ${receipt.postedBy.lastName}` : 'Unknown'} on{' '}
              {receipt.postedAt ? new Date(receipt.postedAt).toLocaleString() : '-'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Link back to PO */}
      <div className="mt-4">
        <Link href={`/inventory/purchase-orders/${receipt.purchaseOrderId}`}>
          <Button variant="outline">View Purchase Order</Button>
        </Link>
      </div>
    </AppShell>
  );
}
