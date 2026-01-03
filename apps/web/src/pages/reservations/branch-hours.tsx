import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Save } from 'lucide-react';

interface OperatingHours {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  enabled: boolean;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const defaultHours: Omit<OperatingHours, 'id'>[] = DAYS_OF_WEEK.map((_, i) => ({
  dayOfWeek: i,
  openTime: '09:00',
  closeTime: '22:00',
  enabled: i >= 1 && i <= 5, // Mon-Fri enabled by default
}));

export default function BranchHoursPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [hours, setHours] = useState<Omit<OperatingHours, 'id'>[]>(defaultHours);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingHours, isLoading } = useQuery<OperatingHours[]>({
    queryKey: ['branch-hours', branchId],
    queryFn: async () => {
      const res = await apiClient.get('/reservations/branch-hours', {
        params: { branchId },
      });
      return res.data;
    },
    enabled: !!branchId,
  });

  // Sync fetched hours to local state
  useEffect(() => {
    if (existingHours && existingHours.length > 0) {
      const merged = defaultHours.map((dh) => {
        const existing = existingHours.find((h) => h.dayOfWeek === dh.dayOfWeek);
        return existing
          ? { dayOfWeek: existing.dayOfWeek, openTime: existing.openTime, closeTime: existing.closeTime, enabled: existing.enabled }
          : dh;
      });
      setHours(merged);
    }
  }, [existingHours]);

  const saveMutation = useMutation({
    mutationFn: async (hoursData: Omit<OperatingHours, 'id'>[]) => {
      const res = await apiClient.put('/reservations/branch-hours', 
        { hours: hoursData },
        { params: { branchId } }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-hours', branchId] });
      setHasChanges(false);
    },
  });

  const handleTimeChange = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
    setHasChanges(true);
  };

  const handleEnabledChange = (dayOfWeek: number, enabled: boolean) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, enabled } : h))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(hours);
  };

  if (!branchId) {
    return (
      <AppShell>
        <PageHeader
          title="Branch Operating Hours"
          subtitle="Define when your branch accepts reservations"
        />
        <Card className="p-6">
          <p className="text-muted-foreground">Please select a branch to manage hours.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Branch Operating Hours"
        subtitle="Define when your branch accepts reservations"
        actions={
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Hours'}
          </Button>
        }
      />

      <Card className="p-6">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-4">
            {hours.map((h) => (
              <div
                key={h.dayOfWeek}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="w-32 font-medium">{DAYS_OF_WEEK[h.dayOfWeek]}</div>
                
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => handleEnabledChange(h.dayOfWeek, e.target.checked)}
                  className="h-4 w-4"
                />
                
                <div className="flex items-center gap-2 flex-1">
                  <Label className="sr-only">Open Time</Label>
                  <Input
                    type="time"
                    value={h.openTime}
                    onChange={(e) => handleTimeChange(h.dayOfWeek, 'openTime', e.target.value)}
                    disabled={!h.enabled}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Label className="sr-only">Close Time</Label>
                  <Input
                    type="time"
                    value={h.closeTime}
                    onChange={(e) => handleTimeChange(h.dayOfWeek, 'closeTime', e.target.value)}
                    disabled={!h.enabled}
                    className="w-32"
                  />
                </div>

                <Badge variant={h.enabled ? 'default' : 'secondary'}>
                  {h.enabled ? 'Open' : 'Closed'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
