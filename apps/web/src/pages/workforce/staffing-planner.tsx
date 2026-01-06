/**
 * M10.12: Staffing Planner Page
 *
 * Features:
 * - Generate forecast snapshots from reservations + historical data
 * - Generate staffing plans from forecasts
 * - View hourly staffing recommendations by role
 * - Variance report (scheduled vs suggested)
 * - Publish plans
 * - CSV exports
 *
 * RBAC: L4+ (Manager, Owner) for write, L3+ for read
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
  Calendar,
  Zap,
  FileCheck,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface ForecastSnapshot {
  id: string;
  date: string;
  inputsHash: string;
  generatedAt: string;
  totalsJson: {
    coversForecast: number[];
    ordersForecast: number[];
    dataSources: string[];
  };
}

interface StaffingPlan {
  id: string;
  date: string;
  status: 'DRAFT' | 'PUBLISHED';
  generatedAt: string;
  publishedAt: string | null;
  lines: Array<{
    id: string;
    hour: number;
    roleKey: string;
    suggestedHeadcount: number;
    rationale: Record<string, unknown>;
  }>;
}

interface VarianceItem {
  hour: number;
  roleKey: string;
  scheduledCount: number;
  suggestedCount: number;
  delta: number;
}

export default function StaffingPlannerPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [activeView, setActiveView] = useState<'forecast' | 'plan' | 'variance'>('forecast');

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

  // Fetch forecast
  const { data: forecast, isLoading: forecastLoading } = useQuery<ForecastSnapshot>({
    queryKey: ['forecast', selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        date: selectedDate,
      });
      const response = await apiClient.get(`/workforce/planning/forecast?${params.toString()}`);
      return response.data;
    },
    enabled: !!selectedBranch && !!selectedDate && hasReadAccess,
  });

  // Fetch plan
  const { data: plan, isLoading: planLoading } = useQuery<StaffingPlan>({
    queryKey: ['staffing-plan', selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        date: selectedDate,
      });
      const response = await apiClient.get(`/workforce/planning/plans?${params.toString()}`);
      return response.data;
    },
    enabled: !!selectedBranch && !!selectedDate && hasReadAccess,
  });

  // Fetch variance
  const { data: variance } = useQuery<VarianceItem[]>({
    queryKey: ['variance', selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        date: selectedDate,
      });
      const response = await apiClient.get(`/workforce/planning/variance?${params.toString()}`);
      return response.data;
    },
    enabled: !!selectedBranch && !!selectedDate && !!plan && hasReadAccess,
  });

  // Generate forecast mutation
  const generateForecastMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/planning/forecast/generate', {
        branchId: selectedBranch,
        date: selectedDate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast', selectedBranch, selectedDate] });
      toast({ title: 'Forecast generated', description: 'Labor forecast has been generated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate forecast.', variant: 'destructive' });
    },
  });

  // Generate plan mutation
  const generatePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/planning/plans/generate', {
        branchId: selectedBranch,
        date: selectedDate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffing-plan', selectedBranch, selectedDate] });
      toast({ title: 'Plan generated', description: 'Staffing plan has been generated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate plan. Make sure forecast exists.', variant: 'destructive' });
    },
  });

  // Publish plan mutation
  const publishPlanMutation = useMutation({
    mutationFn: async () => {
      if (!plan) return;
      const response = await apiClient.post(`/workforce/planning/plans/${plan.id}/publish`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffing-plan', selectedBranch, selectedDate] });
      toast({ title: 'Plan published', description: 'Staffing plan is now published.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to publish plan.', variant: 'destructive' });
    },
  });

  // Generate alerts mutation
  const generateAlertsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/workforce/planning/alerts/generate', {
        branchId: selectedBranch,
        date: selectedDate,
      });
      return response.data;
    },
    onSuccess: (data: { count: number }) => {
      toast({ title: 'Alerts generated', description: `Generated ${data.count} alerts.` });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate alerts.', variant: 'destructive' });
    },
  });

  // Export handlers
  const handleExport = async (type: 'forecast' | 'plan' | 'variance') => {
    try {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        date: selectedDate,
      });
      const response = await apiClient.get(
        `/workforce/planning/export/${type}?${params.toString()}`,
        { responseType: 'blob' },
      );

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selectedBranch}_${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: `${type} exported as CSV.` });
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
            <CardDescription>You need L3+ access to view staffing planner.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Group plan lines by hour (used for potential future enhancements)
  const _planByHour = plan?.lines.reduce((acc, line) => {
    if (!acc[line.hour]) acc[line.hour] = [];
    acc[line.hour].push(line);
    return acc;
  }, {} as Record<number, typeof plan.lines>);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Staffing Planner
          </h1>
          <p className="text-muted-foreground mt-1">
            Forecast labor demand and generate staffing plans
          </p>
        </div>
      </div>

      {/* Date/Branch Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Date &amp; Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      {selectedBranch && (
        <div className="space-y-4">
          {/* View Switcher */}
          <div className="flex gap-2">
            <Button
              variant={activeView === 'forecast' ? 'default' : 'outline'}
              onClick={() => setActiveView('forecast')}
            >
              Forecast
            </Button>
            <Button
              variant={activeView === 'plan' ? 'default' : 'outline'}
              onClick={() => setActiveView('plan')}
            >
              Staffing Plan
            </Button>
            <Button
              variant={activeView === 'variance' ? 'default' : 'outline'}
              onClick={() => setActiveView('variance')}
            >
              Variance
            </Button>
          </div>

          {/* Forecast View */}
          {activeView === 'forecast' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Labor Forecast</CardTitle>
                  <CardDescription>
                    Predicted covers and orders based on reservations and historical data
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {hasWriteAccess && (
                    <Button
                      onClick={() => generateForecastMutation.mutate()}
                      disabled={generateForecastMutation.isPending}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Forecast
                    </Button>
                  )}
                  {forecast && (
                    <Button variant="outline" onClick={() => handleExport('forecast')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : !forecast ? (
                  <p className="text-muted-foreground">No forecast generated for this date.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Hash: {forecast.inputsHash.substring(0, 8)}...</span>
                      <span>Generated: {new Date(forecast.generatedAt).toLocaleString()}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hour</TableHead>
                          <TableHead>Forecasted Covers</TableHead>
                          <TableHead>Forecasted Orders</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecast.totalsJson.coversForecast.map((covers, hour) => (
                          <TableRow key={hour}>
                            <TableCell>{hour}:00 - {hour + 1}:00</TableCell>
                            <TableCell>{covers}</TableCell>
                            <TableCell>{forecast.totalsJson.ordersForecast[hour]}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Staffing Plan View */}
          {activeView === 'plan' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Staffing Plan</CardTitle>
                  <CardDescription>
                    Suggested staff counts per role and hour
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {hasWriteAccess && (
                    <>
                      <Button
                        onClick={() => generatePlanMutation.mutate()}
                        disabled={generatePlanMutation.isPending || !forecast}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Plan
                      </Button>
                      {plan?.status === 'DRAFT' && (
                        <Button
                          variant="secondary"
                          onClick={() => publishPlanMutation.mutate()}
                          disabled={publishPlanMutation.isPending}
                        >
                          <FileCheck className="h-4 w-4 mr-2" />
                          Publish
                        </Button>
                      )}
                    </>
                  )}
                  {plan && (
                    <Button variant="outline" onClick={() => handleExport('plan')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {planLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : !plan ? (
                  <p className="text-muted-foreground">
                    No staffing plan for this date. Generate forecast first.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-4 items-center">
                      <Badge variant={plan.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {plan.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Generated: {new Date(plan.generatedAt).toLocaleString()}
                      </span>
                      {plan.publishedAt && (
                        <span className="text-sm text-muted-foreground">
                          Published: {new Date(plan.publishedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hour</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Suggested Staff</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plan.lines
                          .filter((l) => l.suggestedHeadcount > 0)
                          .sort((a, b) => a.hour - b.hour || a.roleKey.localeCompare(b.roleKey))
                          .map((line) => (
                            <TableRow key={line.id}>
                              <TableCell>{line.hour}:00 - {line.hour + 1}:00</TableCell>
                              <TableCell>{line.roleKey}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  {line.suggestedHeadcount}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Variance View */}
          {activeView === 'variance' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Variance Report</CardTitle>
                  <CardDescription>
                    Difference between scheduled shifts and staffing plan
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {hasWriteAccess && (
                    <Button
                      onClick={() => generateAlertsMutation.mutate()}
                      disabled={generateAlertsMutation.isPending || !variance?.length}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Generate Alerts
                    </Button>
                  )}
                  {variance && variance.length > 0 && (
                    <Button variant="outline" onClick={() => handleExport('variance')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!plan ? (
                  <p className="text-muted-foreground">Generate a staffing plan first.</p>
                ) : !variance?.length ? (
                  <p className="text-muted-foreground">No variance data available.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hour</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Suggested</TableHead>
                        <TableHead>Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variance
                        .filter((v) => v.suggestedCount > 0 || v.scheduledCount > 0)
                        .sort((a, b) => a.hour - b.hour || a.roleKey.localeCompare(b.roleKey))
                        .map((v, i) => (
                          <TableRow key={i}>
                            <TableCell>{v.hour}:00 - {v.hour + 1}:00</TableCell>
                            <TableCell>{v.roleKey}</TableCell>
                            <TableCell>{v.scheduledCount}</TableCell>
                            <TableCell>{v.suggestedCount}</TableCell>
                            <TableCell>
                              <div
                                className={`flex items-center gap-1 ${v.delta > 0
                                    ? 'text-green-600'
                                    : v.delta < 0
                                      ? 'text-red-600'
                                      : ''
                                  }`}
                              >
                                {v.delta > 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : v.delta < 0 ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : null}
                                {v.delta > 0 ? '+' : ''}
                                {v.delta}
                              </div>
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
      )}
    </div>
  );
}
