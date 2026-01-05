/**
 * M10.21: Kiosk Devices Management Page
 *
 * Features:
 * - View/manage kiosk devices per branch
 * - Device enrollment with one-time secret display
 * - Secret rotation
 * - Device enable/disable
 * - Usage KPIs dashboard
 * - Session history
 *
 * RBAC: L4+ (Full access)
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
import { useToast } from '@/components/ui/use-toast';
import {
  Tablet,
  Settings,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Key,
  Copy,
  Eye,
  EyeOff,
  Clock,
  Users,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface KioskDevice {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  publicId: string;
  enabled: boolean;
  allowedIpCidrs: string[];
  lastSeenAt: string | null;
  createdAt: string;
  branch: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string } | null;
  _count?: {
    sessions: number;
    clockEvents: number;
    pinAttempts: number;
  };
}

interface KioskKpis {
  devices: {
    total: number;
    enabled: number;
    disabled: number;
  };
  sessions: { total: number };
  clockEvents: {
    total: number;
    byType: Record<string, number>;
  };
  pinAttempts: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
}

interface DeviceSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  lastHeartbeatAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export default function KioskDevicesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<KioskDevice | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<{ deviceName: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    branchId: '',
    name: '',
    allowedIpCidrs: '',
    enabled: true,
  });

  // Check role level (L4+)
  const canManage = user?.roleLevel === 'L4' || user?.roleLevel === 'L5';

  // Fetch branches
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/org/branches');
      return res.data;
    },
  });

  // Fetch kiosk devices
  const { data: devices = [], isLoading: devicesLoading, refetch: refetchDevices } = useQuery<KioskDevice[]>({
    queryKey: ['kiosk-devices', selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== 'all' ? { branchId: selectedBranch } : {};
      const res = await apiClient.get('/workforce/kiosk/devices', { params });
      return res.data;
    },
    enabled: canManage,
  });

  // Fetch KPIs
  const { data: kpis } = useQuery<KioskKpis>({
    queryKey: ['kiosk-kpis', selectedBranch],
    queryFn: async () => {
      const params = selectedBranch !== 'all' ? { branchId: selectedBranch } : {};
      const res = await apiClient.get('/workforce/kiosk/kpis', { params });
      return res.data;
    },
    enabled: canManage,
  });

  // Fetch sessions for selected device
  const { data: sessionsData } = useQuery<{ sessions: DeviceSession[]; total: number }>({
    queryKey: ['kiosk-device-sessions', selectedDeviceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workforce/kiosk/devices/${selectedDeviceId}/sessions`);
      return res.data;
    },
    enabled: !!selectedDeviceId && sessionsDialogOpen,
  });

  // Create device mutation
  const createMutation = useMutation({
    mutationFn: async (data: { branchId: string; name: string; allowedIpCidrs?: string[] }) => {
      const res = await apiClient.post('/workforce/kiosk/devices', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-devices'] });
      queryClient.invalidateQueries({ queryKey: ['kiosk-kpis'] });
      setCreateDialogOpen(false);
      setNewSecret({ deviceName: data.name, secret: data.secret });
      setSecretDialogOpen(true);
      toast({ title: 'Device created', description: 'Save the secret below - it will not be shown again!' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to create device',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Update device mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; enabled?: boolean; allowedIpCidrs?: string[] }) => {
      const res = await apiClient.patch(`/workforce/kiosk/devices/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-devices'] });
      queryClient.invalidateQueries({ queryKey: ['kiosk-kpis'] });
      setEditDevice(null);
      toast({ title: 'Device updated' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to update device',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete device mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/workforce/kiosk/devices/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-devices'] });
      queryClient.invalidateQueries({ queryKey: ['kiosk-kpis'] });
      toast({ title: 'Device deleted' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to delete device',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  // Rotate secret mutation
  const rotateSecretMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/workforce/kiosk/devices/${id}/rotate-secret`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kiosk-devices'] });
      setNewSecret({ deviceName: data.name, secret: data.secret });
      setSecretDialogOpen(true);
      toast({ title: 'Secret rotated', description: 'Save the new secret below - it will not be shown again!' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to rotate secret',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    const cidrs = formData.allowedIpCidrs
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      branchId: formData.branchId,
      name: formData.name,
      allowedIpCidrs: cidrs.length > 0 ? cidrs : undefined,
    });
  };

  const handleUpdate = () => {
    if (!editDevice) return;

    const cidrs = formData.allowedIpCidrs
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    updateMutation.mutate({
      id: editDevice.id,
      name: formData.name,
      enabled: formData.enabled,
      allowedIpCidrs: cidrs,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (!canManage) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>You need L4+ role to manage kiosk devices.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tablet className="h-6 w-6" />
            Kiosk Devices
          </h1>
          <p className="text-muted-foreground">
            Manage timeclock kiosk devices for employee clock-in/out
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDevices()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setFormData({ branchId: '', name: '', allowedIpCidrs: '', enabled: true });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Kiosk Device</DialogTitle>
                <DialogDescription>
                  Create a new kiosk device for a branch. You will receive a one-time secret.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select
                    value={formData.branchId}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, branchId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Device Name</Label>
                  <Input
                    placeholder="e.g., Front Entrance Tablet"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allowed IP CIDRs (optional)</Label>
                  <Input
                    placeholder="e.g., 192.168.1.0/24, 10.0.0.0/8"
                    value={formData.allowedIpCidrs}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowedIpCidrs: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list of IP ranges</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.branchId || !formData.name || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Device'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Branch Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Label>Filter by Branch:</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tablet className="h-4 w-4" />
                Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.devices.total}</div>
              <div className="text-xs text-muted-foreground">
                {kpis.devices.enabled} enabled, {kpis.devices.disabled} disabled
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.sessions.total}</div>
              <div className="text-xs text-muted-foreground">Total device sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Clock Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.clockEvents.total}</div>
              <div className="text-xs text-muted-foreground">
                {kpis.clockEvents.byType?.CLOCK_IN || 0} in, {kpis.clockEvents.byType?.CLOCK_OUT || 0} out
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                PIN Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(kpis.pinAttempts.successRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                {kpis.pinAttempts.successful} / {kpis.pinAttempts.total} attempts
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Devices</CardTitle>
          <CardDescription>Manage kiosk devices for timeclock operations</CardDescription>
        </CardHeader>
        <CardContent>
          {devicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No kiosk devices enrolled. Click &quot;Add Device&quot; to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Public ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell>{device.branch.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 rounded">{device.publicId}</code>
                    </TableCell>
                    <TableCell>
                      {device.enabled ? (
                        <Badge variant="default" className="bg-green-600">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(device.lastSeenAt)}
                    </TableCell>
                    <TableCell>
                      {device._count && (
                        <span className="text-sm text-muted-foreground">
                          {device._count.clockEvents} events
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDeviceId(device.id);
                            setSessionsDialogOpen(true);
                          }}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditDevice(device);
                            setFormData({
                              branchId: device.branchId,
                              name: device.name,
                              allowedIpCidrs: device.allowedIpCidrs.join(', '),
                              enabled: device.enabled,
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Rotate secret for "${device.name}"? The old secret will stop working immediately.`)) {
                              rotateSecretMutation.mutate(device.id);
                            }
                          }}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${device.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(device.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Device Dialog */}
      <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed IP CIDRs</Label>
              <Input
                placeholder="e.g., 192.168.1.0/24"
                value={formData.allowedIpCidrs}
                onChange={(e) => setFormData(prev => ({ ...prev, allowedIpCidrs: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Display Dialog */}
      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-yellow-500" />
              Device Secret
            </DialogTitle>
            <DialogDescription>
              Save this secret immediately. It will NOT be shown again.
            </DialogDescription>
          </DialogHeader>
          {newSecret && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4">
                <Label className="text-xs text-muted-foreground">Device: {newSecret.deviceName}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-background p-2 rounded text-sm font-mono break-all">
                    {showSecret ? newSecret.secret : '•'.repeat(32)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(newSecret.secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Important:</strong> Copy this secret now. Once you close this dialog,
                    you will need to rotate the secret to get a new one.
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => {
              setSecretDialogOpen(false);
              setNewSecret(null);
              setShowSecret(false);
            }}>
              I&apos;ve Saved the Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={sessionsDialogOpen} onOpenChange={setSessionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Device Sessions</DialogTitle>
            <DialogDescription>Recent session history for this device</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            {sessionsData?.sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No sessions recorded</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData?.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{formatDate(session.startedAt)}</TableCell>
                      <TableCell>{formatDate(session.endedAt)}</TableCell>
                      <TableCell>
                        {session.endedReason ? (
                          <Badge variant="secondary">{session.endedReason}</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {session.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
