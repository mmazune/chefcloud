/**
 * M11.4: Inventory Depletions Page
 * 
 * Provides UI for viewing and managing POS inventory depletions:
 * - List depletions with filters by status and date
 * - View depletion details
 * - Retry failed depletions
 * - Skip failed depletions with reason
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
import { RefreshCw, SkipForward, Eye, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Depletion {
    id: string;
    orgId: string;
    orderId: string;
    branchId: string;
    locationId: string;
    status: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED';
    errorCode: string | null;
    errorMessage: string | null;
    ledgerEntryCount: number;
    metadata: any;
    createdAt: string;
    postedAt: string | null;
    order: {
        id: string;
        orderNumber: string;
        status: string;
        total: string | null;
    };
    branch: {
        id: string;
        name: string;
    };
    location: {
        id: string;
        code: string;
        name: string;
    };
}

interface DepletionStats {
    total: number;
    posted: number;
    failed: number;
    pending: number;
    skipped: number;
}

const statusBadgeVariant: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
    POSTED: 'success',
    FAILED: 'destructive',
    PENDING: 'warning',
    SKIPPED: 'secondary',
};

const statusIcon: Record<string, any> = {
    POSTED: CheckCircle,
    FAILED: XCircle,
    PENDING: Clock,
    SKIPPED: SkipForward,
};

export default function DepletionsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [skipDialogOpen, setSkipDialogOpen] = useState(false);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDepletion, setSelectedDepletion] = useState<Depletion | null>(null);
    const [skipReason, setSkipReason] = useState('');

    // Fetch depletions
    const { data, isLoading } = useQuery({
        queryKey: ['depletions', statusFilter, dateFrom, dateTo],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (statusFilter) params.status = statusFilter;
            if (dateFrom) params.fromDate = dateFrom;
            if (dateTo) params.toDate = dateTo;
            const response = await apiClient.get<{ depletions: Depletion[]; total: number }>(
                '/inventory/depletions',
                { params }
            );
            return response.data;
        },
    });

    // Fetch stats
    const { data: stats } = useQuery({
        queryKey: ['depletion-stats'],
        queryFn: async () => {
            const response = await apiClient.get<DepletionStats>('/inventory/depletions/stats');
            return response.data;
        },
    });

    // Retry mutation
    const retryMutation = useMutation({
        mutationFn: async (depletionId: string) => {
            const response = await apiClient.post(`/inventory/depletions/${depletionId}/retry`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['depletions'] });
            queryClient.invalidateQueries({ queryKey: ['depletion-stats'] });
        },
    });

    // Skip mutation
    const skipMutation = useMutation({
        mutationFn: async ({ depletionId, reason }: { depletionId: string; reason: string }) => {
            const response = await apiClient.post(`/inventory/depletions/${depletionId}/skip`, { reason });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['depletions'] });
            queryClient.invalidateQueries({ queryKey: ['depletion-stats'] });
            setSkipDialogOpen(false);
            setSkipReason('');
        },
    });

    const handleOpenSkip = (depletion: Depletion) => {
        setSelectedDepletion(depletion);
        setSkipReason('');
        setSkipDialogOpen(true);
    };

    const handleOpenDetails = (depletion: Depletion) => {
        setSelectedDepletion(depletion);
        setDetailsDialogOpen(true);
    };

    const handleSkip = async () => {
        if (selectedDepletion && skipReason) {
            await skipMutation.mutateAsync({
                depletionId: selectedDepletion.id,
                reason: skipReason,
            });
        }
    };

    const columns: Array<{ header: string; accessor: keyof Depletion | ((row: Depletion) => React.ReactNode) }> = [
        {
            header: 'Order #',
            accessor: (row) => (
                <span className="font-mono">{row.order?.orderNumber}</span>
            ),
        },
        {
            header: 'Status',
            accessor: (row) => {
                const status = row.status;
                const IconComponent = statusIcon[status];
                return (
                    <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <Badge variant={statusBadgeVariant[status] || 'default'}>
                            {status}
                        </Badge>
                    </div>
                );
            },
        },
        {
            header: 'Location',
            accessor: (row) => row.location?.code ?? '-',
        },
        {
            header: 'Entries',
            accessor: 'ledgerEntryCount' as keyof Depletion,
        },
        {
            header: 'Error',
            accessor: (row) => {
                if (!row.errorCode) return '-';
                return (
                    <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">{row.errorCode}</span>
                    </div>
                );
            },
        },
        {
            header: 'Created',
            accessor: (row) => new Date(row.createdAt).toLocaleString(),
        },
        {
            header: 'Posted',
            accessor: (row) =>
                row.postedAt ? new Date(row.postedAt).toLocaleString() : '-',
        },
        {
            header: 'Actions',
            accessor: (row) => {
                return (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetails(row)}
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                        {row.status === 'FAILED' && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => retryMutation.mutate(row.id)}
                                    disabled={retryMutation.isPending}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenSkip(row)}
                                >
                                    <SkipForward className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <AppShell>
            <PageHeader
                title="Inventory Depletions"
                subtitle="View and manage POS inventory depletions"
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4 mb-4">
                <Card className="p-4">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Posted
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats?.posted ?? 0}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-red-600 flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Failed
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats?.failed ?? 0}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-yellow-600 flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Pending
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                        <SkipForward className="h-4 w-4" />
                        Skipped
                    </div>
                    <div className="text-2xl font-bold">{stats?.skipped ?? 0}</div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 mb-4">
                <div className="flex gap-4">
                    <div>
                        <Label>Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <option value="">All Status</option>
                            <option value="POSTED">Posted</option>
                            <option value="FAILED">Failed</option>
                            <option value="PENDING">Pending</option>
                            <option value="SKIPPED">Skipped</option>
                        </Select>
                    </div>
                    <div>
                        <Label>From Date</Label>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>To Date</Label>
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                </div>
            </Card>

            {/* Depletions Table */}
            <Card>
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={data?.depletions ?? []}
                    />
                )}
            </Card>

            {/* Skip Dialog */}
            <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
                <div className="p-6 max-w-md">
                    <h3 className="text-lg font-medium mb-4">Skip Depletion</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        This will mark the depletion as skipped and no inventory will be deducted
                        for order #{selectedDepletion?.order.orderNumber}.
                    </p>

                    <div>
                        <Label>Reason for skipping</Label>
                        <Textarea
                            value={skipReason}
                            onChange={(e) => setSkipReason(e.target.value)}
                            placeholder="e.g., Inventory already adjusted manually, test order, etc."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSkip}
                            disabled={!skipReason || skipMutation.isPending}
                        >
                            Skip Depletion
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <div className="p-6 max-w-lg">
                    <h3 className="text-lg font-medium mb-4">Depletion Details</h3>

                    {selectedDepletion && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Order Number</Label>
                                    <div className="font-mono">{selectedDepletion.order.orderNumber}</div>
                                </div>
                                <div>
                                    <Label>Order Total</Label>
                                    <div>${selectedDepletion.order.total}</div>
                                </div>
                                <div>
                                    <Label>Status</Label>
                                    <Badge variant={statusBadgeVariant[selectedDepletion.status]}>
                                        {selectedDepletion.status}
                                    </Badge>
                                </div>
                                <div>
                                    <Label>Location</Label>
                                    <div>{selectedDepletion.location?.name}</div>
                                </div>
                                <div>
                                    <Label>Ledger Entries</Label>
                                    <div>{selectedDepletion.ledgerEntryCount}</div>
                                </div>
                                <div>
                                    <Label>Created</Label>
                                    <div>{new Date(selectedDepletion.createdAt).toLocaleString()}</div>
                                </div>
                            </div>

                            {selectedDepletion.errorCode && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                    <div className="font-medium text-red-700">{selectedDepletion.errorCode}</div>
                                    <div className="text-sm text-red-600">{selectedDepletion.errorMessage}</div>
                                </div>
                            )}

                            {selectedDepletion.metadata && (
                                <div>
                                    <Label>Metadata</Label>
                                    <pre className="p-3 bg-gray-50 rounded text-sm overflow-auto max-h-48">
                                        {JSON.stringify(selectedDepletion.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end mt-6">
                        <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
                    </div>
                </div>
            </Dialog>
        </AppShell>
    );
}
