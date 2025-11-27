import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { apiClient } from '@/lib/api';
import { Search, AlertTriangle, CheckCircle } from 'lucide-react';

// M24-S2: Inventory Management Page

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  category: string | null;
  reorderLevel: number;
  isActive: boolean;
  currentStock?: number;
  onHand?: number;
}

interface LowStockAlert {
  itemId: string;
  itemName: string;
  itemSku: string;
  category: string;
  unit: string;
  currentQty: number;
  minQuantity: number | null;
  minDaysOfCover: number | null;
  estimatedDaysRemaining: number | null;
  alertLevel: 'LOW' | 'CRITICAL';
  reorderLevel: number;
  reorderQty: number;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Fetch inventory items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryItem[]>('/inventory/items');
      return response.data;
    },
  });

  // Fetch stock levels
  const { data: stockLevels } = useQuery({
    queryKey: ['inventory-levels'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/inventory/levels');
      return response.data;
    },
  });

  // Fetch low-stock alerts
  const { data: lowStockAlerts } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<LowStockAlert[]>('/inventory/low-stock/alerts', {
          params: { branchId: 'default' },
        });
        return response.data;
      } catch (error) {
        console.error('Failed to fetch low-stock alerts:', error);
        return [];
      }
    },
  });

  // Update item mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/inventory/items/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-levels'] });
      setDrawerOpen(false);
      setEditingItem(null);
    },
  });

  // Merge items with stock levels and low-stock info
  const enrichedItems = React.useMemo(() => {
    if (!items) return [];

    const stockMap = new Map<string, number>();
    if (stockLevels) {
      stockLevels.forEach((level: any) => {
        stockMap.set(level.itemId, level.onHand || 0);
      });
    }

    const alertMap = new Map<string, LowStockAlert>();
    if (lowStockAlerts) {
      lowStockAlerts.forEach((alert) => {
        alertMap.set(alert.itemId, alert);
      });
    }

    return items.map((item) => ({
      ...item,
      currentStock: stockMap.get(item.id) || 0,
      lowStockAlert: alertMap.get(item.id),
    }));
  }, [items, stockLevels, lowStockAlerts]);

  // Filter items
  const filteredItems = React.useMemo(() => {
    let result = enrichedItems;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower) ||
          item.category?.toLowerCase().includes(searchLower)
      );
    }

    if (showLowStockOnly) {
      result = result.filter((item) => item.lowStockAlert);
    }

    return result;
  }, [enrichedItems, search, showLowStockOnly]);

  // Low-stock summary stats
  const lowStockStats = React.useMemo(() => {
    if (!lowStockAlerts) return { total: 0, critical: 0 };
    return {
      total: lowStockAlerts.length,
      critical: lowStockAlerts.filter((a) => a.alertLevel === 'CRITICAL').length,
    };
  }, [lowStockAlerts]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setDrawerOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    }
  };

  const columns = [
    {
      header: 'Item Name',
      accessor: (row: any) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.sku && <div className="text-sm text-gray-500">SKU: {row.sku}</div>}
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (row: any) => row.category || '—',
    },
    {
      header: 'Current Stock',
      accessor: (row: any) => (
        <div>
          {row.currentStock} {row.unit}
        </div>
      ),
    },
    {
      header: 'Reorder Level',
      accessor: (row: any) => (
        <div>
          {row.reorderLevel} {row.unit}
        </div>
      ),
    },
    {
      header: 'Stock Status',
      accessor: (row: any) => {
        if (!row.lowStockAlert) {
          return (
            <Badge variant="success" className="flex items-center gap-1 w-fit">
              <CheckCircle className="h-3 w-3" />
              OK
            </Badge>
          );
        }
        return (
          <Badge
            variant={row.lowStockAlert.alertLevel === 'CRITICAL' ? 'destructive' : 'warning'}
            className="flex items-center gap-1 w-fit"
          >
            <AlertTriangle className="h-3 w-3" />
            {row.lowStockAlert.alertLevel}
          </Badge>
        );
      },
    },
    {
      header: 'Active',
      accessor: (row: any) => (
        <Badge variant={row.isActive ? 'success' : 'destructive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inventory"
        subtitle="Stock levels, low-stock alerts, and basic item settings"
      />

      <div className="space-y-6">
        {/* Low-stock summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{enrichedItems.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-orange-600">{lowStockStats.total}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Items</p>
                <p className="text-2xl font-bold text-red-600">{lowStockStats.critical}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </Card>
        </div>

        {/* Most urgent low-stock items */}
        {lowStockAlerts && lowStockAlerts.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Top 5 Most Urgent Items</h3>
            <div className="space-y-2">
              {lowStockAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.itemId}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="font-medium">{alert.itemName}</div>
                    <div className="text-sm text-gray-500">
                      Current: {alert.currentQty} {alert.unit} | Min:{' '}
                      {alert.minQuantity || alert.reorderLevel} {alert.unit}
                    </div>
                  </div>
                  <Badge variant={alert.alertLevel === 'CRITICAL' ? 'destructive' : 'warning'}>
                    {alert.alertLevel}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, SKU, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={!showLowStockOnly ? 'default' : 'outline'}
              onClick={() => setShowLowStockOnly(false)}
            >
              All Items
            </Button>
            <Button
              variant={showLowStockOnly ? 'default' : 'outline'}
              onClick={() => setShowLowStockOnly(true)}
            >
              Low Stock Only
            </Button>
          </div>
        </div>

        {/* Inventory table */}
        {itemsLoading ? (
          <div className="text-center py-8">Loading inventory data...</div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">
              {search || showLowStockOnly
                ? 'No items match your filters.'
                : 'No inventory items found.'}
            </p>
          </Card>
        ) : (
          <DataTable columns={columns} data={filteredItems} />
        )}
      </div>

      {/* Edit item drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingItem(null);
        }}
        title="Edit Inventory Item"
        size="md"
      >
        {editingItem && (
          <EditItemForm
            item={editingItem}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDrawerOpen(false);
              setEditingItem(null);
            }}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </Drawer>

      {/* Backend connection indicator */}
      <div className="mt-8 text-center text-sm text-gray-500">
        Backend: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
      </div>
    </AppShell>
  );
}

// Edit form component
interface EditItemFormProps {
  item: InventoryItem;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function EditItemForm({ item, onSubmit, onCancel, isSubmitting }: EditItemFormProps) {
  const [formData, setFormData] = React.useState({
    name: item.name,
    isActive: item.isActive,
    reorderLevel: item.reorderLevel,
    category: item.category || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      isActive: formData.isActive,
      reorderLevel: Number(formData.reorderLevel),
      category: formData.category || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Item Name <span className="text-red-500">*</span>
        </label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <Input
          type="text"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="e.g., Vegetables, Beverages, etc."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Reorder Level ({item.unit})
        </label>
        <Input
          type="number"
          step="0.001"
          min="0"
          value={formData.reorderLevel}
          onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
        />
        <p className="text-sm text-gray-500 mt-1">Alert when stock falls below this level</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="h-4 w-4"
        />
        <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
          Item is active
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
