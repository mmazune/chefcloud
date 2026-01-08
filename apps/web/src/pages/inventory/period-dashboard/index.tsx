/**
 * M12.6: Inventory Period Dashboard Page
 *
 * Multi-branch period close dashboard:
 * - Per-branch current period status
 * - Preclose status (READY/BLOCKED/WARNING)
 * - Last close info
 * - Close request status
 * - Highlighting WARNING/CRITICAL branches
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

// ============================================
// Dashboard Status Thresholds (Configurable)
// WARNING: > 30 days since last close
// CRITICAL: > 60 days since last close
// ============================================
const WARNING_THRESHOLD_DAYS = 30;
const CRITICAL_THRESHOLD_DAYS = 60;

// ============================================
// Types
// ============================================

interface DashboardRow {
  branchId: string;
  branchName: string;
  currentPeriod: {
    id: string;
    startDate: string;
    endDate: string;
    status: 'OPEN' | 'CLOSED';
  } | null;
  precloseStatus: 'READY' | 'BLOCKED' | 'WARNING' | 'NOT_RUN';
  blockerSummary: string[];
  lastClosePack: {
    hash: string;
    generatedAt: string;
  } | null;
  closeRequest: {
    id: string;
    status: string;
  } | null;
  lastEvent: {
    type: string;
    occurredAt: string;
    actorName: string;
  } | null;
}

interface DashboardResult {
  rows: DashboardRow[];
  summary: {
    totalBranches: number;
    openPeriods: number;
    blockedPeriods: number;
    pendingApprovals: number;
  };
}

interface Branch {
  id: string;
  name: string;
}

// ============================================
// Component
// ============================================

export default function PeriodDashboardPage() {
  const [branchFilter, setBranchFilter] = useState<string>('');

  // ============================================
  // Queries
  // ============================================

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data;
    },
  });

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardResult>({
    queryKey: ['period-dashboard', branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.append('branchId', branchFilter);
      const res = await apiClient.get(`/inventory/periods/dashboard?${params}`);
      return res.data;
    },
  });

  // ============================================
  // Helpers
  // ============================================

  const getPrecloseStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'BLOCKED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Blocked</Badge>;
      case 'WARNING':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Not Run</Badge>;
    }
  };

  const getCloseRequestBadge = (request: DashboardRow['closeRequest']) => {
    if (!request) return <Badge variant="outline">No Request</Badge>;
    switch (request.status) {
      case 'APPROVED':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'SUBMITTED':
        return <Badge className="bg-blue-500">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{request.status}</Badge>;
    }
  };

  const getBranchHealthStatus = (row: DashboardRow) => {
    // Calculate days since last close
    if (!row.lastClosePack) {
      return 'CRITICAL'; // Never closed
    }
    const daysSinceClose = differenceInDays(new Date(), new Date(row.lastClosePack.generatedAt));
    if (daysSinceClose > CRITICAL_THRESHOLD_DAYS) return 'CRITICAL';
    if (daysSinceClose > WARNING_THRESHOLD_DAYS) return 'WARNING';
    if (row.precloseStatus === 'BLOCKED') return 'WARNING';
    return 'HEALTHY';
  };

  const getHealthBadge = (row: DashboardRow) => {
    const health = getBranchHealthStatus(row);
    switch (health) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'WARNING':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      default:
        return <Badge className="bg-green-600">Healthy</Badge>;
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <AppShell>
      <PageHeader
        title="Period Dashboard"
        description="Multi-branch inventory period close status"
      >
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      {dashboard?.summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Branches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.summary.totalBranches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Periods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{dashboard.summary.openPeriods}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{dashboard.summary.blockedPeriods}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{dashboard.summary.pendingApprovals}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end">
          <div className="w-48">
            <Label>Branch</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Branch Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading dashboard...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboard?.rows.map((row) => (
            <Card key={row.branchId} className={`border-2 ${
              getBranchHealthStatus(row) === 'CRITICAL' ? 'border-red-500' :
              getBranchHealthStatus(row) === 'WARNING' ? 'border-yellow-500' : 'border-transparent'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {row.branchName}
                  </CardTitle>
                  {getHealthBadge(row)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Current Period */}
                <div>
                  <div className="text-xs text-muted-foreground">Current Period</div>
                  {row.currentPeriod ? (
                    <div className="text-sm">
                      {format(new Date(row.currentPeriod.startDate), 'MMM d')} - {format(new Date(row.currentPeriod.endDate), 'MMM d, yyyy')}
                      <Badge variant="outline" className="ml-2">{row.currentPeriod.status}</Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No open period</div>
                  )}
                </div>

                {/* Preclose Status */}
                <div>
                  <div className="text-xs text-muted-foreground">Preclose Status</div>
                  <div className="flex items-center gap-2">
                    {getPrecloseStatusBadge(row.precloseStatus)}
                    {row.blockerSummary.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({row.blockerSummary.slice(0, 2).join(', ')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Close Request */}
                <div>
                  <div className="text-xs text-muted-foreground">Close Request</div>
                  {getCloseRequestBadge(row.closeRequest)}
                </div>

                {/* Last Close */}
                <div>
                  <div className="text-xs text-muted-foreground">Last Close</div>
                  {row.lastClosePack ? (
                    <div className="text-sm">
                      {format(new Date(row.lastClosePack.generatedAt), 'MMM d, yyyy HH:mm')}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({differenceInDays(new Date(), new Date(row.lastClosePack.generatedAt))} days ago)
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Never closed</div>
                  )}
                </div>

                {/* Last Event */}
                {row.lastEvent && (
                  <div>
                    <div className="text-xs text-muted-foreground">Last Event</div>
                    <div className="text-sm">
                      {row.lastEvent.type} by {row.lastEvent.actorName}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({format(new Date(row.lastEvent.occurredAt), 'MMM d HH:mm')})
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Threshold Documentation */}
      <Card className="mt-6 p-4">
        <div className="text-sm text-muted-foreground">
          <strong>Health Status Thresholds:</strong>
          <ul className="list-disc list-inside mt-2">
            <li><span className="text-yellow-600 font-medium">Warning:</span> &gt; {WARNING_THRESHOLD_DAYS} days since last close, or preclose blocked</li>
            <li><span className="text-red-600 font-medium">Critical:</span> &gt; {CRITICAL_THRESHOLD_DAYS} days since last close, or never closed</li>
          </ul>
        </div>
      </Card>
    </AppShell>
  );
}
