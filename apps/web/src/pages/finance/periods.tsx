/**
 * M8.2: Fiscal Periods Page
 * 
 * Manages accounting periods (open, close, lock, reopen).
 * Period reopen is gated by FINANCE_PERIOD_REOPEN capability (L5/OWNER only).
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel, hasRoleLevel } from '@/lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Lock, Unlock, AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I3: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/finance/periods',
  title: 'Fiscal Periods',
  primaryActions: [
    { label: 'Close Period', testId: 'period-close', intent: 'update' },
    { label: 'Reopen Period', testId: 'period-reopen', intent: 'update' },
  ],
  apiCalls: [
    { method: 'GET', path: '/accounting/periods', trigger: 'onMount', notes: 'List periods' },
    { method: 'PATCH', path: '/accounting/periods/:id/close', trigger: 'onAction', notes: 'Close period' },
    { method: 'PATCH', path: '/accounting/periods/:id/reopen', trigger: 'onAction', notes: 'Reopen period (L5 only)' },
  ],
  risk: 'HIGH',
  allowedRoles: ['OWNER', 'ACCOUNTANT'],
});

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  createdAt: string;
}

const STATUS_CONFIG = {
  OPEN: { color: 'bg-green-100 text-green-800', icon: Unlock, description: 'Transactions allowed' },
  CLOSED: { color: 'bg-yellow-100 text-yellow-800', icon: Lock, description: 'Soft closed, can reopen' },
  LOCKED: { color: 'bg-red-100 text-red-800', icon: Lock, description: 'Permanently locked' },
};

export default function FiscalPeriodsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if user can reopen periods (L5/OWNER only - FINANCE_PERIOD_REOPEN capability)
  const canReopenPeriods = user ? hasRoleLevel(user, RoleLevel.L5) : false;

  const { data: periods, isLoading, error } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: async () => {
      const response = await apiClient.get<FiscalPeriod[]>('/accounting/periods');
      return response.data;
    },
    enabled: !!user,
  });

  // Close period mutation
  const closePeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await apiClient.patch(`/accounting/periods/${periodId}/close`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      toast({ title: 'Success', description: 'Period closed successfully' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({ 
        title: 'Error', 
        description: error.response?.data?.message || 'Failed to close period',
        variant: 'destructive' 
      });
    },
  });

  // Reopen period mutation (L5/OWNER only)
  const reopenPeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await apiClient.patch(`/accounting/periods/${periodId}/reopen`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });
      toast({ title: 'Success', description: 'Period reopened successfully' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({ 
        title: 'Error', 
        description: error.response?.data?.message || 'Failed to reopen period. Only OWNER can reopen periods.',
        variant: 'destructive' 
      });
    },
  });

  // Sort periods by start date (most recent first)
  const sortedPeriods = periods?.sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  ) || [];

  // Find current period
  const now = new Date();
  const currentPeriod = sortedPeriods.find(p => 
    new Date(p.startDate) <= now && new Date(p.endDate) >= now
  );

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Fiscal Periods" 
          subtitle="Manage accounting periods and period close"
        />

        {/* Period Status Legend */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Period Status Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge className={config.color}>{status}</Badge>
                  <span className="text-sm text-muted-foreground">{config.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Period Highlight */}
        {currentPeriod && (
          <Card className="mb-6 border-2 border-blue-500">
            <CardHeader className="bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-blue-800">Current Period</CardTitle>
                  <CardDescription>{currentPeriod.name}</CardDescription>
                </div>
                <Badge className={STATUS_CONFIG[currentPeriod.status].color}>
                  {currentPeriod.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p>
                    <strong>Start:</strong> {new Date(currentPeriod.startDate).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>End:</strong> {new Date(currentPeriod.endDate).toLocaleDateString()}
                  </p>
                </div>
                {currentPeriod.status === 'OPEN' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button data-testid="period-close" variant="outline">
                        <Lock className="mr-2 h-4 w-4" />
                        Close Period
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          Close Fiscal Period?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Closing the period &quot;{currentPeriod.name}&quot; will prevent new journal entries 
                          from being posted to this period. This is a soft close and can be reopened by an 
                          administrator if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => closePeriod.mutate(currentPeriod.id)}
                          disabled={closePeriod.isPending}
                        >
                          {closePeriod.isPending ? 'Closing...' : 'Close Period'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Periods Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              All Fiscal Periods ({sortedPeriods.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Loading periods...</p>}
            {error && <p className="text-red-500">Failed to load periods</p>}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPeriods.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No fiscal periods found. Periods are created automatically when the organization is set up.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedPeriods.map((period) => {
                      const isCurrent = period.id === currentPeriod?.id;
                      const StatusIcon = STATUS_CONFIG[period.status].icon;
                      
                      return (
                        <TableRow key={period.id} className={isCurrent ? 'bg-blue-50' : ''}>
                          <TableCell className="font-medium">
                            {period.name}
                            {isCurrent && (
                              <Badge variant="outline" className="ml-2">Current</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(period.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(period.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[period.status].color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {period.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {period.status === 'OPEN' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Lock className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Close Period?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will close &quot;{period.name}&quot; and prevent new journal entries.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => closePeriod.mutate(period.id)}
                                    >
                                      Close
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {period.status === 'CLOSED' && canReopenPeriods && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    data-testid="period-reopen"
                                    title="Reopen Period (Owner Only)"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                                      Reopen Period?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will reopen &quot;{period.name}&quot; and allow new journal entries.
                                      This action is restricted to Owners only.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => reopenPeriod.mutate(period.id)}
                                      disabled={reopenPeriod.isPending}
                                    >
                                      {reopenPeriod.isPending ? 'Reopening...' : 'Reopen Period'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {period.status === 'CLOSED' && !canReopenPeriods && (
                              <span className="text-xs text-muted-foreground">
                                Closed (Owner can reopen)
                              </span>
                            )}
                            {period.status === 'LOCKED' && (
                              <span className="text-xs text-muted-foreground">
                                Permanently locked
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Period Close Process</p>
                <ul className="mt-1 text-muted-foreground list-disc pl-4 space-y-1">
                  <li><strong>OPEN</strong>: Normal operations, all transactions allowed</li>
                  <li><strong>CLOSED</strong>: Soft close, prevents new entries but can be reopened if needed</li>
                  <li><strong>LOCKED</strong>: Permanent lock after final review, cannot be reopened</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="mt-4 text-xs text-muted-foreground">
          ✓ Data source: GET /accounting/periods, PATCH /accounting/periods/:id/close
        </div>
      </AppShell>
    </RequireRole>
  );
}
