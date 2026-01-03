import React, { useState } from 'react';
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

interface ReservationPolicy {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  defaultDurationMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  advanceBookingDays: number;
  minAdvanceMinutes: number;
  depositRequired: boolean;
  depositMinPartySize: number;
  depositAmount: string;
  depositType: 'FLAT' | 'PER_PERSON' | 'PERCENT';
  depositDeadlineMinutes: number;
  noShowFeePercent: string;
  lateCancelMinutes: number;
  lateCancelFeePercent: string;
  autoConfirm: boolean;
  maxDailyReservations: number | null;
  slotIntervalMinutes: number;
  notes: string | null;
  branch?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

const defaultPolicy: Partial<ReservationPolicy> = {
  name: '',
  defaultDurationMinutes: 90,
  minPartySize: 1,
  maxPartySize: 12,
  advanceBookingDays: 14,
  minAdvanceMinutes: 60,
  depositRequired: false,
  depositMinPartySize: 6,
  depositAmount: '50000',
  depositType: 'PER_PERSON',
  depositDeadlineMinutes: 1440,
  noShowFeePercent: '100',
  lateCancelMinutes: 180,
  lateCancelFeePercent: '50',
  autoConfirm: false,
  maxDailyReservations: 50,
  slotIntervalMinutes: 15,
  notes: '',
};

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branch?.id;
  
  const [editingPolicy, setEditingPolicy] = useState<ReservationPolicy | null>(null);
  const [formData, setFormData] = useState<Partial<ReservationPolicy>>(defaultPolicy);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: policies = [], isLoading } = useQuery<ReservationPolicy[]>({
    queryKey: ['reservation-policies', branchId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      const res = await apiClient.get('/reservations/policies', { params });
      return res.data;
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<ReservationPolicy>) => {
      const res = await apiClient.put('/reservations/policies', {
        branchId: data.branchId || branchId,
        ...data,
        depositAmount: Number(data.depositAmount) || 0,
        noShowFeePercent: Number(data.noShowFeePercent) || 100,
        lateCancelFeePercent: Number(data.lateCancelFeePercent) || 50,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-policies'] });
      setDialogOpen(false);
      setEditingPolicy(null);
      setFormData(defaultPolicy);
    },
  });

  const openEditDialog = (policy: ReservationPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      ...policy,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPolicy(null);
    setFormData({ ...defaultPolicy, branchId });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(formData);
  };

  const updateField = <K extends keyof ReservationPolicy>(
    field: K,
    value: ReservationPolicy[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppShell>
      <PageHeader
        title="Reservation Policies"
        subtitle="Configure booking rules, deposits, and cancellation policies"
      />

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/reservations'}>
            ← Back to Reservations
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/reservations/calendar'}>
            📅 Calendar View
          </Button>
        </div>
        <Button onClick={openCreateDialog}>+ Create Policy</Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading policies...</Card>
      ) : policies.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No policies configured yet.</p>
          <Button onClick={openCreateDialog}>Create Your First Policy</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <Card key={policy.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{policy.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {policy.branch?.name || 'All Branches'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(policy)}>
                  Edit
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Party Size</p>
                  <p className="font-medium">{policy.minPartySize} - {policy.maxPartySize} guests</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{policy.defaultDurationMinutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Advance Booking</p>
                  <p className="font-medium">Up to {policy.advanceBookingDays} days</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Auto-Confirm</p>
                  <Badge variant={policy.autoConfirm ? 'success' : 'secondary'}>
                    {policy.autoConfirm ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              
              <div className="border-t mt-4 pt-4">
                <h4 className="text-sm font-medium mb-2">Deposit Settings</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Required</p>
                    <Badge variant={policy.depositRequired ? 'default' : 'outline'}>
                      {policy.depositRequired ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  {policy.depositRequired && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Min Party Size</p>
                        <p className="font-medium">{policy.depositMinPartySize}+ guests</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-medium">
                          {Number(policy.depositAmount).toLocaleString()} UGX
                          <span className="text-xs text-muted-foreground ml-1">
                            ({policy.depositType.toLowerCase().replace('_', ' ')})
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className="font-medium">{Math.floor(policy.depositDeadlineMinutes / 60)}h before</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="border-t mt-4 pt-4">
                <h4 className="text-sm font-medium mb-2">Cancellation Rules</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Late Cancel Window</p>
                    <p className="font-medium">{Math.floor(policy.lateCancelMinutes / 60)}h before</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Late Cancel Fee</p>
                    <p className="font-medium">{policy.lateCancelFeePercent}% of deposit</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">No-Show Fee</p>
                    <p className="font-medium">{policy.noShowFeePercent}% of deposit</p>
                  </div>
                </div>
              </div>
              
              {policy.notes && (
                <div className="border-t mt-4 pt-4">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{policy.notes}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Edit Policy' : 'Create Reservation Policy'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="name">Policy Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Standard Dining Policy"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="defaultDuration">Default Duration (min)</Label>
                <Input
                  id="defaultDuration"
                  type="number"
                  value={formData.defaultDurationMinutes || 90}
                  onChange={(e) => updateField('defaultDurationMinutes', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="slotInterval">Slot Interval (min)</Label>
                <Input
                  id="slotInterval"
                  type="number"
                  value={formData.slotIntervalMinutes || 15}
                  onChange={(e) => updateField('slotIntervalMinutes', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="minPartySize">Min Party Size</Label>
                <Input
                  id="minPartySize"
                  type="number"
                  value={formData.minPartySize || 1}
                  onChange={(e) => updateField('minPartySize', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="maxPartySize">Max Party Size</Label>
                <Input
                  id="maxPartySize"
                  type="number"
                  value={formData.maxPartySize || 12}
                  onChange={(e) => updateField('maxPartySize', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="advanceBookingDays">Advance Booking (days)</Label>
                <Input
                  id="advanceBookingDays"
                  type="number"
                  value={formData.advanceBookingDays || 14}
                  onChange={(e) => updateField('advanceBookingDays', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="minAdvanceMinutes">Min Advance Notice (min)</Label>
                <Input
                  id="minAdvanceMinutes"
                  type="number"
                  value={formData.minAdvanceMinutes || 60}
                  onChange={(e) => updateField('minAdvanceMinutes', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="maxDailyReservations">Max Daily Reservations</Label>
                <Input
                  id="maxDailyReservations"
                  type="number"
                  value={formData.maxDailyReservations || 50}
                  onChange={(e) => updateField('maxDailyReservations', parseInt(e.target.value))}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoConfirm"
                  checked={formData.autoConfirm || false}
                  onChange={(e) => updateField('autoConfirm', e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="autoConfirm">Auto-Confirm Reservations</Label>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="font-medium mb-4">Deposit Settings</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="depositRequired"
                    checked={formData.depositRequired || false}
                    onChange={(e) => updateField('depositRequired', e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="depositRequired">Require Deposit</Label>
                </div>
                
                {formData.depositRequired && (
                  <>
                    <div>
                      <Label htmlFor="depositMinPartySize">Min Party for Deposit</Label>
                      <Input
                        id="depositMinPartySize"
                        type="number"
                        value={formData.depositMinPartySize || 6}
                        onChange={(e) => updateField('depositMinPartySize', parseInt(e.target.value))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="depositAmount">Deposit Amount</Label>
                      <Input
                        id="depositAmount"
                        type="number"
                        value={formData.depositAmount || '50000'}
                        onChange={(e) => updateField('depositAmount', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="depositType">Deposit Type</Label>
                      <select
                        id="depositType"
                        value={formData.depositType || 'PER_PERSON'}
                        onChange={(e) => updateField('depositType', e.target.value as 'FLAT' | 'PER_PERSON' | 'PERCENT')}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                      >
                        <option value="FLAT">Flat Amount</option>
                        <option value="PER_PERSON">Per Person</option>
                        <option value="PERCENT">Percentage</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="depositDeadlineMinutes">Deadline (hours before)</Label>
                      <Input
                        id="depositDeadlineMinutes"
                        type="number"
                        value={Math.floor((formData.depositDeadlineMinutes || 1440) / 60)}
                        onChange={(e) => updateField('depositDeadlineMinutes', parseInt(e.target.value) * 60)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="font-medium mb-4">Cancellation Rules</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="lateCancelMinutes">Late Cancel Window (hours)</Label>
                  <Input
                    id="lateCancelMinutes"
                    type="number"
                    value={Math.floor((formData.lateCancelMinutes || 180) / 60)}
                    onChange={(e) => updateField('lateCancelMinutes', parseInt(e.target.value) * 60)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="lateCancelFeePercent">Late Cancel Fee (%)</Label>
                  <Input
                    id="lateCancelFeePercent"
                    type="number"
                    value={formData.lateCancelFeePercent || '50'}
                    onChange={(e) => updateField('lateCancelFeePercent', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="noShowFeePercent">No-Show Fee (%)</Label>
                  <Input
                    id="noShowFeePercent"
                    type="number"
                    value={formData.noShowFeePercent || '100'}
                    onChange={(e) => updateField('noShowFeePercent', e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                className="w-full h-20 rounded-md border border-input bg-background px-3 py-2"
                placeholder="Internal notes about this policy..."
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? 'Saving...' : editingPolicy ? 'Update Policy' : 'Create Policy'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
