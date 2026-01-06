/**
 * M11.10 Stocktake Session Detail Page
 *
 * Shows stocktake session details, lines, and workflow actions.
 * Supports blind counts and multi-step approval workflow.
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
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft,
  Download,
  Play,
  Send,
  Check,
  XCircle,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface StocktakeSession {
  id: string;
  sessionNumber: string;
  name: string | null;
  description: string | null;
  status: string;
  blindCount: boolean;
  totalLines: number;
  linesWithVariance: number;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdBy: { firstName: string; lastName: string } | null;
  startedBy: { firstName: string; lastName: string } | null;
  submittedBy: { firstName: string; lastName: string } | null;
  approvedBy: { firstName: string; lastName: string } | null;
  postedBy: { firstName: string; lastName: string } | null;
  voidedBy: { firstName: string; lastName: string } | null;
  location: { code: string; name: string } | null;
}

interface StocktakeLine {
  id: string;
  itemId: string;
  locationId: string;
  snapshotQty: string | null;
  countedQty: string | null;
  variance: string | null;
  notes: string | null;
  countedAt: string | null;
  item: { id: string; sku: string | null; name: string };
  location: { id: string; code: string; name: string };
  countedBy: { firstName: string; lastName: string } | null;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  IN_PROGRESS: 'default',
  SUBMITTED: 'default',
  APPROVED: 'default',
  POSTED: 'default',
  VOID: 'destructive',
};

const WORKFLOW_STEPS = ['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'POSTED'];

export default function StocktakeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [countingLineId, setCountingLineId] = useState<string | null>(null);
  const [countValue, setCountValue] = useState('');
  const [countNotes, setCountNotes] = useState('');

  // Fetch session details
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['stocktake-session', id],
    queryFn: async () => {
      const response = await apiClient.get<StocktakeSession>(`/inventory/stocktakes/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Fetch session lines
  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['stocktake-lines', id],
    queryFn: async () => {
      const response = await apiClient.get<StocktakeLine[]>(`/inventory/stocktakes/${id}/lines`);
      return response.data;
    },
    enabled: !!id,
  });

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/start`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', id] });
      queryClient.invalidateQueries({ queryKey: ['stocktake-lines', id] });
    },
  });

  // Record count mutation
  const countMutation = useMutation({
    mutationFn: async (data: { lineId: string; countedQty: number; notes?: string }) => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/counts`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-lines', id] });
      setCountingLineId(null);
      setCountValue('');
      setCountNotes('');
    },
  });

  // Submit session mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', id] });
    },
  });

  // Approve session mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', id] });
    },
  });

  // Post session mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/post`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', id] });
    },
  });

  // Void session mutation
  const voidMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/void`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', id] });
      setVoidDialogOpen(false);
      setVoidReason('');
    },
  });

  // Cancel session mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/inventory/stocktakes/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      router.push('/inventory/stocktakes');
    },
  });

  const handleExport = async () => {
    try {
      const response = await apiClient.get(`/inventory/stocktakes/${id}/export`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stocktake-${session?.sessionNumber}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Failed to export');
    }
  };

  const handleRecordCount = () => {
    if (countingLineId && countValue) {
      countMutation.mutate({
        lineId: countingLineId,
        countedQty: parseFloat(countValue),
        notes: countNotes || undefined,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = STATUS_COLORS[status] || 'secondary';
    const label = status.replace('_', ' ');
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getCurrentStep = () => {
    if (!session) return 0;
    if (session.status === 'VOID') return -1;
    return WORKFLOW_STEPS.indexOf(session.status);
  };

  const formatUser = (user: { firstName: string; lastName: string } | null) => {
    return user ? `${user.firstName} ${user.lastName}` : '-';
  };

  if (sessionLoading || !session) {
    return (
      <AppShell>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/inventory/stocktakes" className="text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Stocktakes
        </Link>
      </div>

      <PageHeader
        title={session.sessionNumber}
        subtitle={session.name || session.description || 'Stocktake Session'}
        actions={
          <div className="flex gap-2">
          {session.status !== 'DRAFT' && (
            <Button variant="outline" onClick={handleExport} data-testid="export-btn">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}

          {session.status === 'DRAFT' && (
            <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Start Counting
            </Button>
          )}

          {session.status === 'IN_PROGRESS' && (
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="submit-btn">
              <Send className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          )}

          {session.status === 'SUBMITTED' && (
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}

          {session.status === 'APPROVED' && (
            <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              <FileText className="h-4 w-4 mr-2" />
              Post to Ledger
            </Button>
          )}

          {session.status === 'POSTED' && (
            <Button variant="destructive" onClick={() => setVoidDialogOpen(true)} data-testid="void-btn">
              <XCircle className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}

          {(session.status === 'DRAFT' || session.status === 'IN_PROGRESS') && (
            <Button variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel Session
            </Button>
          )}
          </div>
        }
      />

      {/* Workflow Timeline */}
      <Card className="mb-6 p-6">
        <h3 className="text-lg font-semibold mb-4">Workflow</h3>
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, idx) => {
            const currentStep = getCurrentStep();
            const isCompleted = currentStep >= idx;
            const isCurrent = currentStep === idx;
            const isVoid = session.status === 'VOID';

            return (
              <div key={step} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isVoid
                      ? 'bg-red-100 text-red-600'
                      : isCompleted
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isVoid ? (
                    <XCircle className="h-5 w-5" />
                  ) : isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <span className={`mt-2 text-sm ${isCurrent ? 'font-semibold' : 'text-gray-500'}`}>
                  {step.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>

        {session.status === 'VOID' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <strong>Session Voided</strong>
            </div>
            <p className="text-sm text-red-600 mt-1">Reason: {session.voidReason}</p>
            <p className="text-sm text-red-600">
              By: {formatUser(session.voidedBy)} on{' '}
              {session.voidedAt && format(new Date(session.voidedAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        )}
      </Card>

      {/* Session Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-4">
          <h4 className="font-medium mb-3">Details</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>{getStatusBadge(session.status)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Blind Count</dt>
              <dd>{session.blindCount ? 'Yes 🙈' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Location</dt>
              <dd>{session.location?.name || 'All Locations'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Lines</dt>
              <dd>{session.totalLines}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Lines with Variance</dt>
              <dd className={session.linesWithVariance > 0 ? 'text-amber-600' : ''}>{session.linesWithVariance}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-3">Timeline</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd>
                {format(new Date(session.createdAt), 'MMM d, yyyy')}
                <span className="text-gray-400 ml-1">by {formatUser(session.createdBy)}</span>
              </dd>
            </div>
            {session.startedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Started</dt>
                <dd>
                  {format(new Date(session.startedAt), 'MMM d, yyyy')}
                  <span className="text-gray-400 ml-1">by {formatUser(session.startedBy)}</span>
                </dd>
              </div>
            )}
            {session.submittedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Submitted</dt>
                <dd>
                  {format(new Date(session.submittedAt), 'MMM d, yyyy')}
                  <span className="text-gray-400 ml-1">by {formatUser(session.submittedBy)}</span>
                </dd>
              </div>
            )}
            {session.approvedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Approved</dt>
                <dd>
                  {format(new Date(session.approvedAt), 'MMM d, yyyy')}
                  <span className="text-gray-400 ml-1">by {formatUser(session.approvedBy)}</span>
                </dd>
              </div>
            )}
            {session.postedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Posted</dt>
                <dd>
                  {format(new Date(session.postedAt), 'MMM d, yyyy')}
                  <span className="text-gray-400 ml-1">by {formatUser(session.postedBy)}</span>
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* Lines Table */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Count Lines</h3>
        {linesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : !lines || lines.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No lines in this session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" data-testid="lines-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  {!session.blindCount || session.status !== 'IN_PROGRESS' ? (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
                  ) : null}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Counted</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                  {session.status === 'IN_PROGRESS' && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium">{line.item.name}</div>
                      {line.item.sku && <div className="text-xs text-gray-500">{line.item.sku}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{line.location.name}</td>
                    {!session.blindCount || session.status !== 'IN_PROGRESS' ? (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{line.snapshotQty ?? '-'}</td>
                    ) : null}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {countingLineId === line.id ? (
                        <Input
                          type="number"
                          value={countValue}
                          onChange={(e) => setCountValue(e.target.value)}
                          className="w-20 text-right"
                          autoFocus
                        />
                      ) : (
                        line.countedQty ?? '-'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {line.variance !== null ? (
                        <span
                          className={
                            parseFloat(line.variance) === 0
                              ? 'text-gray-500'
                              : parseFloat(line.variance) < 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }
                        >
                          {parseFloat(line.variance) > 0 ? '+' : ''}
                          {line.variance}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    {session.status === 'IN_PROGRESS' && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {countingLineId === line.id ? (
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={handleRecordCount} disabled={countMutation.isPending}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCountingLineId(null);
                                setCountValue('');
                                setCountNotes('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCountingLineId(line.id);
                              setCountValue(line.countedQty || '');
                            }}
                          >
                            Count
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Void Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">Void Stocktake Session</h2>
          <p className="text-gray-600 mb-4">
            This will reverse all ledger entries created by this stocktake. This action cannot be undone.
          </p>
          <div className="mb-4">
            <Label htmlFor="void-reason">Reason for voiding (required)</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Enter reason for voiding this session"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidMutation.mutate(voidReason)}
              disabled={!voidReason.trim() || voidMutation.isPending}
            >
              {voidMutation.isPending ? 'Voiding...' : 'Void Session'}
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
