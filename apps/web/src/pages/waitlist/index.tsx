import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface WaitlistEntry {
  id: string;
  name: string;
  phone: string;
  partySize: number;
  notes?: string;
  quotedWaitMinutes?: number;
  status: 'WAITING' | 'SEATED' | 'DROPPED';
  seatedAt?: string;
  droppedAt?: string;
  droppedReason?: string;
  createdAt: string;
  branch?: {
    id: string;
    name: string;
  };
}

interface WaitlistStats {
  total: number;
  waiting: number;
  seated: number;
  dropped: number;
  averageWaitMinutes: number;
  waitingQueue: Array<{
    id: string;
    name: string;
    partySize: number;
    quotedWaitMinutes?: number;
    waitingSince: string;
    waitingMinutes: number;
  }>;
}

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [statusFilter, setStatusFilter] = useState<string>('WAITING');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    name: '',
    phone: '',
    partySize: 2,
    notes: '',
    quotedWaitMinutes: 15,
  });

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ['waitlist', statusFilter, branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await apiClient.get('/waitlist', { params });
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: stats } = useQuery<WaitlistStats>({
    queryKey: ['waitlist-stats', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/waitlist/stats', { params });
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof newEntry & { branchId: string }) => {
      const res = await apiClient.post('/waitlist', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
      setAddDialogOpen(false);
      setNewEntry({
        name: '',
        phone: '',
        partySize: 2,
        notes: '',
        quotedWaitMinutes: 15,
      });
    },
  });

  const seatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/waitlist/${id}/seat`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
    },
  });

  const dropMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post(`/waitlist/${id}/drop`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'WAITING':
        return <Badge variant="secondary">Waiting</Badge>;
      case 'SEATED':
        return <Badge variant="success">Seated</Badge>;
      case 'DROPPED':
        return <Badge variant="destructive">Dropped</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWaitingMinutes = (createdAt: string) => {
    return Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const handleAddEntry = () => {
    if (!branchId || !newEntry.name) return;
    addMutation.mutate({
      ...newEntry,
      branchId,
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Waitlist"
        subtitle="Manage walk-in guests waiting for a table"
        actions={
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ Add to Waitlist</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Waitlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Guest Name *</label>
                  <Input
                    value={newEntry.name}
                    onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                    placeholder="Guest name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <Input
                    value={newEntry.phone}
                    onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                    placeholder="+256-77..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Party Size</label>
                    <Input
                      type="number"
                      min={1}
                      value={newEntry.partySize}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, partySize: parseInt(e.target.value) || 2 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Quoted Wait (min)</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEntry.quotedWaitMinutes}
                      onChange={(e) =>
                        setNewEntry({
                          ...newEntry,
                          quotedWaitMinutes: parseInt(e.target.value) || 15,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Input
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                    placeholder="High chair, allergies, etc."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleAddEntry}
                  disabled={addMutation.isPending || !newEntry.name}
                >
                  {addMutation.isPending ? 'Adding...' : 'Add to Waitlist'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Currently Waiting</div>
          <div className="text-2xl font-bold mt-2">{stats?.waiting || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Seated Today</div>
          <div className="text-2xl font-bold mt-2 text-green-600">{stats?.seated || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Dropped Today</div>
          <div className="text-2xl font-bold mt-2 text-red-600">{stats?.dropped || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Avg Wait Time</div>
          <div className="text-2xl font-bold mt-2">{stats?.averageWaitMinutes || 0} min</div>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={statusFilter === 'WAITING' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('WAITING')}
          >
            Waiting
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'SEATED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('SEATED')}
          >
            Seated
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'DROPPED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('DROPPED')}
          >
            Dropped
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('ALL')}
          >
            All
          </Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Waitlist Queue</h2>
          <p className="text-sm text-muted-foreground">
            Guests waiting for a table (ordered by arrival time)
          </p>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading waitlist...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No entries found. Click &quot;Add to Waitlist&quot; to add a guest.
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">#</th>
                  <th className="text-left p-3 text-sm font-medium">Added</th>
                  <th className="text-left p-3 text-sm font-medium">Guest Name</th>
                  <th className="text-left p-3 text-sm font-medium">Phone</th>
                  <th className="text-left p-3 text-sm font-medium">Party</th>
                  <th className="text-left p-3 text-sm font-medium">Quoted</th>
                  <th className="text-left p-3 text-sm font-medium">Waiting</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const waitingMins = getWaitingMinutes(entry.createdAt);
                  const isOverdue =
                    entry.status === 'WAITING' &&
                    entry.quotedWaitMinutes &&
                    waitingMins > entry.quotedWaitMinutes;

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b hover:bg-muted/30 ${isOverdue ? 'bg-red-50' : ''}`}
                    >
                      <td className="p-3 text-sm font-medium">{index + 1}</td>
                      <td className="p-3 text-sm">{formatTime(entry.createdAt)}</td>
                      <td className="p-3 text-sm font-medium">
                        {entry.name}
                        {entry.notes && (
                          <span className="block text-xs text-muted-foreground">{entry.notes}</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">{entry.phone || '—'}</td>
                      <td className="p-3 text-sm">{entry.partySize}</td>
                      <td className="p-3 text-sm">
                        {entry.quotedWaitMinutes ? `${entry.quotedWaitMinutes} min` : '—'}
                      </td>
                      <td className="p-3 text-sm">
                        {entry.status === 'WAITING' ? (
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            {waitingMins} min
                            {isOverdue && ' ⚠️'}
                          </span>
                        ) : entry.seatedAt ? (
                          <span className="text-green-600">
                            {Math.round(
                              (new Date(entry.seatedAt).getTime() -
                                new Date(entry.createdAt).getTime()) /
                              60000,
                            )}{' '}
                            min
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">{getStatusBadge(entry.status)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {entry.status === 'WAITING' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => seatMutation.mutate(entry.id)}
                                disabled={seatMutation.isPending}
                              >
                                Seat
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  dropMutation.mutate({ id: entry.id, reason: 'Left voluntarily' })
                                }
                                disabled={dropMutation.isPending}
                              >
                                Drop
                              </Button>
                            </>
                          )}
                          {entry.status !== 'WAITING' && (
                            <span className="text-xs text-muted-foreground">
                              {entry.droppedReason || '—'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
