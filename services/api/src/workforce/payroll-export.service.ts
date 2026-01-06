/**
 * M10.7: Payroll Export Service
 * 
 * CSV exports for payroll runs, payslips, and employer costs.
 * Deterministic ordering for consistency.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF';

@Injectable()
export class PayrollExportService {
  private readonly logger = new Logger(PayrollExportService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Export payroll run summary CSV
   */
  async exportRunSummaryCsv(orgId: string, payrollRunId: string): Promise<string> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: payrollRunId, orgId },
      include: {
        payPeriod: true,
        branch: { select: { id: true, name: true } },
        payslips: {
          orderBy: { userId: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    const headers = [
      'PayrollRunId',
      'PayPeriodStart',
      'PayPeriodEnd',
      'Branch',
      'Status',
      'EmployeeId',
      'EmployeeName',
      'EmployeeEmail',
      'GrossEarnings',
      'PreTaxDeductions',
      'TaxableWages',
      'TaxesWithheld',
      'PostTaxDeductions',
      'NetPay',
      'EmployerContribTotal',
      'TotalEmployerCost',
    ];

    const rows: string[] = [headers.join(',')];

    for (const payslip of run.payslips) {
      const row = [
        run.id,
        run.payPeriod.startDate.toISOString().split('T')[0],
        run.payPeriod.endDate.toISOString().split('T')[0],
        run.branch?.name ?? 'All Branches',
        run.status,
        payslip.user.id,
        `${payslip.user.firstName} ${payslip.user.lastName}`,
        payslip.user.email,
        payslip.grossEarnings.toFixed(2),
        payslip.preTaxDeductions.toFixed(2),
        payslip.taxableWages.toFixed(2),
        payslip.taxesWithheld.toFixed(2),
        payslip.postTaxDeductions.toFixed(2),
        payslip.netPay.toFixed(2),
        payslip.employerContribTotal.toFixed(2),
        payslip.totalEmployerCost.toFixed(2),
      ];

      rows.push(row.map(v => this.escapeCsvValue(v)).join(','));
    }

    this.logger.log(`Exported run summary for ${payrollRunId}: ${run.payslips.length} rows`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Export payslip line items CSV (per employee per component)
   */
  async exportPayslipDetailsCsv(orgId: string, payrollRunId: string): Promise<string> {
    const payslips = await this.prisma.client.payslip.findMany({
      where: { orgId, payrollRunId },
      orderBy: { userId: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        lineItems: {
          orderBy: [{ type: 'asc' }, { componentCode: 'asc' }],
        },
        payrollRun: {
          select: {
            payPeriod: true,
            branch: { select: { name: true } },
          },
        },
      },
    });

    if (!payslips.length) {
      throw new NotFoundException('No payslips found for this run');
    }

    const headers = [
      'PayrollRunId',
      'PayPeriodStart',
      'PayPeriodEnd',
      'Branch',
      'EmployeeId',
      'EmployeeName',
      'EmployeeEmail',
      'ComponentCode',
      'ComponentName',
      'ComponentType',
      'Amount',
    ];

    const rows: string[] = [headers.join(',')];

    for (const payslip of payslips) {
      for (const item of payslip.lineItems) {
        const row = [
          payrollRunId,
          payslip.payrollRun.payPeriod.startDate.toISOString().split('T')[0],
          payslip.payrollRun.payPeriod.endDate.toISOString().split('T')[0],
          payslip.payrollRun.branch?.name ?? 'All Branches',
          payslip.user.id,
          `${payslip.user.firstName} ${payslip.user.lastName}`,
          payslip.user.email,
          item.componentCode,
          item.componentName,
          item.type,
          item.amount.toFixed(2),
        ];

        rows.push(row.map(v => this.escapeCsvValue(v)).join(','));
      }
    }

    this.logger.log(`Exported payslip details for ${payrollRunId}: ${rows.length - 1} rows`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Export employer cost CSV (for accounting reconciliation)
   */
  async exportEmployerCostCsv(orgId: string, payrollRunId: string): Promise<string> {
    const run = await this.prisma.client.payrollRun.findFirst({
      where: { id: payrollRunId, orgId },
      include: {
        payPeriod: true,
        branch: { select: { id: true, name: true } },
        payslips: {
          orderBy: { userId: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            lineItems: {
              where: { type: 'EMPLOYER_CONTRIB' },
              orderBy: { componentCode: 'asc' },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }

    const headers = [
      'PayrollRunId',
      'PayPeriodStart',
      'PayPeriodEnd',
      'Branch',
      'EmployeeId',
      'EmployeeName',
      'GrossEarnings',
      'EmployerContribCode',
      'EmployerContribName',
      'EmployerContribAmount',
      'TotalEmployerCost',
    ];

    const rows: string[] = [headers.join(',')];

    for (const payslip of run.payslips) {
      if (payslip.lineItems.length === 0) {
        // No employer contributions, still include for completeness
        const row = [
          run.id,
          run.payPeriod.startDate.toISOString().split('T')[0],
          run.payPeriod.endDate.toISOString().split('T')[0],
          run.branch?.name ?? 'All Branches',
          payslip.user.id,
          `${payslip.user.firstName} ${payslip.user.lastName}`,
          payslip.grossEarnings.toFixed(2),
          '',
          '',
          '0.00',
          payslip.totalEmployerCost.toFixed(2),
        ];
        rows.push(row.map(v => this.escapeCsvValue(v)).join(','));
      } else {
        for (const item of payslip.lineItems) {
          const row = [
            run.id,
            run.payPeriod.startDate.toISOString().split('T')[0],
            run.payPeriod.endDate.toISOString().split('T')[0],
            run.branch?.name ?? 'All Branches',
            payslip.user.id,
            `${payslip.user.firstName} ${payslip.user.lastName}`,
            payslip.grossEarnings.toFixed(2),
            item.componentCode,
            item.componentName,
            item.amount.toFixed(2),
            payslip.totalEmployerCost.toFixed(2),
          ];
          rows.push(row.map(v => this.escapeCsvValue(v)).join(','));
        }
      }
    }

    this.logger.log(`Exported employer cost for ${payrollRunId}: ${rows.length - 1} rows`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Escape CSV value (handle quotes and commas)
   */
  private escapeCsvValue(value: any): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
