/**
 * M10.5: My Time Page (Staff Self-Service)
 *
 * Features:
 * - View time entries for the logged-in user
 * - Show break entries, rounded times, and totals
 * - Show current clock status (clocked in/out, on break)
 * - Filter by pay period or date range
 *
 * RBAC: All roles (L1-L5) - only shows own data
 */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Clock, Timer, Coffee, AlertCircle, ChevronDown, RefreshCw, Lock } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

interface BreakEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
}

interface TimeEntry {
  id: string;
  branchId: string;
  shiftId: string | null;
  role: string | null;
  clockInAt: string;
  clockOutAt: string | null;
  method: string;
  workedMinutes: number | null;
  breakMinutes: number;
  overtimeMinutes: number;
  approved: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  isLocked: boolean;
  breakEntries: BreakEntry[];
}

interface ClockStatus {
  isClockedIn: boolean;
  isOnBreak: boolean;
  currentEntryId: string | null;
  clockedInAt: string | null;
  breakStartedAt: string | null;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function getApprovalBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    case 'PENDING':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function MyTimePage() {
  const { user } = useAuth();
  
  // Default: last 14 days
  const today = new Date();
  const defaultFrom = format(subDays(today, 14), 'yyyy-MM-dd');
  const defaultTo = format(today, 'yyyy-MM-dd');
  
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch clock status
  const { data: clockStatus } = useQuery<ClockStatus>({
    queryKey: ['my-clock-status'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/self/clock-status');
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch time entries
  const { data: entries, isLoading, refetch, isRefetching } = useQuery<TimeEntry[]>({
    queryKey: ['my-time-entries', fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());
      const response = await apiClient.get(`/workforce/self/time-entries?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view your time entries.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalWorked = entries?.reduce((sum, e) => sum + (e.workedMinutes ?? 0), 0) ?? 0;
  const totalBreaks = entries?.reduce((sum, e) => sum + e.breakMinutes, 0) ?? 0;
  const totalOT = entries?.reduce((sum, e) => sum + e.overtimeMinutes, 0) ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Timer className="h-6 w-6" />
            My Time
          </h1>
          <p className="text-muted-foreground">
            View your time entries and clock status
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Clock Status Card */}
      <Card className={clockStatus?.isClockedIn ? 'border-green-500' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={clockStatus?.isClockedIn ? 'default' : 'outline'} className="text-sm py-1 px-3">
              {clockStatus?.isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </Badge>
            {clockStatus?.isOnBreak && (
              <Badge variant="secondary" className="text-sm py-1 px-3">
                <Coffee className="h-3 w-3 mr-1" />
                On Break
              </Badge>
            )}
            {clockStatus?.clockedInAt && (
              <span className="text-sm text-muted-foreground">
                Since {format(parseISO(clockStatus.clockedInAt), 'h:mm a')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">From:</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">To:</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Entries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entries?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Worked</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(totalWorked)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Breaks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(totalBreaks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overtime</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{formatDuration(totalOT)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading your time entries...
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries in this date range.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Breaks</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <Collapsible key={entry.id} asChild open={expandedRows.has(entry.id)}>
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(entry.id)}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(entry.id) ? 'rotate-180' : ''}`} />
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(parseISO(entry.clockInAt), 'EEE, MMM d')}
                        </TableCell>
                        <TableCell>{format(parseISO(entry.clockInAt), 'h:mm a')}</TableCell>
                        <TableCell>
                          {entry.clockOutAt ? format(parseISO(entry.clockOutAt), 'h:mm a') : <Badge variant="outline">Active</Badge>}
                        </TableCell>
                        <TableCell>{formatDuration(entry.workedMinutes)}</TableCell>
                        <TableCell>{formatDuration(entry.breakMinutes)}</TableCell>
                        <TableCell>
                          {entry.overtimeMinutes > 0 ? (
                            <span className="text-orange-600 font-medium">{formatDuration(entry.overtimeMinutes)}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={getApprovalBadgeVariant(entry.approvalStatus)}>
                              {entry.approvalStatus ?? 'N/A'}
                            </Badge>
                            {entry.isLocked && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={8} className="py-2">
                            <div className="pl-8 space-y-2">
                              <p className="text-sm text-muted-foreground">
                                <strong>Method:</strong> {entry.method} | 
                                <strong> Role:</strong> {entry.role ?? 'N/A'} |
                                <strong> Shift ID:</strong> {entry.shiftId ?? 'Unscheduled'}
                              </p>
                              {entry.breakEntries.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium flex items-center gap-1">
                                    <Coffee className="h-3 w-3" /> Breaks:
                                  </p>
                                  <ul className="text-sm text-muted-foreground ml-4">
                                    {entry.breakEntries.map((b) => (
                                      <li key={b.id}>
                                        {format(parseISO(b.startedAt), 'h:mm a')} - 
                                        {b.endedAt ? format(parseISO(b.endedAt), ' h:mm a') : ' (active)'} 
                                        {b.minutes && ` (${b.minutes}m)`}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
