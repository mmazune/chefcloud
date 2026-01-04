/**
 * M10.11: Open Shifts Page (Staff Self-Service)
 *
 * Features:
 * - View available open shifts that need coverage
 * - Claim open shifts (subject to manager approval)
 *
 * RBAC: All roles (L1-L5) - sees open shifts for their location/department
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, RefreshCw, AlertCircle, CheckCircle, Hand } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface OpenShift {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  positionTitle: string;
  department: string;
  location: string;
  notes: string | null;
  urgencyLevel: 'low' | 'medium' | 'high';
  claimCount: number;
  maxClaims: number;
  hasClaimed: boolean;
  createdAt: string;
}

interface OpenShiftClaim {
  id: string;
  openShiftId: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  createdAt: string;
}

const getUrgencyBadgeVariant = (level: string): 'default' | 'secondary' | 'destructive' => {
  switch (level) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
    default:
      return 'secondary';
  }
};

export default function OpenShiftsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<OpenShift | null>(null);
  const [claimNotes, setClaimNotes] = useState('');

  // Fetch open shifts
  const { data: openShifts, isLoading, refetch } = useQuery<OpenShift[]>({
    queryKey: ['open-shifts'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/self/open-shifts');
      return res.data;
    },
  });

  // Fetch my claims
  const { data: myClaims } = useQuery<OpenShiftClaim[]>({
    queryKey: ['my-open-shift-claims'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/self/open-shifts/claims');
      return res.data;
    },
  });

  // Mutation: Claim shift
  const claimShiftMutation = useMutation({
    mutationFn: async ({ shiftId, notes }: { shiftId: string; notes: string }) => {
      const res = await apiClient.post(`/workforce/self/open-shifts/${shiftId}/claim`, { notes });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Shift claimed! Awaiting manager approval.' });
      queryClient.invalidateQueries({ queryKey: ['open-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['my-open-shift-claims'] });
      setShowClaimDialog(false);
      setSelectedShift(null);
      setClaimNotes('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to claim shift', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Withdraw claim
  const withdrawClaimMutation = useMutation({
    mutationFn: async (claimId: string) => {
      await apiClient.delete(`/workforce/self/open-shifts/claims/${claimId}`);
    },
    onSuccess: () => {
      toast({ title: 'Claim withdrawn' });
      queryClient.invalidateQueries({ queryKey: ['open-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['my-open-shift-claims'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to withdraw claim', description: error.message, variant: 'destructive' });
    },
  });

  const handleClaimClick = (shift: OpenShift) => {
    setSelectedShift(shift);
    setShowClaimDialog(true);
  };

  const handleClaimSubmit = () => {
    if (!selectedShift) return;
    claimShiftMutation.mutate({ shiftId: selectedShift.id, notes: claimNotes });
  };

  const getClaimForShift = (shiftId: string) => {
    return myClaims?.find((c) => c.openShiftId === shiftId);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>Please log in to view open shifts.</span>
      </div>
    );
  }

  // Filter to only show future open shifts
  const futureShifts = openShifts?.filter((s) => {
    const shiftDateTime = parseISO(`${s.shiftDate}T${s.startTime}`);
    return isAfter(shiftDateTime, new Date());
  }) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Open Shifts</h1>
          <p className="text-muted-foreground">View and claim available shifts that need coverage</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Shifts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{futureShifts.length}</div>
            <p className="text-xs text-muted-foreground">Open shifts needing coverage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Pending Claims</CardTitle>
            <Hand className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myClaims?.filter((c) => c.status === 'pending').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Claims</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myClaims?.filter((c) => c.status === 'approved').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Shifts you&apos;ve picked up</p>
          </CardContent>
        </Card>
      </div>

      {/* Open Shifts List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Open Shifts</CardTitle>
          <CardDescription>
            Shifts that need coverage. Claim a shift to pick it up (pending manager approval).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : futureShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No open shifts available at this time.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {futureShifts.map((shift) => {
                  const myClaim = getClaimForShift(shift.id);
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(shift.shiftDate), 'EEE, MMM d')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                          {shift.startTime} - {shift.endTime}
                        </div>
                      </TableCell>
                      <TableCell>{shift.positionTitle}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{shift.location}</div>
                          <div className="text-muted-foreground">{shift.department}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getUrgencyBadgeVariant(shift.urgencyLevel)}>
                          {shift.urgencyLevel.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {shift.claimCount} / {shift.maxClaims}
                      </TableCell>
                      <TableCell className="text-right">
                        {myClaim ? (
                          myClaim.status === 'pending' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => withdrawClaimMutation.mutate(myClaim.id)}
                              disabled={withdrawClaimMutation.isPending}
                            >
                              Withdraw
                            </Button>
                          ) : (
                            <Badge variant={myClaim.status === 'approved' ? 'default' : 'destructive'}>
                              {myClaim.status.charAt(0).toUpperCase() + myClaim.status.slice(1)}
                            </Badge>
                          )
                        ) : shift.claimCount >= shift.maxClaims ? (
                          <Badge variant="outline">Full</Badge>
                        ) : (
                          <Button size="sm" onClick={() => handleClaimClick(shift)}>
                            <Hand className="w-4 h-4 mr-1" />
                            Claim
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Claim Dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Open Shift</DialogTitle>
            <DialogDescription>
              Submit your request to pick up this shift
            </DialogDescription>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {format(parseISO(selectedShift.shiftDate), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">
                    {selectedShift.startTime} - {selectedShift.endTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-medium">{selectedShift.positionTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">{selectedShift.location}</span>
                </div>
                {selectedShift.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-sm">Notes: </span>
                    <span className="text-sm">{selectedShift.notes}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Add a note (optional)</Label>
                <Textarea
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="e.g., I'm available and experienced with this position"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaimDialog(false)}>Cancel</Button>
            <Button onClick={handleClaimSubmit} disabled={claimShiftMutation.isPending}>
              {claimShiftMutation.isPending ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
