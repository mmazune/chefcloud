/**
 * M11.2: Receipts List Page
 * 
 * Features:
 * - List receipts with filters: status
 * - Create receipt flow (select PO, enter lines)
 * - Post receipt action (L3+)
 * - Void receipt action (L4+)
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { Plus, Search, Eye, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface Receipt {
  id: string;
  receiptNumber: string;
  status: string;
  purchaseOrderId: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
    vendor: { id: string; name: string };
  };
  receivedAt: string;
  postedAt: string | null;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  vendor: { id: string; name: string };
  lines: {
    id: string;
    itemId: string;
    item: { id: string; sku: string | null; name: string };
    inputUom: { id: string; code: string };
    qtyOrderedBase: string;
    qtyReceivedBase: string;
    unitCost: string;
  }[];
}

interface Location {
  id: string;
  code: string;
  name: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  POSTED: 'default',
  VOID: 'destructive',
};

export default function ReceiptsPage() {
  const router = useRouter();
  const { poId: queryPoId } = router.query;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string>('');

  // Form state
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<{
    itemId: string;
    locationId: string;
    poLineId: string;
    qtyReceivedInput: string;
    inputUomId: string;
  }[]>([]);

  // Open dialog if poId is in URL
  useEffect(() => {
    if (queryPoId && typeof queryPoId === 'string') {
      setSelectedPoId(queryPoId);
      setDialogOpen(true);
    }
  }, [queryPoId]);

  // Fetch receipts
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receipts', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await apiClient.get<Receipt[]>(`/inventory/procurement/receipts?${params}`);
      return response.data;
    },
  });

  // Fetch receivable POs
  const { data: receivablePOs } = useQuery({
    queryKey: ['receivable-pos'],
    queryFn: async () => {
      const response = await apiClient.get<PurchaseOrder[]>(
        '/inventory/procurement/purchase-orders?status=APPROVED&status=PARTIALLY_RECEIVED'
      );
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await apiClient.get<Location[]>('/inventory/foundation/locations');
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      purchaseOrderId: string;
      referenceNumber?: string;
      notes?: string;
      lines: { itemId: string; locationId: string; poLineId?: string; qtyReceivedInput: number; inputUomId: string }[];
    }) => {
      const response = await apiClient.post('/inventory/procurement/receipts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      handleCloseDialog();
    },
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await apiClient.post(`/inventory/procurement/receipts/${receiptId}/post`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await apiClient.post(`/inventory/procurement/receipts/${receiptId}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });

  const selectedPO = receivablePOs?.find((p) => p.id === selectedPoId);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPoId('');
    setFormReferenceNumber('');
    setFormNotes('');
    setFormLines([]);
    if (queryPoId) {
      router.replace('/inventory/receipts', undefined, { shallow: true });
    }
  };

  const handleSelectPO = (poId: string) => {
    setSelectedPoId(poId);
    const po = receivablePOs?.find((p) => p.id === poId);
    if (po) {
      setFormLines(
        po.lines.map((line) => ({
          itemId: line.itemId,
          locationId: locations?.[0]?.id || '',
          poLineId: line.id,
          qtyReceivedInput: '',
          inputUomId: line.inputUom.id,
        }))
      );
    }
  };

  const handleUpdateLine = (index: number, field: string, value: string) => {
    const updated = [...formLines];
    (updated[index] as Record<string, string>)[field] = value;
    setFormLines(updated);
  };

  const handleCreate = () => {
    if (!selectedPoId || formLines.length === 0) {
      alert('Please select a PO and add lines');
      return;
    }

    const validLines = formLines.filter((line) => parseFloat(line.qtyReceivedInput) > 0);
    if (validLines.length === 0) {
      alert('Please enter quantity for at least one line');
      return;
    }

    createMutation.mutate({
      purchaseOrderId: selectedPoId,
      referenceNumber: formReferenceNumber || undefined,
      notes: formNotes || undefined,
      lines: validLines.map((line) => ({
        itemId: line.itemId,
        locationId: line.locationId,
        poLineId: line.poLineId,
        qtyReceivedInput: parseFloat(line.qtyReceivedInput) || 0,
        inputUomId: line.inputUomId,
      })),
    });
  };

  // Filter receipts
  const filteredReceipts = (receipts ?? []).filter(
    (r) =>
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.purchaseOrder?.vendor?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="Goods Receipts" subtitle="Receive goods against purchase orders" />

      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search receipt # or vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="POSTED">Posted</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
          {isL3OrAbove && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Receipt
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No receipts found</div>
        ) : (
          <div className="overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Receipt #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">PO #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Received</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Posted</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/receipts/${receipt.id}`} className="text-blue-600 hover:underline">
                        {receipt.receiptNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventory/purchase-orders/${receipt.purchaseOrderId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {receipt.purchaseOrder?.poNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{receipt.purchaseOrder?.vendor?.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[receipt.status] || 'secondary'}>{receipt.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{new Date(receipt.receivedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {receipt.postedAt ? new Date(receipt.postedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/inventory/receipts/${receipt.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {receipt.status === 'DRAFT' && isL3OrAbove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => postMutation.mutate(receipt.id)}
                            disabled={postMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {receipt.status === 'POSTED' && isL4OrAbove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Void this receipt?')) voidMutation.mutate(receipt.id);
                            }}
                            disabled={voidMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Receipt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Purchase Order</Label>
                <Select value={selectedPoId} onValueChange={handleSelectPO}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO" />
                  </SelectTrigger>
                  <SelectContent>
                    {(receivablePOs ?? []).map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber} - {po.vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference Number</Label>
                <Input
                  value={formReferenceNumber}
                  onChange={(e) => setFormReferenceNumber(e.target.value)}
                  placeholder="Optional (e.g., delivery note #)"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            {/* Lines */}
            {selectedPO && (
              <div>
                <Label className="mb-2 block">Receipt Lines</Label>
                <div className="border rounded">
                  <div className="grid grid-cols-5 gap-2 p-2 bg-muted font-medium text-sm">
                    <span>Item</span>
                    <span>Ordered (Base)</span>
                    <span>Already Received</span>
                    <span>Receiving Now</span>
                    <span>Location</span>
                  </div>
                  {formLines.map((line, idx) => {
                    const poLine = selectedPO.lines.find((l) => l.id === line.poLineId);
                    return (
                      <div key={idx} className="grid grid-cols-5 gap-2 p-2 border-t items-center text-sm">
                        <span>{poLine?.item?.name || 'Unknown'}</span>
                        <span>{parseFloat(poLine?.qtyOrderedBase || '0').toLocaleString()}</span>
                        <span>{parseFloat(poLine?.qtyReceivedBase || '0').toLocaleString()}</span>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={line.qtyReceivedInput}
                          onChange={(e) => handleUpdateLine(idx, 'qtyReceivedInput', e.target.value)}
                          className="h-8"
                        />
                        <Select value={line.locationId} onValueChange={(v) => handleUpdateLine(idx, 'locationId', v)}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {(locations ?? []).map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !selectedPoId}>
              {createMutation.isPending ? 'Creating...' : 'Create Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
