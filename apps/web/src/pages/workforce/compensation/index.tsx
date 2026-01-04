/**
 * M10.7: Compensation Components Admin Page
 * 
 * Manage org-scoped compensation components (earnings, deductions, taxes).
 * RBAC: L4+ for CRUD operations
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Plus, Edit, Archive, DollarSign, Percent, Clock, Calculator } from 'lucide-react';

interface CompensationComponent {
  id: string;
  code: string;
  name: string;
  type: string;
  calcMethod: string;
  rate: string | null;
  capMin: string | null;
  capMax: string | null;
  earningsCode: string | null;
  roundingRule: string;
  displayOrder: number;
  isActive: boolean;
  branchId: string | null;
  createdAt: string;
}

const COMPONENT_TYPES = [
  { value: 'EARNING', label: 'Earnings', color: 'bg-green-100 text-green-800' },
  { value: 'DEDUCTION_PRE', label: 'Pre-Tax Deduction', color: 'bg-orange-100 text-orange-800' },
  { value: 'TAX', label: 'Tax Withholding', color: 'bg-red-100 text-red-800' },
  { value: 'DEDUCTION_POST', label: 'Post-Tax Deduction', color: 'bg-purple-100 text-purple-800' },
  { value: 'EMPLOYER_CONTRIB', label: 'Employer Contribution', color: 'bg-blue-100 text-blue-800' },
];

const CALC_METHODS = [
  { value: 'FIXED', label: 'Fixed Amount', icon: DollarSign },
  { value: 'PERCENT_OF_GROSS', label: '% of Gross', icon: Percent },
  { value: 'PERCENT_OF_EARNINGS_CODE', label: '% of Earnings Code', icon: Calculator },
  { value: 'PER_HOUR', label: 'Per Hour', icon: Clock },
];

const ROUNDING_RULES = [
  { value: 'HALF_UP_CENTS', label: 'Round to cents (0.01)' },
  { value: 'HALF_UP_UNIT', label: 'Round to whole units (1.00)' },
];

interface ComponentFormData {
  code: string;
  name: string;
  type: string;
  calcMethod: string;
  rate: string;
  capMin: string;
  capMax: string;
  earningsCode: string;
  roundingRule: string;
  displayOrder: number;
  branchId: string;
}

const defaultFormData: ComponentFormData = {
  code: '',
  name: '',
  type: 'EARNING',
  calcMethod: 'FIXED',
  rate: '',
  capMin: '',
  capMax: '',
  earningsCode: '',
  roundingRule: 'HALF_UP_CENTS',
  displayOrder: 100,
  branchId: '',
};

export default function CompensationComponentsPage() {
  const { user } = useAuth();
  const [components, setComponents] = useState<CompensationComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<CompensationComponent | null>(null);
  const [formData, setFormData] = useState<ComponentFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // Check role access
  const canView = user?.roleLevel === 'L4' || user?.roleLevel === 'L5';
  const canEdit = user?.roleLevel === 'L4' || user?.roleLevel === 'L5';

  useEffect(() => {
    if (canView) {
      fetchComponents();
    }
  }, [canView, showInactive]);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (!showInactive) {
        params.append('isActive', 'true');
      }
      const res = await apiClient.get(`/workforce/compensation/components?${params}`);
      setComponents(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load components');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingComponent(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleEdit = (component: CompensationComponent) => {
    setEditingComponent(component);
    setFormData({
      code: component.code,
      name: component.name,
      type: component.type,
      calcMethod: component.calcMethod,
      rate: component.rate || '',
      capMin: component.capMin || '',
      capMax: component.capMax || '',
      earningsCode: component.earningsCode || '',
      roundingRule: component.roundingRule,
      displayOrder: component.displayOrder,
      branchId: component.branchId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: any = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        calcMethod: formData.calcMethod,
        roundingRule: formData.roundingRule,
        displayOrder: formData.displayOrder,
      };

      if (formData.rate) {
        payload.rate = parseFloat(formData.rate);
      }
      if (formData.capMin) {
        payload.capMin = parseFloat(formData.capMin);
      }
      if (formData.capMax) {
        payload.capMax = parseFloat(formData.capMax);
      }
      if (formData.earningsCode) {
        payload.earningsCode = formData.earningsCode;
      }
      if (formData.branchId) {
        payload.branchId = formData.branchId;
      }

      if (editingComponent) {
        await apiClient.patch(`/workforce/compensation/components/${editingComponent.id}`, payload);
      } else {
        await apiClient.post('/workforce/compensation/components', payload);
      }

      setDialogOpen(false);
      fetchComponents();
    } catch (err: any) {
      setError(err.message || 'Failed to save component');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (component: CompensationComponent) => {
    if (!confirm(`Are you sure you want to ${component.isActive ? 'disable' : 'enable'} "${component.name}"?`)) {
      return;
    }
    try {
      await apiClient.patch(`/workforce/compensation/components/${component.id}/disable`);
      fetchComponents();
    } catch (err: any) {
      setError(err.message || 'Failed to update component status');
    }
  };

  const getTypeConfig = (type: string) => {
    return COMPONENT_TYPES.find((t) => t.value === type) || COMPONENT_TYPES[0];
  };

  const getCalcMethodConfig = (method: string) => {
    return CALC_METHODS.find((m) => m.value === method) || CALC_METHODS[0];
  };

  // Filter components
  const filteredComponents = components.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    return true;
  });

  if (!canView) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          You don&apos;t have permission to manage compensation components.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compensation Components</h1>
            <p className="text-muted-foreground">
              Configure earnings, deductions, taxes, and employer contributions
            </p>
          </div>
          {canEdit && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="w-48">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {COMPONENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showInactive"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="showInactive">Show inactive</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-4"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Components Table */}
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>
              {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredComponents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No components found. Create your first component to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calculation</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Caps</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComponents.map((component) => {
                    const typeConfig = getTypeConfig(component.type);
                    const calcConfig = getCalcMethodConfig(component.calcMethod);
                    const CalcIcon = calcConfig.icon;

                    return (
                      <TableRow key={component.id} className={!component.isActive ? 'opacity-50' : ''}>
                        <TableCell className="font-mono font-medium">{component.code}</TableCell>
                        <TableCell>{component.name}</TableCell>
                        <TableCell>
                          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CalcIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{calcConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {component.rate
                            ? component.calcMethod.includes('PERCENT')
                              ? `${parseFloat(component.rate).toFixed(2)}%`
                              : parseFloat(component.rate).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {component.capMin || component.capMax ? (
                            <span className="text-sm">
                              {component.capMin && `Min: ${parseFloat(component.capMin).toLocaleString()}`}
                              {component.capMin && component.capMax && ' / '}
                              {component.capMax && `Max: ${parseFloat(component.capMax).toLocaleString()}`}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={component.isActive ? 'default' : 'secondary'}>
                            {component.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(component)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDisable(component)}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? 'Edit Component' : 'Create Component'}
              </DialogTitle>
              <DialogDescription>
                Configure the compensation component settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., REG_PAY"
                    disabled={!!editingComponent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Regular Pay"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calcMethod">Calculation Method</Label>
                  <Select
                    value={formData.calcMethod}
                    onValueChange={(value) => setFormData({ ...formData, calcMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALC_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">
                  Rate {formData.calcMethod.includes('PERCENT') ? '(%)' : '($)'}
                </Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder={formData.calcMethod.includes('PERCENT') ? '6.2' : '0.00'}
                />
              </div>

              {formData.calcMethod === 'PERCENT_OF_EARNINGS_CODE' && (
                <div className="space-y-2">
                  <Label htmlFor="earningsCode">Earnings Code Reference</Label>
                  <Input
                    id="earningsCode"
                    value={formData.earningsCode}
                    onChange={(e) => setFormData({ ...formData, earningsCode: e.target.value.toUpperCase() })}
                    placeholder="e.g., REG_PAY"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capMin">Min Cap ($)</Label>
                  <Input
                    id="capMin"
                    type="number"
                    step="0.01"
                    value={formData.capMin}
                    onChange={(e) => setFormData({ ...formData, capMin: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capMax">Max Cap ($)</Label>
                  <Input
                    id="capMax"
                    type="number"
                    step="0.01"
                    value={formData.capMax}
                    onChange={(e) => setFormData({ ...formData, capMax: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roundingRule">Rounding</Label>
                <Select
                  value={formData.roundingRule}
                  onValueChange={(value) => setFormData({ ...formData, roundingRule: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDING_RULES.map((rule) => (
                      <SelectItem key={rule.value} value={rule.value}>
                        {rule.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingComponent ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
