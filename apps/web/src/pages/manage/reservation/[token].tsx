/**
 * M9.5: Customer Self-Service "Manage Reservation" Page
 *
 * Token-based self-service portal for viewing, cancelling, and rescheduling reservations.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../components/ui/use-toast';
import {
  AlertCircle,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Bell,
} from 'lucide-react';

interface ReservationDetails {
  id: string;
  name: string;
  phone: string | null;
  partySize: number;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  branch: {
    name: string;
    address: string | null;
  };
  deposit?: {
    status: string;
    amountCents: number;
  } | null;
  policy?: {
    cancelCutoffMinutes: number;
    rescheduleCutoffMinutes: number;
    allowCancel: boolean;
    allowReschedule: boolean;
  } | null;
}

interface NotificationSummary {
  id: string;
  type: string;
  event: string;
  status: string;
  createdAt: string;
}

// Public API client (no auth)
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

export default function ManageReservationPage() {
  const router = useRouter();
  const { token } = router.query;
  const { toast } = useToast();

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  // Fetch reservation details
  const {
    data: reservation,
    isLoading,
    error,
    refetch,
  } = useQuery<ReservationDetails>({
    queryKey: ['manage-reservation', token],
    queryFn: async () => {
      const response = await publicApi.get(`/public/reservations/manage`, {
        params: { token },
      });
      return response.data;
    },
    enabled: !!token,
    retry: false,
  });

  // Fetch notification history (if available)
  const { data: notifications } = useQuery<NotificationSummary[]>({
    queryKey: ['reservation-notifications', token],
    queryFn: async () => {
      const response = await publicApi.get(`/public/reservations/notifications`, {
        params: { token },
      });
      return response.data;
    },
    enabled: !!token && !!reservation,
    retry: false,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await publicApi.post(`/public/reservations/${reservation?.id}/cancel`, {
        token,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Reservation Cancelled',
        description: 'Your reservation has been cancelled.',
        variant: 'default',
      });
      setShowCancelConfirm(false);
      refetch();
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to cancel reservation';
      toast({
        title: 'Cancel Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const newStartAt = new Date(`${newDate}T${newTime}`);
      const response = await publicApi.post(`/public/reservations/${reservation?.id}/reschedule`, {
        token,
        newStartAt: newStartAt.toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Reservation Rescheduled',
        description: 'Your reservation has been updated.',
        variant: 'default',
      });
      setShowRescheduleForm(false);
      refetch();
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to reschedule reservation';
      toast({
        title: 'Reschedule Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'text-green-600';
      case 'HELD':
        return 'text-yellow-600';
      case 'CANCELLED':
        return 'text-red-600';
      case 'COMPLETED':
        return 'text-blue-600';
      case 'NO_SHOW':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDepositStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUIRED':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Deposit Required</span>;
      case 'PAID':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Deposit Paid</span>;
      case 'REFUNDED':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Deposit Refunded</span>;
      case 'FORFEITED':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Deposit Forfeited</span>;
      case 'APPLIED':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Deposit Applied</span>;
      default:
        return null;
    }
  };

  const canCancel =
    reservation?.policy?.allowCancel !== false &&
    ['CONFIRMED', 'HELD'].includes(reservation?.status || '');

  const canReschedule =
    reservation?.policy?.allowReschedule !== false &&
    ['CONFIRMED', 'HELD'].includes(reservation?.status || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-lg">Loading your reservation...</div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Reservation Not Found</h2>
            <p className="text-muted-foreground">
              This link may be invalid or expired. Please contact the restaurant directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { date, time } = formatDateTime(reservation.startAt);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Manage Your Reservation</h1>
          <p className="text-muted-foreground">{reservation.branch.name}</p>
          {reservation.branch.address && (
            <p className="text-sm text-muted-foreground">{reservation.branch.address}</p>
          )}
        </div>

        {/* Reservation Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Reservation Details</span>
              <span className={`text-lg font-medium ${getStatusColor(reservation.status)}`}>
                {reservation.status}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{time}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Party Size</p>
                  <p className="font-medium">{reservation.partySize} guests</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{reservation.name}</p>
                </div>
              </div>
            </div>

            {reservation.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Special Requests</p>
                <p>{reservation.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deposit Status */}
        {reservation.deposit && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Deposit Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat('en-UG', {
                      style: 'currency',
                      currency: 'UGX',
                      minimumFractionDigits: 0,
                    }).format(reservation.deposit.amountCents / 100)}
                  </p>
                </div>
                {getDepositStatusBadge(reservation.deposit.status)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {['CONFIRMED', 'HELD'].includes(reservation.status) && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showCancelConfirm ? (
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <p className="font-medium text-red-800 mb-4">
                    Are you sure you want to cancel this reservation?
                  </p>
                  {reservation.deposit?.status === 'PAID' && (
                    <p className="text-sm text-red-700 mb-4">
                      Note: Deposit refund depends on cancellation timing and policy.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
                      Keep Reservation
                    </Button>
                  </div>
                </div>
              ) : showRescheduleForm ? (
                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-4">Select New Date & Time</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Time</label>
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => rescheduleMutation.mutate()}
                      disabled={!newDate || !newTime || rescheduleMutation.isPending}
                    >
                      {rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowRescheduleForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  {canReschedule && (
                    <Button variant="outline" onClick={() => setShowRescheduleForm(true)}>
                      Reschedule
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="destructive" onClick={() => setShowCancelConfirm(true)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Reservation
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notification History */}
        {notifications && notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="text-sm font-medium">{n.event.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        n.status === 'SENT'
                          ? 'bg-green-100 text-green-800'
                          : n.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {n.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            <p>Need help? Contact {reservation.branch.name} directly.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
