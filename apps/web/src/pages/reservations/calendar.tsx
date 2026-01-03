import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

interface CalendarReservation {
  id: string;
  name: string;
  phone: string;
  partySize: number;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  notes?: string;
  table?: {
    id: string;
    label: string;
  };
}

interface CalendarSlot {
  startHour: number;
  endHour: number;
  reservations: CalendarReservation[];
}

interface CalendarResponse {
  date: string;
  branchId: string;
  totalReservations: number;
  totalCovers: number;
  slots: CalendarSlot[];
}

const STATUS_COLORS: Record<string, string> = {
  HELD: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  CONFIRMED: 'bg-blue-100 border-blue-300 text-blue-800',
  SEATED: 'bg-purple-100 border-purple-300 text-purple-800',
  COMPLETED: 'bg-green-100 border-green-300 text-green-800',
  CANCELLED: 'bg-red-100 border-red-300 text-red-800',
  NO_SHOW: 'bg-gray-100 border-gray-300 text-gray-800',
};

export default function CalendarPage() {
  const { user } = useAuth();
  const branchId = user?.branch?.id;
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const { data: calendarData, isLoading, error } = useQuery<CalendarResponse>({
    queryKey: ['reservation-calendar', selectedDate, branchId],
    queryFn: async () => {
      const params: Record<string, string> = { date: selectedDate };
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/reservations/calendar', { params });
      return res.data;
    },
    enabled: !!user,
  });

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const formatReservationTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HELD':
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
      case 'CONFIRMED':
        return <Badge variant="default" className="text-xs">{status}</Badge>;
      case 'SEATED':
        return <Badge className="bg-purple-500 text-xs">{status}</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="text-xs">{status}</Badge>;
      case 'CANCELLED':
      case 'NO_SHOW':
        return <Badge variant="destructive" className="text-xs">{status.replace('_', ' ')}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  // Generate hours for display (6 AM to 11 PM by default)
  const displayHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  return (
    <AppShell>
      <PageHeader
        title="Reservation Calendar"
        subtitle="Daily timeline view of reservations"
      />

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/reservations'}>
            ← Back to Reservations
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/reservations/policies'}>
            ⚙️ Policies
          </Button>
        </div>
        
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={goToPreviousDay}>
            ← Prev
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={goToNextDay}>
            Next →
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading calendar...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-red-500">
          Error loading calendar. Please try again.
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Date</div>
              <div className="text-xl font-bold mt-1">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Reservations</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">
                {calendarData?.totalReservations || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Total Covers</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {calendarData?.totalCovers || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium text-muted-foreground">Peak Hour</div>
              <div className="text-2xl font-bold mt-1">
                {calendarData?.slots && calendarData.slots.length > 0
                  ? formatTime(
                      calendarData.slots.reduce((prev, curr) =>
                        curr.reservations.length > prev.reservations.length ? curr : prev
                      ).startHour
                    )
                  : '—'}
              </div>
            </Card>
          </div>

          {/* Timeline View */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b bg-muted/50">
              <h2 className="text-lg font-semibold">Day Timeline</h2>
              <p className="text-sm text-muted-foreground">
                Reservations organized by time slot
              </p>
            </div>
            
            <div className="divide-y">
              {displayHours.map((hour) => {
                const slot = calendarData?.slots?.find((s) => s.startHour === hour);
                const reservations = slot?.reservations || [];
                const hasReservations = reservations.length > 0;
                
                return (
                  <div
                    key={hour}
                    className={`flex ${hasReservations ? 'bg-white' : 'bg-muted/20'}`}
                  >
                    {/* Time Column */}
                    <div className="w-24 flex-shrink-0 p-3 border-r bg-muted/30">
                      <span className="text-sm font-medium">{formatTime(hour)}</span>
                    </div>
                    
                    {/* Reservations Column */}
                    <div className="flex-1 p-3 min-h-[60px]">
                      {reservations.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {reservations.map((res) => (
                            <div
                              key={res.id}
                              className={`p-2 rounded-md border ${STATUS_COLORS[res.status] || 'bg-gray-50 border-gray-200'}`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{res.name}</span>
                                {getStatusBadge(res.status)}
                              </div>
                              <div className="text-xs text-muted-foreground flex gap-3">
                                <span>⏰ {formatReservationTime(res.startAt)}</span>
                                <span>👥 {res.partySize}</span>
                                {res.table && <span>🪑 {res.table.label}</span>}
                              </div>
                              {res.notes && (
                                <div className="text-xs mt-1 italic">{res.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Legend */}
          <Card className="mt-4 p-4">
            <h3 className="text-sm font-medium mb-2">Status Legend</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></div>
                <span className="text-xs">Held</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-200 border border-blue-400"></div>
                <span className="text-xs">Confirmed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-200 border border-purple-400"></div>
                <span className="text-xs">Seated</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-200 border border-green-400"></div>
                <span className="text-xs">Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-200 border border-red-400"></div>
                <span className="text-xs">Cancelled</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-200 border border-gray-400"></div>
                <span className="text-xs">No-Show</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
