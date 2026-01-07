/**
 * M12.1 + M12.2: Inventory Period Close Page
 *
 * Enterprise inventory period close workflow.
 * Features:
 * - Create and list periods (branch-scoped)
 * - Check blocking states before close
 * - Close period with snapshot + movement summary generation
 * - View valuation snapshots and movement summaries
 * - GL reconciliation report
 * - Export CSV with SHA-256 hash
 *
 * M12.2 Enhancements:
 * - Pre-close check panel (READY/BLOCKED/WARNING + overrideAllowed)
 * - Auto-generate monthly periods (fromMonth/toMonth)
 * - Reopen closed period (L5 only) with reason
 * - Close pack view with bundle hash and export links
 * - Event log (audit trail)
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
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { Plus, Download, FileCheck, AlertTriangle, Lock, CheckCircle2, XCircle, RefreshCw, Calendar, Package, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';

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

// M12.2: Pre-close check result
interface PreCloseCheckResult {
  status: 'READY' | 'BLOCKED' | 'WARNING';
  overrideAllowed: boolean;
  checklist: Array<{
    category: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    count: number;
    items: Array<{ id: string; name?: string; status: string }>;
    message: string;
  }>;
  summary: string;
}

// M12.2: Close pack summary
interface ClosePack {
  periodId: string;
  branchId: string;
  branchName?: string;
  startDate: string;
  endDate: string;
  status: string;
  revision: number;
  bundleHash: string;
  exports: Array<{
    type: string;
    url: string;
    hash: string;
    rows: number;
  }>;
  events: Array<{
    id: string;
    type: string;
    actorName?: string;
    occurredAt: string;
    reason?: string;
  }>;
  generatedAt: string;
}

// M12.2: Period event
interface PeriodEvent {
  id: string;
  type: 'CREATED' | 'CLOSED' | 'REOPENED' | 'OVERRIDE_USED' | 'EXPORT_GENERATED';
  actorUserId: string;
  actorName?: string;
  occurredAt: string;
  reason?: string;
  metadataJson?: Record<string, unknown>;
}

export default function PeriodClosePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<InventoryPeriod | null>(null);
  const [detailTab, setDetailTab] = useState('valuation');

  // M12.2: New dialogs
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [closePackDialogOpen, setClosePackDialogOpen] = useState(false);
  const [preCloseDialogOpen, setPreCloseDialogOpen] = useState(false);

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

  // M12.2: Generate periods form state
  const [genBranchId, setGenBranchId] = useState('');
  const [genFromMonth, setGenFromMonth] = useState('');
  const [genToMonth, setGenToMonth] = useState('');

  // M12.2: Reopen form state
  const [reopenReason, setReopenReason] = useState('');

  // M12.2: Pre-close check state
  const [preCloseCheckBranchId, setPreCloseCheckBranchId] = useState('');
  const [preCloseCheckStartDate, setPreCloseCheckStartDate] = useState<Date | null>(null);
  const [preCloseCheckEndDate, setPreCloseCheckEndDate] = useState<Date | null>(null);

  // Check if user is L5 (OWNER or ADMIN)
  const isL5 = user?.role === 'OWNER' || user?.role === 'ADMIN';

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

  // M12.2: Generate periods mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/inventory/periods/generate', {
        branchId: genBranchId,
        fromMonth: genFromMonth,
        toMonth: genToMonth,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-periods'] });
      setGenerateDialogOpen(false);
      setGenBranchId('');
      setGenFromMonth('');
      setGenToMonth('');
    },
  });

  // M12.2: Reopen period mutation
  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod) throw new Error('No period selected');
      const response = await apiClient.post(
        `/inventory/periods/${selectedPeriod.id}/reopen`,
        { reason: reopenReason }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-periods'] });
      setReopenDialogOpen(false);
      setReopenReason('');
      setSelectedPeriod(null);
    },
  });

  // M12.2: Pre-close check query
  const { data: preCloseCheckResult, isLoading: preCloseCheckLoading, refetch: refetchPreCloseCheck } = useQuery({
    queryKey: ['preclose-check', preCloseCheckBranchId, preCloseCheckStartDate, preCloseCheckEndDate],
    queryFn: async () => {
      if (!preCloseCheckBranchId || !preCloseCheckStartDate || !preCloseCheckEndDate) return null;
      const response = await apiClient.get<PreCloseCheckResult>(
        '/inventory/periods/preclose-check',
        {
          params: {
            branchId: preCloseCheckBranchId,
            startDate: preCloseCheckStartDate.toISOString(),
            endDate: preCloseCheckEndDate.toISOString(),
          },
        }
      );
      return response.data;
    },
    enabled: !!preCloseCheckBranchId && !!preCloseCheckStartDate && !!preCloseCheckEndDate && preCloseDialogOpen,
  });

  // M12.2: Close pack query
  const { data: closePack, isLoading: closePackLoading } = useQuery({
    queryKey: ['close-pack', selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod) return null;
      const response = await apiClient.get<ClosePack>(
        `/inventory/periods/${selectedPeriod.id}/close-pack`
      );
      return response.data;
    },
    enabled: !!selectedPeriod && closePackDialogOpen,
  });

  // M12.2: Period events query
  const { data: periodEvents } = useQuery({
    queryKey: ['period-events', selectedPeriod?.id],
    queryFn: async () => {
      if (!selectedPeriod) return null;
      const response = await apiClient.get<{ events: PeriodEvent[] }>(
        `/inventory/periods/${selectedPeriod.id}/events`
      );
      return response.data.events;
    },
    enabled: !!selectedPeriod && detailTab === 'events',
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

  // M12.2: Open reopen dialog
  const openReopenDialog = (period: InventoryPeriod) => {
    setSelectedPeriod(period);
    setReopenReason('');
    setReopenDialogOpen(true);
  };

  // M12.2: Open close pack dialog
  const openClosePackDialog = (period: InventoryPeriod) => {
    setSelectedPeriod(period);
    setClosePackDialogOpen(true);
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
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDetailDialog(row.original)}
            disabled={row.original.status === 'OPEN'}
          >
            View Details
          </Button>
          {row.original.status === 'CLOSED' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openClosePackDialog(row.original)}
                title="Close Pack"
              >
                <Package className="w-4 h-4" />
              </Button>
              {isL5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReopenDialog(row.original)}
                  title="Reopen Period (L5)"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
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
        <div className="flex items-center gap-4 flex-wrap">
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
          <Button variant="outline" onClick={() => setPreCloseDialogOpen(true)}>
            <CheckCircle2 className="w-4 h-4 mr-2" /> Pre-Close Check
          </Button>
          <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
            <Calendar className="w-4 h-4 mr-2" /> Generate Periods
          </Button>
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

      {/* M12.2: Pre-Close Check Dialog */}
      <Dialog open={preCloseDialogOpen} onOpenChange={setPreCloseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pre-Close Validation Check</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select value={preCloseCheckBranchId} onValueChange={setPreCloseCheckBranchId}>
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
                <DatePicker value={preCloseCheckStartDate} onChange={setPreCloseCheckStartDate} />
              </div>
              <div>
                <Label>End Date</Label>
                <DatePicker value={preCloseCheckEndDate} onChange={setPreCloseCheckEndDate} />
              </div>
            </div>

            {preCloseCheckLoading && (
              <div className="text-sm text-muted-foreground">Running checks...</div>
            )}

            {preCloseCheckResult && (
              <div className="border rounded p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  <Badge
                    variant={
                      preCloseCheckResult.status === 'READY'
                        ? 'default'
                        : preCloseCheckResult.status === 'BLOCKED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {preCloseCheckResult.status === 'READY' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {preCloseCheckResult.status === 'BLOCKED' && <XCircle className="w-3 h-3 mr-1" />}
                    {preCloseCheckResult.status === 'WARNING' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {preCloseCheckResult.status}
                  </Badge>
                  {preCloseCheckResult.overrideAllowed && (
                    <Badge variant="outline">Override Allowed (L5)</Badge>
                  )}
                </div>
                <p className="text-sm">{preCloseCheckResult.summary}</p>

                <div className="space-y-2">
                  {preCloseCheckResult.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {item.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />}
                      {item.status === 'FAIL' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                      {item.status === 'WARN' && <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
                      <div>
                        <span className="font-medium">{item.category}:</span> {item.message}
                        {item.count > 0 && <span className="text-muted-foreground"> ({item.count} items)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreCloseDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => refetchPreCloseCheck()}
              disabled={!preCloseCheckBranchId || !preCloseCheckStartDate || !preCloseCheckEndDate}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Run Check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M12.2: Generate Periods Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Monthly Periods</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select value={genBranchId} onValueChange={setGenBranchId}>
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
                <Label>From Month (YYYY-MM)</Label>
                <Input
                  type="month"
                  value={genFromMonth}
                  onChange={(e) => setGenFromMonth(e.target.value)}
                  placeholder="2025-01"
                />
              </div>
              <div>
                <Label>To Month (YYYY-MM)</Label>
                <Input
                  type="month"
                  value={genToMonth}
                  onChange={(e) => setGenToMonth(e.target.value)}
                  placeholder="2025-12"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will create OPEN periods for each month in the range. Existing periods are skipped (idempotent).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!genBranchId || !genFromMonth || !genToMonth || generateMutation.isPending}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="reconciliation">GL Reconciliation</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
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

            {/* M12.2: Events tab */}
            <TabsContent value="events" className="mt-4">
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Actor</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodEvents?.map((evt) => (
                      <tr key={evt.id} className="border-t">
                        <td className="p-2">
                          <Badge variant="outline">{evt.type}</Badge>
                        </td>
                        <td className="p-2">{evt.actorName || evt.actorUserId}</td>
                        <td className="p-2">{format(new Date(evt.occurredAt), 'yyyy-MM-dd HH:mm:ss')}</td>
                        <td className="p-2">{evt.reason || '-'}</td>
                      </tr>
                    ))}
                    {(!periodEvents || periodEvents.length === 0) && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          No events recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* M12.2: Reopen Period Dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Closed Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPeriod && (
              <div className="text-sm">
                <p><strong>Period:</strong> {format(new Date(selectedPeriod.startDate), 'yyyy-MM-dd')} to {format(new Date(selectedPeriod.endDate), 'yyyy-MM-dd')}</p>
                <p><strong>Status:</strong> {selectedPeriod.status}</p>
              </div>
            )}
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Reopening a period will increment the revision number. New snapshots will be generated on re-close.
                This action is audit-logged.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Reason for Reopening *</Label>
              <textarea
                className="w-full border rounded p-2"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
                placeholder="Enter a detailed reason (min 10 characters)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reopenMutation.mutate()}
              disabled={reopenReason.length < 10 || reopenMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reopen Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* M12.2: Close Pack Dialog */}
      <Dialog open={closePackDialogOpen} onOpenChange={setClosePackDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Close Pack Summary</DialogTitle>
          </DialogHeader>

          {closePackLoading && (
            <div className="text-sm text-muted-foreground">Loading close pack...</div>
          )}

          {closePack && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Period:</span>{' '}
                  {format(new Date(closePack.startDate), 'yyyy-MM-dd')} to {format(new Date(closePack.endDate), 'yyyy-MM-dd')}
                </div>
                <div>
                  <span className="font-medium">Branch:</span> {closePack.branchName || closePack.branchId}
                </div>
                <div>
                  <span className="font-medium">Status:</span> <Badge variant="default">{closePack.status}</Badge>
                </div>
                <div>
                  <span className="font-medium">Revision:</span> {closePack.revision}
                </div>
              </div>

              <div className="border rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4" />
                  <span className="font-medium">Bundle Hash (SHA-256):</span>
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                  {closePack.bundleHash}
                </code>
              </div>

              <div>
                <h4 className="font-medium mb-2">Exports</h4>
                <div className="space-y-2">
                  {closePack.exports.map((exp, idx) => (
                    <div key={idx} className="flex items-center justify-between border rounded p-2 text-sm">
                      <div>
                        <span className="font-medium">{exp.type}</span>
                        <span className="text-muted-foreground ml-2">({exp.rows} rows)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1 rounded">{exp.hash.substring(0, 16)}...</code>
                        <Button variant="outline" size="sm" asChild>
                          <a href={exp.url} download>
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Event History</h4>
                <div className="border rounded">
                  <table className="w-full text-sm">
                    <tbody>
                      {closePack.events.map((evt) => (
                        <tr key={evt.id} className="border-t first:border-t-0">
                          <td className="p-2"><Badge variant="outline" className="text-xs">{evt.type}</Badge></td>
                          <td className="p-2">{evt.actorName}</td>
                          <td className="p-2 text-muted-foreground">{format(new Date(evt.occurredAt), 'yyyy-MM-dd HH:mm')}</td>
                          <td className="p-2">{evt.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Generated at: {format(new Date(closePack.generatedAt), 'yyyy-MM-dd HH:mm:ss')}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setClosePackDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
