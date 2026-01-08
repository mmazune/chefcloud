/**
 * M12.6: Inventory Close Requests Page
 *
 * List and manage period close requests with:
 * - Filters: branch, status, period
 * - Actions: create (L3+), approve/reject (L4+)
 * - Request history/events
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { Plus, Check, X, Download, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';

// ============================================
// Types
// ============================================

interface CloseRequest {
  id: string;
  orgId: string;
  branchId: string;
  periodId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  requestedById: string;
  requestedByName: string;
  requestedAt: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  period: {
    startDate: string;
    endDate: string;
    status: string;
  };
  branch: {
    name: string;
  };
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

// ============================================
// Component
// ============================================

export default function CloseRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Dialogs
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CloseRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Check role level
  const canApprove = user?.roleLevel && user.roleLevel >= 5; // L5+
  const canCreate = user?.roleLevel && user.roleLevel >= 4; // L4+

  // ============================================
  // Queries
  // ============================================

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data;
    },
  });

  const { data: requests = [], isLoading, refetch } = useQuery<CloseRequest[]>({
    queryKey: ['close-requests', branchFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.append('branchId', branchFilter);
      if (statusFilter) params.append('status', statusFilter);
      const res = await apiClient.get(`/inventory/periods/close-requests?${params}`);
      return res.data;
    },
  });

  // ============================================
  // Mutations
  // ============================================

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const res = await apiClient.post(`/inventory/periods/close-requests/${requestId}/approve`, { notes });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-requests'] });
      setApproveDialogOpen(false);
      setApproveNotes('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiClient.post(`/inventory/periods/close-requests/${requestId}/reject`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-requests'] });
      setRejectDialogOpen(false);
      setRejectReason('');
    },
  });

  // ============================================
  // Handlers
  // ============================================

  const handleApprove = (request: CloseRequest) => {
    setSelectedRequest(request);
    setApproveDialogOpen(true);
  };

  const handleReject = (request: CloseRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (branchFilter) params.append('branchId', branchFilter);
    if (statusFilter) params.append('status', statusFilter);
    
    const res = await apiClient.get(`/inventory/periods/close-requests/export?${params}`, {
      responseType: 'blob',
    });
    
    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'close-requests-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // Status Badge
  // ============================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'SUBMITTED':
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // ============================================
  // Columns
  // ============================================

  const columns = [
    {
      accessorKey: 'branch.name',
      header: 'Branch',
      cell: ({ row }: any) => row.original.branch?.name || '-',
    },
    {
      accessorKey: 'period',
      header: 'Period',
      cell: ({ row }: any) => {
        const p = row.original.period;
        if (!p) return '-';
        return `${format(new Date(p.startDate), 'MMM d')} - ${format(new Date(p.endDate), 'MMM d, yyyy')}`;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'requestedByName',
      header: 'Requested By',
    },
    {
      accessorKey: 'requestedAt',
      header: 'Requested At',
      cell: ({ row }: any) => row.original.requestedAt ? format(new Date(row.original.requestedAt), 'MMM d, yyyy HH:mm') : '-',
    },
    {
      accessorKey: 'approvedByName',
      header: 'Reviewed By',
      cell: ({ row }: any) => row.original.approvedByName || '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const request = row.original;
        if (request.status !== 'SUBMITTED' || !canApprove) return null;
        
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-600"
              onClick={() => handleApprove(request)}
            >
              <Check className="w-3 h-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-600"
              onClick={() => handleReject(request)}
            >
              <X className="w-3 h-3 mr-1" />
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  // ============================================
  // Render
  // ============================================

  return (
    <AppShell>
      <PageHeader
        title="Close Requests"
        description="Manage period close approval requests"
      >
        {canCreate && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </PageHeader>

      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end">
          <div className="w-48">
            <Label>Branch</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
      />

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Close Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Approve close request for {selectedRequest?.branch?.name} - Period {selectedRequest?.period?.startDate?.slice(0, 10)} to {selectedRequest?.period?.endDate?.slice(0, 10)}?
            </p>
            <Label>Notes (optional)</Label>
            <Textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Optional approval notes..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600"
              onClick={() => selectedRequest && approveMutation.mutate({ requestId: selectedRequest.id, notes: approveNotes })}
              disabled={approveMutation.isPending}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Close Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Reject close request for {selectedRequest?.branch?.name}?
            </p>
            <Label>Reason (required, min 10 characters)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="mt-2"
            />
            {rejectReason.length > 0 && rejectReason.length < 10 && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>Reason must be at least 10 characters</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectReason })}
              disabled={rejectMutation.isPending || rejectReason.length < 10}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
