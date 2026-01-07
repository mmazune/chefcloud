/**
 * M11.13: Inventory GL Posting Mappings Page
 * 
 * Manage GL account mappings for inventory transactions.
 * Features:
 * - Organization-level default mapping
 * - Branch-level override mappings
 * - Account validation (types must match purpose)
 * - L4+ RBAC required (Manager, Owner, Admin)
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Building2,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface PostingMapping {
  id: string;
  orgId: string;
  branchId: string | null;
  branch?: Branch | null;
  inventoryAssetAccountId: string;
  inventoryAssetAccount: Account;
  cogsAccountId: string;
  cogsAccount: Account;
  wasteExpenseAccountId: string;
  wasteExpenseAccount: Account;
  shrinkExpenseAccountId: string;
  shrinkExpenseAccount: Account;
  grniAccountId: string;
  grniAccount: Account;
  inventoryGainAccountId: string | null;
  inventoryGainAccount: Account | null;
  autoPostEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MappingFormData {
  branchId: string | null;
  inventoryAssetAccountId: string;
  cogsAccountId: string;
  wasteExpenseAccountId: string;
  shrinkExpenseAccountId: string;
  grniAccountId: string;
  inventoryGainAccountId: string | null;
  autoPostEnabled: boolean;
}

const emptyFormData: MappingFormData = {
  branchId: null,
  inventoryAssetAccountId: '',
  cogsAccountId: '',
  wasteExpenseAccountId: '',
  shrinkExpenseAccountId: '',
  grniAccountId: '',
  inventoryGainAccountId: null,
  autoPostEnabled: true,
};

export default function AccountingMappingsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<PostingMapping | null>(null);
  const [formData, setFormData] = useState<MappingFormData>(emptyFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch mappings
  const { data: mappings, isLoading, refetch } = useQuery({
    queryKey: ['inventory-gl-mappings'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: PostingMapping[] }>(
        '/inventory/gl/mappings'
      );
      return response.data.data ?? [];
    },
  });

  // Fetch branches for dropdown
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Branch[] }>('/branches');
      return response.data.data ?? [];
    },
  });

  // Fetch accounts for dropdowns (ASSET, EXPENSE, LIABILITY types)
  const { data: accounts } = useQuery({
    queryKey: ['accounts-for-mapping'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Account[] }>('/accounting/accounts', {
        params: { limit: 500 },
      });
      return response.data.data ?? [];
    },
  });

  // Filter accounts by type for each dropdown
  const assetAccounts = accounts?.filter((a) => a.type === 'ASSET') ?? [];
  const expenseAccounts = accounts?.filter((a) => a.type === 'EXPENSE') ?? [];
  const liabilityAccounts = accounts?.filter((a) => a.type === 'LIABILITY') ?? [];
  const revenueAccounts = accounts?.filter((a) => a.type === 'REVENUE') ?? [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: MappingFormData) => {
      const response = await apiClient.post('/inventory/gl/mappings', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Mapping created successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-gl-mappings'] });
      setIsDialogOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create mapping');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MappingFormData> }) => {
      const response = await apiClient.put(`/inventory/gl/mappings/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Mapping updated successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-gl-mappings'] });
      setIsDialogOpen(false);
      setEditingMapping(null);
      setFormData(emptyFormData);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update mapping');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/gl/mappings/${id}`);
    },
    onSuccess: () => {
      toast.success('Mapping deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-gl-mappings'] });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete mapping');
    },
  });

  const handleOpenCreate = () => {
    setEditingMapping(null);
    setFormData(emptyFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (mapping: PostingMapping) => {
    setEditingMapping(mapping);
    setFormData({
      branchId: mapping.branchId,
      inventoryAssetAccountId: mapping.inventoryAssetAccountId,
      cogsAccountId: mapping.cogsAccountId,
      wasteExpenseAccountId: mapping.wasteExpenseAccountId,
      shrinkExpenseAccountId: mapping.shrinkExpenseAccountId,
      grniAccountId: mapping.grniAccountId,
      inventoryGainAccountId: mapping.inventoryGainAccountId,
      autoPostEnabled: mapping.autoPostEnabled,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingMapping) {
      updateMutation.mutate({ id: editingMapping.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Find org default
  const orgDefault = mappings?.find((m) => !m.branchId);
  const branchOverrides = mappings?.filter((m) => m.branchId) ?? [];

  // Table columns
  const columns = [
    {
      accessorKey: 'scope',
      header: 'Scope',
      cell: ({ row }: any) => {
        const mapping = row.original as PostingMapping;
        if (!mapping.branchId) {
          return (
            <Badge variant="outline" className="gap-1">
              <Building2 className="h-3 w-3" />
              Organization Default
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="gap-1">
            <MapPin className="h-3 w-3" />
            {mapping.branch?.name || 'Unknown Branch'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'inventoryAssetAccount',
      header: 'Inventory Asset',
      cell: ({ row }: any) => {
        const account = row.original.inventoryAssetAccount;
        return (
          <span className="text-sm">
            {account.code} - {account.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'cogsAccount',
      header: 'COGS',
      cell: ({ row }: any) => {
        const account = row.original.cogsAccount;
        return (
          <span className="text-sm">
            {account.code} - {account.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'grniAccount',
      header: 'GRNI',
      cell: ({ row }: any) => {
        const account = row.original.grniAccount;
        return (
          <span className="text-sm">
            {account.code} - {account.name}
          </span>
        );
      },
    },
    {
      accessorKey: 'autoPostEnabled',
      header: 'Auto-Post',
      cell: ({ row }: any) => {
        const enabled = row.original.autoPostEnabled;
        return enabled ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Disabled
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const mapping = row.original as PostingMapping;
        return (
          <div className="flex gap-2">
            <Tooltip content="Edit mapping">
              <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(mapping)}>
                <Edit className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete mapping">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteConfirmId(mapping.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Inventory GL Mappings"
        description="Configure which GL accounts to use for inventory transactions"
        icon={BookOpen}
      />

      <div className="p-6 space-y-6">
        {/* Info Banner */}
        {!orgDefault && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No organization default mapping configured. Inventory transactions will not be posted
              to GL until a default mapping is created.
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </div>

        {/* Mappings Table */}
        <Card className="p-4">
          <DataTable columns={columns} data={mappings ?? []} isLoading={isLoading} />
        </Card>

        {/* Legend */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Account Purposes</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div>
              <strong>Inventory Asset:</strong> Balance sheet account for inventory on hand
            </div>
            <div>
              <strong>COGS:</strong> Expense account debited when inventory is depleted via sales
            </div>
            <div>
              <strong>GRNI:</strong> Liability account credited on goods receipt (pending vendor bill)
            </div>
            <div>
              <strong>Waste Expense:</strong> Expense account debited for documented waste
            </div>
            <div>
              <strong>Shrink Expense:</strong> Expense account for stocktake variances (losses)
            </div>
            <div>
              <strong>Inventory Gain:</strong> Revenue account for stocktake gains (optional)
            </div>
          </div>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? 'Edit Posting Mapping' : 'Create Posting Mapping'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Scope */}
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select
                value={formData.branchId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, branchId: value || null })
                }
              >
                <option value="">Organization Default</option>
                {branches?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Branch-specific mappings override the organization default
              </p>
            </div>

            {/* Inventory Asset Account */}
            <div className="grid gap-2">
              <Label>Inventory Asset Account *</Label>
              <Select
                value={formData.inventoryAssetAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, inventoryAssetAccountId: value })
                }
              >
                <option value="">Select account...</option>
                {assetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* COGS Account */}
            <div className="grid gap-2">
              <Label>COGS Account *</Label>
              <Select
                value={formData.cogsAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, cogsAccountId: value })
                }
              >
                <option value="">Select account...</option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* GRNI Account */}
            <div className="grid gap-2">
              <Label>GRNI (Goods Received Not Invoiced) Account *</Label>
              <Select
                value={formData.grniAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, grniAccountId: value })
                }
              >
                <option value="">Select account...</option>
                {liabilityAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Waste Expense Account */}
            <div className="grid gap-2">
              <Label>Waste Expense Account *</Label>
              <Select
                value={formData.wasteExpenseAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, wasteExpenseAccountId: value })
                }
              >
                <option value="">Select account...</option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Shrink Expense Account */}
            <div className="grid gap-2">
              <Label>Shrink Expense Account *</Label>
              <Select
                value={formData.shrinkExpenseAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, shrinkExpenseAccountId: value })
                }
              >
                <option value="">Select account...</option>
                {expenseAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Inventory Gain Account (optional) */}
            <div className="grid gap-2">
              <Label>Inventory Gain Account (Optional)</Label>
              <Select
                value={formData.inventoryGainAccountId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, inventoryGainAccountId: value || null })
                }
              >
                <option value="">Not configured (gains offset shrink expense)</option>
                {revenueAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                If not configured, stocktake gains will credit the Shrink Expense account
              </p>
            </div>

            {/* Auto-Post Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Post Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create GL entries when inventory events are posted
                </p>
              </div>
              <Switch
                checked={formData.autoPostEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, autoPostEnabled: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.inventoryAssetAccountId ||
                !formData.cogsAccountId ||
                !formData.grniAccountId ||
                !formData.wasteExpenseAccountId ||
                !formData.shrinkExpenseAccountId
              }
            >
              {editingMapping ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this posting mapping?</p>
          <p className="text-sm text-muted-foreground">
            Existing GL entries will not be affected, but new inventory transactions will not be
            posted to GL unless another mapping applies.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
