/**
 * M9.4: Reservations Reports Page
 * 
 * AC-06: Reports summary returns expected KPI keys
 * AC-07: Export returns valid CSV with headers
 * AC-08: RBAC enforced (L4+ for reports)
 * AC-10: Reports dashboard shows filters + export
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useToast } from '../../components/ui/use-toast';
import {
  Calendar,
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

interface ReportSummary {
  totalReservations: number;
  byStatus: Record<string, number>;
  noShowRate: number;
  averagePartySize: number;
  conversionRates: {
    heldToConfirmed: number;
    waitlistToSeated: number;
  };
  deposits: {
    required: number;
    paid: number;
    applied: number;
    refunded: number;
    forfeited: number;
    totalRequiredAmount: number;
    totalPaidAmount: number;
    totalAppliedAmount: number;
    totalRefundedAmount: number;
    totalForfeitedAmount: number;
  };
  bySource: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
}

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  // Date range - default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [fromDate, setFromDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>('');

  // Check if user has required role
  const hasAccess = user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel);

  // Fetch report summary
  const { data: summary, isLoading } = useQuery<ReportSummary>({
    queryKey: ['reservation-reports', fromDate, toDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);

      const response = await apiClient.get(
        `/reservations/reports/summary?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!user && !!fromDate && !!toDate,
  });

  // Export CSV
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);

      const response = await apiClient.get(
        `/reservations/reports/export?${params.toString()}`,
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reservations_${fromDate}_to_${toDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: 'Export downloaded', variant: 'default' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  // RBAC check - redirect if not L4+
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Reservation Reports
          </h1>
          <p className="text-muted-foreground">
            Analytics and KPIs for your reservations
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
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
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Branches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Total Reservations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReservations}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Avg Party Size
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.averagePartySize.toFixed(1)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  No-Show Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summary.noShowRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Conversion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.conversionRates.heldToConfirmed.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.byStatus).map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell>{status}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Source</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary.bySource).map(([source, count]) => (
                      <TableRow key={source}>
                        <TableCell>{source}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Deposit Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deposit Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Required</div>
                  <div className="font-bold">{summary.deposits.required}</div>
                  <div className="text-sm">{formatCurrency(summary.deposits.totalRequiredAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Paid</div>
                  <div className="font-bold text-green-600">{summary.deposits.paid}</div>
                  <div className="text-sm">{formatCurrency(summary.deposits.totalPaidAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Applied</div>
                  <div className="font-bold text-blue-600">{summary.deposits.applied}</div>
                  <div className="text-sm">{formatCurrency(summary.deposits.totalAppliedAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Refunded</div>
                  <div className="font-bold text-orange-600">{summary.deposits.refunded}</div>
                  <div className="text-sm">{formatCurrency(summary.deposits.totalRefundedAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Forfeited</div>
                  <div className="font-bold text-red-600">{summary.deposits.forfeited}</div>
                  <div className="text-sm">{formatCurrency(summary.deposits.totalForfeitedAmount)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Peak Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                {summary.peakHours.map(({ hour, count }) => (
                  <div key={hour} className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-lg font-bold">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {count} reservations
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Day of Week */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">By Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Reservations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(summary.byDayOfWeek).map(([day, count]) => (
                    <TableRow key={day}>
                      <TableCell>{day}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
