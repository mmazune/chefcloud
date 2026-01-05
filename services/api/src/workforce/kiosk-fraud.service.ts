/**
 * M10.22: Kiosk Fraud Service
 *
 * Fraud detection and prevention:
 * - PIN attempt tracking (never store raw PIN, H4)
 * - Sliding window rate limiting via DB (no timers, H3)
 * - Anomaly signal detection
 * - Fair rate limiting (success resets don't penalize, H6)
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';
import { WorkforceAuditService, WorkforceAuditAction } from './workforce-audit.service';

export interface FraudMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  invalidAttempts: number;
  blockedAttempts: number;
  successRate: number;
  byDevice: Record<string, {
    total: number;
    invalid: number;
    blocked: number;
  }>;
  anomalies: AnomalySignal[];
}

export interface AnomalySignal {
  type: 'HIGH_INVALID_RATE' | 'HIGH_OVERRIDES' | 'OUTSIDE_HOURS';
  deviceId?: string;
  branchId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  value: number;
  threshold: number;
}

@Injectable()
export class KioskFraudService {
  private readonly logger = new Logger(KioskFraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: WorkforceAuditService,
  ) {}

  /**
   * Log a PIN attempt (never store raw PIN, H4).
   */
  async logPinAttempt(
    orgId: string,
    branchId: string,
    kioskDeviceId: string,
    pin: string,
    success: boolean,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    // Mask PIN: show only last 2 digits (H4)
    const pinMasked = pin.length >= 2
      ? '*'.repeat(pin.length - 2) + pin.slice(-2)
      : '****';

    await this.prisma.client.kioskPinAttempt.create({
      data: {
        orgId,
        branchId,
        kioskDeviceId,
        pinMasked,
        success,
        userId,
        ipAddress,
      },
    });
  }

  /**
   * Check if device should be rate limited.
   * Uses DB sliding window query (no timers, H3).
   * Fair: counts invalid attempts only (H6).
   */
  async checkRateLimit(
    orgId: string,
    kioskDeviceId: string,
  ): Promise<{ blocked: boolean; remainingAttempts: number }> {
    // Get policy limits
    const policy = await this.prisma.client.workforcePolicy.findFirst({
      where: { orgId },
    });

    const maxPerMinute = policy?.kioskPinRateLimitPerMinute ?? 5;
    const maxInvalidPerMinute = policy?.kioskMaxInvalidPinsPerMinute ?? 10;

    // Count invalid attempts in last minute (sliding window via DB)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const invalidCount = await this.prisma.client.kioskPinAttempt.count({
      where: {
        kioskDeviceId,
        success: false,
        attemptedAt: { gte: oneMinuteAgo },
      },
    });

    const blocked = invalidCount >= maxInvalidPerMinute;
    const remainingAttempts = Math.max(0, maxInvalidPerMinute - invalidCount);

    if (blocked) {
      // Get device for audit
      const device = await this.prisma.client.kioskDevice.findUnique({
        where: { id: kioskDeviceId },
      });

      if (device) {
        await this.auditService.logAction({
          orgId,
          performedById: 'SYSTEM',
          action: WorkforceAuditAction.KIOSK_FRAUD_BLOCKED,
          entityType: 'KioskDevice',
          entityId: kioskDeviceId,
          payload: {
            description: `Device blocked: ${invalidCount} invalid PIN attempts in 1 minute`,
            kioskDeviceId,
            branchId: device.branchId,
            invalidCount,
            threshold: maxInvalidPerMinute,
          },
        });
      }
    }

    return { blocked, remainingAttempts };
  }

  /**
   * Get fraud metrics for reporting.
   */
  async getFraudMetrics(
    orgId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      branchId?: string;
    },
  ): Promise<FraudMetrics> {
    const from = options?.startDate;
    const to = options?.endDate;
    const branchId = options?.branchId;

    const where = {
      orgId,
      ...(branchId ? { branchId } : {}),
      ...(from && to ? { attemptedAt: { gte: from, lte: to } } : {}),
    };

    // Get attempt counts
    const [total, successful, invalid] = await Promise.all([
      this.prisma.client.kioskPinAttempt.count({ where }),
      this.prisma.client.kioskPinAttempt.count({ where: { ...where, success: true } }),
      this.prisma.client.kioskPinAttempt.count({ where: { ...where, success: false } }),
    ]);

    // Get by-device breakdown
    const deviceAttempts = await this.prisma.client.kioskPinAttempt.groupBy({
      by: ['kioskDeviceId'],
      where,
      _count: { id: true },
    });

    const deviceInvalid = await this.prisma.client.kioskPinAttempt.groupBy({
      by: ['kioskDeviceId'],
      where: { ...where, success: false },
      _count: { id: true },
    });

    const byDevice: Record<string, { total: number; invalid: number; blocked: number }> = {};

    for (const d of deviceAttempts) {
      byDevice[d.kioskDeviceId] = {
        total: d._count.id,
        invalid: 0,
        blocked: 0,
      };
    }

    for (const d of deviceInvalid) {
      if (byDevice[d.kioskDeviceId]) {
        byDevice[d.kioskDeviceId].invalid = d._count.id;
      }
    }

    // Detect anomalies
    const anomalies = await this.detectAnomalies(orgId, from, to, branchId);

    // Count blocked attempts (rejected events with RATE_LIMITED code)
    const blockedAttempts = await this.prisma.client.kioskEvent.count({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        ...(from && to ? { receivedAt: { gte: from, lte: to } } : {}),
        rejectCode: 'RATE_LIMITED',
      },
    });

    return {
      totalAttempts: total,
      successfulAttempts: successful,
      invalidAttempts: invalid,
      blockedAttempts,
      successRate: total > 0 ? successful / total : 0,
      byDevice,
      anomalies,
    };
  }

  /**
   * Detect anomaly signals.
   */
  private async detectAnomalies(
    orgId: string,
    from?: Date,
    to?: Date,
    branchId?: string,
  ): Promise<AnomalySignal[]> {
    const anomalies: AnomalySignal[] = [];

    const where = {
      orgId,
      ...(branchId ? { branchId } : {}),
      ...(from && to ? { attemptedAt: { gte: from, lte: to } } : {}),
    };

    // Check for devices with high invalid rate (>50%)
    const deviceStats = await this.prisma.client.kioskPinAttempt.groupBy({
      by: ['kioskDeviceId'],
      where,
      _count: { id: true },
    });

    const deviceInvalidStats = await this.prisma.client.kioskPinAttempt.groupBy({
      by: ['kioskDeviceId'],
      where: { ...where, success: false },
      _count: { id: true },
    });

    const invalidByDevice: Record<string, number> = {};
    for (const d of deviceInvalidStats) {
      invalidByDevice[d.kioskDeviceId] = d._count.id;
    }

    for (const device of deviceStats) {
      const total = device._count.id;
      const invalid = invalidByDevice[device.kioskDeviceId] || 0;
      const invalidRate = total > 0 ? invalid / total : 0;

      if (total >= 10 && invalidRate > 0.5) {
        anomalies.push({
          type: 'HIGH_INVALID_RATE',
          deviceId: device.kioskDeviceId,
          severity: invalidRate > 0.8 ? 'HIGH' : invalidRate > 0.6 ? 'MEDIUM' : 'LOW',
          description: `Device has ${(invalidRate * 100).toFixed(1)}% invalid PIN rate`,
          value: invalidRate,
          threshold: 0.5,
        });
      }
    }

    // Check for branches with high override rate
    const overrideEvents = await this.prisma.client.kioskClockEvent.groupBy({
      by: ['branchId'],
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        geoOverridden: true,
        ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
      },
      _count: { id: true },
    });

    const totalEvents = await this.prisma.client.kioskClockEvent.groupBy({
      by: ['branchId'],
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        ...(from && to ? { createdAt: { gte: from, lte: to } } : {}),
      },
      _count: { id: true },
    });

    const totalByBranch: Record<string, number> = {};
    for (const b of totalEvents) {
      totalByBranch[b.branchId] = b._count.id;
    }

    for (const override of overrideEvents) {
      const total = totalByBranch[override.branchId] || 0;
      const overrideRate = total > 0 ? override._count.id / total : 0;

      if (total >= 10 && overrideRate > 0.2) {
        anomalies.push({
          type: 'HIGH_OVERRIDES',
          branchId: override.branchId,
          severity: overrideRate > 0.5 ? 'HIGH' : overrideRate > 0.3 ? 'MEDIUM' : 'LOW',
          description: `Branch has ${(overrideRate * 100).toFixed(1)}% override rate`,
          value: overrideRate,
          threshold: 0.2,
        });
      }
    }

    return anomalies;
  }

  /**
   * Export PIN attempts to CSV with hash (H5).
   */
  async exportAttempts(
    orgId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      branchId?: string;
    },
  ): Promise<{ csv: string; sha256: string }> {
    const from = options?.startDate;
    const to = options?.endDate;
    const branchId = options?.branchId;

    const attempts = await this.prisma.client.kioskPinAttempt.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        ...(from && to ? { attemptedAt: { gte: from, lte: to } } : {}),
      },
      include: {
        kioskDevice: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { attemptedAt: 'asc' },
    });

    // Build CSV with BOM for UTF-8
    const bom = '\uFEFF';
    const headers = ['Timestamp', 'Device', 'Branch', 'PIN (masked)', 'Success', 'User', 'IP Address'];
    const rows = attempts.map(a => [
      a.attemptedAt.toISOString(),
      a.kioskDevice?.name || a.kioskDeviceId,
      a.branch?.name || a.branchId,
      a.pinMasked,
      a.success ? 'Yes' : 'No',
      a.user ? `${a.user.firstName} ${a.user.lastName}` : '',
      a.ipAddress || '',
    ]);

    // Normalize line endings to LF (H5)
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const csv = bom + csvContent;

    // Compute hash on normalized content (H5)
    const sha256 = createHash('sha256').update(csvContent).digest('hex');

    return { csv, sha256 };
  }
}
