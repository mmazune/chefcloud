/**
 * M10.22: Kiosk Ops Reporting Service
 *
 * Operational reporting:
 * - Health metrics
 * - Fraud metrics
 * - Event exports with hash (H5)
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { KioskHealthService, HealthMetrics } from './kiosk-health.service';
import { KioskFraudService, FraudMetrics } from './kiosk-fraud.service';

export interface ExportOptions {
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class KioskOpsReportingService {
  private readonly logger = new Logger(KioskOpsReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: KioskHealthService,
    private readonly fraudService: KioskFraudService,
  ) {}

  /**
   * Get health report.
   */
  async getHealthReport(
    orgId: string,
    branchId?: string,
  ): Promise<HealthMetrics> {
    return this.healthService.getHealthMetrics(orgId, branchId);
  }

  /**
   * Get fraud report.
   */
  async getFraudReport(
    orgId: string,
    options?: ExportOptions,
  ): Promise<FraudMetrics> {
    return this.fraudService.getFraudMetrics(orgId, options);
  }

  /**
   * Export events to CSV with BOM and hash (H5).
   */
  async exportEvents(
    orgId: string,
    options?: ExportOptions,
  ): Promise<{ csv: string; sha256: string; count: number }> {
    const branchId = options?.branchId;
    const from = options?.startDate;
    const to = options?.endDate;

    const events = await this.prisma.client.kioskEvent.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        ...(from && to ? { receivedAt: { gte: from, lte: to } } : {}),
      },
      include: {
        kioskDevice: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: [
        { receivedAt: 'asc' },
        { id: 'asc' }, // Stable secondary sort
      ],
    });

    // Build CSV with UTF-8 BOM
    const bom = '\uFEFF';
    const headers = [
      'ID',
      'Received At',
      'Occurred At',
      'Device',
      'Branch',
      'Type',
      'Status',
      'Reject Code',
      'User',
      'Idempotency Key',
      'Time Entry ID',
      'Break Entry ID',
    ];

    const rows = events.map(e => [
      e.id,
      e.receivedAt.toISOString(),
      e.occurredAt.toISOString(),
      e.kioskDevice?.name || e.kioskDeviceId,
      e.branch?.name || e.branchId,
      e.type,
      e.status,
      e.rejectCode || '',
      e.user ? `${e.user.firstName} ${e.user.lastName}` : '',
      e.idempotencyKey,
      e.timeEntryId || '',
      e.breakEntryId || '',
    ]);

    // Escape and join with LF line endings (H5)
    const escapeCell = (val: string): string => {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(escapeCell).join(',')),
    ].join('\n');

    // Compute hash on normalized content (without BOM)
    const sha256 = createHash('sha256').update(csvContent).digest('hex');

    const csv = bom + csvContent;

    return { csv, sha256, count: events.length };
  }

  /**
   * Get event batch history for a device.
   */
  async getBatchHistory(
    kioskDeviceId: string,
    orgId: string,
    limit: number = 50,
  ): Promise<Array<{
    batchId: string;
    eventCount: number;
    acceptedCount: number;
    rejectedCount: number;
    status: string;
    createdAt: Date;
  }>> {
    // Verify device belongs to org
    const device = await this.prisma.client.kioskDevice.findFirst({
      where: { id: kioskDeviceId, orgId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const batches = await this.prisma.client.kioskEventIngest.findMany({
      where: { kioskDeviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return batches.map(b => ({
      batchId: b.batchId,
      eventCount: b.eventCount,
      acceptedCount: b.acceptedCount,
      rejectedCount: b.rejectedCount,
      status: b.status,
      createdAt: b.createdAt,
    }));
  }

  /**
   * Get recent events for a device.
   */
  async getDeviceEvents(
    kioskDeviceId: string,
    orgId: string,
    limit: number = 100,
    status?: 'ACCEPTED' | 'REJECTED' | 'PENDING',
  ): Promise<Array<{
    id: string;
    type: string;
    status: string;
    rejectCode: string | null;
    occurredAt: Date;
    receivedAt: Date;
    idempotencyKey: string;
    userName: string | null;
  }>> {
    // Verify device belongs to org
    const device = await this.prisma.client.kioskDevice.findFirst({
      where: { id: kioskDeviceId, orgId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const events = await this.prisma.client.kioskEvent.findMany({
      where: {
        kioskDeviceId,
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });

    return events.map(e => ({
      id: e.id,
      type: e.type,
      status: e.status,
      rejectCode: e.rejectCode,
      occurredAt: e.occurredAt,
      receivedAt: e.receivedAt,
      idempotencyKey: e.idempotencyKey,
      userName: e.user ? `${e.user.firstName} ${e.user.lastName}` : null,
    }));
  }
}
