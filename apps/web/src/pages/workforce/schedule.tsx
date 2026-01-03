/**
 * M10.2: Manager Schedule Page
 *
 * Features:
 * - Branch filter (multi-branch)
 * - Date range selector (week view)
 * - List planned shifts with status badges
 * - Create shift dialog
 * - Publish button for date range
 * - Conflict UI
 *
 * RBAC: L4+ (Manager, Owner)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Plus, Send, Users, Clock, AlertCircle } from 'lucide-react';

type ShiftStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED';

interface ScheduledShift {
  id: string;
  branchId: string;
  userId: string;
  role: string;
  startAt: string;
  endAt: string;
  plannedMinutes: number;
  actualMinutes: number | null;
  status: ShiftStatus;
  notes: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobRole: string;
}

const STATUS_COLORS: Record<ShiftStatus, string> = {
  DRAFT: 'bg-gray-500',
  PUBLISHED: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  COMPLETED: 'bg-green-500',
  APPROVED: 'bg-emerald-600',
  CANCELLED: 'bg-red-500',
};

const JOB_ROLES = [
  'OWNER',
  'MANAGER',
  'ACCOUNTANT',
  'PROCUREMENT',
  'STOCK_MANAGER',
  'SUPERVISOR',
  'CASHIER',
  'CHEF',
  'WAITER',
  'BARTENDER',
  'EVENT_MANAGER',
];

export default function SchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const queryClient = useQueryClient();

  // Date range - default to this week
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [fromDate, setFromDate] = useState(weekStart.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(weekEnd.toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>(activeBranchId || '');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Create shift form state
  const [newShift, setNewShift] = useState({
    userId: '',
    role: '',
    startDate: today.toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  });

  // Check if user has required role
  const hasAccess = user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel);

  // Fetch shifts
  const { data: shifts, isLoading } = useQuery<ScheduledShift[]>({
    queryKey: ['workforce-shifts', fromDate, toDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);

      const response = await apiClient.get(`/workforce/scheduling/shifts?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch users for assignment
  const { data: users } = useQuery<User[]>({
    queryKey: ['org-users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response.data;
    },
    enabled: !!user && isCreateOpen,
  });

  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      branchId: string;
      userId: string;
      role: string;
      startAt: string;
      endAt: string;
      notes?: string;
    }) => {
      const response = await apiClient.post('/workforce/scheduling/shifts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      setIsCreateOpen(false);
      setCreateError(null);
      toast({ title: 'Shift created', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message;
      setCreateError(msg);
      toast({ title: 'Failed to create shift', description: msg, variant: 'destructive' });
    },
  });

  // Publish shifts mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/scheduling/publish', {
        branchId: branchFilter || undefined,
        from: fromDate,
        to: toDate,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workforce-shifts'] });
      toast({ title: `Published ${data.publishedCount || 0} shifts`, variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to publish',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!newShift.userId || !newShift.role || !branchFilter) {
      setCreateError('Please select a branch, user, and role');
      return;
    }

    const startAt = new Date(`${newShift.startDate}T${newShift.startTime}`);
    const endAt = new Date(`${newShift.startDate}T${newShift.endTime}`);

    if (endAt <= startAt) {
      setCreateError('End time must be after start time');
      return;
    }

    createMutation.mutate({
      branchId: branchFilter,
      userId: newShift.userId,
      role: newShift.role,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      notes: newShift.notes || undefined,
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  const draftShifts = shifts?.filter((s) => s.status === 'DRAFT') || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Workforce Schedule
          </h1>
          <p className="text-muted-foreground">Manage staff shifts and schedules</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateOpen(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" /> Create Shift
          </Button>
          <Button
            onClick={() => publishMutation.mutate()}
            variant="outline"
            disabled={draftShifts.length === 0 || publishMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" /> Publish ({draftShifts.length} Draft)
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium">From Date</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div>
          <label className="text-sm font-medium">To Date</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Branches</SelectItem>
            {/* Branch options would be populated from API */}
          </SelectContent>
        </Select>
      </div>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Scheduled Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse">Loading shifts...</div>
          ) : !shifts || shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shifts scheduled for this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{formatDate(shift.startAt)}</TableCell>
                    <TableCell>
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatTime(shift.startAt)} - {formatTime(shift.endAt)}
                    </TableCell>
                    <TableCell>
                      {shift.user.firstName} {shift.user.lastName}
                    </TableCell>
                    <TableCell>{shift.role}</TableCell>
                    <TableCell>{shift.branch?.name || '—'}</TableCell>
                    <TableCell>{Math.floor(shift.plannedMinutes / 60)}h {shift.plannedMinutes % 60}m</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[shift.status]} text-white`}>
                        {shift.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Shift Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Shift</DialogTitle>
          </DialogHeader>

          {createError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded">
              <AlertCircle className="h-4 w-4" />
              {createError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee</label>
              <Select value={newShift.userId} onValueChange={(v) => setNewShift({ ...newShift, userId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.jobRole})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={newShift.role} onValueChange={(v) => setNewShift({ ...newShift, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={newShift.startDate}
                onChange={(e) => setNewShift({ ...newShift, startDate: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={newShift.notes}
                onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                placeholder="Add notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
