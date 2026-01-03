import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Plus, Trash2, Edit, CalendarOff } from 'lucide-react';

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

interface Blackout {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  reason?: string;
  createdBy?: string;
}

export default function BlackoutsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingBlackout, setEditingBlackout] = useState<Blackout | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    startAt: '',
    endAt: '',
    reason: '',
  });

  const { data: blackouts = [], isLoading } = useQuery<Blackout[]>({
    queryKey: ['blackouts', branchId],
    queryFn: async () => {
      const res = await apiClient.get('/reservations/blackouts', {
        params: { branchId },
      });
      return res.data;
    },
    enabled: !!branchId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiClient.post('/reservations/blackouts', data, {
        params: { branchId },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackouts', branchId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiClient.put(`/reservations/blackouts/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackouts', branchId] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reservations/blackouts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackouts', branchId] });
      setDeleteId(null);
    },
  });

  const resetForm = () => {
    setFormData({ title: '', startAt: '', endAt: '', reason: '' });
    setEditingBlackout(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (blackout: Blackout) => {
    setEditingBlackout(blackout);
    setFormData({
      title: blackout.title,
      startAt: blackout.startAt.slice(0, 16),
      endAt: blackout.endAt.slice(0, 16),
      reason: blackout.reason || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBlackout) {
      updateMutation.mutate({ id: editingBlackout.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!branchId) {
    return (
      <AppShell>
        <PageHeader
          title="Blackout Windows"
          subtitle="Block reservations during maintenance or private events"
        />
        <Card className="p-6">
          <p className="text-muted-foreground">Please select a branch to manage blackouts.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Blackout Windows"
        subtitle="Block reservations during maintenance or private events"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Blackout
          </Button>
        }
      />

      <Card className="p-6">
        {isLoading ? (
          <p>Loading...</p>
        ) : blackouts.length === 0 ? (
          <div className="text-center py-12">
            <CalendarOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No blackout windows configured</p>
            <Button onClick={handleOpenCreate} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Blackout
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {blackouts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(b.startAt)} -{' '}
                    {formatDateTime(b.endAt)}
                  </div>
                  {b.reason && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Reason: {b.reason}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(b)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(b.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBlackout ? 'Edit Blackout' : 'Create Blackout'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Private Event, Maintenance"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startAt">Start</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endAt">End</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Additional notes about this blackout"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blackout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow reservations during this time window again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
