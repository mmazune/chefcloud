/**
 * M10.11: My Availability Page (Staff Self-Service)
 *
 * Features:
 * - View and edit weekly recurring availability slots (by day of week)
 * - View and manage date-specific exceptions (unavailable days or special hours)
 *
 * RBAC: All roles (L1-L5) - only shows/edits own data
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

interface AvailabilitySlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone?: string;
}

interface AvailabilityException {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isUnavailable: boolean;
  reason: string | null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MyAvailabilityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('weekly');
  const [showAddSlotDialog, setShowAddSlotDialog] = useState(false);
  const [showAddExceptionDialog, setShowAddExceptionDialog] = useState(false);
  const [newSlot, setNewSlot] = useState<AvailabilitySlot>({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });
  const [newException, setNewException] = useState({ date: '', startTime: '', endTime: '', isUnavailable: true, reason: '' });

  // Fetch weekly availability
  const { data: availabilityData, isLoading: loadingAvailability, refetch: refetchAvailability } = useQuery({
    queryKey: ['my-availability'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/self/availability');
      return res.data;
    },
  });

  // Fetch exceptions
  const { data: exceptions, isLoading: loadingExceptions, refetch: refetchExceptions } = useQuery<AvailabilityException[]>({
    queryKey: ['my-availability-exceptions'],
    queryFn: async () => {
      const res = await apiClient.get('/workforce/self/availability/exceptions');
      return res.data;
    },
  });

  // Mutation: Set weekly availability
  const setAvailabilityMutation = useMutation({
    mutationFn: async (slots: AvailabilitySlot[]) => {
      const res = await apiClient.put('/workforce/self/availability', { slots });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Availability updated' });
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      setShowAddSlotDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Add exception
  const addExceptionMutation = useMutation({
    mutationFn: async (data: typeof newException) => {
      const res = await apiClient.post('/workforce/self/availability/exceptions', data);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Exception added' });
      queryClient.invalidateQueries({ queryKey: ['my-availability-exceptions'] });
      setShowAddExceptionDialog(false);
      setNewException({ date: '', startTime: '', endTime: '', isUnavailable: true, reason: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add exception', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation: Delete exception
  const deleteExceptionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workforce/self/availability/exceptions/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Exception removed' });
      queryClient.invalidateQueries({ queryKey: ['my-availability-exceptions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove exception', description: error.message, variant: 'destructive' });
    },
  });

  const slots: AvailabilitySlot[] = availabilityData?.slots || [];

  const handleAddSlot = () => {
    const updatedSlots = [...slots, newSlot];
    setAvailabilityMutation.mutate(updatedSlots);
  };

  const handleRemoveSlot = (index: number) => {
    const updatedSlots = slots.filter((_, i) => i !== index);
    setAvailabilityMutation.mutate(updatedSlots);
  };

  const handleAddException = () => {
    addExceptionMutation.mutate(newException);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="w-6 h-6 mr-2" />
        <span>Please log in to view your availability.</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Availability</h1>
          <p className="text-muted-foreground">Manage your weekly availability and schedule exceptions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchAvailability(); refetchExceptions(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tab buttons */}
      <div className="flex space-x-2 border-b pb-2">
        <Button
          variant={activeTab === 'weekly' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly Availability
        </Button>
        <Button
          variant={activeTab === 'exceptions' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('exceptions')}
        >
          Date Exceptions
        </Button>
      </div>

      {activeTab === 'weekly' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Weekly Availability</CardTitle>
              <CardDescription>Set your regular weekly working hours</CardDescription>
            </div>
            <Button onClick={() => setShowAddSlotDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Slot
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAvailability ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No availability set. Click &quot;Add Slot&quot; to add your available hours.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot, index) => (
                    <TableRow key={slot.id || index}>
                      <TableCell className="font-medium">
                        {DAYS_OF_WEEK[slot.dayOfWeek]}
                      </TableCell>
                      <TableCell>{slot.startTime}</TableCell>
                      <TableCell>{slot.endTime}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSlot(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'exceptions' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Date Exceptions</CardTitle>
              <CardDescription>Mark specific dates as unavailable or set special hours</CardDescription>
            </div>
            <Button onClick={() => setShowAddExceptionDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Exception
            </Button>
          </CardHeader>
          <CardContent>
            {loadingExceptions ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (exceptions?.length || 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No exceptions set. Click &quot;Add Exception&quot; to mark specific dates.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions?.map((exc) => (
                    <TableRow key={exc.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(exc.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={exc.isUnavailable ? 'destructive' : 'secondary'}>
                          {exc.isUnavailable ? 'Unavailable' : 'Special Hours'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {exc.isUnavailable ? '-' : `${exc.startTime} - ${exc.endTime}`}
                      </TableCell>
                      <TableCell>{exc.reason || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExceptionMutation.mutate(exc.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={showAddSlotDialog} onOpenChange={setShowAddSlotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability Slot</DialogTitle>
            <DialogDescription>Add a recurring weekly availability slot</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={newSlot.dayOfWeek}
                onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: parseInt(e.target.value) })}
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <option key={index} value={index}>{day}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newSlot.startTime}
                  onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newSlot.endTime}
                  onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSlotDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSlot} disabled={setAvailabilityMutation.isPending}>
              {setAvailabilityMutation.isPending ? 'Saving...' : 'Add Slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={showAddExceptionDialog} onOpenChange={setShowAddExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Date Exception</DialogTitle>
            <DialogDescription>Mark a specific date as unavailable or set special hours</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={newException.date}
                onChange={(e) => setNewException({ ...newException, date: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="unavailable"
                checked={newException.isUnavailable}
                onChange={(e) => setNewException({ ...newException, isUnavailable: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="unavailable">Mark as Unavailable (entire day)</Label>
            </div>
            {!newException.isUnavailable && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newException.startTime}
                    onChange={(e) => setNewException({ ...newException, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newException.endTime}
                    onChange={(e) => setNewException({ ...newException, endTime: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={newException.reason}
                onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
                placeholder="e.g., Doctor appointment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExceptionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddException} disabled={addExceptionMutation.isPending || !newException.date}>
              {addExceptionMutation.isPending ? 'Adding...' : 'Add Exception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
