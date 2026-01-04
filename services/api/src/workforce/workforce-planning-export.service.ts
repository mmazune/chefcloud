/**
 * M10.12: Workforce Planning Export Service
 *
 * CSV exports for forecast, plan, variance, and alerts.
 * Uses UTF-8 BOM for Excel compatibility.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkforcePlanningService } from './workforce-planning.service';

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF';

@Injectable()
export class WorkforcePlanningExportService {
  private readonly logger = new Logger(WorkforcePlanningExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planningService: WorkforcePlanningService,
  ) {}

  /**
   * Export forecast snapshot as CSV
   */
  async exportForecastCsv(orgId: string, branchId: string, date: Date): Promise<string> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const snapshot = await this.prisma.client.laborForecastSnapshot.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
    });

    if (!snapshot) {
      // Return empty CSV with headers
      return UTF8_BOM + 'Hour,CoversForecast,OrdersForecast\n';
    }

    const totals = snapshot.totalsJson as {
      coversForecast: number[];
      ordersForecast: number[];
    };

    const headers = ['Hour', 'CoversForecast', 'OrdersForecast'];
    const rows: string[] = [headers.join(',')];

    for (let hour = 0; hour < 24; hour++) {
      rows.push([
        hour,
        totals.coversForecast[hour] || 0,
        totals.ordersForecast[hour] || 0,
      ].join(','));
    }

    this.logger.log(`Exported forecast CSV for ${branchId} on ${dateOnly.toISOString()}`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Export staffing plan as CSV
   */
  async exportPlanCsv(orgId: string, branchId: string, date: Date): Promise<string> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const plan = await this.prisma.client.staffingPlan.findFirst({
      where: { orgId, branchId, date: dateOnly },
      orderBy: { generatedAt: 'desc' },
      include: { lines: true },
    });

    if (!plan || plan.lines.length === 0) {
      return UTF8_BOM + 'Hour,RoleKey,SuggestedHeadcount\n';
    }

    const headers = ['Hour', 'RoleKey', 'SuggestedHeadcount'];
    const rows: string[] = [headers.join(',')];

    for (const line of plan.lines) {
      rows.push([
        line.hour,
        this.escapeCsvValue(line.roleKey),
        line.suggestedHeadcount,
      ].join(','));
    }

    this.logger.log(`Exported plan CSV for ${branchId} on ${dateOnly.toISOString()}: ${plan.lines.length} lines`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Export variance report as CSV
   */
  async exportVarianceCsv(orgId: string, branchId: string, date: Date): Promise<string> {
    const variance = await this.planningService.getVariance(orgId, branchId, date);

    if (variance.length === 0) {
      return UTF8_BOM + 'Hour,RoleKey,ScheduledCount,SuggestedCount,Delta\n';
    }

    const headers = ['Hour', 'RoleKey', 'ScheduledCount', 'SuggestedCount', 'Delta'];
    const rows: string[] = [headers.join(',')];

    for (const v of variance) {
      rows.push([
        v.hour,
        this.escapeCsvValue(v.roleKey),
        v.scheduledCount,
        v.suggestedCount,
        v.delta,
      ].join(','));
    }

    this.logger.log(`Exported variance CSV for ${branchId}: ${variance.length} rows`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Export alerts as CSV
   */
  async exportAlertsCsv(orgId: string, branchId: string, date: Date): Promise<string> {
    const dateOnly = new Date(date.toISOString().split('T')[0]);
    const alerts = await this.prisma.client.staffingAlert.findMany({
      where: { orgId, branchId, date: dateOnly },
      orderBy: [{ hour: 'asc' }],
    });

    if (alerts.length === 0) {
      return UTF8_BOM + 'Hour,Severity,Type,ScheduledCount,SuggestedCount,Delta,ResolvedAt\n';
    }

    const headers = ['Hour', 'Severity', 'Type', 'ScheduledCount', 'SuggestedCount', 'Delta', 'ResolvedAt'];
    const rows: string[] = [headers.join(',')];

    for (const a of alerts) {
      const payload = a.payloadJson as {
        scheduledCount?: number;
        suggestedCount?: number;
        delta?: number;
      };
      rows.push([
        a.hour,
        a.severity,
        a.type,
        payload.scheduledCount ?? '',
        payload.suggestedCount ?? '',
        payload.delta ?? '',
        a.resolvedAt ? a.resolvedAt.toISOString() : '',
      ].join(','));
    }

    this.logger.log(`Exported alerts CSV for ${branchId}: ${alerts.length} rows`);
    return UTF8_BOM + rows.join('\n');
  }

  /**
   * Escape CSV value (handle quotes, commas, newlines)
   */
  private escapeCsvValue(value: unknown): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
