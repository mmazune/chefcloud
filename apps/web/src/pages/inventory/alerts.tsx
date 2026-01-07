/**
 * M11.12: Inventory Alerts Dashboard
 * 
 * Displays inventory alerts with lifecycle management:
 * - List alerts with filters (type, severity, status)
 * - Evaluate alerts (manual trigger)
 * - Acknowledge alerts (L4+)
 * - Resolve alerts (L4+)
 * 
 * RBAC: L2+ read, L4+ actions
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Play,
  Eye,
} from 'lucide-react';

// ============================================
// Interfaces
// ============================================

type AlertType = 'DEAD_STOCK' | 'EXPIRY_SOON' | 'EXPIRED' | 'BELOW_REORDER_POINT' | 'HIGH_WASTE' | 'HIGH_VARIANCE';
type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';
type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

interface AlertItem {
  id: string;
  orgId: string;
  branchId: string | null;
  type: AlertType;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  detailsJson: Record<string, unknown>;
  status: AlertStatus;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AlertListResult {
  items: AlertItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface EvaluateResult {
  created: number;
  skippedDuplicate: number;
  alertsByType: Record<string, number>;
}

// ============================================
// Component
// ============================================

export default function InventoryAlertsPage() {
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch alerts
  const { data: alertsData, isLoading, refetch } = useQuery({
    queryKey: ['inventory-alerts', selectedType, selectedSeverity, selectedStatus, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: page.toString(),
        pageSize: '20',
      };
      if (selectedType) params.type = selectedType;
      if (selectedSeverity) params.severity = selectedSeverity;
      if (selectedStatus) params.status = selectedStatus;

      const response = await apiClient.get<AlertListResult>('/inventory/alerts', { params });
      return response.data;
    },
  });

  // Evaluate mutation
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<EvaluateResult>('/inventory/alerts/evaluate', {});
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Alerts Evaluated',
        description: `Created ${data.created} new alerts, skipped ${data.skippedDuplicate} duplicates`,
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to evaluate alerts',
        variant: 'destructive',
      });
    },
  });

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.post<AlertItem>(`/inventory/alerts/${alertId}/acknowledge`);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged',
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      setSelectedAlert(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, note }: { alertId: string; note?: string }) => {
      const response = await apiClient.post<AlertItem>(`/inventory/alerts/${alertId}/resolve`, {
        resolutionNote: note,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Alert Resolved',
        description: 'The alert has been resolved',
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      setSelectedAlert(null);
      setResolveDialogOpen(false);
      setResolutionNote('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to resolve alert',
        variant: 'destructive',
      });
    },
  });

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'WARN':
        return <Badge variant="warning">Warning</Badge>;
      case 'INFO':
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="outline" className="border-red-500 text-red-500">Open</Badge>;
      case 'ACKNOWLEDGED':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Acknowledged</Badge>;
      case 'RESOLVED':
        return <Badge variant="outline" className="border-green-500 text-green-500">Resolved</Badge>;
    }
  };

  const getTypeBadge = (type: AlertType) => {
    const labels: Record<AlertType, string> = {
      DEAD_STOCK: 'Dead Stock',
      EXPIRY_SOON: 'Expiring Soon',
      EXPIRED: 'Expired',
      BELOW_REORDER_POINT: 'Below Reorder',
      HIGH_WASTE: 'High Waste',
      HIGH_VARIANCE: 'High Variance',
    };
    return <Badge variant="secondary">{labels[type]}</Badge>;
  };

  return (
    <AppShell>
      <PageHeader
        title="Inventory Alerts"
        subtitle="Monitor and manage inventory alerts"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="default" 
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {evaluateMutation.isPending ? 'Evaluating...' : 'Evaluate Alerts'}
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-1 block">Type</label>
            <select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="DEAD_STOCK">Dead Stock</option>
              <option value="EXPIRY_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="BELOW_REORDER_POINT">Below Reorder</option>
              <option value="HIGH_WASTE">High Waste</option>
              <option value="HIGH_VARIANCE">High Variance</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-1 block">Severity</label>
            <select 
              value={selectedSeverity} 
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts Table */}
      <Card className="p-6">
        {isLoading ? (
          <p>Loading alerts...</p>
        ) : (
          <>
            <DataTable
              data={alertsData?.items ?? []}
              columns={[
                { 
                  header: 'Severity', 
                  accessorKey: 'severity',
                  cell: ({ row }) => getSeverityBadge(row.original.severity),
                },
                { 
                  header: 'Type', 
                  accessorKey: 'type',
                  cell: ({ row }) => getTypeBadge(row.original.type),
                },
                { header: 'Title', accessorKey: 'title' },
                { 
                  header: 'Status', 
                  accessorKey: 'status',
                  cell: ({ row }) => getStatusBadge(row.original.status),
                },
                { 
                  header: 'Created', 
                  accessorKey: 'createdAt',
                  cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
                },
                {
                  header: 'Actions',
                  accessorKey: 'id',
                  cell: ({ row }) => (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAlert(row.original)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {row.original.status === 'OPEN' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => acknowledgeMutation.mutate(row.original.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 text-yellow-500" />
                        </Button>
                      )}
                      {row.original.status !== 'RESOLVED' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedAlert(row.original);
                            setResolveDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {alertsData?.items.length ?? 0} of {alertsData?.total ?? 0} alerts
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(alertsData?.items.length ?? 0) < 20}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert && !resolveDialogOpen} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <div>{getTypeBadge(selectedAlert.type)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <div>{getSeverityBadge(selectedAlert.severity)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div>{getStatusBadge(selectedAlert.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Created</label>
                  <div className="text-sm">{new Date(selectedAlert.createdAt).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Title</label>
                <p className="text-sm">{selectedAlert.title}</p>
              </div>

              <div>
                <label className="text-sm font-medium">Details</label>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(selectedAlert.detailsJson, null, 2)}
                </pre>
              </div>

              {selectedAlert.acknowledgedAt && (
                <div>
                  <label className="text-sm font-medium">Acknowledged</label>
                  <p className="text-sm">{new Date(selectedAlert.acknowledgedAt).toLocaleString()}</p>
                </div>
              )}

              {selectedAlert.resolvedAt && (
                <div>
                  <label className="text-sm font-medium">Resolved</label>
                  <p className="text-sm">{new Date(selectedAlert.resolvedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedAlert?.status === 'OPEN' && (
              <Button 
                onClick={() => acknowledgeMutation.mutate(selectedAlert.id)}
                disabled={acknowledgeMutation.isPending}
              >
                Acknowledge
              </Button>
            )}
            {selectedAlert?.status !== 'RESOLVED' && (
              <Button 
                variant="outline"
                onClick={() => setResolveDialogOpen(true)}
              >
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Resolution Note (optional)</label>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Enter resolution notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedAlert) {
                  resolveMutation.mutate({ 
                    alertId: selectedAlert.id, 
                    note: resolutionNote || undefined 
                  });
                }
              }}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
