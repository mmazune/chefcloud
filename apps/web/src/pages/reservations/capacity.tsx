import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Save, Users, UserCheck } from 'lucide-react';

interface CapacityRule {
  id: string;
  maxPartiesPerHour: number | null;
  maxCoversPerHour: number | null;
  enabled: boolean;
}

export default function CapacityPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;

  const [formData, setFormData] = useState({
    maxPartiesPerHour: '',
    maxCoversPerHour: '',
    enabled: true,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: rule, isLoading } = useQuery<CapacityRule | null>({
    queryKey: ['capacity-rules', branchId],
    queryFn: async () => {
      const res = await apiClient.get('/reservations/capacity-rules', {
        params: { branchId },
      });
      return res.data;
    },
    enabled: !!branchId,
  });

  // Sync fetched rule to local state
  useEffect(() => {
    if (rule) {
      setFormData({
        maxPartiesPerHour: rule.maxPartiesPerHour?.toString() || '',
        maxCoversPerHour: rule.maxCoversPerHour?.toString() || '',
        enabled: rule.enabled,
      });
    }
  }, [rule]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiClient.put(
        '/reservations/capacity-rules',
        {
          maxPartiesPerHour: data.maxPartiesPerHour ? parseInt(data.maxPartiesPerHour) : null,
          maxCoversPerHour: data.maxCoversPerHour ? parseInt(data.maxCoversPerHour) : null,
          enabled: data.enabled,
        },
        { params: { branchId } }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capacity-rules', branchId] });
      setHasChanges(false);
    },
  });

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (!branchId) {
    return (
      <AppShell>
        <PageHeader
          title="Capacity Rules"
          subtitle="Control maximum parties and covers per hour"
        />
        <Card className="p-6">
          <p className="text-muted-foreground">Please select a branch to manage capacity.</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Capacity Rules"
        subtitle="Control maximum parties and covers per hour"
        actions={
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Rules'}
          </Button>
        }
      />

      <Card className="p-6">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-6 max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Capacity Limits</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, no capacity limits are enforced
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-start gap-4">
                <Users className="h-5 w-5 mt-2 text-muted-foreground" />
                <div className="flex-1">
                  <Label htmlFor="maxParties">Maximum Parties Per Hour</Label>
                  <Input
                    id="maxParties"
                    type="number"
                    min="0"
                    value={formData.maxPartiesPerHour}
                    onChange={(e) => handleChange('maxPartiesPerHour', e.target.value)}
                    placeholder="Unlimited"
                    disabled={!formData.enabled}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Number of reservation groups that can start in the same hour
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <UserCheck className="h-5 w-5 mt-2 text-muted-foreground" />
                <div className="flex-1">
                  <Label htmlFor="maxCovers">Maximum Covers Per Hour</Label>
                  <Input
                    id="maxCovers"
                    type="number"
                    min="0"
                    value={formData.maxCoversPerHour}
                    onChange={(e) => handleChange('maxCoversPerHour', e.target.value)}
                    placeholder="Unlimited"
                    disabled={!formData.enabled}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Total guests (sum of party sizes) that can be seated in the same hour
                  </p>
                </div>
              </div>
            </div>

            {rule && (
              <div className="pt-4 border-t text-sm text-muted-foreground">
                Current limits:{' '}
                {rule.maxPartiesPerHour ? `${rule.maxPartiesPerHour} parties/hr` : 'Unlimited parties'}
                {' • '}
                {rule.maxCoversPerHour ? `${rule.maxCoversPerHour} covers/hr` : 'Unlimited covers'}
              </div>
            )}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
