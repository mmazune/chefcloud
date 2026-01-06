/**
 * M11.3: Inventory Transfers List Page
 * 
 * Features:
 * - List transfers with status filters
 * - Create transfer with lines (item, from/to location, qty)
 * - Ship/Receive/Void actions based on status and RBAC
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
import { Plus, Search, Eye, Send, Package, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

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
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
}

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  branchId: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  IN_TRANSIT: 'outline',
  RECEIVED: 'default',
  VOID: 'destructive',
};

export default function InventoryTransfersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formFromBranchId, setFormFromBranchId] = useState('');
  const [formToBranchId, setFormToBranchId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<{
    itemId: string;
    fromLocationId: string;
    toLocationId: string;
    qtyShipped: string;
  }[]>([{ itemId: '', fromLocationId: '', toLocationId: '', qtyShipped: '' }]);

  // Fetch transfers
  const { data: transfers, isLoading } = useQuery({
    queryKey: ['inventory-transfers', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await apiClient.get<InventoryTransfer[]>(`/inventory/transfers?${params}`);
      return response.data;
    },
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<Branch[]>('/branches');
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

  // Fetch locations for from branch
  const { data: fromLocations } = useQuery({
    queryKey: ['inventory-locations', formFromBranchId],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>(`/inventory/foundation/locations?branchId=${formFromBranchId}`);
      return response.data;
    },
    enabled: !!formFromBranchId && dialogOpen,
  });

  // Fetch locations for to branch
  const { data: toLocations } = useQuery({
    queryKey: ['inventory-locations', formToBranchId],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>(`/inventory/foundation/locations?branchId=${formToBranchId}`);
      return response.data;
    },
    enabled: !!formToBranchId && dialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      fromBranchId: string;
      toBranchId: string;
      notes?: string;
      lines: { itemId: string; fromLocationId: string; toLocationId: string; qtyShipped: number }[];
    }) => {
      const response = await apiClient.post('/inventory/transfers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      handleCloseDialog();
    },
  });

  // Ship mutation
  const shipMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/transfers/${id}/ship`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
  });

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/transfers/${id}/receive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/transfers/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormFromBranchId('');
    setFormToBranchId('');
    setFormNotes('');
    setFormLines([{ itemId: '', fromLocationId: '', toLocationId: '', qtyShipped: '' }]);
  };

  const handleAddLine = () => {
    setFormLines([...formLines, { itemId: '', fromLocationId: '', toLocationId: '', qtyShipped: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof typeof formLines[0], value: string) => {
    const newLines = [...formLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormLines(newLines);
  };

  const handleSubmit = () => {
    if (!formFromBranchId || !formToBranchId || formLines.length === 0) return;

    const validLines = formLines.filter(
      line => line.itemId && line.fromLocationId && line.toLocationId && parseFloat(line.qtyShipped) > 0
    );

    if (validLines.length === 0) return;

    createMutation.mutate({
      fromBranchId: formFromBranchId,
      toBranchId: formToBranchId,
      notes: formNotes || undefined,
      lines: validLines.map(line => ({
        itemId: line.itemId,
        fromLocationId: line.fromLocationId,
        toLocationId: line.toLocationId,
        qtyShipped: parseFloat(line.qtyShipped),
      })),
    });
  };

  const filteredTransfers = transfers?.filter(t =>
    !search ||
    t.transferNumber.toLowerCase().includes(search.toLowerCase()) ||
    t.fromBranch.name.toLowerCase().includes(search.toLowerCase()) ||
    t.toBranch.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="Inventory Transfers"
        subtitle="Manage inter-branch and intra-branch stock transfers"
        actions={
          isL3OrAbove && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Transfer
            </Button>
          )
        }
      />

      <Card className="p-6">
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transfers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !filteredTransfers?.length ? (
          <div className="text-center py-8 text-muted-foreground">No transfers found</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Transfer #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">From Branch</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">To Branch</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Shipped At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Received At</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono">{transfer.transferNumber}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[transfer.status] || 'secondary'}>
                        {transfer.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{transfer.fromBranch.name}</td>
                    <td className="px-4 py-3 text-sm">{transfer.toBranch.name}</td>
                    <td className="px-4 py-3 text-sm">
                      {transfer.shippedAt ? new Date(transfer.shippedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {transfer.receivedAt ? new Date(transfer.receivedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/inventory/transfers/${transfer.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isL3OrAbove && transfer.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => shipMutation.mutate(transfer.id)}
                            disabled={shipMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Ship
                          </Button>
                        )}
                        {isL3OrAbove && transfer.status === 'IN_TRANSIT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => receiveMutation.mutate(transfer.id)}
                            disabled={receiveMutation.isPending}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Receive
                          </Button>
                        )}
                        {isL4OrAbove && transfer.status === 'DRAFT' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => voidMutation.mutate(transfer.id)}
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Transfer</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Branch</Label>
                <Select value={formFromBranchId} onValueChange={setFormFromBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To Branch</Label>
                <Select value={formToBranchId} onValueChange={setFormToBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Transfer notes..."
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {formLines.map((line, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 items-end">
                    <div>
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={line.itemId}
                        onValueChange={(v) => handleLineChange(index, 'itemId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items?.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.sku ? `${item.sku} - ` : ''}{item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">From Location</Label>
                      <Select
                        value={line.fromLocationId}
                        onValueChange={(v) => handleLineChange(index, 'fromLocationId', v)}
                        disabled={!formFromBranchId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Location" />
                        </SelectTrigger>
                        <SelectContent>
                          {fromLocations?.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.code} - {loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">To Location</Label>
                      <Select
                        value={line.toLocationId}
                        onValueChange={(v) => handleLineChange(index, 'toLocationId', v)}
                        disabled={!formToBranchId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Location" />
                        </SelectTrigger>
                        <SelectContent>
                          {toLocations?.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.code} - {loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={line.qtyShipped}
                        onChange={(e) => handleLineChange(index, 'qtyShipped', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLine(index)}
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
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !formFromBranchId || !formToBranchId}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
