/**
 * M11.1: On-Hand Inventory Page
 * 
 * Displays computed on-hand quantities by aggregating ledger entries.
 * Features:
 * - View on-hand by branch/location/item
 * - Filters and search
 * - Export to CSV
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { Search, Download, RefreshCw } from 'lucide-react';

interface OnHandLevel {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  locationId: string;
  locationName: string;
  onHand: number;
  uom: string;
  lastUpdated: string;
}

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
}

export default function OnHandPage() {
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>('/inventory/foundation/locations');
      return response.data;
    },
  });

  // Fetch on-hand levels
  const { data: onHandData, isLoading, refetch } = useQuery({
    queryKey: ['inventory-on-hand', selectedLocation],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedLocation) {
        params.locationId = selectedLocation;
      }
      const response = await apiClient.get<OnHandLevel[]>('/inventory/foundation/ledger/on-hand', {
        params,
      });
      return response.data;
    },
  });

  // Handle CSV export
  const handleExport = async () => {
    try {
      const response = await apiClient.get('/inventory/foundation/exports/on-hand', {
        params: { format: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `on-hand-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Filter on-hand data
  const filteredData = React.useMemo(() => {
    if (!onHandData) return [];
    if (!search) return onHandData;

    const searchLower = search.toLowerCase();
    return onHandData.filter(
      (item) =>
        item.itemName.toLowerCase().includes(searchLower) ||
        item.itemSku?.toLowerCase().includes(searchLower) ||
        item.locationName.toLowerCase().includes(searchLower)
    );
  }, [onHandData, search]);

  // Summary stats
  const stats = React.useMemo(() => {
    if (!filteredData) return { totalItems: 0, totalLocations: 0, zeroStock: 0 };
    const itemSet = new Set(filteredData.map((d) => d.itemId));
    const locationSet = new Set(filteredData.map((d) => d.locationId));
    const zeroStock = filteredData.filter((d) => d.onHand <= 0).length;
    return {
      totalItems: itemSet.size,
      totalLocations: locationSet.size,
      zeroStock,
    };
  }, [filteredData]);

  const columns = [
    {
      header: 'Item',
      accessor: (row: OnHandLevel) => (
        <div>
          <div className="font-medium">{row.itemName}</div>
          {row.itemSku && <div className="text-sm text-gray-500">SKU: {row.itemSku}</div>}
        </div>
      ),
    },
    {
      header: 'Location',
      accessor: (row: OnHandLevel) => row.locationName,
    },
    {
      header: 'On Hand',
      accessor: (row: OnHandLevel) => (
        <div className="font-mono">
          <span className={row.onHand <= 0 ? 'text-red-600' : 'text-green-600'}>
            {row.onHand.toFixed(2)}
          </span>
          <span className="text-gray-400 ml-1">{row.uom}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row: OnHandLevel) =>
        row.onHand <= 0 ? (
          <Badge variant="destructive">Out of Stock</Badge>
        ) : row.onHand < 10 ? (
          <Badge variant="warning">Low</Badge>
        ) : (
          <Badge variant="success">In Stock</Badge>
        ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="On-Hand Inventory"
        subtitle="Current stock levels by location"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} data-testid="refresh-btn">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExport} data-testid="export-btn">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Locations</div>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600">{stats.zeroStock}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items or locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="on-hand-search-input"
              />
            </div>
            <Select
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              data-testid="location-filter-select"
            >
              <option value="">All Locations</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* On-Hand Table */}
        <Card>
          <DataTable
            columns={columns}
            data={filteredData}
            emptyMessage="No inventory data found"
          />
        </Card>
      </div>
    </AppShell>
  );
}
