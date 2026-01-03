/**
 * M9.4: Public Booking Page
 * 
 * AC-01: Public availability returns slots respecting policy
 * AC-02: Public create works (HELD if deposit required, CONFIRMED otherwise)
 * AC-09: Public booking page functional
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Calendar, Users, Clock, CheckCircle } from 'lucide-react';

interface TimeSlot {
  startAt: string;
  endAt: string;
  available: boolean;
  remainingCapacity: number;
}

interface BranchInfo {
  id: string;
  name: string;
  address: string | null;
  orgName: string;
  policy: {
    minPartySize: number;
    maxPartySize: number;
    advanceBookingDays: number;
    depositRequired: boolean;
    depositMinPartySize: number;
  } | null;
}

interface BookingResult {
  reservation: {
    id: string;
    name: string;
    partySize: number;
    startAt: string;
    endAt: string;
    status: string;
    depositRequired: boolean;
  };
  accessToken: string;
  manageUrl: string;
}

// Public API client (no auth)
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

export default function PublicBookingPage() {
  const router = useRouter();
  const { branchSlug } = router.query;
  const { toast } = useToast();

  // Form state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [partySize, setPartySize] = useState<number>(2);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Booking result
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  // Fetch branch info
  const { data: branchInfo, isLoading: loadingBranch } = useQuery<BranchInfo>({
    queryKey: ['public-branch', branchSlug],
    queryFn: async () => {
      const response = await publicApi.get(`/public/reservations/branch/${branchSlug}`);
      return response.data;
    },
    enabled: !!branchSlug,
  });

  // Fetch available slots
  const { data: slotsData, isLoading: loadingSlots } = useQuery<{
    slots: TimeSlot[];
    policy: Record<string, unknown>;
  }>({
    queryKey: ['public-slots', branchSlug, selectedDate, partySize],
    queryFn: async () => {
      const params = new URLSearchParams({
        branchSlug: branchSlug as string,
        date: selectedDate,
        partySize: partySize.toString(),
      });
      const response = await publicApi.get(`/public/reservations/availability?${params}`);
      return response.data;
    },
    enabled: !!branchSlug && !!selectedDate && partySize > 0,
  });

  // Create reservation mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) throw new Error('No slot selected');

      const response = await publicApi.post('/public/reservations', {
        branchSlug,
        date: selectedDate,
        startAt: selectedSlot.startAt,
        name,
        phone: phone || undefined,
        partySize,
        notes: notes || undefined,
      });
      return response.data as BookingResult;
    },
    onSuccess: (data) => {
      setBookingResult(data);
      toast({
        title: 'Reservation Created!',
        description: `Your reservation is ${data.reservation.status}`,
        variant: 'default',
      });
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Failed to create reservation';
      toast({
        title: 'Booking Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show confirmation screen after successful booking
  if (bookingResult) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-green-600">
                Reservation {bookingResult.reservation.status === 'CONFIRMED' ? 'Confirmed' : 'Held'}!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg space-y-2">
                <p><strong>Name:</strong> {bookingResult.reservation.name}</p>
                <p><strong>Party Size:</strong> {bookingResult.reservation.partySize} guests</p>
                <p><strong>Date:</strong> {new Date(bookingResult.reservation.startAt).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {formatTime(bookingResult.reservation.startAt)}</p>
              </div>

              {bookingResult.reservation.depositRequired && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="text-yellow-800 font-medium">Deposit Required</p>
                  <p className="text-sm text-yellow-700">
                    Your reservation is held. Please pay the deposit to confirm.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  Save this link to manage your reservation:
                </p>
                <code className="text-xs block mt-2 break-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}{bookingResult.manageUrl}
                </code>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  setBookingResult(null);
                  setSelectedSlot(null);
                  setName('');
                  setPhone('');
                  setNotes('');
                }}
              >
                Make Another Reservation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loadingBranch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!branchInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600">
              This branch does not have public booking enabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableSlots = slotsData?.slots.filter((s) => s.available) || [];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">{branchInfo.name}</h1>
          <p className="text-muted-foreground">{branchInfo.orgName}</p>
          {branchInfo.address && (
            <p className="text-sm text-muted-foreground mt-1">{branchInfo.address}</p>
          )}
        </div>

        {/* Step 1: Date & Party Size */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Date & Party Size
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Guests</label>
                <Select
                  value={partySize.toString()}
                  onValueChange={(v) => {
                    setPartySize(parseInt(v, 10));
                    setSelectedSlot(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: (branchInfo.policy?.maxPartySize || 10) },
                      (_, i) => i + 1
                    ).map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? 'guest' : 'guests'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Time Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Select Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSlots ? (
              <div className="text-center py-4 animate-pulse">
                Loading available times...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No available times for this date. Please try another date.
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {availableSlots.map((slot) => (
                  <Button
                    key={slot.startAt}
                    variant={selectedSlot?.startAt === slot.startAt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSlot(slot)}
                    className="w-full"
                  >
                    {formatTime(slot.startAt)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Contact Details */}
        {selectedSlot && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Special Requests (optional)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests?"
                />
              </div>

              {branchInfo.policy?.depositRequired && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
                  <p className="text-yellow-800 font-medium">Deposit Required</p>
                  <p className="text-yellow-700">
                    A deposit is required to confirm your reservation.
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={!name || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Booking...' : 'Complete Reservation'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
