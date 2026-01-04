/**
 * M10.5: My Schedule Page (Staff Self-Service)
 *
 * Features:
 * - View upcoming shifts for the logged-in user (14-30 days)
 * - Show shift status badges (DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED)
 * - Filter by date range
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
import { Calendar, Clock, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

interface ScheduledShift {
  id: string;
  branchId: string;
  branchName: string | null;
  role: string;
  startAt: string;
  endAt: string;
  plannedMinutes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'CANCELLED';
  notes: string | null;
}

function getStatusBadgeVariant(status: ScheduledShift['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PUBLISHED':
      return 'default';
    case 'IN_PROGRESS':
      return 'secondary';
    case 'COMPLETED':
    case 'APPROVED':
      return 'outline';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function MySchedulePage() {
  const { user } = useAuth();
  
  // Default: today to 30 days ahead
  const today = new Date();
  const defaultFrom = format(today, 'yyyy-MM-dd');
  const defaultTo = format(addDays(today, 30), 'yyyy-MM-dd');
  
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  // Fetch own schedule
  const { data: shifts, isLoading, refetch, isRefetching } = useQuery<ScheduledShift[]>({
    queryKey: ['my-schedule', fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate).toISOString());
      const response = await apiClient.get(`/workforce/self/schedule?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view your schedule.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            My Schedule
          </h1>
          <p className="text-muted-foreground">
            View your upcoming shifts and work schedule
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

      {/* Schedule Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Shifts
          </CardTitle>
          <CardDescription>
            {shifts?.length ?? 0} shift{(shifts?.length ?? 0) !== 1 ? 's' : ''} scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading your schedule...
            </div>
          ) : !shifts || shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shifts scheduled in this date range.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(shift.startAt), 'EEE, MMM d')}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(shift.startAt), 'h:mm a')} - {format(parseISO(shift.endAt), 'h:mm a')}
                    </TableCell>
                    <TableCell>{formatDuration(shift.plannedMinutes)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shift.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {shift.branchName ?? 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(shift.status)}>
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {shift.notes ?? '-'}
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
