/**
 * M11.1: Inventory Locations Page
 * 
 * Provides UI for managing inventory storage locations within branches.
 * Features:
 * - List all locations for the current branch
 * - Create/edit locations with type (STORAGE, BAR, KITCHEN, RETAIL, OTHER)
 * - Toggle active/default-receiving status
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
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search } from 'lucide-react';

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  type: 'STORAGE' | 'BAR' | 'KITCHEN' | 'RETAIL' | 'OTHER';
  isActive: boolean;
  isDefaultReceiving: boolean;
  parentId: string | null;
  createdAt: string;
}

const LOCATION_TYPES = ['STORAGE', 'BAR', 'KITCHEN', 'RETAIL', 'OTHER'] as const;

export default function InventoryLocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<InventoryLocation | null>(null);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<string>('STORAGE');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Fetch locations
  const { data: locations, isLoading } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>('/inventory/foundation/locations');
      return response.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/inventory/foundation/locations', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
      handleCloseDialog();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.patch(`/inventory/foundation/locations/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-locations'] });
      handleCloseDialog();
    },
  });

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setFormCode('');
    setFormName('');
    setFormType('STORAGE');
    setFormIsActive(true);
    setFormIsDefault(false);
    setDialogOpen(true);
  };

  const handleEdit = (location: InventoryLocation) => {
    setEditingLocation(location);
    setFormCode(location.code);
    setFormName(location.name);
    setFormType(location.type);
    setFormIsActive(location.isActive);
    setFormIsDefault(location.isDefaultReceiving);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLocation(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      code: formCode,
      name: formName,
      type: formType,
      isActive: formIsActive,
      isDefaultReceiving: formIsDefault,
    };

    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter locations
  const filteredLocations = React.useMemo(() => {
    if (!locations) return [];
    if (!search) return locations;

    const searchLower = search.toLowerCase();
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(searchLower) ||
        loc.code.toLowerCase().includes(searchLower)
    );
  }, [locations, search]);

  const columns = [
    {
      header: 'Code',
      accessor: (row: InventoryLocation) => (
        <span className="font-mono text-sm">{row.code}</span>
      ),
    },
    {
      header: 'Name',
      accessor: (row: InventoryLocation) => row.name,
    },
    {
      header: 'Type',
      accessor: (row: InventoryLocation) => (
        <Badge variant="outline">{row.type}</Badge>
      ),
    },
    {
      header: 'Status',
      accessor: (row: InventoryLocation) => (
        <Badge variant={row.isActive ? 'success' : 'destructive'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Default Receiving',
      accessor: (row: InventoryLocation) =>
        row.isDefaultReceiving ? (
          <Badge variant="default">Default</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      header: 'Actions',
      accessor: (row: InventoryLocation) => (
        <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inventory Locations"
        subtitle="Manage storage locations for inventory tracking"
        actions={
          <Button onClick={handleOpenCreate} data-testid="create-location-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Search */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="location-search-input"
              />
            </div>
          </div>
        </Card>

        {/* Locations Table */}
        <Card>
          <DataTable
            columns={columns}
            data={filteredLocations}
            emptyMessage="No locations found"
          />
        </Card>

        {/* Create/Edit Dialog */}
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-semibold mb-4">
                  {editingLocation ? 'Edit Location' : 'Create Location'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g., MAIN-STORAGE"
                      required
                      disabled={!!editingLocation}
                      data-testid="location-code-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Main Storage Room"
                      required
                      data-testid="location-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={formType}
                      onValueChange={setFormType}
                      data-testid="location-type-select"
                    >
                      {LOCATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      data-testid="location-active-checkbox"
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      data-testid="location-default-checkbox"
                    />
                    <Label htmlFor="isDefault">Default Receiving Location</Label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="location-submit-btn"
                    >
                      {editingLocation ? 'Save' : 'Create'}
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
