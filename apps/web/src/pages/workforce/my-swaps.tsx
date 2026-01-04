/**
 * M10.11: My Swaps Page (Staff Self-Service)
 *
 * Features:
 * - View own swap requests (sent and received)
 * - Create new swap requests
 * - Cancel pending requests
 *
 * RBAC: All roles (L1-L5) - only shows/manages own swaps
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Plus, RefreshCw, AlertCircle, X, Check, Clock } from 'lucide-react';
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
  createdAt: string;
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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <Check className="w-3 h-3 mr-1" />;
    case 'rejected':
    case 'cancelled':
      return <X className="w-3 h-3 mr-1" />;
    default:
      return <Clock className="w-3 h-3 mr-1" />;
  }
};

export default function MySwapsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('sent');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSwap, setNewSwap] = useState({
    targetUserId: '',
    requestorShiftId: '',
    targetShiftId: '',
    reason: '',
  });

  // Fetch my swap requests
  const { data: swaps, isLoading, refetch } = useQuery<SwapRequest[]>({
    queryKey: ['my-swaps'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/self/swaps');
      return res.data;
    },
  });

  // Mutation: Create swap request
  const createSwapMutation = useMutation({
    mutationFn: async (data: typeof newSwap) => {
      const res = await apiClient.post('/workforce/self/swaps', data);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Swap request created' });
      queryClient.invalidateQueries({ queryKey: ['my-swaps'] });
      setShowCreateDialog(false);
      setNewSwap({ targetUserId: '', requestorShiftId: '', targetShiftId: '', reason: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create swap', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Cancel swap request
  const cancelSwapMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/workforce/self/swaps/${id}/cancel`);
    },
    onSuccess: () => {
      toast({ title: 'Swap request cancelled' });
      queryClient.invalidateQueries({ queryKey: ['my-swaps'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel swap', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Accept swap request (as target)
  const acceptSwapMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/workforce/self/swaps/${id}/accept`);
    },
    onSuccess: () => {
      toast({ title: 'Swap request accepted' });
      queryClient.invalidateQueries({ queryKey: ['my-swaps'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to accept swap', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Decline swap request (as target)
  const declineSwapMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/workforce/self/swaps/${id}/decline`);
    },
    onSuccess: () => {
      toast({ title: 'Swap request declined' });
      queryClient.invalidateQueries({ queryKey: ['my-swaps'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to decline swap', description: error.message, variant: 'destructive' });
    },
  });

  const sentSwaps = swaps?.filter((s) => s.requestorId === user?.id) || [];
  const receivedSwaps = swaps?.filter((s) => s.targetUserId === user?.id) || [];

  const handleCreateSwap = () => {
    createSwapMutation.mutate(newSwap);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>Please log in to view your swaps.</span>
      </div>
    );
  }

  const renderSwapRow = (swap: SwapRequest, type: 'sent' | 'received') => (
    <TableRow key={swap.id}>
      <TableCell>
        <Badge variant={getStatusBadgeVariant(swap.status)} className="flex items-center w-fit">
          {getStatusIcon(swap.status)}
          {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        {type === 'sent' ? swap.targetUserName : swap.requestorName}
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div>{format(parseISO(swap.requestorShiftDate), 'MMM d')}</div>
          <div className="text-muted-foreground">{swap.requestorShiftStart} - {swap.requestorShiftEnd}</div>
        </div>
      </TableCell>
      <TableCell>
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div>{format(parseISO(swap.targetShiftDate), 'MMM d')}</div>
          <div className="text-muted-foreground">{swap.targetShiftStart} - {swap.targetShiftEnd}</div>
        </div>
      </TableCell>
      <TableCell>{swap.reason || '-'}</TableCell>
      <TableCell className="text-right">
        {type === 'sent' && swap.status === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => cancelSwapMutation.mutate(swap.id)}
            disabled={cancelSwapMutation.isPending}
          >
            Cancel
          </Button>
        )}
        {type === 'received' && swap.status === 'pending' && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => declineSwapMutation.mutate(swap.id)}
              disabled={declineSwapMutation.isPending}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => acceptSwapMutation.mutate(swap.id)}
              disabled={acceptSwapMutation.isPending}
            >
              Accept
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Swaps</h1>
          <p className="text-muted-foreground">View and manage your shift swap requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Request Swap
          </Button>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex space-x-2 border-b pb-2">
        <Button
          variant={activeTab === 'sent' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('sent')}
        >
          Sent Requests ({sentSwaps.length})
        </Button>
        <Button
          variant={activeTab === 'received' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('received')}
        >
          Received Requests ({receivedSwaps.length})
        </Button>
      </div>

      {activeTab === 'sent' && (
        <Card>
          <CardHeader>
            <CardTitle>Swap Requests I Sent</CardTitle>
            <CardDescription>Requests you have submitted to swap shifts with others</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : sentSwaps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No swap requests sent. Click &quot;Request Swap&quot; to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Swap With</TableHead>
                    <TableHead>My Shift</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Their Shift</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentSwaps.map((swap) => renderSwapRow(swap, 'sent'))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'received' && (
        <Card>
          <CardHeader>
            <CardTitle>Swap Requests I Received</CardTitle>
            <CardDescription>Requests from others to swap shifts with you</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : receivedSwaps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No swap requests received.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Their Shift</TableHead>
                    <TableHead></TableHead>
                    <TableHead>My Shift</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedSwaps.map((swap) => renderSwapRow(swap, 'received'))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Swap Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
            <DialogDescription>
              Submit a request to swap one of your shifts with a colleague
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Staff Member ID</Label>
              <Input
                value={newSwap.targetUserId}
                onChange={(e) => setNewSwap({ ...newSwap, targetUserId: e.target.value })}
                placeholder="Enter staff member ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Your Shift ID</Label>
              <Input
                value={newSwap.requestorShiftId}
                onChange={(e) => setNewSwap({ ...newSwap, requestorShiftId: e.target.value })}
                placeholder="Enter your shift ID to swap"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Shift ID</Label>
              <Input
                value={newSwap.targetShiftId}
                onChange={(e) => setNewSwap({ ...newSwap, targetShiftId: e.target.value })}
                placeholder="Enter target shift ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={newSwap.reason}
                onChange={(e) => setNewSwap({ ...newSwap, reason: e.target.value })}
                placeholder="e.g., Need day off for appointment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSwap}
              disabled={createSwapMutation.isPending || !newSwap.targetUserId || !newSwap.requestorShiftId || !newSwap.targetShiftId}
            >
              {createSwapMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
