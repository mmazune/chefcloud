/**
 * M11.2: Purchase Orders List Page
 * 
 * Features:
 * - List POs with status filters
 * - Create PO with lines (item, UOM, qty, cost)
 * - Submit for approval (L3+)
 * - Approve/reject (L4+)
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Search, Eye, Check, X, Send } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  vendor: { id: string; name: string };
  branchId: string;
  branch: { id: string; name: string };
  expectedAt: string | null;
  totalAmount: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
}

interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  APPROVED: 'default',
  PARTIALLY_RECEIVED: 'default',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
};

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formVendorId, setFormVendorId] = useState('');
  const [formExpectedAt, setFormExpectedAt] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<{
    itemId: string;
    qtyOrderedInput: string;
    inputUomId: string;
    unitCost: string;
  }[]>([{ itemId: '', qtyOrderedInput: '', inputUomId: '', unitCost: '' }]);

  // Fetch POs
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await apiClient.get<PurchaseOrder[]>(`/inventory/procurement/purchase-orders?${params}`);
      return response.data;
    },
  });

  // Fetch vendors
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiClient.get<Vendor[]>('/vendors');
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Fetch items
  const { data: items } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryItem[]>('/inventory/foundation/items');
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Fetch UOMs
  const { data: uoms } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => {
      const response = await apiClient.get<UnitOfMeasure[]>('/inventory/foundation/uom');
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      vendorId: string;
      expectedAt?: string;
      notes?: string;
      lines: { itemId: string; qtyOrderedInput: number; inputUomId: string; unitCost: number }[];
    }) => {
      const response = await apiClient.post('/inventory/procurement/purchase-orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      handleCloseDialog();
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/procurement/purchase-orders/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormVendorId('');
    setFormExpectedAt('');
    setFormNotes('');
    setFormLines([{ itemId: '', qtyOrderedInput: '', inputUomId: '', unitCost: '' }]);
  };

  const handleAddLine = () => {
    setFormLines([...formLines, { itemId: '', qtyOrderedInput: '', inputUomId: '', unitCost: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (formLines.length > 1) {
      setFormLines(formLines.filter((_, i) => i !== index));
    }
  };

  const handleUpdateLine = (index: number, field: string, value: string) => {
    const updated = [...formLines];
    (updated[index] as Record<string, string>)[field] = value;
    setFormLines(updated);
  };

  const handleCreate = () => {
    if (!formVendorId) {
      alert('Please select a vendor');
      return;
    }

    const validLines = formLines.filter(
      (line) => line.itemId && line.inputUomId && parseFloat(line.qtyOrderedInput) > 0
    );
    if (validLines.length === 0) {
      alert('Please add at least one valid line');
      return;
    }

    createMutation.mutate({
      vendorId: formVendorId,
      expectedAt: formExpectedAt || undefined,
      notes: formNotes || undefined,
      lines: validLines.map((line) => ({
        itemId: line.itemId,
        qtyOrderedInput: parseFloat(line.qtyOrderedInput) || 0,
        inputUomId: line.inputUomId,
        unitCost: parseFloat(line.unitCost) || 0,
      })),
    });
  };

  // Filter POs
  const filteredPOs = (purchaseOrders ?? []).filter(
    (po) =>
      po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      po.vendor?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="Purchase Orders" subtitle="Manage purchase orders for inventory procurement" />

      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO # or vendor..."
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
              <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {isL3OrAbove && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create PO
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filteredPOs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No purchase orders found</div>
        ) : (
          <div className="overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">PO #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Expected</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {filteredPOs.map((po) => (
                  <tr key={po.id}>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/purchase-orders/${po.id}`} className="text-blue-600 hover:underline">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{po.vendor?.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[po.status] || 'secondary'}>{po.status}</Badge>
                    </td>
                    <td className="px-4 py-3">${parseFloat(po.totalAmount || '0').toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/inventory/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {po.status === 'DRAFT' && isL3OrAbove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => submitMutation.mutate(po.id)}
                            disabled={submitMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {po.status === 'PENDING_APPROVAL' && isL4OrAbove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => approveMutation.mutate(po.id)}
                            disabled={approveMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {['DRAFT', 'PENDING_APPROVAL'].includes(po.status) && isL4OrAbove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Cancel this PO?')) cancelMutation.mutate(po.id);
                            }}
                            disabled={cancelMutation.isPending}
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

      {/* Create PO Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor</Label>
                <Select value={formVendorId} onValueChange={setFormVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(vendors ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={formExpectedAt}
                  onChange={(e) => setFormExpectedAt(e.target.value)}
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
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Order Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>
              <div className="border rounded">
                <div className="grid grid-cols-5 gap-2 p-2 bg-muted font-medium text-sm">
                  <span>Item</span>
                  <span>UOM</span>
                  <span>Quantity</span>
                  <span>Unit Cost</span>
                  <span></span>
                </div>
                {formLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 p-2 border-t items-center">
                    <Select value={line.itemId} onValueChange={(v) => handleUpdateLine(idx, 'itemId', v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {(items ?? []).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.sku ? `${item.sku} - ` : ''}{item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={line.inputUomId} onValueChange={(v) => handleUpdateLine(idx, 'inputUomId', v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="UOM" />
                      </SelectTrigger>
                      <SelectContent>
                        {(uoms ?? []).map((uom) => (
                          <SelectItem key={uom.id} value={uom.id}>
                            {uom.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="h-8"
                      placeholder="Qty"
                      value={line.qtyOrderedInput}
                      onChange={(e) => handleUpdateLine(idx, 'qtyOrderedInput', e.target.value)}
                    />
                    <Input
                      type="number"
                      className="h-8"
                      placeholder="Cost"
                      value={line.unitCost}
                      onChange={(e) => handleUpdateLine(idx, 'unitCost', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={formLines.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
