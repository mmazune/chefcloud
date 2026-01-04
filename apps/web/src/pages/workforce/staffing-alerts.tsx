/**
 * M10.12: Staffing Alerts Page
 *
 * Features:
 * - View understaffed/overstaffed alerts
 * - Filter by branch, date, resolved status
 * - Resolve alerts
 * - Export alerts as CSV
 *
 * RBAC: L4+ (Manager, Owner) for resolve, L3+ for read
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Download,
  UserMinus,
  UserPlus,
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface StaffingAlert {
  id: string;
  date: string;
  hour: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  type: 'UNDERSTAFFED' | 'OVERSTAFFED';
  payloadJson: {
    scheduledCount: number;
    suggestedCount: number;
    delta: number;
    roleKey: string;
  };
  resolvedAt: string | null;
  resolvedById: string | null;
  createdAt: string;
}

export default function StaffingAlertsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [includeResolved, setIncludeResolved] = useState(false);

  // Check RBAC
  const hasWriteAccess = !!(user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel));
  const hasReadAccess = !!(user && user.roleLevel && ['L3', 'L4', 'L5'].includes(user.roleLevel));

  // Fetch branches
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get('/orgs/branches');
      return response.data;
    },
    enabled: !!user,
  });

  // Fetch alerts
  const { data: alerts, isLoading } = useQuery<StaffingAlert[]>({
    queryKey: ['staffing-alerts', selectedBranch, selectedDate, includeResolved],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch,
      });
      if (selectedDate) params.append('date', selectedDate);
      if (includeResolved) params.append('includeResolved', 'true');
      
      const response = await apiClient.get(`/workforce/planning/alerts?${params.toString()}`);
      return response.data;
    },
    enabled: !!selectedBranch && hasReadAccess,
  });

  // Resolve alert mutation
  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.post(`/workforce/planning/alerts/${alertId}/resolve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffing-alerts'] });
      toast({ title: 'Alert resolved', description: 'The alert has been marked as resolved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to resolve alert.', variant: 'destructive' });
    },
  });

  // Export handler
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        date: selectedDate,
      });
      const response = await apiClient.get(
        `/workforce/planning/export/alerts?${params.toString()}`,
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alerts_${selectedBranch}_${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: 'Alerts exported as CSV.' });
    } catch {
      toast({ title: 'Error', description: 'Export failed.', variant: 'destructive' });
    }
  };

  // Access check
  if (!hasReadAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need L3+ access to view staffing alerts.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Severity badge colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return '';
    }
  };

  // Alert statistics
  const stats = {
    total: alerts?.length || 0,
    unresolved: alerts?.filter((a) => !a.resolvedAt).length || 0,
    high: alerts?.filter((a) => a.severity === 'HIGH' && !a.resolvedAt).length || 0,
    understaffed: alerts?.filter((a) => a.type === 'UNDERSTAFFED' && !a.resolvedAt).length || 0,
    overstaffed: alerts?.filter((a) => a.type === 'OVERSTAFFED' && !a.resolvedAt).length || 0,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Staffing Alerts
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage understaffed/overstaffed alerts
          </p>
        </div>
        {alerts && alerts.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="w-64">
              <Label>Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeResolved"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="includeResolved">Include resolved</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedBranch && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.unresolved}</div>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{stats.high}</div>
                <p className="text-xs text-muted-foreground">High Severity</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{stats.understaffed}</div>
                <p className="text-xs text-muted-foreground">Understaffed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{stats.overstaffed}</div>
                <p className="text-xs text-muted-foreground">Overstaffed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
          </div>

          {/* Alerts Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alerts</CardTitle>
              <CardDescription>
                Alerts generated from variance analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : !alerts?.length ? (
                <p className="text-muted-foreground">No alerts for this date.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hour</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Delta</TableHead>
                      <TableHead>Status</TableHead>
                      {hasWriteAccess && <TableHead>Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts
                      .sort((a, b) => {
                        // Sort by resolved (unresolved first), then by severity, then by hour
                        if (a.resolvedAt && !b.resolvedAt) return 1;
                        if (!a.resolvedAt && b.resolvedAt) return -1;
                        const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                          return severityOrder[a.severity] - severityOrder[b.severity];
                        }
                        return a.hour - b.hour;
                      })
                      .map((alert) => (
                        <TableRow
                          key={alert.id}
                          className={alert.resolvedAt ? 'opacity-50' : ''}
                        >
                          <TableCell>{alert.hour}:00 - {alert.hour + 1}:00</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {alert.type === 'UNDERSTAFFED' ? (
                                <UserMinus className="h-4 w-4 text-orange-600" />
                              ) : (
                                <UserPlus className="h-4 w-4 text-blue-600" />
                              )}
                              {alert.type}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{alert.payloadJson.roleKey}</TableCell>
                          <TableCell>
                            <span
                              className={
                                alert.payloadJson.delta < 0
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }
                            >
                              {alert.payloadJson.delta > 0 ? '+' : ''}
                              {alert.payloadJson.delta}
                            </span>
                            <span className="text-muted-foreground text-sm ml-2">
                              ({alert.payloadJson.scheduledCount} scheduled,{' '}
                              {alert.payloadJson.suggestedCount} suggested)
                            </span>
                          </TableCell>
                          <TableCell>
                            {alert.resolvedAt ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Resolved
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-orange-600">
                                <AlertCircle className="h-4 w-4" />
                                Open
                              </div>
                            )}
                          </TableCell>
                          {hasWriteAccess && (
                            <TableCell>
                              {!alert.resolvedAt && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resolveMutation.mutate(alert.id)}
                                  disabled={resolveMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Resolve
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
