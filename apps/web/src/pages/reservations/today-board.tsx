/**
 * M9.3: Host Today Board
 * 
 * AC-07: View HELD/CONFIRMED/SEATED + waitlist, sortable, filterable
 * AC-08: Host actions (hold/confirm/seat/complete/no-show/cancel) with toasts
 * AC-09: Calendar timeline reflects changes immediately
 * AC-11: RBAC enforcement (Host/Manager allowed)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Users,
  Clock,
  Check,
  X,
  UserX,
  Play,
  RefreshCw,
} from 'lucide-react';

interface Reservation {
  id: string;
  name: string;
  phone: string | null;
  partySize: number;
  startAt: string;
  endAt: string;
  status: string;
  table: { id: string; label: string } | null;
  depositStatus: string;
  source: string;
}

interface WaitlistEntry {
  id: string;
  name: string;
  phone: string | null;
  partySize: number;
  waitingMinutes: number;
  quotedWaitMinutes: number | null;
  status: string;
}

interface TodayBoardData {
  date: string;
  branchId?: string;
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
  stats: {
    totalReservations: number;
    held: number;
    confirmed: number;
    seated: number;
    completed: number;
    noShow: number;
    cancelled: number;
    waitlistCount: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  HELD: 'bg-yellow-500',
  CONFIRMED: 'bg-blue-500',
  SEATED: 'bg-green-500',
  COMPLETED: 'bg-gray-500',
  NO_SHOW: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
};

export default function TodayBoardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;
  
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    reservationId: string;
    reservationName: string;
  }>({
    open: false,
    action: '',
    reservationId: '',
    reservationName: '',
  });

  // AC-11: RBAC check - redirect if not L2+
  useEffect(() => {
    if (user && user.roleLevel && !['L2', 'L3', 'L4', 'L5'].includes(user.roleLevel)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch today board data
  const { data, isLoading, refetch } = useQuery<TodayBoardData>({
    queryKey: ['today-board', branchId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      if (statusFilter === 'active') {
        params.append('status', 'HELD,CONFIRMED,SEATED');
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('includeWaitlist', 'true');
      
      const response = await apiClient.get(
        `/reservations/today-board?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // AC-09: Auto-refresh every 30s
  });

  // Mutation handlers
  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/reservations/${id}/confirm`, {}),
    onSuccess: () => {
      toast({ title: 'Reservation confirmed', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to confirm reservation', variant: 'destructive' });
    },
  });

  const seatMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/reservations/${id}/seat`, {}),
    onSuccess: () => {
      toast({ title: 'Guest seated', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to seat guest', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/reservations/${id}/complete`, {}),
    onSuccess: () => {
      toast({ title: 'Reservation completed', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to complete reservation', variant: 'destructive' });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/reservations/${id}/no-show-with-grace`, {}),
    onSuccess: (response) => {
      const resData = response.data as { forfeited: boolean; amount: number };
      if (resData.forfeited) {
        toast({
          title: 'No-show recorded',
          description: `Deposit of $${resData.amount} forfeited`,
          variant: 'default',
        });
      } else {
        toast({ title: 'No-show recorded (within grace period)', variant: 'default' });
      }
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to mark no-show', variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/reservations/${id}/cancel`, { reason: 'Cancelled by host' }),
    onSuccess: () => {
      toast({ title: 'Reservation cancelled', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to cancel reservation', variant: 'destructive' });
    },
  });

  const seatWaitlistMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/waitlist/${id}/seat`, {}),
    onSuccess: () => {
      toast({ title: 'Waitlist guest seated', variant: 'default' });
      queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: () => {
      toast({ title: 'Failed to seat waitlist guest', variant: 'destructive' });
    },
  });

  // AC-08: Action handlers with confirmation dialogs
  const handleAction = useCallback((action: string, reservationId: string, name: string) => {
    setConfirmDialog({
      open: true,
      action,
      reservationId,
      reservationName: name,
    });
  }, []);

  const executeAction = useCallback(() => {
    const { action, reservationId } = confirmDialog;
    switch (action) {
      case 'confirm':
        confirmMutation.mutate(reservationId);
        break;
      case 'seat':
        seatMutation.mutate(reservationId);
        break;
      case 'complete':
        completeMutation.mutate(reservationId);
        break;
      case 'noShow':
        noShowMutation.mutate(reservationId);
        break;
      case 'cancel':
        cancelMutation.mutate(reservationId);
        break;
      case 'seatWaitlist':
        seatWaitlistMutation.mutate(reservationId);
        break;
    }
    setConfirmDialog({ ...confirmDialog, open: false });
  }, [confirmDialog, confirmMutation, seatMutation, completeMutation, noShowMutation, cancelMutation, seatWaitlistMutation]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionButtons = (res: Reservation) => {
    const buttons = [];
    
    if (res.status === 'HELD') {
      buttons.push(
        <Button
          key="confirm"
          size="sm"
          variant="outline"
          onClick={() => handleAction('confirm', res.id, res.name)}
          className="mr-1"
        >
          <Check className="h-4 w-4 mr-1" /> Confirm
        </Button>
      );
      buttons.push(
        <Button
          key="cancel"
          size="sm"
          variant="outline"
          onClick={() => handleAction('cancel', res.id, res.name)}
        >
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      );
    }
    
    if (res.status === 'CONFIRMED') {
      buttons.push(
        <Button
          key="seat"
          size="sm"
          variant="default"
          onClick={() => handleAction('seat', res.id, res.name)}
          className="mr-1"
        >
          <Play className="h-4 w-4 mr-1" /> Seat
        </Button>
      );
      buttons.push(
        <Button
          key="noShow"
          size="sm"
          variant="destructive"
          onClick={() => handleAction('noShow', res.id, res.name)}
        >
          <UserX className="h-4 w-4 mr-1" /> No-Show
        </Button>
      );
    }
    
    if (res.status === 'SEATED') {
      buttons.push(
        <Button
          key="complete"
          size="sm"
          variant="default"
          onClick={() => handleAction('complete', res.id, res.name)}
        >
          <Check className="h-4 w-4 mr-1" /> Complete
        </Button>
      );
    }
    
    return buttons;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading today board...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Today&apos;s Board</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (Held/Confirmed/Seated)</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="HELD">Held Only</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed Only</SelectItem>
            <SelectItem value="SEATED">Seated Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.totalReservations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">Held</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.held}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Confirmed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.confirmed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Seated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.seated}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">No-Show</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.noShow}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.cancelled}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600">Waitlist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.stats.waitlistCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reservations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {formatTime(res.startAt)} - {formatTime(res.endAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{res.name}</div>
                      {res.phone && (
                        <div className="text-sm text-muted-foreground">{res.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {res.partySize}
                    </div>
                  </TableCell>
                  <TableCell>{res.table?.label || '-'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[res.status] || 'bg-gray-500'}>
                      {res.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {res.depositStatus !== 'NONE' && (
                      <Badge variant="outline">{res.depositStatus}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">{getActionButtons(res)}</div>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.reservations || data.reservations.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No reservations for today
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Waitlist Section */}
      {data?.waitlist && data.waitlist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waitlist</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Waiting</TableHead>
                  <TableHead>Quoted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.waitlist.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.name}</div>
                        {entry.phone && (
                          <div className="text-sm text-muted-foreground">{entry.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {entry.partySize}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={entry.waitingMinutes > 30 ? 'text-red-600' : ''}>
                        {entry.waitingMinutes} min
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.quotedWaitMinutes ? `${entry.quotedWaitMinutes} min` : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAction('seatWaitlist', entry.id, entry.name)}
                      >
                        <Play className="h-4 w-4 mr-1" /> Seat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {confirmDialog.action}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmDialog.action} the reservation for{' '}
              <strong>{confirmDialog.reservationName}</strong>?
              {confirmDialog.action === 'noShow' && (
                <span className="block mt-2 text-destructive">
                  This may forfeit any deposit if past grace period.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
