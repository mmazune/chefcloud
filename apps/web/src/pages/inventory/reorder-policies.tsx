/**
 * M11.6: Reorder Policies Page
 * 
 * Manages branch-scoped reorder point overrides for inventory items.
 * Features:
 * - List policies with reorder point, qty, preferred vendor/location
 * - Create/edit policy dialogs
 * - Toggle active status
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
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { Plus, Search, Edit } from 'lucide-react';

interface Vendor {
    id: string;
    name: string;
}

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
    reorderLevel: number;
    reorderQty: number;
}

interface ReorderPolicy {
    id: string;
    inventoryItemId: string;
    reorderPointBaseQty: number;
    reorderQtyBaseQty: number;
    preferredVendorId: string | null;
    preferredLocationId: string | null;
    isActive: boolean;
    inventoryItem?: InventoryItem;
    preferredVendor?: Vendor;
}

export default function ReorderPoliciesPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<ReorderPolicy | null>(null);

    // Form state
    const [formItemId, setFormItemId] = useState('');
    const [formReorderPoint, setFormReorderPoint] = useState('');
    const [formReorderQty, setFormReorderQty] = useState('');
    const [formPreferredVendorId, setFormPreferredVendorId] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);

    // Fetch policies
    const { data: policies, isLoading } = useQuery({
        queryKey: ['reorder-policies'],
        queryFn: async () => {
            const response = await apiClient.get<{ data: ReorderPolicy[] }>('/inventory/reorder/policies');
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

    // Fetch vendors for dropdown
    const { data: vendors } = useQuery({
        queryKey: ['vendors'],
        queryFn: async () => {
            const response = await apiClient.get<{ data: Vendor[] }>('/vendors');
            return response.data.data;
        },
    });

    // Upsert policy mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiClient.post('/inventory/reorder/policies', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reorder-policies'] });
            setDialogOpen(false);
            setEditingPolicy(null);
            resetForm();
            toast({ title: 'Success', description: 'Reorder policy saved' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to save policy', variant: 'destructive' });
        },
    });

    const resetForm = () => {
        setFormItemId('');
        setFormReorderPoint('');
        setFormReorderQty('');
        setFormPreferredVendorId('');
        setFormIsActive(true);
    };

    const openEdit = (policy: ReorderPolicy) => {
        setEditingPolicy(policy);
        setFormItemId(policy.inventoryItemId);
        setFormReorderPoint(policy.reorderPointBaseQty.toString());
        setFormReorderQty(policy.reorderQtyBaseQty.toString());
        setFormPreferredVendorId(policy.preferredVendorId || '');
        setFormIsActive(policy.isActive);
        setDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate({
            inventoryItemId: formItemId,
            reorderPointBaseQty: parseFloat(formReorderPoint),
            reorderQtyBaseQty: parseFloat(formReorderQty),
            preferredVendorId: formPreferredVendorId || undefined,
            isActive: formIsActive,
        });
    };

    const filteredPolicies = policies?.filter(
        (policy) =>
            policy.inventoryItem?.name.toLowerCase().includes(search.toLowerCase()) ||
            policy.inventoryItem?.sku?.toLowerCase().includes(search.toLowerCase())
    );

    const columns = [
        {
            accessorKey: 'inventoryItem.name',
            header: 'Item',
        },
        {
            accessorKey: 'inventoryItem.sku',
            header: 'SKU',
            cell: ({ row }: any) => row.original.inventoryItem?.sku || '-',
        },
        {
            accessorKey: 'reorderPointBaseQty',
            header: 'Reorder Point',
            cell: ({ row }: any) => Number(row.original.reorderPointBaseQty).toFixed(2),
        },
        {
            accessorKey: 'reorderQtyBaseQty',
            header: 'Reorder Qty',
            cell: ({ row }: any) => Number(row.original.reorderQtyBaseQty).toFixed(2),
        },
        {
            accessorKey: 'preferredVendor.name',
            header: 'Preferred Vendor',
            cell: ({ row }: any) => row.original.preferredVendor?.name || '-',
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
                <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
                    <Edit className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <AppShell>
            <div className="p-6 space-y-6">
                <PageHeader
                    title="Reorder Policies"
                    subtitle="Configure branch-level reorder points and quantities"
                />

                <Card className="p-4">
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by item name or SKU..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                resetForm();
                                setEditingPolicy(null);
                                setDialogOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Policy
                        </Button>
                    </div>

                    <DataTable
                        columns={columns}
                        data={filteredPolicies || []}
                        isLoading={isLoading}
                    />
                </Card>

                {/* Create/Edit Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <Card className="w-full max-w-lg p-6">
                            <h2 className="text-lg font-semibold mb-4">
                                {editingPolicy ? 'Edit Reorder Policy' : 'Add Reorder Policy'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label>Inventory Item</Label>
                                    <select
                                        value={formItemId}
                                        onChange={(e) => setFormItemId(e.target.value)}
                                        className="w-full p-2 border rounded"
                                        required
                                        disabled={!!editingPolicy}
                                    >
                                        <option value="">Select item...</option>
                                        {inventoryItems?.map((i) => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} ({i.sku || 'No SKU'}) - Default: {i.reorderLevel} / {i.reorderQty}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Reorder Point (Base UOM)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formReorderPoint}
                                            onChange={(e) => setFormReorderPoint(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label>Reorder Qty (Base UOM)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formReorderQty}
                                            onChange={(e) => setFormReorderQty(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Preferred Vendor (Optional)</Label>
                                    <select
                                        value={formPreferredVendorId}
                                        onChange={(e) => setFormPreferredVendorId(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">No preference</option>
                                        {vendors?.map((v) => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
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
            </div>
        </AppShell>
    );
}
