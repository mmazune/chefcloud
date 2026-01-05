/**
 * M10.21: Public Kiosk Timeclock Interface
 *
 * Features:
 * - Fullscreen tablet/kiosk-friendly UI
 * - Device authentication flow
 * - PIN entry keypad
 * - Clock in/out + break management
 * - Status display
 * - Geofence integration (if required)
 *
 * Authentication: Device secret-based (not JWT)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Tablet,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  CheckCircle,
  AlertCircle,
  Loader2,
  MapPin,
  User,
  Delete,
} from 'lucide-react';

// Direct API client for public endpoints (no auth required)
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

interface DeviceInfo {
  publicId: string;
  name: string;
  branchName: string;
  orgName: string;
  enabled: boolean;
}

interface UserStatus {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    pin: string; // masked
  };
  isClockedIn: boolean;
  isOnBreak: boolean;
  activeEntry?: {
    id: string;
    clockInAt: string;
  };
  activeBreak?: {
    id: string;
    startAt: string;
  };
}

type KioskMode = 'auth' | 'idle' | 'pin' | 'action' | 'result';
type ActionType = 'clock-in' | 'clock-out' | 'break-start' | 'break-end' | 'status';

export default function PublicKioskPage() {
  const router = useRouter();
  const { publicId } = router.query;
  const { toast } = useToast();

  // State
  const [mode, setMode] = useState<KioskMode>('auth');
  const [deviceSecret, setDeviceSecret] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat effect
  useEffect(() => {
    if (!sessionId || !publicId) return;

    const heartbeat = async () => {
      try {
        await publicApi.post(`/public/workforce/kiosk/${publicId}/heartbeat`, {
          sessionId,
        });
      } catch (error) {
        // Session expired
        console.error('Heartbeat failed:', error);
        setSessionId(null);
        setMode('auth');
        toast({
          title: 'Session expired',
          description: 'Please authenticate again',
          variant: 'destructive',
        });
      }
    };

    // Send heartbeat every 5 minutes
    const interval = setInterval(heartbeat, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionId, publicId, toast]);

  // Fetch device info
  const { data: deviceInfo, isLoading: deviceLoading, error: deviceError } = useQuery<DeviceInfo>({
    queryKey: ['kiosk-device-info', publicId],
    queryFn: async () => {
      const res = await publicApi.get(`/public/workforce/kiosk/${publicId}/info`);
      return res.data;
    },
    enabled: !!publicId,
  });

  // Authenticate device
  const authMutation = useMutation({
    mutationFn: async (secret: string) => {
      const res = await publicApi.post(`/public/workforce/kiosk/${publicId}/authenticate`, {
        secret,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMode('idle');
      toast({ title: 'Device authenticated' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Authentication failed',
        description: error.response?.data?.message || 'Invalid device secret',
        variant: 'destructive',
      });
    },
  });

  // Clock actions
  const actionMutation = useMutation({
    mutationFn: async ({ action, pin: userPin }: { action: ActionType; pin: string }) => {
      const endpoint = action === 'clock-in' ? 'clock-in'
        : action === 'clock-out' ? 'clock-out'
        : action === 'break-start' ? 'break/start'
        : action === 'break-end' ? 'break/end'
        : 'status';

      const res = await publicApi.post(`/public/workforce/kiosk/${publicId}/${endpoint}`, {
        sessionId,
        pin: userPin,
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      setPin('');
      setPendingAction(null);

      if (variables.action === 'status') {
        setUserStatus(data);
        setMode('action');
      } else {
        setResultMessage({
          type: 'success',
          message: getSuccessMessage(variables.action, data),
        });
        setMode('result');
        // Auto-return to idle after 5 seconds
        setTimeout(() => {
          setMode('idle');
          setResultMessage(null);
          setUserStatus(null);
        }, 5000);
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string; code?: string } } }) => {
      const errorMessage = error.response?.data?.message || 'Action failed';
      const errorCode = error.response?.data?.code;

      if (errorCode === 'RATE_LIMITED') {
        setResultMessage({
          type: 'error',
          message: 'Too many PIN attempts. Please wait before trying again.',
        });
      } else if (errorCode === 'GEO_BLOCKED') {
        setResultMessage({
          type: 'error',
          message: 'Geofence check failed. You must be within the allowed area.',
        });
      } else {
        setResultMessage({
          type: 'error',
          message: errorMessage,
        });
      }

      setPin('');
      setPendingAction(null);
      setMode('result');

      setTimeout(() => {
        setMode('idle');
        setResultMessage(null);
      }, 5000);
    },
  });

  const getSuccessMessage = (action: ActionType, data: unknown): string => {
    const userName = (data as { user?: { firstName?: string } })?.user?.firstName || 'User';
    switch (action) {
      case 'clock-in':
        return `${userName} clocked in successfully!`;
      case 'clock-out':
        return `${userName} clocked out. Total: ${(data as { totalMinutes?: number })?.totalMinutes || 0} minutes`;
      case 'break-start':
        return `${userName} started break`;
      case 'break-end':
        return `${userName} ended break`;
      default:
        return 'Action completed';
    }
  };

  const handlePinEntry = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinSubmit = () => {
    if (pin.length < 4 || !pendingAction || !sessionId) return;
    actionMutation.mutate({ action: pendingAction, pin });
  };

  const handleActionSelect = (action: ActionType) => {
    setPendingAction(action);
    setPin('');
    setMode('pin');
  };

  const handleLogout = async () => {
    if (sessionId && publicId) {
      try {
        await publicApi.post(`/public/workforce/kiosk/${publicId}/logout`, {
          sessionId,
        });
      } catch (e) {
        // Ignore logout errors
      }
    }
    setSessionId(null);
    setMode('auth');
    setDeviceSecret('');
  };

  // Loading/Error states
  if (deviceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-xl">Loading kiosk...</span>
        </div>
      </div>
    );
  }

  if (deviceError || !deviceInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 to-slate-900">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              Device Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This kiosk device could not be found or has been disabled.
              Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!deviceInfo.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-900 to-slate-900">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertCircle className="h-6 w-6" />
              Device Disabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This kiosk device has been disabled by an administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authentication screen
  if (mode === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Tablet className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">Kiosk Setup</CardTitle>
            <CardDescription>
              {deviceInfo.name} - {deviceInfo.branchName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter device secret"
                value={deviceSecret}
                onChange={(e) => setDeviceSecret(e.target.value)}
                className="text-lg py-6"
              />
            </div>
            <Button
              className="w-full py-6 text-lg"
              onClick={() => authMutation.mutate(deviceSecret)}
              disabled={!deviceSecret || authMutation.isPending}
            >
              {authMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Activate Kiosk
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Result screen
  if (mode === 'result' && resultMessage) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        resultMessage.type === 'success'
          ? 'bg-gradient-to-br from-green-900 to-slate-900'
          : 'bg-gradient-to-br from-red-900 to-slate-900'
      }`}>
        <Card className="w-full max-w-lg text-center">
          <CardContent className="pt-12 pb-8">
            {resultMessage.type === 'success' ? (
              <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-6" />
            ) : (
              <AlertCircle className="h-24 w-24 text-red-500 mx-auto mb-6" />
            )}
            <p className="text-2xl font-semibold mb-4">{resultMessage.message}</p>
            <p className="text-muted-foreground">Returning to home screen...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PIN entry screen
  if (mode === 'pin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Enter Your PIN</CardTitle>
            <CardDescription>
              {pendingAction === 'clock-in' && 'Clock In'}
              {pendingAction === 'clock-out' && 'Clock Out'}
              {pendingAction === 'break-start' && 'Start Break'}
              {pendingAction === 'break-end' && 'End Break'}
              {pendingAction === 'status' && 'Check Status'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PIN display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${
                    i < pin.length ? 'border-primary bg-primary/10' : 'border-muted'
                  }`}
                >
                  {i < pin.length ? '•' : ''}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => (
                <Button
                  key={key || 'empty'}
                  variant={key === 'del' ? 'destructive' : 'outline'}
                  className={`h-16 text-2xl ${key === '' ? 'invisible' : ''}`}
                  onClick={() => {
                    if (key === 'del') handlePinDelete();
                    else if (key) handlePinEntry(key);
                  }}
                  disabled={!key}
                >
                  {key === 'del' ? <Delete className="h-6 w-6" /> : key}
                </Button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 py-6"
                onClick={() => {
                  setPin('');
                  setPendingAction(null);
                  setMode('idle');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 py-6"
                onClick={handlePinSubmit}
                disabled={pin.length < 4 || actionMutation.isPending}
              >
                {actionMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Action selection (after status check)
  if (mode === 'action' && userStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <User className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {userStatus.user.firstName} {userStatus.user.lastName}
            </CardTitle>
            <div className="flex justify-center gap-2 mt-2">
              {userStatus.isClockedIn ? (
                <Badge className="bg-green-600">Clocked In</Badge>
              ) : (
                <Badge variant="secondary">Clocked Out</Badge>
              )}
              {userStatus.isOnBreak && (
                <Badge className="bg-yellow-600">On Break</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!userStatus.isClockedIn ? (
              <Button
                className="w-full py-8 text-xl bg-green-600 hover:bg-green-700"
                onClick={() => handleActionSelect('clock-in')}
              >
                <LogIn className="h-6 w-6 mr-3" />
                Clock In
              </Button>
            ) : (
              <>
                {!userStatus.isOnBreak ? (
                  <Button
                    className="w-full py-6 text-lg bg-yellow-600 hover:bg-yellow-700"
                    onClick={() => handleActionSelect('break-start')}
                  >
                    <Coffee className="h-5 w-5 mr-2" />
                    Start Break
                  </Button>
                ) : (
                  <Button
                    className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleActionSelect('break-end')}
                  >
                    <Coffee className="h-5 w-5 mr-2" />
                    End Break
                  </Button>
                )}
                <Button
                  className="w-full py-8 text-xl bg-red-600 hover:bg-red-700"
                  onClick={() => handleActionSelect('clock-out')}
                >
                  <LogOut className="h-6 w-6 mr-3" />
                  Clock Out
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="w-full py-4"
              onClick={() => {
                setUserStatus(null);
                setMode('idle');
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Idle screen - main kiosk interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Tablet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-bold text-lg">{deviceInfo.name}</h1>
            <p className="text-sm text-slate-400">{deviceInfo.branchName} - {deviceInfo.orgName}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm text-slate-400">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="text-center mb-12">
          <Clock className="h-24 w-24 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-2">Employee Time Clock</h2>
          <p className="text-xl text-slate-400">Select an action and enter your PIN</p>
        </div>

        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
          <Button
            className="h-40 text-2xl bg-green-600 hover:bg-green-700 flex flex-col gap-3"
            onClick={() => handleActionSelect('clock-in')}
          >
            <LogIn className="h-12 w-12" />
            Clock In
          </Button>
          <Button
            className="h-40 text-2xl bg-red-600 hover:bg-red-700 flex flex-col gap-3"
            onClick={() => handleActionSelect('clock-out')}
          >
            <LogOut className="h-12 w-12" />
            Clock Out
          </Button>
          <Button
            className="h-40 text-2xl bg-yellow-600 hover:bg-yellow-700 flex flex-col gap-3"
            onClick={() => handleActionSelect('break-start')}
          >
            <Coffee className="h-12 w-12" />
            Start Break
          </Button>
          <Button
            className="h-40 text-2xl bg-blue-600 hover:bg-blue-700 flex flex-col gap-3"
            onClick={() => handleActionSelect('break-end')}
          >
            <Coffee className="h-12 w-12" />
            End Break
          </Button>
        </div>

        <Button
          variant="outline"
          className="mt-8 py-6 px-8 text-lg"
          onClick={() => handleActionSelect('status')}
        >
          <User className="h-5 w-5 mr-2" />
          Check My Status
        </Button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">Geofence active</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-1" />
          Admin Logout
        </Button>
      </div>
    </div>
  );
}
