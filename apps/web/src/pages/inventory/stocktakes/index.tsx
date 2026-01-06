/**
 * M11.10 Stocktakes List Page
 *
 * Displays list of stocktake sessions with status filters and actions.
 * Supports blind counts and approval workflow.
 */
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';
import { Plus, Search, ClipboardList } from 'lucide-react';

interface StocktakeSession {
  id: string;
  sessionNumber: string;
  name: string | null;
  status: string;
  blindCount: boolean;
  totalLines: number;
  linesWithVariance: number;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdBy: { firstName: string; lastName: string } | null;
  location: { code: string; name: string } | null;
}

interface InventoryLocation {
  id: string;
  code: string;
  name: string;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  IN_PROGRESS: 'default',
  SUBMITTED: 'default',
  APPROVED: 'default',
  POSTED: 'default',
  VOID: 'destructive',
};

export default function StocktakesListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state for new session
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLocationId, setFormLocationId] = useState('');
  const [formBlindCount, setFormBlindCount] = useState(true);

  // Fetch stocktake sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['stocktake-sessions', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await apiClient.get<{ data: StocktakeSession[]; pagination: any }>(
        '/inventory/stocktakes',
        { params }
      );
      return response.data.data;
    },
  });

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryLocation[]>('/inventory/foundation/locations');
      return response.data;
    },
  });

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; locationId?: string; blindCount?: boolean }) => {
      const response = await apiClient.post('/inventory/stocktakes', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-sessions'] });
      handleCloseDialog();
      router.push(`/inventory/stocktakes/${data.id}`);
    },
  });

  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormLocationId('');
    setFormBlindCount(true);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSubmitCreate = () => {
    createMutation.mutate({
      name: formName || undefined,
      description: formDescription || undefined,
      locationId: formLocationId || undefined,
      blindCount: formBlindCount,
    });
  };

  const getStatusBadge = (status: string) => {
    const variant = STATUS_COLORS[status] || 'secondary';
    const label = status.replace('_', ' ');
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filteredSessions = sessions?.filter((session) => {
    if (search) {
      const query = search.toLowerCase();
      return (
        session.sessionNumber.toLowerCase().includes(query) ||
        (session.name && session.name.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        title="Stocktakes"
        subtitle="Enterprise inventory count sessions with blind counts and approval workflow"
        actions={
          <Button onClick={handleOpenCreate} data-testid="create-stocktake-btn">
            <Plus className="h-4 w-4 mr-2" />
            New Stocktake
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by session number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
              data-testid="search-input"
            />
          </div>
          <div className="w-48">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
              data-testid="status-filter"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
              <option value="VOID">Void</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : !filteredSessions || filteredSessions.length === 0 ? (
        <Card className="p-12 text-center" data-testid="empty-state">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stocktake sessions</h3>
          <p className="text-gray-500 mb-4">Create your first stocktake session to start counting inventory.</p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Stocktake
          </Button>
        </Card>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200" data-testid="stocktakes-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lines
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr key={session.id} data-testid={`session-row-${session.id}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/inventory/stocktakes/${session.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {session.sessionNumber}
                    </Link>
                    {session.name && (
                      <div className="text-sm text-gray-500">{session.name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(session.status)}
                    {session.blindCount && (
                      <span className="ml-2 text-xs text-gray-400" title="Blind Count">
                        🙈
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.location?.name || 'All Locations'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="text-gray-900">{session.totalLines}</span>
                    {session.linesWithVariance > 0 && (
                      <span className="ml-1 text-amber-600">
                        ({session.linesWithVariance} variance)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(session.createdAt), 'MMM d, yyyy')}
                    {session.createdBy && (
                      <div className="text-xs text-gray-400">
                        by {session.createdBy.firstName} {session.createdBy.lastName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link
                      href={`/inventory/stocktakes/${session.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Create Stocktake Session</h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="session-name">Session Name (optional)</Label>
              <Input
                id="session-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Q1 Full Count"
              />
            </div>

            <div>
              <Label htmlFor="session-description">Description (optional)</Label>
              <Textarea
                id="session-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Notes about this stocktake session"
              />
            </div>

            <div>
              <Label htmlFor="session-location">Location (optional)</Label>
              <Select
                value={formLocationId}
                onValueChange={(value) => setFormLocationId(value)}
              >
                <option value="">All Locations</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {loc.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="blind-count">Blind Count</Label>
                <p className="text-sm text-gray-500">Hide expected quantities during counting</p>
              </div>
              <Switch
                id="blind-count"
                checked={formBlindCount}
                onCheckedChange={(checked) => setFormBlindCount(checked)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
