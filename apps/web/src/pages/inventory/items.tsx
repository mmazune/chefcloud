/**
 * M11.1: Inventory Items Page
 * 
 * Dedicated page for managing inventory items with CRUD operations.
 * Features:
 * - List all items with SKU, category, UOM
 * - Create/edit item dialogs
 * - Toggle active status
 * - SKU uniqueness enforcement per org
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
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { Plus, Search, Edit } from 'lucide-react';

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  category: string | null;
  reorderLevel: number;
  reorderQty: number;
  isActive: boolean;
  createdAt: string;
}

export default function InventoryItemsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form state
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formReorderLevel, setFormReorderLevel] = useState('0');
  const [formReorderQty, setFormReorderQty] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch items
  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryItem[]>('/inventory/items');
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/inventory/items', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      // Handle SKU uniqueness error
      if (error.response?.data?.message?.includes('SKU')) {
        alert('SKU already exists for this organization');
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/inventory/items/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      handleCloseDialog();
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormSku('');
    setFormName('');
    setFormUnit('');
    setFormCategory('');
    setFormReorderLevel('0');
    setFormReorderQty('0');
    setFormIsActive(true);
    setDialogOpen(true);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormSku(item.sku || '');
    setFormName(item.name);
    setFormUnit(item.unit);
    setFormCategory(item.category || '');
    setFormReorderLevel(String(item.reorderLevel));
    setFormReorderQty(String(item.reorderQty));
    setFormIsActive(item.isActive);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      sku: formSku || undefined,
      name: formName,
      unit: formUnit,
      category: formCategory || undefined,
      reorderLevel: parseFloat(formReorderLevel) || 0,
      reorderQty: parseFloat(formReorderQty) || 0,
      isActive: formIsActive,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter items
  const filteredItems = React.useMemo(() => {
    if (!items) return [];

    let result = items;

    if (!showInactive) {
      result = result.filter((item) => item.isActive);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower) ||
          item.category?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [items, search, showInactive]);

  // Stats
  const stats = React.useMemo(() => {
    if (!items) return { total: 0, active: 0, inactive: 0 };
    return {
      total: items.length,
      active: items.filter((i) => i.isActive).length,
      inactive: items.filter((i) => !i.isActive).length,
    };
  }, [items]);

  const columns = [
    {
      header: 'SKU',
      accessor: (row: InventoryItem) => (
        <span className="font-mono text-sm">{row.sku || '—'}</span>
      ),
    },
    {
      header: 'Name',
      accessor: (row: InventoryItem) => row.name,
    },
    {
      header: 'Unit',
      accessor: (row: InventoryItem) => row.unit,
    },
    {
      header: 'Category',
      accessor: (row: InventoryItem) => row.category || '—',
    },
    {
      header: 'Reorder Level',
      accessor: (row: InventoryItem) => (
        <span className="font-mono">{row.reorderLevel}</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: InventoryItem) => (
        <Badge variant={row.isActive ? 'success' : 'destructive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: InventoryItem) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(row)}
          data-testid={`edit-item-btn-${row.id}`}
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inventory Items"
        subtitle="Manage your inventory catalog"
        actions={
          <Button onClick={handleOpenCreate} data-testid="create-item-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Inactive</div>
            <div className="text-2xl font-bold text-gray-400">{stats.inactive}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="item-search-input"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                data-testid="show-inactive-checkbox"
              />
              <span className="text-sm">Show inactive</span>
            </label>
          </div>
        </Card>

        {/* Items Table */}
        <Card>
          <DataTable
            columns={columns}
            data={filteredItems}
            emptyMessage="No items found"
          />
        </Card>

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold mb-4">
                  {editingItem ? 'Edit Item' : 'Create Item'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="sku">SKU (optional)</Label>
                    <Input
                      id="sku"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      placeholder="e.g., BEEF-001"
                      data-testid="item-sku-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be unique within your organization
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Ground Beef"
                      required
                      data-testid="item-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit *</Label>
                    <Input
                      id="unit"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="e.g., kg, liter, piece"
                      required
                      data-testid="item-unit-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category (optional)</Label>
                    <Input
                      id="category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g., Meat, Produce"
                      data-testid="item-category-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="reorderLevel">Reorder Level</Label>
                      <Input
                        id="reorderLevel"
                        type="number"
                        step="0.01"
                        value={formReorderLevel}
                        onChange={(e) => setFormReorderLevel(e.target.value)}
                        data-testid="item-reorder-level-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reorderQty">Reorder Qty</Label>
                      <Input
                        id="reorderQty"
                        type="number"
                        step="0.01"
                        value={formReorderQty}
                        onChange={(e) => setFormReorderQty(e.target.value)}
                        data-testid="item-reorder-qty-input"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      data-testid="item-active-checkbox"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="item-submit-btn"
                    >
                      {editingItem ? 'Save' : 'Create'}
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
