/**
 * M11.3: Inventory Waste Detail Page
 * 
 * Features:
 * - Show waste header with status, reason, dates
 * - Show waste lines with item, location, qty, cost
 * - Post button (from DRAFT, L3+)
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
import { ArrowLeft, Check, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface WasteLine {
  id: string;
  itemId: string;
  item: { id: string; sku: string | null; name: string };
  location: { id: string; code: string; name: string };
  qty: string;
  unitCost: string | null;
  reason: string | null;
}

interface InventoryWaste {
  id: string;
  wasteNumber: string;
  status: string;
  reason: string;
  branchId: string;
  branch: { id: string; name: string };
  postedAt: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  postedBy: { id: string; firstName: string; lastName: string } | null;
  lines: WasteLine[];
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
};

const REASON_LABELS: Record<string, string> = {
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
  THEFT: 'Theft',
  SPOILED: 'Spoiled',
  SAMPLE: 'Sample',
  OTHER: 'Other',
};

export default function WasteDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  // Fetch waste
  const { data: waste, isLoading } = useQuery({
    queryKey: ['inventory-waste', id],
    queryFn: async () => {
      const response = await apiClient.get<InventoryWaste>(`/inventory/waste/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/waste/${id}/post`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-waste', id] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/waste/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-waste', id] });
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

  if (!waste) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Waste document not found</div>
        </div>
      </AppShell>
    );
  }

  // Calculate totals
  const totalQty = waste.lines.reduce((sum, line) => sum + parseFloat(line.qty), 0);
  const totalCost = waste.lines.reduce((sum, line) => {
    if (line.unitCost) {
      return sum + parseFloat(line.qty) * parseFloat(line.unitCost);
    }
    return sum;
  }, 0);

  return (
    <AppShell>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link href="/inventory/waste">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            <span>Waste {waste.wasteNumber}</span>
            <Badge variant={STATUS_COLORS[waste.status] || 'secondary'}>
              {waste.status}
            </Badge>
          </div>
        }
        subtitle={`Created ${new Date(waste.createdAt).toLocaleString()}`}
        actions={
          <div className="flex gap-2">
            {isL3OrAbove && waste.status === 'DRAFT' && (
              <Button
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                {postMutation.isPending ? 'Posting...' : 'Post Waste'}
              </Button>
            )}
            {isL4OrAbove && waste.status === 'DRAFT' && (
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
        {/* Waste Info */}
        <Card>
          <CardHeader>
            <CardTitle>Waste Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Branch</div>
                <div className="font-medium">{waste.branch.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Reason</div>
                <Badge variant="outline" className="mt-1">
                  {REASON_LABELS[waste.reason] || waste.reason}
                </Badge>
              </div>
            </div>
            {waste.notes && (
              <div>
                <div className="text-sm text-muted-foreground">Notes</div>
                <div>{waste.notes}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Created By</div>
                <div>{waste.createdBy.firstName} {waste.createdBy.lastName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created At</div>
                <div>{new Date(waste.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posting Info */}
        <Card>
          <CardHeader>
            <CardTitle>Posting Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Posted At</div>
                <div>{waste.postedAt ? new Date(waste.postedAt).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Posted By</div>
                <div>
                  {waste.postedBy
                    ? `${waste.postedBy.firstName} ${waste.postedBy.lastName}`
                    : '-'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Total Quantity</div>
                <div className="text-xl font-bold">{totalQty.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-xl font-bold">
                  {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lines */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Waste Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Unit Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Ext. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {waste.lines.map((line) => {
                  const qty = parseFloat(line.qty);
                  const unitCost = line.unitCost ? parseFloat(line.unitCost) : 0;
                  const extCost = qty * unitCost;

                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{line.item.name}</div>
                        {line.item.sku && (
                          <div className="text-sm text-muted-foreground font-mono">{line.item.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{line.location.code}</div>
                        <div className="text-muted-foreground">{line.location.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {line.reason ? (
                          <Badge variant="outline">{REASON_LABELS[line.reason] || line.reason}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{qty.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.unitCost ? `$${unitCost.toFixed(4)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {extCost > 0 ? `$${extCost.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-medium">Totals</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{totalQty.toFixed(4)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
