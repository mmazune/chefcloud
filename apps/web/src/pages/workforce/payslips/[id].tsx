/**
 * M10.7: Payslip Detail Page
 * 
 * View detailed payslip with component breakdown.
 * RBAC: L3+ can view (L3 only own, L4+ all)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { format } from 'date-fns';
import { ArrowLeft, Download, User, Clock } from 'lucide-react';
import Link from 'next/link';

interface PayslipLineItem {
  id: string;
  componentCode: string;
  componentName: string;
  type: string;
  amount: string;
}

interface Payslip {
  id: string;
  userId: string;
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
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  payrollRun: {
    id: string;
    status: string;
    branchId?: string;
    payPeriod: {
      name: string;
    };
  };
  payrollRunLine: {
    regularHours: string;
    overtimeHours: string;
    breakHours: string;
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

export default function PayslipDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check role access
  const canView = user?.roleLevel === 'L3' || user?.roleLevel === 'L4' || user?.roleLevel === 'L5';

  useEffect(() => {
    if (!id || !canView) return;
    fetchPayslip();
  }, [id, canView]);

  const fetchPayslip = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/workforce/payslips/${id}`);
      setPayslip(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payslip');
    } finally {
      setLoading(false);
    }
  };

  // Group line items by type
  const groupedItems = payslip?.lineItems.reduce((acc, item) => {
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
          You don&apos;t have permission to view this page.
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Loading payslip...</div>
      </AppShell>
    );
  }

  if (error || !payslip) {
    return (
      <AppShell>
        <div className="p-8">
          <div className="text-center text-destructive">{error || 'Payslip not found'}</div>
          <div className="text-center mt-4">
            <Link href="/workforce/payslips">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payslips
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/workforce/payslips">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Payslip</h1>
              <p className="text-muted-foreground">
                {format(new Date(payslip.payPeriodStart), 'MMM d')} -{' '}
                {format(new Date(payslip.payPeriodEnd), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Employee & Period Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Employee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {payslip.user.firstName} {payslip.user.lastName}
              </div>
              <div className="text-sm text-muted-foreground">{payslip.user.email}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hours Worked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-medium">
                    {parseFloat(payslip.payrollRunLine.regularHours).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Regular</div>
                </div>
                <div>
                  <div className="text-lg font-medium">
                    {parseFloat(payslip.payrollRunLine.overtimeHours).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Overtime</div>
                </div>
                <div>
                  <div className="text-lg font-medium text-primary">
                    {parseFloat(payslip.payrollRunLine.paidHours).toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Paid</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gross Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {parseFloat(payslip.grossEarnings).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                -{(
                  parseFloat(payslip.preTaxDeductions) +
                  parseFloat(payslip.taxesWithheld) +
                  parseFloat(payslip.postTaxDeductions)
                ).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Net Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {parseFloat(payslip.netPay).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Employer Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {parseFloat(payslip.totalEmployerCost).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Component Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Pay Breakdown</CardTitle>
            <CardDescription>Detailed breakdown by component</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(groupedItems).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No component breakdown available
              </div>
            ) : (
              <div className="space-y-6">
                {['EARNING', 'DEDUCTION_PRE', 'TAX', 'DEDUCTION_POST', 'EMPLOYER_CONTRIB'].map(
                  (type) => {
                    const items = groupedItems[type];
                    if (!items || items.length === 0) return null;

                    const subtotal = items.reduce(
                      (sum, item) => sum + parseFloat(item.amount),
                      0
                    );

                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>
                          <span className="font-medium">
                            {type === 'EARNING' || type === 'EMPLOYER_CONTRIB' ? '' : '-'}
                            {subtotal.toLocaleString()}
                          </span>
                        </div>
                        <Table>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="font-medium">{item.componentName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.componentCode}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {parseFloat(item.amount).toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculation Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Calculation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span>Gross Earnings</span>
                <span className="font-medium">
                  {parseFloat(payslip.grossEarnings).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Pre-Tax Deductions</span>
                <span className="text-orange-600">
                  -{parseFloat(payslip.preTaxDeductions).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Taxable Wages</span>
                <span className="font-medium">
                  {parseFloat(payslip.taxableWages).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Taxes Withheld</span>
                <span className="text-red-600">
                  -{parseFloat(payslip.taxesWithheld).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Post-Tax Deductions</span>
                <span className="text-purple-600">
                  -{parseFloat(payslip.postTaxDeductions).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-3 text-lg font-bold">
                <span>Net Pay</span>
                <span className="text-green-600">
                  {parseFloat(payslip.netPay).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
