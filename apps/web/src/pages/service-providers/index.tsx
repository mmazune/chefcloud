import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  contractCount?: number;
  notes: string | null;
}

interface ServiceContract {
  id: string;
  providerId: string;
  providerName?: string;
  frequency: 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'ONE_OFF';
  amount: number;
  currency: string;
  dueDay: number | null;
  status: string;
  startDate: string;
  endDate: string | null;
}

interface ReminderSummary {
  overdue: number;
  dueToday: number;
  dueSoon: number;
  total: number;
  totalAmount: number;
}

interface ServiceReminder {
  id: string;
  dueDate: string;
  status: string;
  severity: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON';
  providerName?: string;
  providerCategory?: string;
  contractAmount?: number;
  contractCurrency?: string;
  branchName?: string | null;
}

export default function ServiceProvidersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServiceProvider> & { activeContract?: Partial<ServiceContract> }>({});

  // Get branchId from user context
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  // Fetch providers
  const { data: providers = [], isLoading: providersLoading } = useQuery<ServiceProvider[]>({
    queryKey: ['service-providers', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/service-providers', { params });
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch contracts
  const { data: contracts = [] } = useQuery<ServiceContract[]>({
    queryKey: ['service-contracts', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/service-providers/contracts', { params });
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch reminder summary
  const { data: reminderSummary } = useQuery<ReminderSummary>({
    queryKey: ['service-reminders-summary', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/finance/service-reminders/summary', { params });
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch reminders
  const { data: reminders = [] } = useQuery<ServiceReminder[]>({
    queryKey: ['service-reminders', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/finance/service-reminders', { params });
      return res.data;
    },
    enabled: !!user,
  });

  // Update provider mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceProvider> }) => {
      const res = await fetch(`${API_URL}/service-providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update provider');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
      setDrawerOpen(false);
      setEditingProvider(null);
      setEditForm({});
    },
  });

  // Filtered providers
  const filteredProviders = providers.filter((p) => {
    const matchesSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesActive = !showActiveOnly || p.isActive;
    return matchesSearch && matchesActive;
  });

  // Calculate summary stats
  const activeProviders = providers.filter((p) => p.isActive).length;
  const totalActiveContracts = contracts.filter((c) => c.status === 'ACTIVE').length;
  
  // Estimate monthly spend
  const monthlySpend = contracts
    .filter((c) => c.status === 'ACTIVE')
    .reduce((sum, c) => {
      const amount = Number(c.amount);
      switch (c.frequency) {
        case 'MONTHLY':
          return sum + amount;
        case 'WEEKLY':
          return sum + amount * 4;
        case 'DAILY':
          return sum + amount * 30;
        default:
          return sum;
      }
    }, 0);

  const handleEdit = (provider: ServiceProvider) => {
    setEditingProvider(provider);
    setEditForm({
      name: provider.name,
      category: provider.category,
      contactName: provider.contactName || '',
      contactEmail: provider.contactEmail || '',
      contactPhone: provider.contactPhone || '',
      isActive: provider.isActive,
      notes: provider.notes || '',
    });
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (!editingProvider) return;
    updateMutation.mutate({
      id: editingProvider.id,
      data: {
        name: editForm.name,
        category: editForm.category as any,
        contactName: editForm.contactName || null,
        contactEmail: editForm.contactEmail || null,
        contactPhone: editForm.contactPhone || null,
        isActive: editForm.isActive,
        notes: editForm.notes || null,
      },
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'OVERDUE':
        return <Badge variant="destructive">OVERDUE</Badge>;
      case 'DUE_TODAY':
        return <Badge className="bg-orange-500 hover:bg-orange-600">DUE TODAY</Badge>;
      case 'DUE_SOON':
        return <Badge variant="default">DUE SOON</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Service Providers"
        subtitle="Track landlords, utilities and other recurring service contracts"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Active Providers</div>
          <div className="text-2xl font-bold mt-2">{activeProviders}</div>
          <div className="text-xs text-muted-foreground mt-1">{providers.length} total</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Monthly Spend (Est.)</div>
          <div className="text-2xl font-bold mt-2">
            UGX {monthlySpend.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{totalActiveContracts} active contracts</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Overdue Payments</div>
          <div className="text-2xl font-bold mt-2 text-red-600">
            {reminderSummary?.overdue || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            UGX {(reminderSummary?.totalAmount || 0).toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Due This Week</div>
          <div className="text-2xl font-bold mt-2 text-orange-600">
            {(reminderSummary?.dueToday || 0) + (reminderSummary?.dueSoon || 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {reminderSummary?.dueToday || 0} due today
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <Input
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={!showActiveOnly ? 'default' : 'outline'}
                onClick={() => setShowActiveOnly(false)}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={showActiveOnly ? 'default' : 'outline'}
                onClick={() => setShowActiveOnly(true)}
              >
                Active Only
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Providers Table */}
        <Card className="md:col-span-2">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Service Providers</h2>
            <p className="text-sm text-muted-foreground">
              Manage recurring service contracts and payments
            </p>
          </div>
          <div className="overflow-x-auto">
            {providersLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading providers...</div>
            ) : filteredProviders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No providers found
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Category</th>
                    <th className="text-left p-3 text-sm font-medium">Contact</th>
                    <th className="text-left p-3 text-sm font-medium">Contracts</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map((provider) => (
                    <tr key={provider.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 text-sm font-medium">{provider.name}</td>
                      <td className="p-3 text-sm">
                        <Badge variant="outline">{provider.category}</Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {provider.contactPhone || provider.contactEmail || '—'}
                      </td>
                      <td className="p-3 text-sm">{provider.contractCount || 0}</td>
                      <td className="p-3">
                        {provider.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(provider)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Reminders Panel */}
        <Card>
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Upcoming Payments</h2>
            <p className="text-sm text-muted-foreground">Payment reminders</p>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No upcoming payments
              </div>
            ) : (
              reminders.slice(0, 10).map((reminder) => (
                <div key={reminder.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-sm">{reminder.providerName}</div>
                    {getSeverityBadge(reminder.severity)}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Category: {reminder.providerCategory}</div>
                    <div>Due: {formatDate(reminder.dueDate)}</div>
                    <div className="font-medium">
                      {reminder.contractCurrency} {Number(reminder.contractAmount).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingProvider(null);
          setEditForm({});
        }}
        title="Edit Service Provider"
        size="md"
      >
        <div className="space-y-4 p-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              >
                <option value="RENT">Rent</option>
                <option value="UTILITIES">Utilities</option>
                <option value="ISP">Internet Service Provider</option>
                <option value="SECURITY">Security</option>
                <option value="CLEANING">Cleaning</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="ENTERTAINMENT">Entertainment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Contact Name</label>
              <Input
                value={editForm.contactName || ''}
                onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Contact Email</label>
              <Input
                type="email"
                value={editForm.contactEmail || ''}
                onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Contact Phone</label>
              <Input
                value={editForm.contactPhone || ''}
                onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <textarea
                className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive || false}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active
              </label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={updateMutation.isPending}
                className="flex-1"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingProvider(null);
                  setEditForm({});
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
      </Drawer>
    </AppShell>
  );
}
