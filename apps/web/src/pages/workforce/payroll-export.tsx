/**
 * M10.4: Payroll Export Page
 *
 * Features:
 * - Export payroll data as CSV
 * - Select pay period for export
 * - Show last export timestamp
 * - Preview export data before download
 *
 * RBAC: L4+ (Manager, Owner)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Download, FileSpreadsheet, Calendar, Clock } from 'lucide-react';

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface PayrollExportRow {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  status: string;
}

interface PayrollExportResult {
  csv: string;
  rows: PayrollExportRow[];
  generatedAt: string;
  payPeriodId: string;
}

export default function PayrollExportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  // State
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [exportResult, setExportResult] = useState<PayrollExportResult | null>(null);

  // Check if user has required role (L4+ = Manager, Owner)
  const hasAccess = Boolean(user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel));

  // Fetch closed pay periods (only closed periods can be exported)
  const { data: payPeriods, isLoading: periodsLoading } = useQuery<PayPeriod[]>({
    queryKey: ['pay-periods-closed'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/pay-periods?status=CLOSED');
      return response.data;
    },
    enabled: hasAccess,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (payPeriodId: string) => {
      const response = await apiClient.post('/workforce/payroll/export', { payPeriodId });
      return response.data as PayrollExportResult;
    },
    onSuccess: (data) => {
      setExportResult(data);
      toast({
        title: 'Export generated',
        description: `${data.rows.length} employee records ready for download.`,
      });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to generate export',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleExport = () => {
    if (!selectedPeriodId) {
      toast({ title: 'Please select a pay period', variant: 'destructive' });
      return;
    }
    exportMutation.mutate(selectedPeriodId);
  };

  const handleDownloadCsv = () => {
    if (!exportResult?.csv) return;

    const blob = new Blob([exportResult.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const period = payPeriods?.find((p) => p.id === selectedPeriodId);
    const filename = period
      ? `payroll_${period.startDate}_${period.endDate}.csv`
      : 'payroll_export.csv';

    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'CSV downloaded', description: filename });
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  const selectedPeriod = payPeriods?.find((p) => p.id === selectedPeriodId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          Payroll Export
        </h1>
        <p className="text-muted-foreground">
          Export approved timesheets to CSV for payroll processing
        </p>
      </div>

      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Pay Period
          </CardTitle>
          <CardDescription>
            Choose a closed pay period to export. Only periods with CLOSED status can be exported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="w-[300px]">
              <label className="text-sm font-medium">Pay Period</label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a period..." />
                </SelectTrigger>
                <SelectContent>
                  {periodsLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                  ) : !payPeriods || payPeriods.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No closed periods available</div>
                  ) : (
                    payPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleExport}
              disabled={!selectedPeriodId || exportMutation.isPending}
            >
              {exportMutation.isPending ? 'Generating...' : 'Generate Export'}
            </Button>
          </div>

          {selectedPeriod && (
            <div className="text-sm text-muted-foreground">
              Selected: {formatDate(selectedPeriod.startDate)} to{' '}
              {formatDate(selectedPeriod.endDate)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Result */}
      {exportResult && (
        <>
          {/* Download Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Ready
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={handleDownloadCsv} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Generated: {new Date(exportResult.generatedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-sm">
                <strong>{exportResult.rows.length}</strong> employee records included
              </div>
            </CardContent>
          </Card>

          {/* Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle>Export Preview</CardTitle>
              <CardDescription>
                Review the data before downloading. This is what will be in the CSV file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exportResult.rows.length === 0 ? (
                <div className="text-muted-foreground">
                  No approved timesheets found for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Regular</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportResult.rows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.employeeEmail}</TableCell>
                          <TableCell>
                            {formatDate(row.payPeriodStart)} - {formatDate(row.payPeriodEnd)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatMinutes(row.totalMinutes)}
                          </TableCell>
                          <TableCell>{formatMinutes(row.regularMinutes)}</TableCell>
                          <TableCell>
                            {row.overtimeMinutes > 0 ? (
                              <span className="text-orange-600 font-medium">
                                {formatMinutes(row.overtimeMinutes)}
                              </span>
                            ) : (
                              formatMinutes(row.overtimeMinutes)
                            )}
                          </TableCell>
                          <TableCell>{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
