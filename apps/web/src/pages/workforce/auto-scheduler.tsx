/**
 * M10.13: Auto-Scheduler Page
 *
 * Generate shift suggestions from staffing plan, preview, and apply.
 * RBAC: L4+ can generate and apply, L3+ can view.
 */
'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Calendar, Zap, Check, AlertTriangle, Users, Clock, Ban } from 'lucide-react';

interface AutoScheduleRun {
  id: string;
  date: string;
  status: 'DRAFT' | 'APPLIED' | 'VOID';
  staffingPlanId: string;
  inputsHash: string;
  isExisting?: boolean;
  planStatus?: string;
  generatedAt: string;
  appliedAt?: string;
  suggestions: AutoScheduleSuggestion[];
}

interface AutoScheduleSuggestion {
  id: string;
  roleKey: string;
  startAt: string;
  endAt: string;
  headcount: number;
  candidateUserIds?: string[];
  score?: number;
}

interface ImpactReport {
  runId: string;
  status: string;
  summary: {
    totalDemand: number;
    totalCoverageBefore: number;
    totalCoverageAfter: number;
    varianceBefore: number;
    varianceAfter: number;
    improvementPct: number;
  };
  hourlyVariance: Array<{
    hour: number;
    roleKey: string;
    demand: number;
    scheduledBefore: number;
    scheduledAfter: number;
    varianceBefore: number;
    varianceAfter: number;
  }>;
  residualGaps: Array<{
    hour: number;
    roleKey: string;
    varianceAfter: number;
  }>;
}

interface Branch {
  id: string;
  name: string;
}

export default function AutoSchedulerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const hasWriteAccess = !!(user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel));
  const hasReadAccess = !!(user && user.roleLevel && ['L3', 'L4', 'L5'].includes(user.roleLevel));

  // Fetch branches
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<Branch[]>('/orgs/branches');
      return response.data;
    },
    enabled: hasReadAccess,
  });

  // Auto-select first branch
  if (branches && branches.length > 0 && !selectedBranch) {
    setSelectedBranch(branches[0].id);
  }

  // Fetch existing run for date
  const { data: run, isLoading: runLoading, refetch: refetchRun } = useQuery<AutoScheduleRun | null>({
    queryKey: ['auto-schedule-run', selectedBranch, selectedDate],
    queryFn: async () => {
      if (!selectedBranch) return null;
      try {
        const response = await apiClient.get<AutoScheduleRun>(
          `/workforce/planning/auto-schedule?branchId=${selectedBranch}&date=${selectedDate}`,
        );
        return response.data;
      } catch {
        return null;
      }
    },
    enabled: !!(hasReadAccess && selectedBranch),
  });

  // Fetch impact if run exists
  const { data: impact } = useQuery<ImpactReport | null>({
    queryKey: ['auto-schedule-impact', run?.id],
    queryFn: async () => {
      if (!run?.id) return null;
      try {
        const response = await apiClient.get<ImpactReport>(
          `/workforce/planning/auto-schedule/${run.id}/impact`,
        );
        return response.data;
      } catch {
        return null;
      }
    },
    enabled: !!run?.id,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<AutoScheduleRun>(
        `/workforce/planning/auto-schedule/generate?branchId=${selectedBranch}&date=${selectedDate}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-schedule-run'] });
      refetchRun();
    },
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!run?.id) throw new Error('No run to apply');
      const response = await apiClient.post<AutoScheduleRun>(
        `/workforce/planning/auto-schedule/${run.id}/apply`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-schedule-run'] });
      queryClient.invalidateQueries({ queryKey: ['auto-schedule-impact'] });
      refetchRun();
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!run?.id) throw new Error('No run to void');
      const response = await apiClient.post<AutoScheduleRun>(
        `/workforce/planning/auto-schedule/${run.id}/void`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-schedule-run'] });
      refetchRun();
    },
  });

  // Generate alerts mutation
  const alertsMutation = useMutation({
    mutationFn: async () => {
      if (!run?.id) throw new Error('No run');
      const response = await apiClient.post<{ created: number; skipped: number }>(
        `/workforce/planning/auto-schedule/${run.id}/alerts`,
      );
      return response.data;
    },
  });

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Summary stats
  const stats = useMemo(() => {
    if (!run?.suggestions) return { totalShifts: 0, totalHeadcount: 0, roles: 0 };
    const roles = new Set(run.suggestions.map((s) => s.roleKey));
    return {
      totalShifts: run.suggestions.length,
      totalHeadcount: run.suggestions.reduce((sum, s) => sum + s.headcount, 0),
      roles: roles.size,
    };
  }, [run?.suggestions]);

  // Access denied
  if (!hasReadAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need L3+ access to view Auto-Scheduler.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8" />
            Auto-Scheduler
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate and apply shift suggestions from your staffing plan
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Auto-Schedule Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="date" className="text-sm font-medium">
                Date:
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Branch:</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                {branches?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!hasWriteAccess || generateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {generateMutation.isPending ? 'Generating...' : 'Generate Suggestions'}
              </Button>

              {run && run.status === 'DRAFT' && (
                <>
                  <Button
                    onClick={() => applyMutation.mutate()}
                    disabled={!hasWriteAccess || applyMutation.isPending}
                    variant="default"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4" />
                    {applyMutation.isPending ? 'Applying...' : 'Apply Schedule'}
                  </Button>

                  <Button
                    onClick={() => voidMutation.mutate()}
                    disabled={!hasWriteAccess || voidMutation.isPending}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Ban className="h-4 w-4" />
                    Void
                  </Button>
                </>
              )}
            </div>
          </div>

          {generateMutation.error && (
            <p className="text-red-500 text-sm mt-2">{(generateMutation.error as Error).message}</p>
          )}
          {applyMutation.error && (
            <p className="text-red-500 text-sm mt-2">{(applyMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {/* Run Status */}
      {run && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Run Status</span>
              <span
                className={`text-sm px-3 py-1 rounded-full ${run.status === 'APPLIED'
                    ? 'bg-green-100 text-green-800'
                    : run.status === 'VOID'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
              >
                {run.status}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Run ID:</span>
                <p className="font-mono text-xs">{run.id.substring(0, 12)}...</p>
              </div>
              <div>
                <span className="text-muted-foreground">Generated:</span>
                <p>{new Date(run.generatedAt).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Plan Status:</span>
                <p>{run.planStatus || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Idempotent:</span>
                <p>{run.isExisting ? 'Yes (reused)' : 'No (new)'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {run && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalShifts}</p>
                  <p className="text-sm text-muted-foreground">Shift Blocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalHeadcount}</p>
                  <p className="text-sm text-muted-foreground">Total Positions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{impact?.residualGaps?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Residual Gaps</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Suggestions Table */}
      {run && run.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shift Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Role</th>
                    <th className="text-left py-2 px-3">Start</th>
                    <th className="text-left py-2 px-3">End</th>
                    <th className="text-center py-2 px-3">Headcount</th>
                    <th className="text-center py-2 px-3">Candidates</th>
                    <th className="text-center py-2 px-3">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {run.suggestions.map((suggestion) => (
                    <tr key={suggestion.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{suggestion.roleKey}</td>
                      <td className="py-2 px-3">{formatTime(suggestion.startAt)}</td>
                      <td className="py-2 px-3">{formatTime(suggestion.endAt)}</td>
                      <td className="py-2 px-3 text-center">{suggestion.headcount}</td>
                      <td className="py-2 px-3 text-center">
                        {suggestion.candidateUserIds?.length || 0}
                      </td>
                      <td className="py-2 px-3 text-center">{suggestion.score || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Report */}
      {impact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Variance Impact</span>
              <span className="text-sm font-normal text-green-600">
                {impact.summary.improvementPct}% improvement
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm text-muted-foreground">Total Demand</p>
                <p className="text-xl font-bold">{impact.summary.totalDemand}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm text-muted-foreground">Before Coverage</p>
                <p className="text-xl font-bold">{impact.summary.totalCoverageBefore}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm text-muted-foreground">After Coverage</p>
                <p className="text-xl font-bold text-green-600">{impact.summary.totalCoverageAfter}</p>
              </div>
              <div className="bg-muted/50 p-3 rounded">
                <p className="text-sm text-muted-foreground">Residual Variance</p>
                <p className="text-xl font-bold text-orange-600">{impact.summary.varianceAfter}</p>
              </div>
            </div>

            {impact.residualGaps.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Residual Gaps (Unmet Demand)</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alertsMutation.mutate()}
                    disabled={alertsMutation.isPending}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Generate Alerts
                  </Button>
                </div>
                <div className="space-y-1">
                  {impact.residualGaps.slice(0, 5).map((gap, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-orange-50 p-2 rounded">
                      <span>Hour {gap.hour}:00 - {gap.roleKey}</span>
                      <span className="text-orange-600 font-medium">-{gap.varianceAfter} positions</span>
                    </div>
                  ))}
                  {impact.residualGaps.length > 5 && (
                    <p className="text-sm text-muted-foreground">
                      ...and {impact.residualGaps.length - 5} more gaps
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!runLoading && !run && (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Auto-Schedule Run</h3>
            <p className="text-muted-foreground mb-4">
              Click &quot;Generate Suggestions&quot; to create shift suggestions from your staffing plan.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
