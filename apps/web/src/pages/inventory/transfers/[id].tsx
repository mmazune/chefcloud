/**
 * M11.3: Inventory Transfer Detail Page
 * 
 * Features:
 * - Show transfer header with status, from/to branches, dates
 * - Show transfer lines with item, qty shipped/received
 * - Ship button (from DRAFT, L3+)
 * - Receive button (from IN_TRANSIT, L3+)
 * - Void button (from DRAFT, L4+)
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
import { ArrowLeft, Send, Package, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface TransferLine {
  id: string;
  itemId: string;
  item: { id: string; sku: string | null; name: string };
  fromLocation: { id: string; code: string; name: string };
  toLocation: { id: string; code: string; name: string };
  qtyShipped: string;
  qtyReceived: string;
}

interface InventoryTransfer {
  id: string;
  transferNumber: string;
  status: string;
  fromBranchId: string;
  fromBranch: { id: string; name: string };
  toBranchId: string;
  toBranch: { id: string; name: string };
  shippedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  shippedBy: { id: string; firstName: string; lastName: string } | null;
  receivedBy: { id: string; firstName: string; lastName: string } | null;
  lines: TransferLine[];
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  IN_TRANSIT: 'outline',
  RECEIVED: 'default',
  VOID: 'destructive',
};

export default function TransferDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  // Fetch transfer
  const { data: transfer, isLoading } = useQuery({
    queryKey: ['inventory-transfer', id],
    queryFn: async () => {
      const response = await apiClient.get<InventoryTransfer>(`/inventory/transfers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Ship mutation
  const shipMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/transfers/${id}/ship`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
    },
  });

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/transfers/${id}/receive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/transfers/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (!transfer) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Transfer not found</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link href="/inventory/transfers">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span>Transfer {transfer.transferNumber}</span>
            <Badge variant={STATUS_COLORS[transfer.status] || 'secondary'}>
              {transfer.status.replace('_', ' ')}
            </Badge>
          </div>
        }
        subtitle={`Created ${new Date(transfer.createdAt).toLocaleString()}`}
        actions={
          <div className="flex gap-2">
            {isL3OrAbove && transfer.status === 'DRAFT' && (
              <Button
                onClick={() => shipMutation.mutate()}
                disabled={shipMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {shipMutation.isPending ? 'Shipping...' : 'Ship Transfer'}
              </Button>
            )}
            {isL3OrAbove && transfer.status === 'IN_TRANSIT' && (
              <Button
                onClick={() => receiveMutation.mutate()}
                disabled={receiveMutation.isPending}
              >
                <Package className="h-4 w-4 mr-2" />
                {receiveMutation.isPending ? 'Receiving...' : 'Receive Transfer'}
              </Button>
            )}
            {isL4OrAbove && transfer.status === 'DRAFT' && (
              <Button
                variant="destructive"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                {voidMutation.isPending ? 'Voiding...' : 'Void'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transfer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">From Branch</div>
                <div className="font-medium">{transfer.fromBranch.name}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">To Branch</div>
                <div className="font-medium">{transfer.toBranch.name}</div>
              </div>
            </div>
            {transfer.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Notes</div>
                <div>{transfer.notes}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Created By</div>
                <div>{transfer.createdBy.firstName} {transfer.createdBy.lastName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created At</div>
                <div>{new Date(transfer.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping/Receiving Info */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping & Receiving</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Shipped At</div>
                <div>{transfer.shippedAt ? new Date(transfer.shippedAt).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Shipped By</div>
                <div>
                  {transfer.shippedBy
                    ? `${transfer.shippedBy.firstName} ${transfer.shippedBy.lastName}`
                    : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Received At</div>
                <div>{transfer.receivedAt ? new Date(transfer.receivedAt).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Received By</div>
                <div>
                  {transfer.receivedBy
                    ? `${transfer.receivedBy.firstName} ${transfer.receivedBy.lastName}`
                    : '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transfer Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">From Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">To Location</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Qty Shipped</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Qty Received</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfer.lines.map((line) => {
                  const qtyShipped = parseFloat(line.qtyShipped);
                  const qtyReceived = parseFloat(line.qtyReceived);
                  const variance = qtyReceived - qtyShipped;

                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{line.item.name}</div>
                        {line.item.sku && (
                          <div className="text-sm text-muted-foreground font-mono">{line.item.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{line.fromLocation.code}</div>
                        <div className="text-muted-foreground">{line.fromLocation.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{line.toLocation.code}</div>
                        <div className="text-muted-foreground">{line.toLocation.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{qtyShipped.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {transfer.status === 'RECEIVED' ? qtyReceived.toFixed(4) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {transfer.status === 'RECEIVED' ? (
                          <span className={variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : ''}>
                            {variance !== 0 ? (variance > 0 ? '+' : '') + variance.toFixed(4) : '-'}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
