/**
 * M11.6: Reorder Suggestions Page
 * 
 * Generate and manage reorder suggestion runs.
 * Features:
 * - List recent runs with line counts
 * - Create new runs (idempotent by hash)
 * - View run details with suggestion lines
 * - Generate draft POs from runs
 * - Export suggestions as CSV
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';
import { Plus, Eye, FileSpreadsheet, ShoppingCart, RefreshCw } from 'lucide-react';

interface ReorderRun {
    id: string;
    branchId: string;
    deterministicHash: string;
    asOf: string;
    createdAt: string;
    createdBy?: {
        id: string;
        firstName: string;
        lastName: string;
    };
    _count?: {
        lines: number;
        generatedPOs: number;
    };
}

interface ReorderLine {
    id: string;
    inventoryItemId: string;
    onHandBaseQty: number;
    reorderPointBaseQty: number;
    suggestedBaseQty: number;
    suggestedVendorQty: number | null;
    reasonCode: string;
    inventoryItem: {
        id: string;
        name: string;
        sku: string | null;
    };
    suggestedVendor?: {
        id: string;
        name: string;
    };
}

interface RunDetails extends ReorderRun {
    lines: ReorderLine[];
    generatedPOs?: Array<{
        id: string;
        poNumber: string;
        vendorId: string;
        status: string;
        totalAmount: number;
    }>;
}

interface GeneratePOsResult {
    isNew: boolean;
    purchaseOrders: Array<{
        id: string;
        poNumber: string;
        vendor: { name: string };
    }>;
}

export default function ReorderSuggestionsPage() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

    // Fetch recent runs
    const { data: runs, isLoading: runsLoading } = useQuery({
        queryKey: ['reorder-runs'],
        queryFn: async () => {
            const response = await apiClient.get<{ data: ReorderRun[] }>('/inventory/reorder/runs');
            return response.data.data;
        },
    });

    // Fetch run details when selected
    const { data: runDetails, isLoading: detailsLoading } = useQuery({
        queryKey: ['reorder-run', selectedRunId],
        queryFn: async () => {
            if (!selectedRunId) return null;
            const response = await apiClient.get<{ data: RunDetails }>(`/inventory/reorder/runs/${selectedRunId}`);
            return response.data.data;
        },
        enabled: !!selectedRunId,
    });

    // Create run mutation
    const createRunMutation = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post<{ data: RunDetails }>('/inventory/reorder/runs', {});
            return response.data.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['reorder-runs'] });
            setSelectedRunId(data.id);
            setDrawerOpen(true);
            toast({ title: 'Success', description: 'Reorder run created' });
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to create run', variant: 'destructive' });
        },
    });

    // Generate POs mutation
    const generatePOsMutation = useMutation({
        mutationFn: async (runId: string) => {
            const response = await apiClient.post<{ data: GeneratePOsResult }>(
                `/inventory/reorder/runs/${runId}/generate-pos`,
                {}
            );
            return response.data.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['reorder-run', selectedRunId] });
            queryClient.invalidateQueries({ queryKey: ['reorder-runs'] });
            if (data.isNew) {
                toast({ title: 'Success', description: `Generated ${data.purchaseOrders.length} draft PO(s)` });
            } else {
                toast({ title: 'Info', description: 'POs already exist for this run' });
            }
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.response?.data?.message || 'Failed to generate POs', variant: 'destructive' });
        },
    });

    const handleExportCSV = (runId: string) => {
        window.open(`${apiClient.defaults.baseURL}/inventory/export/reorder-suggestions/${runId}`, '_blank');
    };

    const openRunDetails = (runId: string) => {
        setSelectedRunId(runId);
        setDrawerOpen(true);
    };

    const reasonCodeLabels: Record<string, string> = {
        BELOW_REORDER_POINT: 'Below Reorder Point',
        NEGATIVE_ON_HAND: 'Negative Stock',
        MANUAL_TRIGGER: 'Manual',
    };

    const columns = [
        {
            accessorKey: 'createdAt',
            header: 'Created',
            cell: ({ row }: any) => new Date(row.original.createdAt).toLocaleString(),
        },
        {
            accessorKey: 'createdBy',
            header: 'Created By',
            cell: ({ row }: any) => {
                const user = row.original.createdBy;
                return user ? `${user.firstName} ${user.lastName}` : '-';
            },
        },
        {
            accessorKey: '_count.lines',
            header: 'Suggestions',
            cell: ({ row }: any) => row.original._count?.lines ?? 0,
        },
        {
            accessorKey: '_count.generatedPOs',
            header: 'POs Generated',
            cell: ({ row }: any) => {
                const count = row.original._count?.generatedPOs ?? 0;
                return count > 0 ? <Badge>{count}</Badge> : <Badge variant="outline">0</Badge>;
            },
        },
        {
            accessorKey: 'deterministicHash',
            header: 'Hash',
            cell: ({ row }: any) => (
                <span className="font-mono text-xs">{row.original.deterministicHash.slice(0, 8)}...</span>
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }: any) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openRunDetails(row.original.id)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportCSV(row.original.id)}>
                        <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const lineColumns = [
        {
            accessorKey: 'inventoryItem.name',
            header: 'Item',
        },
        {
            accessorKey: 'inventoryItem.sku',
            header: 'SKU',
            cell: ({ row }: any) => row.original.inventoryItem.sku || '-',
        },
        {
            accessorKey: 'onHandBaseQty',
            header: 'On Hand',
            cell: ({ row }: any) => Number(row.original.onHandBaseQty).toFixed(2),
        },
        {
            accessorKey: 'reorderPointBaseQty',
            header: 'Reorder Point',
            cell: ({ row }: any) => Number(row.original.reorderPointBaseQty).toFixed(2),
        },
        {
            accessorKey: 'suggestedBaseQty',
            header: 'Suggested Qty',
            cell: ({ row }: any) => (
                <span className="font-semibold">{Number(row.original.suggestedBaseQty).toFixed(2)}</span>
            ),
        },
        {
            accessorKey: 'suggestedVendor.name',
            header: 'Vendor',
            cell: ({ row }: any) => row.original.suggestedVendor?.name || '-',
        },
        {
            accessorKey: 'suggestedVendorQty',
            header: 'Vendor Qty',
            cell: ({ row }: any) =>
                row.original.suggestedVendorQty ? Number(row.original.suggestedVendorQty).toFixed(2) : '-',
        },
        {
            accessorKey: 'reasonCode',
            header: 'Reason',
            cell: ({ row }: any) => (
                <Badge variant="outline">{reasonCodeLabels[row.original.reasonCode] || row.original.reasonCode}</Badge>
            ),
        },
    ];

    return (
        <AppShell>
            <div className="p-6 space-y-6">
                <PageHeader
                    title="Reorder Suggestions"
                    subtitle="Generate and review reorder suggestions based on current stock levels"
                />

                <Card className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Recent Runs</h3>
                        <Button onClick={() => createRunMutation.mutate()} disabled={createRunMutation.isPending}>
                            {createRunMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Generate Suggestions
                        </Button>
                    </div>

                    <DataTable
                        columns={columns}
                        data={runs || []}
                        isLoading={runsLoading}
                    />
                </Card>

                {/* Run Details Drawer */}
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <SheetContent className="w-[800px] sm:max-w-[800px]">
                        <SheetHeader>
                            <SheetTitle>
                                Reorder Run Details
                                {runDetails && (
                                    <span className="text-sm font-normal text-muted-foreground ml-2">
                                        ({runDetails.lines?.length || 0} suggestions)
                                    </span>
                                )}
                            </SheetTitle>
                        </SheetHeader>

                        <div className="mt-4 space-y-4">
                            {detailsLoading ? (
                                <p>Loading...</p>
                            ) : runDetails ? (
                                <>
                                    <div className="flex gap-4 items-center">
                                        <div className="text-sm">
                                            <span className="text-muted-foreground">Created:</span>{' '}
                                            {new Date(runDetails.createdAt).toLocaleString()}
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-muted-foreground">Hash:</span>{' '}
                                            <code className="text-xs">{runDetails.deterministicHash.slice(0, 16)}...</code>
                                        </div>
                                    </div>

                                    {/* Generated POs Section */}
                                    {runDetails.generatedPOs && runDetails.generatedPOs.length > 0 && (
                                        <Card className="p-3 bg-green-50 dark:bg-green-900/20">
                                            <h4 className="font-medium mb-2">Generated Purchase Orders</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {runDetails.generatedPOs.map((po) => (
                                                    <Badge key={po.id} variant="default">
                                                        {po.poNumber} - {po.status}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </Card>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => generatePOsMutation.mutate(runDetails.id)}
                                            disabled={generatePOsMutation.isPending || (runDetails.generatedPOs?.length ?? 0) > 0}
                                        >
                                            <ShoppingCart className="h-4 w-4 mr-2" />
                                            {(runDetails.generatedPOs?.length ?? 0) > 0 ? 'POs Already Generated' : 'Generate Draft POs'}
                                        </Button>
                                        <Button variant="outline" onClick={() => handleExportCSV(runDetails.id)}>
                                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                                            Export CSV
                                        </Button>
                                    </div>

                                    {/* Suggestion Lines */}
                                    <div className="mt-4">
                                        <h4 className="font-medium mb-2">Suggestion Lines</h4>
                                        {runDetails.lines?.length === 0 ? (
                                            <p className="text-muted-foreground">No items below reorder point</p>
                                        ) : (
                                            <div className="border rounded">
                                                <DataTable
                                                    columns={lineColumns}
                                                    data={runDetails.lines || []}
                                                    isLoading={false}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground">Select a run to view details</p>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </AppShell>
    );
}
