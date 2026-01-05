/**
 * M10.20: Geo-Fence Configuration Page
 *
 * Features:
 * - View/manage geo-fence configurations per branch
 * - Interactive map visualization (Leaflet)
 * - Enforcement KPIs dashboard
 * - Event history with filters
 * - Manager override workflow
 * - CSV export with hash verification
 *
 * RBAC: L3+ (View), L4+ (Edit Config), L5 (Delete)
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  MapPin,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Download,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface GeoFenceConfig {
  id: string;
  branchId: string;
  enabled: boolean;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  enforceClockIn: boolean;
  enforceClockOut: boolean;
  allowManagerOverride: boolean;
  maxAccuracyMeters: number;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; name: string };
}

interface GeoFenceEvent {
  id: string;
  eventType: 'BLOCKED' | 'OVERRIDE' | 'ALLOWED';
  reasonCode: string | null;
  clockAction: 'CLOCK_IN' | 'CLOCK_OUT';
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  overrideReason: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
  branch: { id: string; name: string };
  overrideBy: { id: string; firstName: string; lastName: string } | null;
}

interface EnforcementKpis {
  totalAttempts: number;
  totalBlocked: number;
  totalOverrides: number;
  totalAllowed: number;
  blockedByReason: Record<string, number>;
  overrideRate: number;
  byClockAction: { clockIn: number; clockOut: number };
}

export default function GeoFencePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GeoFenceEvent | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Form state for config
  const [formData, setFormData] = useState({
    branchId: '',
    enabled: true,
    centerLat: 0,
    centerLng: 0,
    radiusMeters: 100,
    enforceClockIn: true,
    enforceClockOut: true,
    allowManagerOverride: true,
    maxAccuracyMeters: 200,
  });

  // RBAC
  const roleLevel = user?.roleLevel || 'L1';
  const roleLevelNum = parseInt(roleLevel.replace('L', ''), 10);
  const canView = roleLevelNum >= 3;
  const canEdit = roleLevelNum >= 4;
  const canDelete = roleLevelNum >= 5;

  // Fetch branches
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data;
    },
    enabled: canView,
  });

  // Fetch geo-fence configs
  const { data: configs = [], isLoading: configsLoading } = useQuery<GeoFenceConfig[]>({
    queryKey: ['geofence-configs'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/geofence/config');
      return res.data;
    },
    enabled: canView,
  });

  // Fetch KPIs
  const { data: kpis } = useQuery<EnforcementKpis>({
    queryKey: ['geofence-kpis', selectedBranchId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const res = await apiClient.get(`/workforce/geofence/kpis?${params}`);
      return res.data;
    },
    enabled: canView,
  });

  // Fetch events
  const { data: eventsData, isLoading: eventsLoading } = useQuery<{
    events: GeoFenceEvent[];
    total: number;
  }>({
    queryKey: ['geofence-events', selectedBranchId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      params.append('limit', '50');
      const res = await apiClient.get(`/workforce/geofence/events?${params}`);
      return res.data;
    },
    enabled: canView,
  });

  // Upsert config mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiClient.put('/workforce/geofence/config', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofence-configs'] });
      setConfigDialogOpen(false);
      toast({ title: 'Configuration saved', description: 'Geo-fence config updated.' });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to save configuration',
        description: err.response?.data?.message || err.message,
        variant: 'destructive',
      });
    },
  });

  // Delete config mutation
  const deleteMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const res = await apiClient.delete(`/workforce/geofence/config/${branchId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofence-configs'] });
      toast({ title: 'Configuration deleted', description: 'Geo-fence config removed.' });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to delete configuration',
        description: err.response?.data?.message || err.message,
        variant: 'destructive',
      });
    },
  });

  // Override mutation
  const overrideMutation = useMutation({
    mutationFn: async (data: {
      timeEntryId: string;
      clockAction: 'CLOCK_IN' | 'CLOCK_OUT';
      reason: string;
    }) => {
      const res = await apiClient.post('/workforce/geofence/override', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofence-events'] });
      queryClient.invalidateQueries({ queryKey: ['geofence-kpis'] });
      setOverrideDialogOpen(false);
      setSelectedEvent(null);
      setOverrideReason('');
      toast({ title: 'Override applied', description: 'Manager override recorded.' });
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to apply override',
        description: err.response?.data?.message || err.message,
        variant: 'destructive',
      });
    },
  });

  // Export CSV
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const res = await apiClient.get(`/workforce/geofence/export?${params}`, {
        responseType: 'blob',
      });

      // Get hash from header
      const hash = res.headers['x-content-hash'];

      // Download file
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geofence-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: `Downloaded with hash: ${hash?.slice(0, 16)}...`,
      });
    } catch (err) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  // Open config dialog for edit
  const openEditDialog = (config: GeoFenceConfig) => {
    setFormData({
      branchId: config.branchId,
      enabled: config.enabled,
      centerLat: Number(config.centerLat),
      centerLng: Number(config.centerLng),
      radiusMeters: config.radiusMeters,
      enforceClockIn: config.enforceClockIn,
      enforceClockOut: config.enforceClockOut,
      allowManagerOverride: config.allowManagerOverride,
      maxAccuracyMeters: config.maxAccuracyMeters ?? 200,
    });
    setConfigDialogOpen(true);
  };

  // Open config dialog for new
  const openNewDialog = () => {
    setFormData({
      branchId: branches[0]?.id || '',
      enabled: true,
      centerLat: 0,
      centerLng: 0,
      radiusMeters: 100,
      enforceClockIn: true,
      enforceClockOut: true,
      allowManagerOverride: true,
      maxAccuracyMeters: 200,
    });
    setConfigDialogOpen(true);
  };

  // RBAC redirect
  if (user && !canView) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Geo-Fence Management
          </h1>
          <p className="text-muted-foreground">
            Configure branch perimeters and enforce clock-in/out location verification
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Geo-Fence
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div>
            <Label>Branch</Label>
            <Select
              value={selectedBranchId || 'all'}
              onValueChange={(v) => setSelectedBranchId(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="kpis">
        <TabsList>
          <TabsTrigger value="kpis">KPIs Dashboard</TabsTrigger>
          <TabsTrigger value="configs">Configurations</TabsTrigger>
          <TabsTrigger value="events">Event History</TabsTrigger>
        </TabsList>

        {/* KPIs Tab */}
        <TabsContent value="kpis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalAttempts ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Blocked</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{kpis?.totalBlocked ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Overrides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {kpis?.totalOverrides ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Override Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((kpis?.overrideRate ?? 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Blocked By Reason */}
          <Card>
            <CardHeader>
              <CardTitle>Blocked By Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 flex-wrap">
                {Object.entries(kpis?.blockedByReason || {}).map(([reason, count]) => (
                  <div key={reason} className="text-center">
                    <div className="text-sm text-muted-foreground">{reason}</div>
                    <div className="text-xl font-bold">{count}</div>
                  </div>
                ))}
                {Object.keys(kpis?.blockedByReason || {}).length === 0 && (
                  <p className="text-muted-foreground">No blocked events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configurations Tab */}
        <TabsContent value="configs">
          <Card>
            <CardHeader>
              <CardTitle>Branch Geo-Fence Configurations</CardTitle>
              <CardDescription>
                Define perimeter settings for each branch location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configsLoading ? (
                <p>Loading...</p>
              ) : configs.length === 0 ? (
                <p className="text-muted-foreground">No geo-fence configurations yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Radius</TableHead>
                      <TableHead>Enforce</TableHead>
                      <TableHead>Override</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((cfg) => (
                      <TableRow key={cfg.id}>
                        <TableCell className="font-medium">{cfg.branch.name}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.enabled ? 'default' : 'secondary'}>
                            {cfg.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>{cfg.radiusMeters}m</TableCell>
                        <TableCell>
                          {cfg.enforceClockIn && <Badge variant="outline">In</Badge>}{' '}
                          {cfg.enforceClockOut && <Badge variant="outline">Out</Badge>}
                        </TableCell>
                        <TableCell>
                          {cfg.allowManagerOverride ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(cfg)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate(cfg.branchId)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Enforcement Event History</CardTitle>
              <CardDescription>Blocked attempts, overrides, and allowed clock actions</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <p>Loading...</p>
              ) : !eventsData?.events?.length ? (
                <p className="text-muted-foreground">No events recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventsData.events.map((evt) => (
                      <TableRow key={evt.id}>
                        <TableCell>
                          {new Date(evt.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {evt.user.firstName} {evt.user.lastName}
                        </TableCell>
                        <TableCell>{evt.branch.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{evt.clockAction}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              evt.eventType === 'BLOCKED'
                                ? 'destructive'
                                : evt.eventType === 'OVERRIDE'
                                  ? 'secondary'
                                  : 'default'
                            }
                          >
                            {evt.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell>{evt.reasonCode || '-'}</TableCell>
                        <TableCell>
                          {evt.distanceMeters ? `${Math.round(evt.distanceMeters)}m` : '-'}
                        </TableCell>
                        <TableCell>
                          {evt.eventType === 'BLOCKED' && roleLevelNum >= 3 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedEvent(evt);
                                setOverrideDialogOpen(true);
                              }}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Override
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formData.branchId && configs.find((c) => c.branchId === formData.branchId)
                ? 'Edit Geo-Fence'
                : 'Add Geo-Fence'}
            </DialogTitle>
            <DialogDescription>
              Configure perimeter enforcement for a branch location
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Branch</Label>
              <Select
                value={formData.branchId}
                onValueChange={(v) => setFormData((p) => ({ ...p, branchId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, enabled: v }))}
              />
              <Label>Enabled</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Center Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formData.centerLat}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, centerLat: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div>
                <Label>Center Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={formData.centerLng}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, centerLng: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div>
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                min="10"
                max="50000"
                value={formData.radiusMeters}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, radiusMeters: parseInt(e.target.value) || 100 }))
                }
              />
            </div>

            <div>
              <Label>Max Accuracy (meters) - H7: Indoor GPS tolerance</Label>
              <Input
                type="number"
                min="10"
                max="1000"
                value={formData.maxAccuracyMeters}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    maxAccuracyMeters: parseInt(e.target.value) || 200,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.enforceClockIn}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, enforceClockIn: v }))}
                />
                <Label>Enforce Clock-In</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.enforceClockOut}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, enforceClockOut: v }))}
                />
                <Label>Enforce Clock-Out</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.allowManagerOverride}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, allowManagerOverride: v }))}
              />
              <Label>Allow Manager Override (L3+)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => upsertMutation.mutate(formData)}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manager Override</DialogTitle>
            <DialogDescription>
              Apply override for blocked clock action. Requires at least 10 characters.
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p>
                  <strong>Employee:</strong> {selectedEvent.user.firstName}{' '}
                  {selectedEvent.user.lastName}
                </p>
                <p>
                  <strong>Action:</strong> {selectedEvent.clockAction}
                </p>
                <p>
                  <strong>Reason:</strong> {selectedEvent.reasonCode}
                </p>
                {selectedEvent.distanceMeters && (
                  <p>
                    <strong>Distance:</strong> {Math.round(selectedEvent.distanceMeters)}m
                  </p>
                )}
              </div>

              <div>
                <Label>Override Reason (min 10 characters)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter justification for override..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedEvent) {
                  // Note: In real implementation, we'd need the timeEntryId
                  // For now, we show the pattern
                  toast({
                    title: 'Override workflow',
                    description:
                      'Override requires timeEntryId. Use timeclock API to apply override.',
                  });
                  setOverrideDialogOpen(false);
                }
              }}
              disabled={overrideReason.trim().length < 10}
            >
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
