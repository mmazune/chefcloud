/**
 * M11.3: Inventory Waste List Page
 * 
 * Features:
 * - List waste documents with status/reason filters
 * - Create waste with lines (item, location, qty)
 * - Post/Void actions based on status and RBAC
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
import { Plus, Search, Eye, Check, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';

interface InventoryWaste {
  id: string;
  wasteNumber: string;
  status: string;
  reason: string;
  branchId: string;
  branch: { id: string; name: string };
  postedAt: string | null;
  createdAt: string;
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

export default function InventoryWastePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isL3OrAbove = user ? hasRoleLevel(user, RoleLevel.L3) : false;
  const isL4OrAbove = user ? hasRoleLevel(user, RoleLevel.L4) : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formReason, setFormReason] = useState<string>('OTHER');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<{
    itemId: string;
    locationId: string;
    qty: string;
    unitCost: string;
    reason: string;
  }[]>([{ itemId: '', locationId: '', qty: '', unitCost: '', reason: '' }]);

  // Fetch waste records
  const { data: wasteRecords, isLoading } = useQuery({
    queryKey: ['inventory-waste', statusFilter, reasonFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (reasonFilter) params.append('reason', reasonFilter);
      const response = await apiClient.get<InventoryWaste[]>(`/inventory/waste?${params}`);
      return response.data;
    },
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

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>('/inventory/foundation/locations');
      return response.data;
    },
    enabled: dialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      reason: string;
      notes?: string;
      lines: { itemId: string; locationId: string; qty: number; unitCost?: number; reason?: string }[];
    }) => {
      const response = await apiClient.post('/inventory/waste', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-waste'] });
      handleCloseDialog();
    },
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/waste/${id}/post`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-waste'] });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/inventory/waste/${id}/void`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-waste'] });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormReason('OTHER');
    setFormNotes('');
    setFormLines([{ itemId: '', locationId: '', qty: '', unitCost: '', reason: '' }]);
  };

  const handleAddLine = () => {
    setFormLines([...formLines, { itemId: '', locationId: '', qty: '', unitCost: '', reason: '' }]);
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
    const validLines = formLines.filter(
      line => line.itemId && line.locationId && parseFloat(line.qty) > 0
    );

    if (validLines.length === 0) return;

    createMutation.mutate({
      reason: formReason,
      notes: formNotes || undefined,
      lines: validLines.map(line => ({
        itemId: line.itemId,
        locationId: line.locationId,
        qty: parseFloat(line.qty),
        unitCost: line.unitCost ? parseFloat(line.unitCost) : undefined,
        reason: line.reason || undefined,
      })),
    });
  };

  const filteredWaste = wasteRecords?.filter(w => 
    !search || 
    w.wasteNumber.toLowerCase().includes(search.toLowerCase()) ||
    w.branch.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="Inventory Waste"
        description="Document and track inventory losses"
        actions={
          isL3OrAbove && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Waste Document
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
              placeholder="Search waste documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="POSTED">Posted</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Reasons</SelectItem>
              <SelectItem value="DAMAGED">Damaged</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="THEFT">Theft</SelectItem>
              <SelectItem value="SPOILED">Spoiled</SelectItem>
              <SelectItem value="SAMPLE">Sample</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !filteredWaste?.length ? (
          <div className="text-center py-8 text-muted-foreground">No waste documents found</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Waste #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Branch</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Posted At</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Created At</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredWaste.map((waste) => (
                  <tr key={waste.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono">{waste.wasteNumber}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[waste.status] || 'secondary'}>
                        {waste.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{waste.branch.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline">{REASON_LABELS[waste.reason] || waste.reason}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {waste.postedAt ? new Date(waste.postedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(waste.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/inventory/waste/${waste.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isL3OrAbove && waste.status === 'DRAFT' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => postMutation.mutate(waste.id)}
                            disabled={postMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Post
                          </Button>
                        )}
                        {isL4OrAbove && waste.status === 'DRAFT' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => voidMutation.mutate(waste.id)}
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
            <DialogTitle>
              <Trash2 className="inline-block mr-2 h-5 w-5" />
              Create Waste Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Reason</Label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="THEFT">Theft</SelectItem>
                    <SelectItem value="SPOILED">Spoiled</SelectItem>
                    <SelectItem value="SAMPLE">Sample</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Waste notes..."
                />
              </div>
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
                  <div key={index} className="grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-2">
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={line.itemId}
                        onValueChange={(v) => handleLineChange(index, 'itemId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
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
                      <Label className="text-xs">Location</Label>
                      <Select
                        value={line.locationId}
                        onValueChange={(v) => handleLineChange(index, 'locationId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations?.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={line.qty}
                        onChange={(e) => handleLineChange(index, 'qty', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.unitCost}
                        onChange={(e) => handleLineChange(index, 'unitCost', e.target.value)}
                        placeholder="0.00"
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
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Waste Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
