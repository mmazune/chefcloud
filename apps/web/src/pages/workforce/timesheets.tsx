/**
 * M10.4: Timesheets Page
 *
 * Features:
 * - List pending timesheet approvals per pay period
 * - Bulk approve/reject with audit trail
 * - Filter by branch, user, pay period
 *
 * RBAC: L3+ (Supervisor, Manager, Owner)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardCheck, CheckCircle, XCircle, Clock, Users } from 'lucide-react';

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface TimesheetApproval {
  id: string;
  orgId: string;
  userId: string;
  branchId: string | null;
  payPeriodId: string;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  payPeriod?: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function TimesheetsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [_branchFilter, _setBranchFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Check if user has required role (L3+ = Supervisor, Manager, Owner)
  const hasAccess = Boolean(user && user.roleLevel && ['L3', 'L4', 'L5'].includes(user.roleLevel));

  // Fetch pending approvals
  const { data: approvals, isLoading } = useQuery<TimesheetApproval[]>({
    queryKey: ['timesheet-approvals'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/timesheets/pending');
      return response.data;
    },
    enabled: hasAccess,
  });

  // Fetch pay periods for reference (reserved for future use)
  const { data: _payPeriods } = useQuery<PayPeriod[]>({
    queryKey: ['pay-periods-list'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/pay-periods');
      return response.data;
    },
    enabled: hasAccess,
  });

  // Bulk approve mutation
  const approveMutation = useMutation({
    mutationFn: async (timeEntryIds: string[]) => {
      const response = await apiClient.post('/workforce/timesheets/approve', { timeEntryIds });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-approvals'] });
      setSelectedIds(new Set());
      toast({
        title: 'Timesheets approved',
        description: `${data.approved} timesheet(s) approved successfully.`,
      });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to approve timesheets',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (timeEntryIds: string[]) => {
      const response = await apiClient.post('/workforce/timesheets/reject', { timeEntryIds });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timesheet-approvals'] });
      setSelectedIds(new Set());
      toast({
        title: 'Timesheets rejected',
        description: `${data.rejected} timesheet(s) rejected.`,
      });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to reject timesheets',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!approvals) return;
    const pendingIds = approvals.filter((a) => a.status === 'PENDING').map((a) => a.id);
    if (selectedIds.size === pendingIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No timesheets selected', variant: 'destructive' });
      return;
    }
    approveMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'No timesheets selected', variant: 'destructive' });
      return;
    }
    rejectMutation.mutate(Array.from(selectedIds));
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  const pendingCount = approvals?.filter((a) => a.status === 'PENDING').length || 0;
  const approvedCount = approvals?.filter((a) => a.status === 'APPROVED').length || 0;
  const pendingApprovals = approvals?.filter((a) => a.status === 'PENDING') || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          Timesheet Approvals
        </h1>
        <p className="text-muted-foreground">
          Review and approve employee timesheets for payroll processing
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending Review
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedIds.size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        <Button
          onClick={handleBulkApprove}
          disabled={selectedIds.size === 0 || approveMutation.isPending}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Approve Selected ({selectedIds.size})
        </Button>
        <Button
          variant="destructive"
          onClick={handleBulkReject}
          disabled={selectedIds.size === 0 || rejectMutation.isPending}
          className="flex items-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Reject Selected ({selectedIds.size})
        </Button>
      </div>

      {/* Timesheets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Timesheets</CardTitle>
          <CardDescription>
            Select timesheets to approve or reject. Only pending timesheets can be actioned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-muted-foreground">
              No pending timesheets. All caught up!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pendingApprovals.length && pendingApprovals.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Regular</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(approval.id)}
                        onChange={() => toggleSelect(approval.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {approval.user
                            ? `${approval.user.firstName} ${approval.user.lastName}`
                            : 'Unknown'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {approval.user?.email || ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {approval.payPeriod
                        ? `${formatDate(approval.payPeriod.startDate)} - ${formatDate(approval.payPeriod.endDate)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMinutes(approval.totalMinutes)}
                    </TableCell>
                    <TableCell>{formatMinutes(approval.regularMinutes)}</TableCell>
                    <TableCell>
                      {approval.overtimeMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">
                          {formatMinutes(approval.overtimeMinutes)}
                        </span>
                      ) : (
                        formatMinutes(approval.overtimeMinutes)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          approval.status === 'APPROVED'
                            ? 'default'
                            : approval.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {approval.status}
                      </Badge>
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
