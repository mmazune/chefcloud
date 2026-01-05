/**
 * M11.1: Stock Adjustments Page
 * 
 * Provides UI for creating and managing stock adjustments.
 * Features:
 * - List pending and approved adjustments
 * - Create new adjustment with reason and quantity
 * - Approval workflow for pending adjustments
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { Plus, Search } from 'lucide-react';

interface StockAdjustment {
  id: string;
  reason: string;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  qtyDelta: number;
  createdAt: string;
  createdByName: string;
  approvedByName: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
}

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
}

const ADJUSTMENT_REASONS = [
  'RECEIVE',
  'SALE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT',
  'WASTE',
  'COUNT_VARIANCE',
  'DAMAGE',
  'THEFT',
  'OTHER',
] as const;

export default function AdjustmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formItemId, setFormItemId] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formQtyDelta, setFormQtyDelta] = useState('');
  const [formReason, setFormReason] = useState<string>('ADJUSTMENT');
  const [formNotes, setFormNotes] = useState('');

  // Fetch adjustments
  const { data: adjustments, isLoading } = useQuery({
    queryKey: ['stock-adjustments', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await apiClient.get<{ adjustments: StockAdjustment[]; total: number }>(
        '/inventory/foundation/adjustments',
        { params }
      );
      return response.data.adjustments;
    },
  });

  // Fetch items for dropdown
  const { data: items } = useQuery({
    queryKey: ['inventory-items-list'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryItem[]>('/inventory/items');
      return response.data;
    },
  });

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>('/inventory/foundation/locations');
      return response.data;
    },
  });

  // Create adjustment mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/inventory/foundation/adjustments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-on-hand'] });
      handleCloseDialog();
    },
  });

  // Approve adjustment mutation
  const approveMutation = useMutation({
    mutationFn: async (adjustmentId: string) => {
      const response = await apiClient.post(
        `/inventory/foundation/adjustments/${adjustmentId}/approve`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-on-hand'] });
    },
  });

  const handleOpenCreate = () => {
    setFormItemId('');
    setFormLocationId('');
    setFormQtyDelta('');
    setFormReason('ADJUSTMENT');
    setFormNotes('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      itemId: formItemId,
      locationId: formLocationId,
      qtyDelta: parseFloat(formQtyDelta),
      reason: formReason,
      notes: formNotes || undefined,
      autoApprove: true, // Auto-approve for now; in production, could be role-based
    });
  };

  // Filter adjustments
  const filteredAdjustments = React.useMemo(() => {
    if (!adjustments) return [];
    if (!search) return adjustments;

    const searchLower = search.toLowerCase();
    return adjustments.filter(
      (adj) =>
        adj.itemName?.toLowerCase().includes(searchLower) ||
        adj.locationName?.toLowerCase().includes(searchLower) ||
        adj.reason.toLowerCase().includes(searchLower)
    );
  }, [adjustments, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const columns = [
    {
      header: 'Date',
      accessor: (row: StockAdjustment) =>
        new Date(row.createdAt).toLocaleDateString(),
    },
    {
      header: 'Item',
      accessor: (row: StockAdjustment) => row.itemName || 'N/A',
    },
    {
      header: 'Location',
      accessor: (row: StockAdjustment) => row.locationName || 'N/A',
    },
    {
      header: 'Qty Delta',
      accessor: (row: StockAdjustment) => (
        <span
          className={`font-mono ${
            row.qtyDelta >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {row.qtyDelta >= 0 ? '+' : ''}
          {row.qtyDelta}
        </span>
      ),
    },
    {
      header: 'Reason',
      accessor: (row: StockAdjustment) => (
        <Badge variant="outline">{row.reason}</Badge>
      ),
    },
    {
      header: 'Status',
      accessor: (row: StockAdjustment) => getStatusBadge(row.status),
    },
    {
      header: 'Created By',
      accessor: (row: StockAdjustment) => row.createdByName || '—',
    },
    {
      header: 'Actions',
      accessor: (row: StockAdjustment) =>
        row.status === 'PENDING' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => approveMutation.mutate(row.id)}
            disabled={approveMutation.isPending}
            data-testid={`approve-btn-${row.id}`}
          >
            Approve
          </Button>
        ) : null,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Stock Adjustments"
        subtitle="Manage inventory adjustments and corrections"
        actions={
          <Button onClick={handleOpenCreate} data-testid="create-adjustment-btn">
            <Plus className="h-4 w-4 mr-2" />
            New Adjustment
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search adjustments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="adjustment-search-input"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              data-testid="status-filter-select"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </div>
        </Card>

        {/* Adjustments Table */}
        <Card>
          <DataTable
            columns={columns}
            data={filteredAdjustments}
            emptyMessage="No adjustments found"
          />
        </Card>

        {/* Create Dialog */}
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">Create Stock Adjustment</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="item">Item</Label>
                    <Select
                      value={formItemId}
                      onValueChange={setFormItemId}
                      data-testid="adjustment-item-select"
                    >
                      <option value="">Select item...</option>
                      {items?.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.sku ? `(${item.sku})` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Select
                      value={formLocationId}
                      onValueChange={setFormLocationId}
                      data-testid="adjustment-location-select"
                    >
                      <option value="">Select location...</option>
                      {locations?.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="qtyDelta">Quantity Change</Label>
                    <Input
                      id="qtyDelta"
                      type="number"
                      step="0.01"
                      value={formQtyDelta}
                      onChange={(e) => setFormQtyDelta(e.target.value)}
                      placeholder="e.g., -5 or +10"
                      required
                      data-testid="adjustment-qty-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use positive for additions, negative for reductions
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Select
                      value={formReason}
                      onValueChange={setFormReason}
                      data-testid="adjustment-reason-select"
                    >
                      {ADJUSTMENT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={3}
                      data-testid="adjustment-notes-input"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || !formItemId || !formLocationId}
                      data-testid="adjustment-submit-btn"
                    >
                      Create Adjustment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}
