/**
 * M11.6: Supplier Catalog Page
 * 
 * Manages supplier items mapping vendors to inventory items.
 * Features:
 * - List supplier items with vendor, item, UOM conversion
 * - Create/edit supplier item dialogs
 * - View price history in drawer
 * - Add new prices
 * - Toggle active/preferred status
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiClient } from '@/lib/api';
import { Plus, Search, Edit, History, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
}

interface SupplierItem {
  id: string;
  vendorSku: string;
  uomConversionFactorToBase: number;
  packSizeLabel: string | null;
  leadTimeDays: number;
  minOrderQtyVendorUom: number;
  isPreferred: boolean;
  isActive: boolean;
  vendor: Vendor;
  inventoryItem: InventoryItem;
  vendorUom?: { id: string; code: string; name: string };
}

interface SupplierPrice {
  id: string;
  unitPriceVendorUom: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: 'MANUAL' | 'RECEIPT_DERIVED';
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierItem | null>(null);
  const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
  const [selectedItemForPrices, setSelectedItemForPrices] = useState<SupplierItem | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  // Form state
  const [formVendorId, setFormVendorId] = useState('');
  const [formInventoryItemId, setFormInventoryItemId] = useState('');
  const [formVendorSku, setFormVendorSku] = useState('');
  const [formConversionFactor, setFormConversionFactor] = useState('1');
  const [formPackSizeLabel, setFormPackSizeLabel] = useState('');
  const [formLeadTimeDays, setFormLeadTimeDays] = useState('0');
  const [formMinOrderQty, setFormMinOrderQty] = useState('1');
  const [formIsPreferred, setFormIsPreferred] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Price form state
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');

  // Fetch supplier items
  const { data: items, isLoading } = useQuery({
    queryKey: ['supplier-items'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: SupplierItem[] }>('/inventory/suppliers/items');
      return response.data.data;
    },
  });

  // Fetch vendors for dropdown
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Vendor[] }>('/vendors');
      return response.data.data;
    },
  });

  // Fetch inventory items for dropdown
  const { data: inventoryItems } = useQuery({
    queryKey: ['inventory-items-simple'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryItem[]>('/inventory/items');
      return response.data;
    },
  });

  // Fetch price history for selected item
  const { data: priceHistory, isLoading: pricesLoading } = useQuery({
    queryKey: ['supplier-prices', selectedItemForPrices?.id],
    queryFn: async () => {
      if (!selectedItemForPrices) return [];
      const response = await apiClient.get<{ data: SupplierPrice[] }>(
        `/inventory/suppliers/items/${selectedItemForPrices.id}/prices`
      );
      return response.data.data;
    },
    enabled: !!selectedItemForPrices,
  });

  // Create/update supplier item
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        return apiClient.patch(`/inventory/suppliers/items/${editingItem.id}`, data);
      }
      return apiClient.post('/inventory/suppliers/items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items'] });
      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast.success(editingItem ? 'Supplier item updated' : 'Supplier item created');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save supplier item');
    },
  });

  // Add price mutation
  const addPriceMutation = useMutation({
    mutationFn: async (data: { unitPriceVendorUom: number; currency: string }) => {
      return apiClient.post(`/inventory/suppliers/items/${selectedItemForPrices?.id}/prices`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-prices', selectedItemForPrices?.id] });
      setPriceDialogOpen(false);
      setPriceAmount('');
      toast.success('Price added');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add price');
    },
  });

  const resetForm = () => {
    setFormVendorId('');
    setFormInventoryItemId('');
    setFormVendorSku('');
    setFormConversionFactor('1');
    setFormPackSizeLabel('');
    setFormLeadTimeDays('0');
    setFormMinOrderQty('1');
    setFormIsPreferred(false);
    setFormIsActive(true);
  };

  const openEdit = (item: SupplierItem) => {
    setEditingItem(item);
    setFormVendorId(item.vendor.id);
    setFormInventoryItemId(item.inventoryItem.id);
    setFormVendorSku(item.vendorSku);
    setFormConversionFactor(item.uomConversionFactorToBase.toString());
    setFormPackSizeLabel(item.packSizeLabel || '');
    setFormLeadTimeDays(item.leadTimeDays.toString());
    setFormMinOrderQty(item.minOrderQtyVendorUom.toString());
    setFormIsPreferred(item.isPreferred);
    setFormIsActive(item.isActive);
    setDialogOpen(true);
  };

  const openPriceDrawer = (item: SupplierItem) => {
    setSelectedItemForPrices(item);
    setPriceDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      vendorId: formVendorId,
      inventoryItemId: formInventoryItemId,
      vendorSku: formVendorSku,
      uomConversionFactorToBase: parseFloat(formConversionFactor),
      packSizeLabel: formPackSizeLabel || undefined,
      leadTimeDays: parseInt(formLeadTimeDays, 10),
      minOrderQtyVendorUom: parseFloat(formMinOrderQty),
      isPreferred: formIsPreferred,
      isActive: formIsActive,
    });
  };

  const handleAddPrice = (e: React.FormEvent) => {
    e.preventDefault();
    addPriceMutation.mutate({
      unitPriceVendorUom: parseFloat(priceAmount),
      currency: priceCurrency,
    });
  };

  const filteredItems = items?.filter(
    (item) =>
      item.vendor.name.toLowerCase().includes(search.toLowerCase()) ||
      item.inventoryItem.name.toLowerCase().includes(search.toLowerCase()) ||
      item.vendorSku.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      accessorKey: 'vendor.name',
      header: 'Vendor',
    },
    {
      accessorKey: 'inventoryItem.name',
      header: 'Item',
    },
    {
      accessorKey: 'vendorSku',
      header: 'Vendor SKU',
    },
    {
      accessorKey: 'uomConversionFactorToBase',
      header: 'UOM Factor',
      cell: ({ row }: any) => row.original.uomConversionFactorToBase.toFixed(4),
    },
    {
      accessorKey: 'packSizeLabel',
      header: 'Pack Size',
      cell: ({ row }: any) => row.original.packSizeLabel || '-',
    },
    {
      accessorKey: 'isPreferred',
      header: 'Preferred',
      cell: ({ row }: any) =>
        row.original.isPreferred ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }: any) =>
        row.original.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openPriceDrawer(row.original)}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Supplier Catalog"
          description="Manage vendor item mappings, UOM conversions, and pricing"
        />

        <Card className="p-4">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vendor, item, or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => {
                resetForm();
                setEditingItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier Item
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={filteredItems || []}
            isLoading={isLoading}
          />
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-lg p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingItem ? 'Edit Supplier Item' : 'Add Supplier Item'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingItem && (
                  <>
                    <div>
                      <Label>Vendor</Label>
                      <select
                        value={formVendorId}
                        onChange={(e) => setFormVendorId(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                      >
                        <option value="">Select vendor...</option>
                        {vendors?.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Inventory Item</Label>
                      <select
                        value={formInventoryItemId}
                        onChange={(e) => setFormInventoryItemId(e.target.value)}
                        className="w-full p-2 border rounded"
                        required
                      >
                        <option value="">Select item...</option>
                        {inventoryItems?.map((i) => (
                          <option key={i.id} value={i.id}>{i.name} ({i.sku || 'No SKU'})</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <Label>Vendor SKU</Label>
                  <Input
                    value={formVendorSku}
                    onChange={(e) => setFormVendorSku(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>UOM Conversion Factor</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={formConversionFactor}
                      onChange={(e) => setFormConversionFactor(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Pack Size Label</Label>
                    <Input
                      value={formPackSizeLabel}
                      onChange={(e) => setFormPackSizeLabel(e.target.value)}
                      placeholder="e.g., Case of 12"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lead Time (days)</Label>
                    <Input
                      type="number"
                      value={formLeadTimeDays}
                      onChange={(e) => setFormLeadTimeDays(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Min Order Qty</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formMinOrderQty}
                      onChange={(e) => setFormMinOrderQty(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formIsPreferred}
                      onChange={(e) => setFormIsPreferred(e.target.checked)}
                    />
                    Preferred Supplier
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </Dialog>

        {/* Price History Drawer */}
        <Sheet open={priceDrawerOpen} onOpenChange={setPriceDrawerOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                Price History: {selectedItemForPrices?.inventoryItem.name}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <Button onClick={() => setPriceDialogOpen(true)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Add Price
              </Button>

              {pricesLoading ? (
                <p>Loading prices...</p>
              ) : priceHistory?.length === 0 ? (
                <p className="text-muted-foreground">No prices recorded</p>
              ) : (
                <div className="space-y-2">
                  {priceHistory?.map((price) => (
                    <Card key={price.id} className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">
                            {price.currency} {Number(price.unitPriceVendorUom).toFixed(2)}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {price.source === 'RECEIPT_DERIVED' ? 'Receipt' : 'Manual'}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(price.effectiveFrom).toLocaleDateString()}
                          {price.effectiveTo && ` - ${new Date(price.effectiveTo).toLocaleDateString()}`}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Add Price Dialog */}
        <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Add Price</h2>
              <form onSubmit={handleAddPrice} className="space-y-4">
                <div>
                  <Label>Unit Price (Vendor UOM)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPriceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addPriceMutation.isPending}>
                    {addPriceMutation.isPending ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}
