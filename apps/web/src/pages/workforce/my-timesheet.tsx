/**
 * M10.5: My Timesheet Page (Staff Self-Service)
 *
 * Features:
 * - Show computed totals for current/selected pay period
 * - Regular hours, overtime hours, breaks, paid hours
 * - Approval status and lock indicator
 * - Request adjustment option for own entries
 *
 * RBAC: All roles (L1-L5) - only shows own data
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { 
  ClipboardCheck, 
  Clock, 
  Timer, 
  Coffee, 
  Lock, 
  AlertCircle,
  RefreshCw,
  FileEdit,
  CheckCircle,
  XCircle,
  Hourglass,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TimesheetTotals {
  payPeriodId: string | null;
  periodStart: string;
  periodEnd: string;
  regularMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  paidMinutes: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MIXED' | 'NONE';
  isLocked: boolean;
  entries: number;
}

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  periodType: string;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

function getApprovalIcon(status: TimesheetTotals['approvalStatus']) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'REJECTED':
      return <XCircle className="h-5 w-5 text-red-600" />;
    case 'PENDING':
      return <Hourglass className="h-5 w-5 text-yellow-600" />;
    case 'MIXED':
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getApprovalBadgeVariant(status: TimesheetTotals['approvalStatus']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    case 'PENDING':
      return 'secondary';
    case 'MIXED':
      return 'outline';
    default:
      return 'outline';
  }
}

export default function MyTimesheetPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Date range state (default to current week)
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(format(weekStart, 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(today, 'yyyy-MM-dd'));
  const [usePayPeriod, setUsePayPeriod] = useState(false);

  // Adjustment request modal state
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Fetch available pay periods
  const { data: payPeriods } = useQuery<PayPeriod[]>({
    queryKey: ['pay-periods-self'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/pay-periods');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch timesheet totals
  const { data: timesheet, isLoading, refetch, isRefetching } = useQuery<TimesheetTotals>({
    queryKey: ['my-timesheet', selectedPeriodId, fromDate, toDate, usePayPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (usePayPeriod && selectedPeriodId) {
        params.set('payPeriodId', selectedPeriodId);
      } else {
        if (fromDate) params.set('from', new Date(fromDate).toISOString());
        if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());
      }
      const response = await apiClient.get(`/workforce/self/timesheet?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  // Request adjustment mutation (placeholder - would need specific entry selection)
  const _requestAdjustmentMutation = useMutation({
    mutationFn: async (data: { timeEntryId: string; reason: string }) => {
      const response = await apiClient.post('/workforce/adjustments', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Adjustment Requested',
        description: 'Your adjustment request has been submitted for review.',
      });
      setAdjustmentOpen(false);
      setAdjustmentReason('');
      queryClient.invalidateQueries({ queryKey: ['my-timesheet'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to request adjustment';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    },
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to view your timesheet.</p>
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
            <ClipboardCheck className="h-6 w-6" />
            My Timesheet
          </h1>
          <p className="text-muted-foreground">
            View your computed hours and approval status
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

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Period Selection</CardTitle>
          <CardDescription>Select a pay period or custom date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePayPeriod"
                checked={usePayPeriod}
                onChange={(e) => setUsePayPeriod(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="usePayPeriod" className="text-sm">Use Pay Period</label>
            </div>
            
            {usePayPeriod ? (
              <Select
                value={selectedPeriodId ?? ''}
                onValueChange={(value) => setSelectedPeriodId(value || null)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select pay period" />
                </SelectTrigger>
                <SelectContent>
                  {payPeriods?.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {format(parseISO(period.startDate), 'MMM d')} - {format(parseISO(period.endDate), 'MMM d, yyyy')} ({period.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
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
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Banner */}
      {timesheet && (
        <Card className={timesheet.isLocked ? 'border-amber-500' : ''}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getApprovalIcon(timesheet.approvalStatus)}
                <div>
                  <p className="font-medium">
                    {timesheet.payPeriodId ? 'Pay Period' : 'Custom Range'}:{' '}
                    {format(parseISO(timesheet.periodStart), 'MMM d')} - {format(parseISO(timesheet.periodEnd), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {timesheet.entries} time {timesheet.entries === 1 ? 'entry' : 'entries'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getApprovalBadgeVariant(timesheet.approvalStatus)}>
                  {timesheet.approvalStatus === 'NONE' ? 'Not Submitted' : timesheet.approvalStatus}
                </Badge>
                {timesheet.isLocked && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours Summary */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading timesheet data...
          </CardContent>
        </Card>
      ) : !timesheet ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No timesheet data available for the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Regular Hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatHours(timesheet.regularMinutes)}h</p>
              <p className="text-sm text-muted-foreground">{formatDuration(timesheet.regularMinutes)}</p>
            </CardContent>
          </Card>
          
          <Card className={timesheet.overtimeMinutes > 0 ? 'border-orange-500' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Timer className="h-4 w-4" />
                Overtime Hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">{formatHours(timesheet.overtimeMinutes)}h</p>
              <p className="text-sm text-muted-foreground">{formatDuration(timesheet.overtimeMinutes)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Coffee className="h-4 w-4" />
                Break Hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-muted-foreground">{formatHours(timesheet.breakMinutes)}h</p>
              <p className="text-sm text-muted-foreground">{formatDuration(timesheet.breakMinutes)}</p>
            </CardContent>
          </Card>
          
          <Card className="border-green-500">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <ClipboardCheck className="h-4 w-4" />
                Paid Hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{formatHours(timesheet.paidMinutes)}h</p>
              <p className="text-sm text-muted-foreground">{formatDuration(timesheet.paidMinutes)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Request Adjustment Info */}
      {timesheet && !timesheet.isLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              Need to Make a Correction?
            </CardTitle>
            <CardDescription>
              If you have a missed punch or incorrect time entry, you can request an adjustment.
              Go to &quot;My Time&quot; to view individual entries and request corrections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/workforce/my-time'}
            >
              View Time Entries
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Locked Notice */}
      {timesheet?.isLocked && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">This period is locked</p>
                <p className="text-sm text-amber-700">
                  Adjustments cannot be made to locked pay periods. Contact your manager if you need corrections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adjustment Request Dialog */}
      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Adjustment</DialogTitle>
            <DialogDescription>
              Explain why you need to adjust this time entry. Your request will be reviewed by a supervisor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Reason for Adjustment</label>
              <Textarea
                placeholder="e.g., Forgot to clock out for lunch break..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Would need a specific time entry ID here
                toast({
                  title: 'Info',
                  description: 'Please go to My Time to select a specific entry to adjust.',
                });
                setAdjustmentOpen(false);
              }}
              disabled={!adjustmentReason.trim()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
