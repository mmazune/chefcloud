/**
 * M10.12: Labor Targets Page
 *
 * Features:
 * - View and manage labor targets (covers/staff, labor %)
 * - Branch-level overrides (override org defaults)
 * - Create, update, delete targets
 * - Role-based filtering
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Target, Plus, Trash2, Edit2 } from 'lucide-react';

interface LaborTarget {
  id: string;
  orgId: string;
  branchId: string | null;
  roleKey: string;
  dayOfWeek: number;
  hourStart: number;
  hourEnd: number;
  targetCoversPerStaff: number | null;
  targetLaborPct: number | null;
  enabled: boolean;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROLES = ['WAITER', 'COOK', 'BARTENDER', 'CASHIER', 'CHEF', 'HOST', 'BUSSER'];

export default function LaborTargetsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [branchFilter, setBranchFilter] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LaborTarget | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    branchId: '',
    roleKey: 'WAITER',
    dayOfWeek: 0,
    hourStart: 8,
    hourEnd: 22,
    targetCoversPerStaff: 20,
    enabled: true,
  });

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

  // Fetch labor targets
  const { data: targets, isLoading } = useQuery<LaborTarget[]>({
    queryKey: ['labor-targets', branchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.append('branchId', branchFilter);
      const response = await apiClient.get(`/workforce/planning/targets?${params.toString()}`);
      return response.data;
    },
    enabled: !!user && hasReadAccess,
  });

  // Create target mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/workforce/planning/targets', {
        ...data,
        branchId: data.branchId || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-targets'] });
      setCreateDialogOpen(false);
      toast({ title: 'Target created', description: 'Labor target has been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create target.', variant: 'destructive' });
    },
  });

  // Update target mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiClient.patch(`/workforce/planning/targets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-targets'] });
      setEditTarget(null);
      toast({ title: 'Target updated', description: 'Labor target has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update target.', variant: 'destructive' });
    },
  });

  // Delete target mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workforce/planning/targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-targets'] });
      toast({ title: 'Target deleted', description: 'Labor target has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete target.', variant: 'destructive' });
    },
  });

  // Access check
  if (!hasReadAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need L3+ access to view labor targets.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleCreateSubmit = () => {
    createMutation.mutate(formData);
  };

  const handleEditSubmit = () => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        targetCoversPerStaff: formData.targetCoversPerStaff,
        enabled: formData.enabled,
      },
    });
  };

  const openEditDialog = (target: LaborTarget) => {
    setEditTarget(target);
    setFormData({
      branchId: target.branchId || '',
      roleKey: target.roleKey,
      dayOfWeek: target.dayOfWeek,
      hourStart: target.hourStart,
      hourEnd: target.hourEnd,
      targetCoversPerStaff: target.targetCoversPerStaff || 20,
      enabled: target.enabled,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Labor Targets
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure staffing targets per role, day, and hour
          </p>
        </div>

        {hasWriteAccess && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Target
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Labor Target</DialogTitle>
                <DialogDescription>
                  Set staffing targets for a role during specific hours.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Branch (optional - leave empty for org default)</Label>
                  <Select
                    value={formData.branchId}
                    onValueChange={(v) => setFormData({ ...formData, branchId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Org-wide default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Org-wide default</SelectItem>
                      {branches?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.roleKey}
                    onValueChange={(v) => setFormData({ ...formData, roleKey: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={formData.dayOfWeek.toString()}
                    onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Hour (0-23)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.hourStart}
                      onChange={(e) => setFormData({ ...formData, hourStart: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Hour (1-24)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={formData.hourEnd}
                      onChange={(e) => setFormData({ ...formData, hourEnd: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Target Covers per Staff</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.targetCoversPerStaff}
                    onChange={(e) => setFormData({ ...formData, targetCoversPerStaff: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Branch Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-64">
              <Label>Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All branches</SelectItem>
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

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Labor Targets</CardTitle>
          <CardDescription>
            Branch-level targets override org-wide defaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !targets?.length ? (
            <p className="text-muted-foreground">No targets configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Covers/Staff</TableHead>
                  <TableHead>Status</TableHead>
                  {hasWriteAccess && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>
                      {target.branchId
                        ? branches?.find((b) => b.id === target.branchId)?.name || 'Unknown'
                        : 'Org Default'}
                    </TableCell>
                    <TableCell>{target.roleKey}</TableCell>
                    <TableCell>{DAYS[target.dayOfWeek]}</TableCell>
                    <TableCell>
                      {target.hourStart}:00 - {target.hourEnd}:00
                    </TableCell>
                    <TableCell>{target.targetCoversPerStaff || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          target.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {target.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    {hasWriteAccess && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(target)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(target.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Labor Target</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Target Covers per Staff</Label>
              <Input
                type="number"
                min={1}
                value={formData.targetCoversPerStaff}
                onChange={(e) => setFormData({ ...formData, targetCoversPerStaff: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
