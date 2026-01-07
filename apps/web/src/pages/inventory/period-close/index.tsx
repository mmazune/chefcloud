/**
 * M12.1: Inventory Period Close Page
 *
 * Enterprise inventory period close workflow.
 * Features:
 * - Create and list periods (branch-scoped)
 * - Check blocking states before close
 * - Close period with snapshot + movement summary generation
 * - View valuation snapshots and movement summaries
 * - GL reconciliation report
 * - Export CSV with SHA-256 hash
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { Plus, Download, FileCheck, AlertTriangle, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryPeriod {
  id: string;
  branchId: string;
  branchName?: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  closedBy: string | null;
  closedByName?: string;
  notes: string | null;
  _count?: {
    valuationSnapshots: number;
    movementSummaries: number;
  };
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BlockingState {
  category: string;
  count: number;
  items: Array<{ id: string; name?: string; status: string }>;
}

interface ValuationSnapshot {
  id: string;
  itemId: string;
  itemName?: string;
  locationId: string;
  locationName?: string;
  qtyOnHand: number;
  unitCost: number;
  totalValue: number;
  snapshotDate: string;
}

interface MovementSummary {
  id: string;
  itemId: string;
  itemName?: string;
  openingQty: number;
  receiptsQty: number;
  salesQty: number;
  wasteQty: number;
  transferInQty: number;
  transferOutQty: number;
  adjustmentQty: number;
  countVarianceQty: number;
  productionConsumeQty: number;
  productionProduceQty: number;
}

interface ReconciliationCategory {
  category: string;
  inventorySide: { amount: number; detail: string };
  glSide: { amount: number; detail: string };
  variance: number;
  status: 'BALANCED' | 'DISCREPANCY';
  warnings: string[];
}

interface ReconciliationReport {
  periodId: string;
  categories: ReconciliationCategory[];
  overallStatus: 'BALANCED' | 'DISCREPANCY';
  generatedAt: string;
}

export default function PeriodClosePage() {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<InventoryPeriod | null>(null);
  const [detailTab, setDetailTab] = useState('valuation');

  // Form state for new period
  const [formBranchId, setFormBranchId] = useState('');
  const [formStartDate, setFormStartDate] = useState<Date | null>(null);
  const [formEndDate, setFormEndDate] = useState<Date | null>(null);
  const [formNotes, setFormNotes] = useState('');

  // Close form state
  const [closeBranchId, setCloseBranchId] = useState('');
  const [closeStartDate, setCloseStartDate] = useState<Date | null>(null);
  const [closeEndDate, setCloseEndDate] = useState<Date | null>(null);
  const [closeNotes, setCloseNotes] = useState('');

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<Branch[]>('/org/branches');
      return response.data;
    },
  });

  // Fetch periods
  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ['inventory-periods', selectedBranchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const response = await apiClient.get<{ periods: InventoryPeriod[]; total: number }>(
        '/inventory/periods',
        { params }
      );
      return response.data.periods;
    },
  });

  // Check blockers before close
  const { data: blockers, isLoading: blockersLoading, refetch: refetchBlockers } = useQuery({
    queryKey: ['inventory-period-blockers', closeBranchId, closeStartDate, closeEndDate],
    queryFn: async () => {
      if (!closeBranchId || !closeStartDate || !closeEndDate) return null;
      const response = await apiClient.get<{ blockers: BlockingState[] }>(
        '/inventory/periods/check-blockers',
        {
          params: {
            branchId: closeBranchId,
            startDate: closeStartDate.toISOString(),
            endDate: closeEndDate.toISOString(),
          },
        }
      );
      return response.data.blockers;
    },
    enabled: !!closeBranchId && !!closeStartDate && !!closeEndDate,
  });

  // Fetch valuation snapshots for selected period
  const { data: valuationData } = useQuery({
    queryKey: ['period-valuation', selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod) return null;
      const response = await apiClient.get<{ snapshots: ValuationSnapshot[] }>(
        `/inventory/periods/${selectedPeriod.id}/valuation`
      );
      return response.data;
    },
    enabled: !!selectedPeriod && detailTab === 'valuation',
  });

  // Fetch movement summaries for selected period
  const { data: movementData } = useQuery({
    queryKey: ['period-movements', selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod) return null;
      const response = await apiClient.get<{ summaries: MovementSummary[] }>(
        `/inventory/periods/${selectedPeriod.id}/movements`
      );
      return response.data;
    },
    enabled: !!selectedPeriod && detailTab === 'movements',
  });

  // Fetch reconciliation for selected period
  const { data: reconData } = useQuery({
    queryKey: ['period-reconciliation', selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod) return null;
      const response = await apiClient.get<ReconciliationReport>(
        `/inventory/periods/${selectedPeriod.id}/reconciliation`
      );
      return response.data;
    },
    enabled: !!selectedPeriod && detailTab === 'reconciliation',
  });

  // Create period mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/inventory/periods', {
        branchId: formBranchId,
        startDate: formStartDate?.toISOString(),
        endDate: formEndDate?.toISOString(),
        notes: formNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-periods'] });
      setCreateDialogOpen(false);
      resetCreateForm();
    },
  });

  // Close period mutation
  const closeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/inventory/periods/close', {
        branchId: closeBranchId,
        startDate: closeStartDate?.toISOString(),
        endDate: closeEndDate?.toISOString(),
        notes: closeNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-periods'] });
      setCloseDialogOpen(false);
      resetCloseForm();
    },
  });

  const resetCreateForm = () => {
    setFormBranchId('');
    setFormStartDate(null);
    setFormEndDate(null);
    setFormNotes('');
  };

  const resetCloseForm = () => {
    setCloseBranchId('');
    setCloseStartDate(null);
    setCloseEndDate(null);
    setCloseNotes('');
  };

  const handleExport = async (type: 'valuation' | 'movements' | 'reconciliation') => {
    if (!selectedPeriod) return;
    try {
      const response = await apiClient.get(
        `/inventory/periods/${selectedPeriod.id}/export/${type}.csv`,
        { responseType: 'blob' }
      );
      const hash = response.headers['x-content-hash'];
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-${selectedPeriod.id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Log hash for audit
      console.log(`Export ${type} hash: ${hash}`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const openDetailDialog = (period: InventoryPeriod) => {
    setSelectedPeriod(period);
    setDetailTab('valuation');
    setDetailDialogOpen(true);
  };

  const columns = [
    {
      accessorKey: 'branchName',
      header: 'Branch',
      cell: ({ row }: { row: { original: InventoryPeriod } }) =>
        row.original.branchName || row.original.branchId,
    },
    {
      accessorKey: 'startDate',
      header: 'Start Date',
      cell: ({ row }: { row: { original: InventoryPeriod } }) =>
        format(new Date(row.original.startDate), 'yyyy-MM-dd'),
    },
    {
      accessorKey: 'endDate',
      header: 'End Date',
      cell: ({ row }: { row: { original: InventoryPeriod } }) =>
        format(new Date(row.original.endDate), 'yyyy-MM-dd'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: { original: InventoryPeriod } }) => (
        <Badge variant={row.original.status === 'CLOSED' ? 'default' : 'secondary'}>
          {row.original.status === 'CLOSED' ? (
            <><Lock className="w-3 h-3 mr-1" /> Closed</>
          ) : (
            'Open'
          )}
        </Badge>
      ),
    },
    {
      accessorKey: 'closedAt',
      header: 'Closed At',
      cell: ({ row }: { row: { original: InventoryPeriod } }) =>
        row.original.closedAt ? format(new Date(row.original.closedAt), 'yyyy-MM-dd HH:mm') : '-',
    },
    {
      accessorKey: '_count',
      header: 'Snapshots',
      cell: ({ row }: { row: { original: InventoryPeriod } }) =>
        row.original._count?.valuationSnapshots ?? 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: { original: InventoryPeriod } }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDetailDialog(row.original)}
          disabled={row.original.status === 'OPEN'}
        >
          View Details
        </Button>
      ),
    },
  ];

  const hasBlockers = blockers && blockers.length > 0 && blockers.some(b => b.count > 0);

  return (
    <AppShell>
      <PageHeader
        title="Inventory Period Close"
        subtitle="Manage inventory periods, close periods with valuation snapshots, and reconcile with GL."
      />

      <div className="space-y-4 p-4">
        {/* Filters and Actions */}
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Branches</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Period
          </Button>
          <Button onClick={() => setCloseDialogOpen(true)}>
            <FileCheck className="w-4 h-4 mr-2" /> Close Period
          </Button>
        </div>

        {/* Periods Table */}
        <Card className="p-4">
          <DataTable
            columns={columns}
            data={periods || []}
            isLoading={periodsLoading}
          />
        </Card>
      </div>

      {/* Create Period Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inventory Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select value={formBranchId} onValueChange={setFormBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <DatePicker value={formStartDate} onChange={setFormStartDate} />
              </div>
              <div>
                <Label>End Date</Label>
                <DatePicker value={formEndDate} onChange={setFormEndDate} />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <textarea
                className="w-full border rounded p-2"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formBranchId || !formStartDate || !formEndDate || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Period Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Close Inventory Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select value={closeBranchId} onValueChange={setCloseBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <DatePicker value={closeStartDate} onChange={setCloseStartDate} />
              </div>
              <div>
                <Label>End Date</Label>
                <DatePicker value={closeEndDate} onChange={setCloseEndDate} />
              </div>
            </div>

            {/* Blocking States Check */}
            {closeBranchId && closeStartDate && closeEndDate && (
              <div className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Pre-Close Validation</h4>
                  <Button variant="ghost" size="sm" onClick={() => refetchBlockers()}>
                    Refresh
                  </Button>
                </div>
                {blockersLoading ? (
                  <div className="text-sm text-muted-foreground">Checking...</div>
                ) : hasBlockers ? (
                  <div className="space-y-2">
                    <Alert variant="destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        There are blocking items that must be resolved before closing.
                      </AlertDescription>
                    </Alert>
                    {blockers?.filter(b => b.count > 0).map((blocker) => (
                      <div key={blocker.category} className="text-sm">
                        <span className="font-medium">{blocker.category}:</span> {blocker.count} pending
                      </div>
                    ))}
                  </div>
                ) : blockers ? (
                  <Alert>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription>
                      No blocking items. Ready to close period.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            )}

            <div>
              <Label>Close Notes (optional)</Label>
              <textarea
                className="w-full border rounded p-2"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={!closeBranchId || !closeStartDate || !closeEndDate || hasBlockers || closeMutation.isPending}
            >
              Close Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Period Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Period Details: {selectedPeriod && format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd')} to{' '}
              {selectedPeriod && format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd')}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="reconciliation">GL Reconciliation</TabsTrigger>
            </TabsList>

            <TabsContent value="valuation" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('valuation')}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-left">Location</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Unit Cost</th>
                      <th className="p-2 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuationData?.snapshots?.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-2">{s.itemName || s.itemId}</td>
                        <td className="p-2">{s.locationName || s.locationId}</td>
                        <td className="p-2 text-right">{Number(s.qtyOnHand).toFixed(4)}</td>
                        <td className="p-2 text-right">${Number(s.unitCost).toFixed(4)}</td>
                        <td className="p-2 text-right">${Number(s.totalValue).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!valuationData?.snapshots || valuationData.snapshots.length === 0) && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          No valuation snapshots
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="movements" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('movements')}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
              <div className="border rounded overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Opening</th>
                      <th className="p-2 text-right">Receipts</th>
                      <th className="p-2 text-right">Sales</th>
                      <th className="p-2 text-right">Waste</th>
                      <th className="p-2 text-right">Transfers</th>
                      <th className="p-2 text-right">Adjustments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementData?.summaries?.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2">{m.itemName || m.itemId}</td>
                        <td className="p-2 text-right">{Number(m.openingQty).toFixed(4)}</td>
                        <td className="p-2 text-right">{Number(m.receiptsQty).toFixed(4)}</td>
                        <td className="p-2 text-right">{Number(m.salesQty).toFixed(4)}</td>
                        <td className="p-2 text-right">{Number(m.wasteQty).toFixed(4)}</td>
                        <td className="p-2 text-right">
                          {Number(m.transferInQty).toFixed(4)} / {Number(m.transferOutQty).toFixed(4)}
                        </td>
                        <td className="p-2 text-right">{Number(m.adjustmentQty).toFixed(4)}</td>
                      </tr>
                    ))}
                    {(!movementData?.summaries || movementData.summaries.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          No movement summaries
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-4">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={() => handleExport('reconciliation')}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>

              {reconData && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Overall Status:</span>
                    <Badge variant={reconData.overallStatus === 'BALANCED' ? 'default' : 'destructive'}>
                      {reconData.overallStatus === 'BALANCED' ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Balanced</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Discrepancy</>
                      )}
                    </Badge>
                  </div>

                  <div className="border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Category</th>
                          <th className="p-2 text-right">Inventory Side</th>
                          <th className="p-2 text-right">GL Side</th>
                          <th className="p-2 text-right">Variance</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconData.categories.map((cat) => (
                          <tr key={cat.category} className="border-t">
                            <td className="p-2 font-medium">{cat.category}</td>
                            <td className="p-2 text-right">${cat.inventorySide.amount.toFixed(2)}</td>
                            <td className="p-2 text-right">${cat.glSide.amount.toFixed(2)}</td>
                            <td className="p-2 text-right">
                              <span className={cat.variance !== 0 ? 'text-red-600' : ''}>
                                ${cat.variance.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant={cat.status === 'BALANCED' ? 'outline' : 'destructive'} className="text-xs">
                                {cat.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!reconData && (
                <div className="p-4 text-center text-muted-foreground">
                  No reconciliation data
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
