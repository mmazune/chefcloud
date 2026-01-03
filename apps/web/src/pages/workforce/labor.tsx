/**
 * M10.2: Labor Reports Page
 *
 * Features:
 * - Branch + date range filters
 * - KPI cards: Planned, Actual, Overtime minutes
 * - Per-role breakdown table
 * - Per-user breakdown table
 * - Export buttons (CSV)
 * - Audit logs (L5 only)
 *
 * RBAC: L4+ (Manager, Owner)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  BarChart3,
  Download,
  Clock,
  Timer,
  AlertTriangle,
  Users,
  FileText,
} from 'lucide-react';

interface LaborMetrics {
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalOvertimeMinutes: number;
  totalBreakMinutes: number;
  shiftCount: number;
  completedShiftCount: number;
  approvedShiftCount: number;
  byRole: Array<{
    role: string;
    plannedMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
    shiftCount: number;
  }>;
  byUser: Array<{
    userId: string;
    userName: string;
    plannedMinutes: number;
    actualMinutes: number;
    overtimeMinutes: number;
    shiftCount: number;
  }>;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  performedBy: {
    firstName: string;
    lastName: string;
  };
  payload: Record<string, unknown> | null;
}

export default function LaborPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  // Date range - default to this month
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fromDate, setFromDate] = useState(monthStart.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [showAudit, setShowAudit] = useState(false);

  // Check if user has required role
  const hasAccess = user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel);
  const isOwner = user?.roleLevel === 'L5';

  // Fetch labor metrics
  const { data: metrics, isLoading } = useQuery<LaborMetrics>({
    queryKey: ['labor-metrics', fromDate, toDate, branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);

      const response = await apiClient.get(`/workforce/reports/labor?${params.toString()}`);
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch audit logs (L5 only)
  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ['workforce-audit', fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });

      const response = await apiClient.get(`/workforce/reports/audit?${params.toString()}`);
      return response.data;
    },
    enabled: !!user && isOwner && showAudit,
  });

  // Export handlers
  const handleExport = async (type: 'shifts' | 'timeentries' | 'labor') => {
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (branchFilter) params.append('branchId', branchFilter);

      const response = await apiClient.get(
        `/workforce/reports/export/${type}?${params.toString()}`,
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_${fromDate}_to_${toDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: 'Export downloaded', variant: 'default' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const formatMinutes = (minutes: number | null | undefined) => {
    if (!minutes) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Labor Reports
          </h1>
          <p className="text-muted-foreground">Workforce analytics and exports</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport('shifts')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Shifts CSV
          </Button>
          <Button onClick={() => handleExport('timeentries')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Time Entries CSV
          </Button>
          <Button onClick={() => handleExport('labor')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" /> Labor Summary CSV
          </Button>
        </div>
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
        {isOwner && (
          <Button
            variant={showAudit ? 'default' : 'outline'}
            onClick={() => setShowAudit(!showAudit)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {showAudit ? 'Hide Audit' : 'Show Audit'}
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="animate-pulse">Loading metrics...</div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Planned Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMinutes(metrics.totalPlannedMinutes)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Actual Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMinutes(metrics.totalActualMinutes)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Overtime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatMinutes(metrics.totalOvertimeMinutes)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Shifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.approvedShiftCount} / {metrics.shiftCount}
                </div>
                <div className="text-xs text-muted-foreground">approved / total</div>
              </CardContent>
            </Card>
          </div>

          {/* Per-Role Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Hours by Role</CardTitle>
              <CardDescription>Labor breakdown by job role</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.byRole && metrics.byRole.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Shifts</TableHead>
                      <TableHead>Planned</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.byRole.map((row) => (
                      <TableRow key={row.role}>
                        <TableCell className="font-medium">{row.role}</TableCell>
                        <TableCell>{row.shiftCount}</TableCell>
                        <TableCell>{formatMinutes(row.plannedMinutes)}</TableCell>
                        <TableCell>{formatMinutes(row.actualMinutes)}</TableCell>
                        <TableCell>
                          {row.overtimeMinutes > 0 ? (
                            <span className="text-orange-600">
                              +{formatMinutes(row.overtimeMinutes)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">No role data</div>
              )}
            </CardContent>
          </Card>

          {/* Per-User Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Hours by Employee</CardTitle>
              <CardDescription>Labor breakdown by staff member</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.byUser && metrics.byUser.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Shifts</TableHead>
                      <TableHead>Planned</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.byUser.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="font-medium">{row.userName}</TableCell>
                        <TableCell>{row.shiftCount}</TableCell>
                        <TableCell>{formatMinutes(row.plannedMinutes)}</TableCell>
                        <TableCell>{formatMinutes(row.actualMinutes)}</TableCell>
                        <TableCell>
                          {row.overtimeMinutes > 0 ? (
                            <span className="text-orange-600">
                              +{formatMinutes(row.overtimeMinutes)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-4 text-muted-foreground">No employee data</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Audit Logs (L5 only) */}
      {isOwner && showAudit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <CardDescription>Workforce actions audit trail (Owner only)</CardDescription>
          </CardHeader>
          <CardContent>
            {!auditLogs || auditLogs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No audit logs</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        {log.performedBy?.firstName} {log.performedBy?.lastName}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{log.action}</span>
                      </TableCell>
                      <TableCell>
                        {log.entityType}:{log.entityId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {log.payload ? (
                          <pre className="text-xs bg-gray-100 p-1 rounded max-w-xs overflow-auto">
                            {JSON.stringify(log.payload, null, 1)}
                          </pre>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
