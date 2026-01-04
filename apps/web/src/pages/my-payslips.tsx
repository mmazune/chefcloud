/**
 * M10.7: My Payslips Page (Employee Self-Service)
 * 
 * View own payslips with component breakdown.
 * RBAC: L1+ can view own payslips only
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';
import { Eye, Download, DollarSign, TrendingUp, Calendar } from 'lucide-react';

interface PayslipLineItem {
  id: string;
  componentCode: string;
  componentName: string;
  type: string;
  amount: string;
}

interface Payslip {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossEarnings: string;
  preTaxDeductions: string;
  taxableWages: string;
  taxesWithheld: string;
  postTaxDeductions: string;
  netPay: string;
  employerContribTotal: string;
  totalEmployerCost: string;
  createdAt: string;
  payrollRun: {
    status: string;
    payPeriod: {
      name: string;
    };
  };
  payrollRunLine: {
    regularHours: string;
    overtimeHours: string;
    paidHours: string;
  };
  lineItems: PayslipLineItem[];
}

const TYPE_LABELS: Record<string, string> = {
  EARNING: 'Earnings',
  DEDUCTION_PRE: 'Pre-Tax Deductions',
  TAX: 'Taxes',
  DEDUCTION_POST: 'Post-Tax Deductions',
  EMPLOYER_CONTRIB: 'Employer Contributions',
};

const TYPE_COLORS: Record<string, string> = {
  EARNING: 'bg-green-100 text-green-800',
  DEDUCTION_PRE: 'bg-orange-100 text-orange-800',
  TAX: 'bg-red-100 text-red-800',
  DEDUCTION_POST: 'bg-purple-100 text-purple-800',
  EMPLOYER_CONTRIB: 'bg-blue-100 text-blue-800',
};

export default function MyPayslipsPage() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // All authenticated users can view their own payslips
  const canView = !!user;

  useEffect(() => {
    if (canView) {
      fetchPayslips();
    }
  }, [canView]);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/workforce/me/payslips');
      setPayslips(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals for summary cards
  const totalGross = payslips.reduce((sum, p) => sum + parseFloat(p.grossEarnings), 0);
  const totalNet = payslips.reduce((sum, p) => sum + parseFloat(p.netPay), 0);
  const avgNet = payslips.length > 0 ? totalNet / payslips.length : 0;

  // Group selected payslip line items by type
  const groupedItems = selectedPayslip?.lineItems.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, PayslipLineItem[]>) || {};

  if (!canView) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          Please sign in to view your payslips.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">My Payslips</h1>
          <p className="text-muted-foreground">View your pay history and detailed breakdowns</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Payslips</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payslips.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Year-to-Date Gross</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGross.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Average Net Pay</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{avgNet.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Payslips Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pay History</CardTitle>
            <CardDescription>Click on a payslip to view details</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">{error}</div>
            ) : payslips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payslips found. Payslips will appear here after payroll runs are processed.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((payslip) => (
                    <TableRow
                      key={payslip.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPayslip(payslip)}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {format(new Date(payslip.payPeriodStart), 'MMM d')} -{' '}
                          {format(new Date(payslip.payPeriodEnd), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payslip.payrollRun.payPeriod.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(payslip.payrollRunLine.paidHours).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(payslip.grossEarnings).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {parseFloat(payslip.netPay).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPayslip(payslip);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payslip Detail Dialog */}
        <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payslip Details</DialogTitle>
              <DialogDescription>
                {selectedPayslip && (
                  <>
                    {format(new Date(selectedPayslip.payPeriodStart), 'MMM d')} -{' '}
                    {format(new Date(selectedPayslip.payPeriodEnd), 'MMM d, yyyy')}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedPayslip && (
              <div className="space-y-6">
                {/* Hours Summary */}
                <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-lg font-medium">
                      {parseFloat(selectedPayslip.payrollRunLine.regularHours).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Regular Hours</div>
                  </div>
                  <div>
                    <div className="text-lg font-medium">
                      {parseFloat(selectedPayslip.payrollRunLine.overtimeHours).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Overtime Hours</div>
                  </div>
                  <div>
                    <div className="text-lg font-medium text-primary">
                      {parseFloat(selectedPayslip.payrollRunLine.paidHours).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Paid</div>
                  </div>
                </div>

                {/* Component Breakdown */}
                {Object.entries(groupedItems).length > 0 && (
                  <div className="space-y-4">
                    {['EARNING', 'DEDUCTION_PRE', 'TAX', 'DEDUCTION_POST', 'EMPLOYER_CONTRIB'].map(
                      (type) => {
                        const items = groupedItems[type];
                        if (!items || items.length === 0) return null;

                        const subtotal = items.reduce(
                          (sum, item) => sum + parseFloat(item.amount),
                          0
                        );

                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge className={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                              <span className="font-medium">
                                {type === 'EARNING' || type === 'EMPLOYER_CONTRIB' ? '' : '-'}
                                {subtotal.toLocaleString()}
                              </span>
                            </div>
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between text-sm pl-4 py-1"
                              >
                                <span>{item.componentName}</span>
                                <span>{parseFloat(item.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}

                {/* Calculation Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Gross Earnings</span>
                    <span>{parseFloat(selectedPayslip.grossEarnings).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>Pre-Tax Deductions</span>
                    <span>-{parseFloat(selectedPayslip.preTaxDeductions).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Taxes Withheld</span>
                    <span>-{parseFloat(selectedPayslip.taxesWithheld).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-purple-600">
                    <span>Post-Tax Deductions</span>
                    <span>-{parseFloat(selectedPayslip.postTaxDeductions).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Net Pay</span>
                    <span className="text-green-600">
                      {parseFloat(selectedPayslip.netPay).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
