/**
 * M10.11: Swap Approvals Page (Manager)
 *
 * Features:
 * - View all pending swap requests for their team/location
 * - Approve or reject swaps with conflict detection
 * - View swap history
 *
 * RBAC: MANAGER, OWNER, SUPERVISOR (L3-L5)
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeftRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface SwapRequest {
  id: string;
  requestorId: string;
  requestorName: string;
  targetUserId: string;
  targetUserName: string;
  requestorShiftId: string;
  requestorShiftDate: string;
  requestorShiftStart: string;
  requestorShiftEnd: string;
  targetShiftId: string;
  targetShiftDate: string;
  targetShiftStart: string;
  targetShiftEnd: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConflictInfo {
  hasConflicts: boolean;
  conflicts: Array<{
    userId: string;
    userName: string;
    type: string;
    description: string;
  }>;
}

const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'approved':
      return 'default';
    case 'rejected':
      return 'destructive';
    case 'cancelled':
      return 'outline';
    case 'pending':
    default:
      return 'secondary';
  }
};

export default function SwapApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  // Fetch pending swap requests
  const { data: pendingSwaps, isLoading: loadingPending, refetch: refetchPending } = useQuery<SwapRequest[]>({
    queryKey: ['manager-swaps', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/swaps', { params: { status: 'pending' } });
      return res.data;
    },
  });

  // Fetch swap history
  const { data: historySwaps, isLoading: loadingHistory, refetch: refetchHistory } = useQuery<SwapRequest[]>({
    queryKey: ['manager-swaps', 'history'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/swaps', { params: { status: 'all' } });
      return res.data?.filter((s: SwapRequest) => s.status !== 'pending') || [];
    },
  });

  // Fetch conflicts for selected swap
  const { data: conflicts, isLoading: loadingConflicts } = useQuery<ConflictInfo>({
    queryKey: ['swap-conflicts', selectedSwap?.id],
    queryFn: async () => {
      if (!selectedSwap) return { hasConflicts: false, conflicts: [] };
      const res = await apiClient.get(`/workforce/swaps/${selectedSwap.id}/conflicts`);
      return res.data;
    },
    enabled: !!selectedSwap,
  });

  // Mutation: Approve swap
  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await apiClient.post(`/workforce/swaps/${id}/approve`, { note });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Swap request approved' });
      queryClient.invalidateQueries({ queryKey: ['manager-swaps'] });
      closeReviewDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Reject swap
  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await apiClient.post(`/workforce/swaps/${id}/reject`, { note });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Swap request rejected' });
      queryClient.invalidateQueries({ queryKey: ['manager-swaps'] });
      closeReviewDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reject', description: error.message, variant: 'destructive' });
    },
  });

  const openReviewDialog = (swap: SwapRequest, action: 'approve' | 'reject') => {
    setSelectedSwap(swap);
    setReviewAction(action);
    setReviewNote('');
    setShowReviewDialog(true);
  };

  const closeReviewDialog = () => {
    setShowReviewDialog(false);
    setSelectedSwap(null);
    setReviewAction(null);
    setReviewNote('');
  };

  const handleReviewSubmit = () => {
    if (!selectedSwap || !reviewAction) return;
    if (reviewAction === 'approve') {
      approveMutation.mutate({ id: selectedSwap.id, note: reviewNote });
    } else {
      rejectMutation.mutate({ id: selectedSwap.id, note: reviewNote });
    }
  };

  const handleRefresh = () => {
    refetchPending();
    refetchHistory();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>Please log in to access this page.</span>
      </div>
    );
  }

  const renderSwapRow = (swap: SwapRequest, showActions: boolean) => (
    <TableRow key={swap.id}>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(swap.status)}>
          {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">{swap.requestorName}</TableCell>
      <TableCell>
        <div className="text-sm">
          <div>{format(parseISO(swap.requestorShiftDate), 'MMM d, yyyy')}</div>
          <div className="text-muted-foreground">{swap.requestorShiftStart} - {swap.requestorShiftEnd}</div>
        </div>
      </TableCell>
      <TableCell>
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
      </TableCell>
      <TableCell className="font-medium">{swap.targetUserName}</TableCell>
      <TableCell>
        <div className="text-sm">
          <div>{format(parseISO(swap.targetShiftDate), 'MMM d, yyyy')}</div>
          <div className="text-muted-foreground">{swap.targetShiftStart} - {swap.targetShiftEnd}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
          {format(parseISO(swap.createdAt), 'MMM d, h:mm a')}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {showActions ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openReviewDialog(swap, 'reject')}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => openReviewDialog(swap, 'approve')}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve
            </Button>
          </div>
        ) : (
          swap.reviewNote && (
            <span className="text-sm text-muted-foreground" title={swap.reviewNote}>
              {swap.reviewNote.substring(0, 30)}...
            </span>
          )
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Swap Approvals</h1>
          <p className="text-muted-foreground">Review and manage staff shift swap requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSwaps?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting your decision</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {historySwaps?.filter((s) => s.status === 'approved').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {historySwaps?.filter((s) => s.status === 'rejected').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab buttons */}
      <div className="flex space-x-2 border-b pb-2">
        <Button
          variant={activeTab === 'pending' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({pendingSwaps?.length || 0})
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('history')}
        >
          History
        </Button>
      </div>

      {activeTab === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Swap Requests</CardTitle>
            <CardDescription>Swap requests awaiting your approval or rejection</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (pendingSwaps?.length || 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending swap requests at this time.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Requestor</TableHead>
                    <TableHead>Their Shift</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Swap With</TableHead>
                    <TableHead>Target Shift</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingSwaps?.map((swap) => renderSwapRow(swap, true))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Swap History</CardTitle>
            <CardDescription>Previously reviewed swap requests</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (historySwaps?.length || 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No swap history to display.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Requestor</TableHead>
                    <TableHead>Their Shift</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Swap With</TableHead>
                    <TableHead>Target Shift</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historySwaps?.map((swap) => renderSwapRow(swap, false))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Swap Request
            </DialogTitle>
            <DialogDescription>
              Review the swap details and add any notes
            </DialogDescription>
          </DialogHeader>
          {selectedSwap && (
            <div className="space-y-4 py-4">
              {/* Swap Details */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedSwap.requestorName}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(parseISO(selectedSwap.requestorShiftDate), 'MMM d')} • {selectedSwap.requestorShiftStart} - {selectedSwap.requestorShiftEnd}
                    </div>
                  </div>
                  <ArrowLeftRight className="w-5 h-5 text-muted-foreground mx-4" />
                  <div className="text-right">
                    <div className="font-medium">{selectedSwap.targetUserName}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(parseISO(selectedSwap.targetShiftDate), 'MMM d')} • {selectedSwap.targetShiftStart} - {selectedSwap.targetShiftEnd}
                    </div>
                  </div>
                </div>
                {selectedSwap.reason && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Reason: </span>
                    <span className="text-sm">{selectedSwap.reason}</span>
                  </div>
                )}
              </div>

              {/* Conflict Warning */}
              {loadingConflicts ? (
                <div className="text-center text-muted-foreground text-sm">Checking for conflicts...</div>
              ) : conflicts?.hasConflicts && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Scheduling Conflicts Detected
                  </div>
                  <ul className="text-sm text-amber-600 space-y-1">
                    {conflicts.conflicts.map((c, i) => (
                      <li key={i}>• {c.userName}: {c.description}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <Label>Add a note (optional)</Label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={reviewAction === 'approve'
                    ? 'e.g., Approved - schedules updated'
                    : 'e.g., Cannot approve due to overtime concerns'
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeReviewDialog}>Cancel</Button>
            <Button
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              onClick={handleReviewSubmit}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {approveMutation.isPending || rejectMutation.isPending
                ? 'Processing...'
                : reviewAction === 'approve'
                  ? 'Approve Swap'
                  : 'Reject Swap'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
