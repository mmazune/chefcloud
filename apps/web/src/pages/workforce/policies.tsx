/**
 * M10.4: Workforce Policies Page
 *
 * Features:
 * - View/edit WorkforcePolicy (OT thresholds, rounding rules)
 * - Configure daily/weekly OT thresholds
 * - Set rounding mode (NONE, NEAREST_15, NEAREST_5)
 *
 * RBAC: L4+ (Manager, Owner)
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Settings, Save, Clock, AlertCircle } from 'lucide-react';

type RoundingMode = 'NEAREST' | 'UP' | 'DOWN';

interface WorkforcePolicy {
  id: string;
  orgId: string;
  dailyOtThresholdMins: number;
  weeklyOtThresholdMins: number;
  roundingMode: RoundingMode;
  roundingIntervalMins?: number;
  requireApproval?: boolean;
  autoLockDays?: number;
  createdAt: string;
  updatedAt: string;
}

export default function PoliciesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [dailyOtHours, setDailyOtHours] = useState('8');
  const [weeklyOtHours, setWeeklyOtHours] = useState('40');
  const [roundingMode, setRoundingMode] = useState<RoundingMode>('NEAREST');
  const [isDirty, setIsDirty] = useState(false);

  // Check if user has required role (L4+ = Manager, Owner)
  const hasAccess = Boolean(user && user.roleLevel && ['L4', 'L5'].includes(user.roleLevel));

  // Fetch current policy
  const { data: policy, isLoading, error } = useQuery<WorkforcePolicy>({
    queryKey: ['workforce-policy'],
    queryFn: async () => {
      const response = await apiClient.get('/workforce/policy');
      return response.data;
    },
    enabled: hasAccess,
  });

  // Update form when policy loads
  useEffect(() => {
    if (policy) {
      setDailyOtHours(String(policy.dailyOtThresholdMins / 60));
      setWeeklyOtHours(String(policy.weeklyOtThresholdMins / 60));
      setRoundingMode(policy.roundingMode);
      setIsDirty(false);
    }
  }, [policy]);

  // Update policy mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      dailyOtThresholdMins: number;
      weeklyOtThresholdMins: number;
      roundingMode: RoundingMode;
    }) => {
      const response = await apiClient.put('/workforce/policy', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce-policy'] });
      setIsDirty(false);
      toast({ title: 'Policy updated', description: 'Workforce policy saved successfully.' });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Failed to update policy',
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    const dailyMinutes = parseFloat(dailyOtHours) * 60;
    const weeklyMinutes = parseFloat(weeklyOtHours) * 60;

    if (isNaN(dailyMinutes) || dailyMinutes < 0) {
      toast({ title: 'Invalid daily OT threshold', variant: 'destructive' });
      return;
    }
    if (isNaN(weeklyMinutes) || weeklyMinutes < 0) {
      toast({ title: 'Invalid weekly OT threshold', variant: 'destructive' });
      return;
    }

    updateMutation.mutate({
      dailyOtThresholdMins: dailyMinutes,
      weeklyOtThresholdMins: weeklyMinutes,
      roundingMode,
    });
  };

  const handleFieldChange = () => {
    setIsDirty(true);
  };

  // RBAC check
  if (user && !hasAccess) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Workforce Policies
        </h1>
        <p className="text-muted-foreground">
          Configure overtime thresholds and time rounding rules
        </p>
      </div>

      {/* Policy Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime &amp; Rounding Rules
          </CardTitle>
          <CardDescription>
            These settings apply organization-wide and affect how overtime is calculated and time is
            rounded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-muted-foreground">Loading policy...</div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to load policy. It may not exist yet - save to create one.</span>
            </div>
          ) : null}

          {/* Daily OT Threshold */}
          <div className="space-y-2">
            <Label htmlFor="dailyOt">Daily Overtime Threshold (hours)</Label>
            <Input
              id="dailyOt"
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={dailyOtHours}
              onChange={(e) => {
                setDailyOtHours(e.target.value);
                handleFieldChange();
              }}
              className="w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              Hours worked beyond this in a single day are overtime (default: 8)
            </p>
          </div>

          {/* Weekly OT Threshold */}
          <div className="space-y-2">
            <Label htmlFor="weeklyOt">Weekly Overtime Threshold (hours)</Label>
            <Input
              id="weeklyOt"
              type="number"
              step="0.5"
              min="0"
              max="168"
              value={weeklyOtHours}
              onChange={(e) => {
                setWeeklyOtHours(e.target.value);
                handleFieldChange();
              }}
              className="w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              Hours worked beyond this in a week are overtime (default: 40)
            </p>
          </div>

          {/* Rounding Mode */}
          <div className="space-y-2">
            <Label htmlFor="rounding">Time Rounding Mode</Label>
            <Select
              value={roundingMode}
              onValueChange={(value) => {
                setRoundingMode(value as RoundingMode);
                handleFieldChange();
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select rounding mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEAREST">Round to Nearest</SelectItem>
                <SelectItem value="UP">Round Up</SelectItem>
                <SelectItem value="DOWN">Round Down</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How clock-in/out times are rounded for payroll calculation
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || !isDirty}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Policy'}
            </Button>
            {isDirty && (
              <p className="text-sm text-muted-foreground mt-2">You have unsaved changes</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Policy Info */}
      {policy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Policy Information</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Policy ID: {policy.id}</p>
            <p>Created: {new Date(policy.createdAt).toLocaleString()}</p>
            <p>Last Updated: {new Date(policy.updatedAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
