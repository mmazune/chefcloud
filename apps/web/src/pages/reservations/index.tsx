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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Reservation {
  id: string;
  name: string;
  phone: string;
  partySize: number;
  startAt: string;
  endAt: string;
  status: 'HELD' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  source: 'PHONE' | 'WALK_IN' | 'ONLINE' | 'INTERNAL';
  notes?: string;
  deposit: number;
  depositStatus: string;
  table?: {
    id: string;
    label: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}

interface EventBooking {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN';
  depositCaptured: boolean;
  creditTotal: number;
  ticketCode: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    eventType: string;
  };
  eventTable: {
    id: string;
    label: string;
    capacity: number;
  } | null;
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    return future.toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: reservations = [], isLoading: reservationsLoading } = useQuery<Reservation[]>({
    queryKey: ['reservations', dateFrom, dateTo, statusFilter, branchId],
    queryFn: async () => {
      const params: Record<string, string> = {
        from: new Date(dateFrom).toISOString(),
        to: new Date(dateTo).toISOString(),
      };
      if (branchId) params.branchId = branchId;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await apiClient.get('/reservations', { params });
      return res.data;
    },
    enabled: !!user,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<EventBooking[]>({
    queryKey: ['bookings-list'],
    queryFn: async () => {
      const res = await apiClient.get('/bookings/list');
      return res.data;
    },
    enabled: !!user,
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/reservations/${id}/confirm`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/reservations/${id}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const seatMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/reservations/${id}/seat`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to seat');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/reservations/${id}/complete`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/reservations/${id}/no-show`, { reason: 'Customer did not arrive' });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const totalReservations = reservations.length;
  const confirmedCount = reservations.filter((r) => r.status === 'CONFIRMED').length;
  const seatedCount = reservations.filter((r) => r.status === 'SEATED').length;
  const completedCount = reservations.filter((r) => r.status === 'COMPLETED').length;
  const cancelledCount = reservations.filter((r) => r.status === 'CANCELLED' || r.status === 'NO_SHOW').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HELD':
        return <Badge variant="secondary">{status}</Badge>;
      case 'CONFIRMED':
        return <Badge variant="default">{status}</Badge>;
      case 'SEATED':
        return <Badge className="bg-blue-500 hover:bg-blue-600">{status}</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">{status}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">{status}</Badge>;
      case 'NO_SHOW':
        return <Badge variant="destructive">{status.replace('_', ' ')}</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="success">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'PHONE':
        return <Badge variant="outline" className="text-xs">📞 Phone</Badge>;
      case 'ONLINE':
        return <Badge variant="outline" className="text-xs">🌐 Online</Badge>;
      case 'WALK_IN':
        return <Badge variant="outline" className="text-xs">🚶 Walk-in</Badge>;
      case 'INTERNAL':
        return <Badge variant="outline" className="text-xs">🏠 Internal</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{source}</Badge>;
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppShell>
      <PageHeader
        title="Reservations & Events"
        subtitle="Manage table reservations and event bookings"
      />

      {/* M9.2: Navigation to Policies and Calendar */}
      <div className="flex gap-2 mb-6">
        <Button variant="outline" data-testid="reservation-nav-policies" onClick={() => window.location.href = '/reservations/policies'}>
          ⚙️ Policies
        </Button>
        <Button variant="outline" data-testid="reservation-nav-calendar" onClick={() => window.location.href = '/reservations/calendar'}>
          📅 Calendar View
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Reservations</div>
          <div className="text-2xl font-bold mt-2">{totalReservations}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Confirmed</div>
          <div className="text-2xl font-bold mt-2 text-blue-600">{confirmedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Seated</div>
          <div className="text-2xl font-bold mt-2 text-purple-600">{seatedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold mt-2 text-green-600">{completedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Cancelled/No-Show</div>
          <div className="text-2xl font-bold mt-2 text-red-600">{cancelledCount}</div>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Status Filter</label>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'HELD' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('HELD')}
              >
                Held
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'CONFIRMED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('CONFIRMED')}
              >
                Confirmed
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'SEATED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('SEATED')}
              >
                Seated
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Table Reservations</h2>
          <p className="text-sm text-muted-foreground">Manage walk-in and online table bookings</p>
        </div>
        <div className="overflow-x-auto">
          {reservationsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading reservations...</div>
          ) : reservations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No reservations found</div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Date/Time</th>
                  <th className="text-left p-3 text-sm font-medium">Guest Name</th>
                  <th className="text-left p-3 text-sm font-medium">Phone</th>
                  <th className="text-left p-3 text-sm font-medium">Covers</th>
                  <th className="text-left p-3 text-sm font-medium">Source</th>
                  <th className="text-left p-3 text-sm font-medium">Table</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">Deposit</th>
                  <th className="text-left p-3 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 text-sm">{formatDateTime(reservation.startAt)}</td>
                    <td className="p-3 text-sm font-medium">
                      {reservation.name}
                      {reservation.notes && (
                        <span className="block text-xs text-muted-foreground">{reservation.notes}</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">{reservation.phone}</td>
                    <td className="p-3 text-sm">{reservation.partySize}</td>
                    <td className="p-3">{getSourceBadge(reservation.source)}</td>
                    <td className="p-3 text-sm">
                      {reservation.table ? reservation.table.label : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">{getStatusBadge(reservation.status)}</td>
                    <td className="p-3 text-sm">
                      {reservation.deposit > 0 ? (
                        <span>
                          ${Number(reservation.deposit).toFixed(2)}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({reservation.depositStatus})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        {reservation.status === 'HELD' && (
                          <>
                            <Button
                              size="sm"
                              data-testid="reservation-confirm"
                              onClick={() => confirmMutation.mutate(reservation.id)}
                              disabled={confirmMutation.isPending}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid="reservation-cancel"
                              onClick={() => cancelMutation.mutate(reservation.id)}
                              disabled={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {reservation.status === 'CONFIRMED' && (
                          <>
                            <Button
                              size="sm"
                              data-testid="reservation-seat"
                              onClick={() => seatMutation.mutate(reservation.id)}
                              disabled={seatMutation.isPending}
                            >
                              Seat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid="reservation-no-show"
                              onClick={() => noShowMutation.mutate(reservation.id)}
                              disabled={noShowMutation.isPending}
                            >
                              No-Show
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              data-testid="reservation-cancel-confirmed"
                              onClick={() => cancelMutation.mutate(reservation.id)}
                              disabled={cancelMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {reservation.status === 'SEATED' && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            data-testid="reservation-complete"
                            onClick={() => completeMutation.mutate(reservation.id)}
                            disabled={completeMutation.isPending}
                          >
                            Complete
                          </Button>
                        )}
                        {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(reservation.status) && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Event Bookings</h2>
          <p className="text-sm text-muted-foreground">Ticketed events and special occasions (read-only view)</p>
        </div>
        <div className="overflow-x-auto">
          {bookingsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No event bookings found</div>
          ) : (
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Event Name</th>
                  <th className="text-left p-3 text-sm font-medium">Date/Time</th>
                  <th className="text-left p-3 text-sm font-medium">Guest Name</th>
                  <th className="text-left p-3 text-sm font-medium">Table</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                  <th className="text-left p-3 text-sm font-medium">Deposit</th>
                  <th className="text-left p-3 text-sm font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">{booking.event.title}</td>
                    <td className="p-3 text-sm">{formatDateTime(booking.event.startsAt)}</td>
                    <td className="p-3 text-sm">{booking.name}</td>
                    <td className="p-3 text-sm">
                      {booking.eventTable ? (
                        <span>
                          {booking.eventTable.label}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({booking.eventTable.capacity} cap)
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">{getStatusBadge(booking.status)}</td>
                    <td className="p-3 text-sm">
                      {booking.depositCaptured ? (
                        <Badge variant="success">Captured</Badge>
                      ) : (
                        <Badge variant="secondary">Held</Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      {booking.creditTotal > 0 ? (
                        <span className="text-green-600 font-medium">
                          ${booking.creditTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
