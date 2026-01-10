/**
 * M13.4: POS Cash Sessions Page
 * Manage cash drawer sessions
 * Route: /pos/cash-sessions
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { 
  DollarSign, 
  Plus, 
  XCircle, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Download,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I2: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/pos/cash-sessions',
  title: 'Cash Sessions',
  primaryActions: [
    { label: 'Open Session', testId: 'cash-open-session', intent: 'create' },
    { label: 'Close Session', testId: 'cash-close-session', intent: 'update' },
    { label: 'Confirm Open', testId: 'cash-confirm-open', intent: 'create' },
    { label: 'Confirm Close', testId: 'cash-confirm-close', intent: 'update' },
  ],
  apiCalls: [
    { method: 'GET', path: '/pos/cash-sessions', trigger: 'onMount', notes: 'List sessions' },
    { method: 'POST', path: '/pos/cash-sessions/open', trigger: 'onAction', notes: 'Open drawer' },
    { method: 'POST', path: '/pos/cash-sessions/:id/close', trigger: 'onAction', notes: 'Close drawer' },
  ],
  risk: 'HIGH',
  allowedRoles: ['OWNER', 'MANAGER', 'SUPERVISOR', 'CASHIER'],
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CashSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingFloatCents: number;
  expectedCashCents: number | null;
  countedCashCents: number | null;
  note: string | null;
  openedBy: { firstName: string; lastName: string };
  closedBy: { firstName: string; lastName: string } | null;
}

export default function CashSessionsPage() {
  const queryClient = useQueryClient();
  
  const [openDialogVisible, setOpenDialogVisible] = useState(false);
  const [closeDialogVisible, setCloseDialogVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions list
  const { data: sessions = [], isLoading } = useQuery<CashSession[]>({
    queryKey: ['cash-sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/pos/cash-sessions`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Check if there's an open session
  const openSession = sessions.find(s => s.status === 'OPEN');

  // Open session mutation
  const openSessionMutation = useMutation({
    mutationFn: async (openingFloatCents: number) => {
      const res = await fetch(`${API_URL}/pos/cash-sessions/open`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloatCents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to open session');
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setOpenDialogVisible(false);
      setOpeningFloat('');
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Close session mutation
  const closeSessionMutation = useMutation({
    mutationFn: async ({ sessionId, countedCashCents, note }: {
      sessionId: string;
      countedCashCents: number;
      note?: string;
    }) => {
      const res = await fetch(`${API_URL}/pos/cash-sessions/${sessionId}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCashCents, note }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to close session');
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setCloseDialogVisible(false);
      setCountedCash('');
      setCloseNote('');
      setSelectedSession(null);
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Handle open session
  const handleOpenSession = useCallback(() => {
    const floatCents = Math.round(parseFloat(openingFloat) * 100);
    if (isNaN(floatCents) || floatCents < 0) {
      setError('Please enter a valid opening float amount');
      return;
    }
    openSessionMutation.mutate(floatCents);
  }, [openingFloat, openSessionMutation]);

  // Handle close session
  const handleCloseSession = useCallback(() => {
    if (!selectedSession) return;
    const countedCents = Math.round(parseFloat(countedCash) * 100);
    if (isNaN(countedCents) || countedCents < 0) {
      setError('Please enter a valid counted cash amount');
      return;
    }
    closeSessionMutation.mutate({
      sessionId: selectedSession.id,
      countedCashCents: countedCents,
      note: closeNote || undefined,
    });
  }, [selectedSession, countedCash, closeNote, closeSessionMutation]);

  // Export CSV
  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pos/export/cash-sessions.csv`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export sessions');
    }
  }, []);

  // Format cents to dollars
  const formatCents = (cents: number | null) => {
    if (cents === null) return '-';
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Calculate variance
  const getVariance = (session: CashSession) => {
    if (session.expectedCashCents === null || session.countedCashCents === null) {
      return null;
    }
    return session.countedCashCents - session.expectedCashCents;
  };

  return (
    <AppShell>
      <PageHeader 
        title="Cash Sessions"
        actions={
          <div className="flex gap-2">
            <Link href="/pos">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to POS
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {!openSession && (
              <Button size="sm" onClick={() => setOpenDialogVisible(true)} data-testid="cash-open-session">
                <Plus className="mr-2 h-4 w-4" />
                Open Session
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Open Session */}
        {openSession && (
          <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                  <DollarSign className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Session Open</h3>
                  <p className="text-sm text-gray-600">
                    Opened by {openSession.openedBy.firstName} {openSession.openedBy.lastName} at{' '}
                    {new Date(openSession.openedAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Opening float: {formatCents(openSession.openingFloatCents)}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => {
                  setSelectedSession(openSession);
                  setCloseDialogVisible(true);
                }}
                data-testid="cash-close-session"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Close Session
              </Button>
            </div>
          </Card>
        )}

        {/* Sessions Table */}
        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No cash sessions yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Opening Float</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const variance = getVariance(session);
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Badge variant={session.status === 'OPEN' ? 'default' : 'secondary'}>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(session.openedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.openedBy.firstName} {session.openedBy.lastName}
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.closedAt ? (
                          <>
                            <div className="text-sm">
                              {new Date(session.closedAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {session.closedBy?.firstName} {session.closedBy?.lastName}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCents(session.openingFloatCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCents(session.expectedCashCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCents(session.countedCashCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {variance !== null ? (
                          <span className={variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : ''}>
                            {variance >= 0 ? '+' : ''}${(variance / 100).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Open Session Dialog */}
      <Dialog open={openDialogVisible} onOpenChange={setOpenDialogVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Cash Session</DialogTitle>
            <DialogDescription>
              Enter the opening float amount in the cash drawer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="mb-2 block text-sm font-medium">Opening Float ($)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialogVisible(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleOpenSession}
              disabled={openSessionMutation.isPending}
              data-testid="cash-confirm-open"
            >
              {openSessionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Open Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={closeDialogVisible} onOpenChange={setCloseDialogVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Cash Session</DialogTitle>
            <DialogDescription>
              Count the cash in the drawer and enter the total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedSession && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p>Opening float: {formatCents(selectedSession.openingFloatCents)}</p>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium">Counted Cash ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Note (optional)</label>
              <Input
                placeholder="Any discrepancies or notes..."
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogVisible(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCloseSession}
              disabled={closeSessionMutation.isPending}
              data-testid="cash-confirm-close"
            >
              {closeSessionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Close Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
