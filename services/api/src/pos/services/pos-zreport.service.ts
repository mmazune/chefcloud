/**
 * M13.5: Z-Report Service (End-of-Day Reporting)
 *
 * Provides summary reports for a business day:
 * - Gross sales
 * - Net sales (after refunds)
 * - Tips
 * - Payment breakdown by method
 * - Order counts
 * - CSV export with SHA-256 hash
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as crypto from 'crypto';

export interface ZReportData {
  reportId: string;
  branchId: string;
  reportDate: string; // ISO date YYYY-MM-DD
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
  generatedAt: string; // ISO datetime

  // Sales Summary
  grossSalesCents: number; // Sum of all order totals
  refundsCents: number; // Sum of all refunds
  netSalesCents: number; // Gross - Refunds
  tipsCents: number; // Sum of all tips

  // Order Counts
  totalOrders: number;
  paidOrders: number;
  partiallyPaidOrders: number;
  unpaidOrders: number;
  refundedOrders: number;
  voidedOrders: number;

  // Payment Breakdown by Method
  paymentsByMethod: {
    method: string;
    count: number;
    amountCents: number;
    tipsCents: number;
  }[];

  // Payment Provider Breakdown
  paymentsByProvider: {
    provider: string;
    count: number;
    amountCents: number;
  }[];
}

@Injectable()
export class PosZReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate Z-Report for a specific date
   */
  async generateZReport(
    branchId: string,
    orgId: string,
    date: string, // YYYY-MM-DD
  ): Promise<ZReportData> {
    // Validate branch access
    const branch = await this.prisma.client.branch.findFirst({
      where: {
        id: branchId,
        orgId,
      },
    });

    if (!branch) {
      throw new BadRequestException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or access denied',
      });
    }

    // Parse date and create time range
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException({
        code: 'INVALID_DATE_FORMAT',
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    const periodStart = new Date(`${date}T00:00:00.000Z`);
    const periodEnd = new Date(`${date}T23:59:59.999Z`);

    // Fetch orders for the date range
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        payments: true,
      },
    });

    // Calculate sales summary
    let grossSalesCents = 0;
    let refundsCents = 0;
    let tipsCents = 0;
    let paidOrders = 0;
    let partiallyPaidOrders = 0;
    let unpaidOrders = 0;
    let refundedOrders = 0;
    let voidedOrders = 0;

    // Track payment methods and providers
    const methodTotals: Record<string, { count: number; amountCents: number; tipsCents: number }> = {};
    const providerTotals: Record<string, { count: number; amountCents: number }> = {};

    for (const order of orders) {
      const orderTotalCents = Math.round(Number(order.total) * 100);
      grossSalesCents += orderTotalCents;

      // Count by payment status
      switch (order.paymentStatus) {
        case 'PAID':
          paidOrders++;
          break;
        case 'PARTIALLY_PAID':
          partiallyPaidOrders++;
          break;
        case 'UNPAID':
          unpaidOrders++;
          break;
        case 'REFUNDED':
          refundedOrders++;
          break;
      }

      // Count voided orders separately
      if (order.status === 'VOIDED') {
        voidedOrders++;
      }

      // Process payments
      for (const payment of order.payments) {
        if (payment.posStatus === 'CAPTURED' || payment.posStatus === 'REFUNDED') {
          const netCaptured = payment.capturedCents - payment.refundedCents;
          refundsCents += payment.refundedCents;
          tipsCents += payment.tipCents;

          // Track by method
          const method = payment.method;
          if (!methodTotals[method]) {
            methodTotals[method] = { count: 0, amountCents: 0, tipsCents: 0 };
          }
          methodTotals[method].count++;
          methodTotals[method].amountCents += netCaptured;
          methodTotals[method].tipsCents += payment.tipCents;

          // Track by provider
          const provider = payment.provider;
          if (!providerTotals[provider]) {
            providerTotals[provider] = { count: 0, amountCents: 0 };
          }
          providerTotals[provider].count++;
          providerTotals[provider].amountCents += netCaptured;
        }
      }
    }

    const netSalesCents = grossSalesCents - refundsCents;

    // Convert maps to arrays
    const paymentsByMethod = Object.entries(methodTotals).map(([method, data]) => ({
      method,
      ...data,
    }));

    const paymentsByProvider = Object.entries(providerTotals).map(([provider, data]) => ({
      provider,
      ...data,
    }));

    const reportId = `zr-${branchId.substring(0, 8)}-${date}`;

    return {
      reportId,
      branchId,
      reportDate: date,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      grossSalesCents,
      refundsCents,
      netSalesCents,
      tipsCents,
      totalOrders: orders.length,
      paidOrders,
      partiallyPaidOrders,
      unpaidOrders,
      refundedOrders,
      voidedOrders,
      paymentsByMethod,
      paymentsByProvider,
    };
  }

  /**
   * Generate Z-Report as CSV with SHA-256 hash
   */
  async generateZReportCsv(
    branchId: string,
    orgId: string,
    date: string,
  ): Promise<{ csv: Buffer; hash: string; filename: string }> {
    const report = await this.generateZReport(branchId, orgId, date);

    // Build CSV content
    const lines: string[] = [];

    // Header with UTF-8 BOM
    lines.push('Z-Report Export');
    lines.push(`Report ID,${report.reportId}`);
    lines.push(`Branch ID,${report.branchId}`);
    lines.push(`Report Date,${report.reportDate}`);
    lines.push(`Period Start,${report.periodStart}`);
    lines.push(`Period End,${report.periodEnd}`);
    lines.push(`Generated At,${report.generatedAt}`);
    lines.push('');

    // Sales Summary
    lines.push('=== Sales Summary ===');
    lines.push(`Gross Sales,$${(report.grossSalesCents / 100).toFixed(2)}`);
    lines.push(`Refunds,$${(report.refundsCents / 100).toFixed(2)}`);
    lines.push(`Net Sales,$${(report.netSalesCents / 100).toFixed(2)}`);
    lines.push(`Tips,$${(report.tipsCents / 100).toFixed(2)}`);
    lines.push('');

    // Order Counts
    lines.push('=== Order Counts ===');
    lines.push(`Total Orders,${report.totalOrders}`);
    lines.push(`Paid Orders,${report.paidOrders}`);
    lines.push(`Partially Paid Orders,${report.partiallyPaidOrders}`);
    lines.push(`Unpaid Orders,${report.unpaidOrders}`);
    lines.push(`Refunded Orders,${report.refundedOrders}`);
    lines.push(`Voided Orders,${report.voidedOrders}`);
    lines.push('');

    // Payment Breakdown by Method
    lines.push('=== Payments by Method ===');
    lines.push('Method,Count,Amount,Tips');
    for (const pm of report.paymentsByMethod) {
      lines.push(`${pm.method},${pm.count},$${(pm.amountCents / 100).toFixed(2)},$${(pm.tipsCents / 100).toFixed(2)}`);
    }
    lines.push('');

    // Payment Breakdown by Provider
    lines.push('=== Payments by Provider ===');
    lines.push('Provider,Count,Amount');
    for (const pp of report.paymentsByProvider) {
      lines.push(`${pp.provider},${pp.count},$${(pp.amountCents / 100).toFixed(2)}`);
    }

    // Join with CRLF for Windows compatibility, add UTF-8 BOM
    const csvContent = lines.join('\r\n');
    const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const csvBuffer = Buffer.concat([utf8Bom, Buffer.from(csvContent, 'utf8')]);

    // Calculate SHA-256 hash
    const hash = crypto.createHash('sha256').update(csvBuffer).digest('hex');

    const filename = `z-report-${report.branchId.substring(0, 8)}-${date}.csv`;

    return { csv: csvBuffer, hash, filename };
  }
}
