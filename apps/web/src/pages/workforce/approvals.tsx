/**
 * M10.2: Approvals Page
 *
 * Features:
 * - List COMPLETED shifts pending approval
 * - Branch + date range filters
 * - Approve action per shift
 * - After approval, display becomes read-only (APPROVED badge)
 *
 * RBAC: L4+ (Manager, Owner)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, Users, AlertTriangle } from 'lucide-react';

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
  breakMinutes: number | null;
  overtimeMinutes: number | null;
  status: ShiftStatus;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  branch: {
    id: string;
    name: string;
  };
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Date range - default to last 7 days
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [fromDate, setFromDate] = useState(weekAgo.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('COMPLETED');

  // Check if user has required role
  const hasAccess = user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel);

  // Fetch shifts for approval
  const { data: shifts, isLoading } = useQuery<ScheduledShift[]>({
    queryKey: ['approval-shifts', fromDate, toDate, branchFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get(`/workforce/scheduling/shifts?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  // Approve shift mutation
  const approveMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const response = await apiClient.post(`/workforce/scheduling/shifts/${shiftId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-shifts'] });
      toast({ title: 'Shift approved', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to approve shift',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const _formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  const pendingCount = shifts?.filter((s) => s.status === 'COMPLETED').length || 0;
  const approvedCount = shifts?.filter((s) => s.status === 'APPROVED').length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckCircle className="h-6 w-6" />
          Shift Approvals
        </h1>
        <p className="text-muted-foreground">Review and approve completed shifts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end flex-wrap">
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
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Branches</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed (Pending)</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Shifts for Approval
          </CardTitle>
          <CardDescription>
            Review completed shifts and approve actuals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse">Loading shifts...</div>
          ) : !shifts || shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shifts found for this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{formatDate(shift.startAt)}</TableCell>
                    <TableCell>
                      {shift.user.firstName} {shift.user.lastName}
                    </TableCell>
                    <TableCell>{shift.role}</TableCell>
                    <TableCell>{shift.branch?.name || '—'}</TableCell>
                    <TableCell>{formatMinutes(shift.plannedMinutes)}</TableCell>
                    <TableCell>{formatMinutes(shift.actualMinutes)}</TableCell>
                    <TableCell>{formatMinutes(shift.breakMinutes)}</TableCell>
                    <TableCell>
                      {shift.overtimeMinutes && shift.overtimeMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">
                          +{formatMinutes(shift.overtimeMinutes)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          shift.status === 'APPROVED'
                            ? 'bg-emerald-600 text-white'
                            : shift.status === 'COMPLETED'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-500 text-white'
                        }
                      >
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {shift.status === 'COMPLETED' ? (
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(shift.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      ) : shift.status === 'APPROVED' ? (
                        <span className="text-sm text-muted-foreground">Approved</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
