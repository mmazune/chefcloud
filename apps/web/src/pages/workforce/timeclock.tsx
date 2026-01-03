/**
 * M10.2: Staff Timeclock Page
 *
 * Features:
 * - Today's shift card
 * - Clock-in/clock-out buttons
 * - Break start/end buttons
 * - Current status indicator
 * - Last 10 time entries table
 *
 * RBAC: L2+ (Staff sees only self data)
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
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
import { Clock, Play, Square, Coffee, Timer, CheckCircle, XCircle } from 'lucide-react';

interface ClockStatus {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentEntryId: string | null;
  currentBreakId: string | null;
  clockedInAt: string | null;
  breakStartedAt: string | null;
  todayShift: {
    id: string;
    role: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
}

interface TimeEntry {
  id: string;
  branchId: string;
  clockInAt: string;
  clockOutAt: string | null;
  method: string;
  approved: boolean;
  overtimeMinutes: number;
  branch: {
    name: string;
  };
  scheduledShift: {
    role: string;
  } | null;
}

export default function TimeclockPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeBranchId } = useActiveBranch();
  const queryClient = useQueryClient();
  const [_isLoading, _setIsLoading] = useState(false);

  // Fetch clock status
  const { data: status, isLoading: statusLoading } = useQuery<ClockStatus>({
    queryKey: ['clock-status'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/timeclock/status');
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch recent time entries
  const { data: entries } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/timeclock/entries?limit=10');
      return response.data;
    },
    enabled: !!user,
  });

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const branchId = activeBranchId || user?.branch?.id;
      if (!branchId) throw new Error('No branch selected');
      
      const response = await apiClient.post('/workforce/timeclock/clock-in', {
        branchId,
        shiftId: status?.todayShift?.id,
        method: 'PASSWORD',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast({ title: 'Clocked in successfully', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to clock in',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/timeclock/clock-out');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast({ title: 'Clocked out successfully', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to clock out',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Start break mutation
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/timeclock/break/start');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      toast({ title: 'Break started', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to start break',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // End break mutation
  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/timeclock/break/end');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-status'] });
      toast({ title: 'Break ended', variant: 'default' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to end break',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '—';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isBusy =
    clockInMutation.isPending ||
    clockOutMutation.isPending ||
    startBreakMutation.isPending ||
    endBreakMutation.isPending;

  if (statusLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading timeclock...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Timeclock
        </h1>
        <p className="text-muted-foreground">Clock in and out for your shifts</p>
      </div>

      {/* Status + Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-lg font-medium">Status:</span>
              {status?.isClockedIn ? (
                status?.isOnBreak ? (
                  <Badge className="bg-yellow-500 text-white">ON BREAK</Badge>
                ) : (
                  <Badge className="bg-green-500 text-white">CLOCKED IN</Badge>
                )
              ) : (
                <Badge className="bg-gray-500 text-white">CLOCKED OUT</Badge>
              )}
            </div>

            {status?.clockedInAt && (
              <div className="text-sm text-muted-foreground">
                Clocked in at: {formatTime(status.clockedInAt)}
              </div>
            )}

            {status?.breakStartedAt && (
              <div className="text-sm text-muted-foreground">
                Break started at: {formatTime(status.breakStartedAt)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {!status?.isClockedIn ? (
                <Button
                  onClick={() => clockInMutation.mutate()}
                  disabled={isBusy}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Clock In
                </Button>
              ) : (
                <>
                  {!status?.isOnBreak ? (
                    <>
                      <Button
                        onClick={() => startBreakMutation.mutate()}
                        disabled={isBusy}
                        variant="outline"
                      >
                        <Coffee className="h-4 w-4 mr-2" />
                        Start Break
                      </Button>
                      <Button
                        onClick={() => clockOutMutation.mutate()}
                        disabled={isBusy}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Clock Out
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => endBreakMutation.mutate()}
                      disabled={isBusy}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      End Break
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Shift Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today&apos;s Shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status?.todayShift ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-medium">{status.todayShift.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">
                    {formatTime(status.todayShift.startAt)} - {formatTime(status.todayShift.endAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{status.todayShift.status}</Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No shift scheduled for today
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
          <CardDescription>Your last 10 clock-in/out records</CardDescription>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No time entries yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.clockInAt)}</TableCell>
                    <TableCell>{formatTime(entry.clockInAt)}</TableCell>
                    <TableCell>{entry.clockOutAt ? formatTime(entry.clockOutAt) : '—'}</TableCell>
                    <TableCell>{formatDuration(entry.clockInAt, entry.clockOutAt)}</TableCell>
                    <TableCell>{entry.scheduledShift?.role || '—'}</TableCell>
                    <TableCell>{entry.branch?.name || '—'}</TableCell>
                    <TableCell>
                      {entry.approved ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
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
