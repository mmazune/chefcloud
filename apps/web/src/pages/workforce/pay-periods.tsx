/**
 * M10.4: Pay Periods Page
 *
 * Features:
 * - List all pay periods with status badges
 * - Generate new pay periods for date range
 * - Close open pay periods (locks timesheets)
 *
 * RBAC: L4+ (Manager, Owner) for generate/close, L3+ for list
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
import { Calendar, Plus, Lock, CalendarDays } from 'lucide-react';

type PayPeriodStatus = 'OPEN' | 'CLOSED';

interface PayPeriod {
  id: string;
  orgId: string;
  branchId: string | null;
  startDate: string;
  endDate: string;
  status: PayPeriodStatus;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  branch?: {
    id: string;
    name: string;
  };
}

export default function PayPeriodsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Generate form
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodDays, setPeriodDays] = useState('14');

  // Check access levels
  const hasListAccess = Boolean(user && user.roleLevel && ['L3', 'L4', 'L5'].includes(user.roleLevel));
  const hasManageAccess = Boolean(user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel));

  // Fetch pay periods
  const { data: payPeriods, isLoading } = useQuery<PayPeriod[]>({
    queryKey: ['pay-periods', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await apiClient.get(`/workforce/pay-periods?${params.toString()}`);
      return response.data;
    },
    enabled: hasListAccess,
  });

  // Generate pay periods mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { periodType: string; startDate: string; endDate: string }) => {
      const response = await apiClient.post('/workforce/pay-periods/generate', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pay-periods'] });
      setShowGenerateForm(false);
      setStartDate('');
      setEndDate('');
      toast({
        title: 'Pay periods generated',
        description: `Created ${data.periods?.length || 0} new pay period(s).`,
      });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to generate pay periods',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Close pay period mutation
  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/workforce/pay-periods/${id}/close`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-periods'] });
      toast({ title: 'Pay period closed', description: 'Timesheets are now locked.' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to close pay period',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Map period days to period type
  const getPeriodType = (days: number): string => {
    if (days <= 7) return 'WEEKLY';
    if (days <= 14) return 'BIWEEKLY';
    return 'MONTHLY';
  };

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast({ title: 'Please select start and end dates', variant: 'destructive' });
      return;
    }
    const days = parseInt(periodDays, 10);
    if (isNaN(days) || days < 1 || days > 31) {
      toast({ title: 'Period days must be between 1 and 31', variant: 'destructive' });
      return;
    }
    generateMutation.mutate({ periodType: getPeriodType(days), startDate, endDate });
  };

  // RBAC check
  if (user && !hasListAccess) {
    router.push('/dashboard');
    return null;
  }

  const openCount = payPeriods?.filter((p) => p.status === 'OPEN').length || 0;
  const closedCount = payPeriods?.filter((p) => p.status === 'CLOSED').length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Pay Periods
          </h1>
          <p className="text-muted-foreground">Manage payroll periods and timesheet locks</p>
        </div>
        {hasManageAccess && (
          <Button onClick={() => setShowGenerateForm(!showGenerateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Periods
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              Open Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              Closed Periods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Form */}
      {showGenerateForm && hasManageAccess && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Pay Periods</CardTitle>
            <CardDescription>
              Create pay periods for a date range. Each period will span the specified number of
              days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Period Length (days)</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(e.target.value)}
                  className="w-[120px]"
                />
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pay Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pay Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : !payPeriods || payPeriods.length === 0 ? (
            <div className="text-muted-foreground">
              No pay periods found. Generate new periods to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>{formatDate(period.startDate)}</TableCell>
                    <TableCell>{formatDate(period.endDate)}</TableCell>
                    <TableCell>
                      <Badge variant={period.status === 'OPEN' ? 'default' : 'secondary'}>
                        {period.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {period.closedAt ? formatDate(period.closedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      {period.status === 'OPEN' && hasManageAccess && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => closeMutation.mutate(period.id)}
                          disabled={closeMutation.isPending}
                        >
                          <Lock className="h-4 w-4 mr-1" />
                          Close
                        </Button>
                      )}
                      {period.status === 'CLOSED' && (
                        <span className="text-sm text-muted-foreground">Locked</span>
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
