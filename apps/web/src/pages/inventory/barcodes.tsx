/**
 * M11.11: Inventory Barcodes Page
 * 
 * Manage barcode mappings for inventory items and lots.
 * Features:
 * - View all barcodes with format, type (item/lot), and linked entity
 * - Resolve barcode (scan simulation) to find item/lot
 * - Add/remove barcodes from items
 * - Export barcodes as CSV with SHA256 hash
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { Search, Download, ScanLine, Plus, Trash2 } from 'lucide-react';

interface BarcodeEntry {
  id: string;
  value: string;
  format: string;
  type: 'ITEM' | 'LOT';
  entityId: string;
  entityName: string;
  entitySku?: string;
  isPrimary?: boolean;
  createdAt: string;
}

interface BarcodeResolveResult {
  type: 'ITEM' | 'LOT';
  itemId: string;
  lotId?: string;
  name: string;
  sku?: string;
  status?: string;
  isActive: boolean;
}

type BarcodeFormat = 'EAN13' | 'UPC_A' | 'CODE128' | 'QR' | 'OTHER';

const BARCODE_FORMAT_OPTIONS: { value: BarcodeFormat; label: string }[] = [
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'UPC_A', label: 'UPC-A' },
  { value: 'CODE128', label: 'Code 128' },
  { value: 'QR', label: 'QR Code' },
  { value: 'OTHER', label: 'Other' },
];

export default function InventoryBarcodesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [resolveResult, setResolveResult] = useState<BarcodeResolveResult | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValue, setFormValue] = useState('');
  const [formFormat, setFormFormat] = useState<BarcodeFormat>('CODE128');
  const [formItemId, setFormItemId] = useState('');
  const [formIsPrimary, setFormIsPrimary] = useState(false);

  // Fetch all barcodes
  const { data: barcodes, isLoading } = useQuery({
    queryKey: ['inventory-barcodes', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '100');
      const response = await apiClient.get<{ items: BarcodeEntry[]; total: number }>(
        `/inventory/barcodes?${params.toString()}`
      );
      return response.data;
    },
  });

  // Fetch items for dropdown
  const { data: items } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const response = await apiClient.get<{ id: string; name: string; sku?: string }[]>(
        '/inventory/items'
      );
      return response.data;
    },
  });

  // Resolve barcode mutation
  const resolveMutation = useMutation({
    mutationFn: async (value: string) => {
      const response = await apiClient.get<BarcodeResolveResult>(
        `/inventory/barcodes/resolve?value=${encodeURIComponent(value)}`
      );
      return response.data;
    },
    onSuccess: (data) => {
      setResolveResult(data);
      setResolveError(null);
    },
    onError: (error: any) => {
      setResolveResult(null);
      setResolveError(error.response?.data?.message || 'Barcode not found');
    },
  });

  // Create item barcode mutation
  const createMutation = useMutation({
    mutationFn: async (data: { itemId: string; value: string; format: string; isPrimary: boolean }) => {
      const response = await apiClient.post(`/inventory/items/${data.itemId}/barcodes`, {
        value: data.value,
        format: data.format,
        isPrimary: data.isPrimary,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-barcodes'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create barcode');
    },
  });

  // Delete barcode mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ itemId, barcodeId }: { itemId: string; barcodeId: string }) => {
      await apiClient.delete(`/inventory/items/${itemId}/barcodes/${barcodeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-barcodes'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to delete barcode');
    },
  });

  const handleScan = () => {
    if (scanValue.trim()) {
      resolveMutation.mutate(scanValue.trim());
    }
  };

  const handleKeyPressScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get('/inventory/barcodes/export', {
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      });
      
      // Get hash from headers
      const hash = response.headers['x-content-hash'];
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `barcodes-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      if (hash) {
        console.log('Export hash:', hash);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleOpenCreate = () => {
    setFormValue('');
    setFormFormat('CODE128');
    setFormItemId('');
    setFormIsPrimary(false);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormValue('');
    setFormItemId('');
  };

  const handleCreate = () => {
    if (!formItemId || !formValue.trim()) {
      alert('Please select an item and enter a barcode value');
      return;
    }
    createMutation.mutate({
      itemId: formItemId,
      value: formValue.trim(),
      format: formFormat,
      isPrimary: formIsPrimary,
    });
  };

  const handleDelete = (barcode: BarcodeEntry) => {
    if (barcode.type !== 'ITEM') {
      alert('Lot barcodes must be deleted from the lot detail page');
      return;
    }
    if (confirm(`Delete barcode "${barcode.value}"?`)) {
      deleteMutation.mutate({ itemId: barcode.entityId, barcodeId: barcode.id });
    }
  };

  const filteredBarcodes = barcodes?.items ?? [];

  const columns = [
    {
      header: 'Barcode',
      accessorKey: 'value',
      cell: ({ row }: any) => (
        <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
          {row.original.value}
        </code>
      ),
    },
    {
      header: 'Format',
      accessorKey: 'format',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.original.format}</Badge>
      ),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: ({ row }: any) => (
        <Badge variant={row.original.type === 'ITEM' ? 'default' : 'secondary'}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      header: 'Linked To',
      accessorKey: 'entityName',
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium">{row.original.entityName}</div>
          {row.original.entitySku && (
            <div className="text-sm text-muted-foreground">{row.original.entitySku}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Primary',
      accessorKey: 'isPrimary',
      cell: ({ row }: any) =>
        row.original.isPrimary ? (
          <Badge variant="default" className="bg-green-600">Primary</Badge>
        ) : null,
    },
    {
      header: 'Actions',
      cell: ({ row }: any) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(row.original)}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inventory Barcodes"
        subtitle="Manage barcode mappings for items and lots"
      />

      <div className="space-y-6">
        {/* Scanner Simulation Card */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Barcode Scanner
          </h3>
          <div className="flex gap-2">
            <Input
              placeholder="Scan or enter barcode..."
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyPress={handleKeyPressScan}
              className="font-mono"
            />
            <Button onClick={handleScan} disabled={resolveMutation.isPending}>
              Resolve
            </Button>
          </div>
          
          {resolveResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={resolveResult.type === 'ITEM' ? 'default' : 'secondary'}>
                  {resolveResult.type}
                </Badge>
                {resolveResult.isActive ? (
                  <Badge variant="outline" className="border-green-500 text-green-700">Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
              <p className="font-medium text-lg">{resolveResult.name}</p>
              {resolveResult.sku && (
                <p className="text-sm text-muted-foreground">SKU: {resolveResult.sku}</p>
              )}
              {resolveResult.lotId && (
                <p className="text-sm text-muted-foreground">Lot ID: {resolveResult.lotId}</p>
              )}
              {resolveResult.status && (
                <p className="text-sm text-muted-foreground">Status: {resolveResult.status}</p>
              )}
            </div>
          )}
          
          {resolveError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {resolveError}
            </div>
          )}
        </Card>

        {/* Barcodes List */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search barcodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Barcode
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredBarcodes}
            isLoading={isLoading}
          />
          
          {barcodes && barcodes.total > filteredBarcodes.length && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredBarcodes.length} of {barcodes.total} barcodes
            </p>
          )}
        </Card>
      </div>

      {/* Add Barcode Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Add Item Barcode</h2>
          
          <div className="space-y-2">
            <Label>Item *</Label>
            <Select value={formItemId} onValueChange={setFormItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item..." />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} {item.sku && `(${item.sku})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Barcode Value *</Label>
            <Input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder="Enter barcode value..."
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={formFormat} onValueChange={(v) => setFormFormat(v as BarcodeFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BARCODE_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={formIsPrimary}
              onChange={(e) => setFormIsPrimary(e.target.checked)}
            />
            <Label htmlFor="isPrimary">Set as primary barcode</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
