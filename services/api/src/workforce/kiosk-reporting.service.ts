/**
 * M10.21: Kiosk Reporting Service
 *
 * KPIs and exports for kiosk timeclock operations.
 * Follows H6 (export hash pattern from M10.20).
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class KioskReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get kiosk usage KPIs.
   */
  async getKpis(
    orgId: string,
    options: {
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const where: any = { orgId };
    if (options.branchId) where.branchId = options.branchId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    // Device stats
    const deviceWhere: any = { orgId };
    if (options.branchId) deviceWhere.branchId = options.branchId;

    const [devices, clockEvents, pinAttempts, sessions] = await Promise.all([
      // Device counts
      this.prisma.client.kioskDevice.groupBy({
        by: ['enabled'],
        where: deviceWhere,
        _count: { id: true },
      }),
      // Clock events by type
      this.prisma.client.kioskClockEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { id: true },
      }),
      // PIN attempts (success/fail)
      this.prisma.client.kioskPinAttempt.groupBy({
        by: ['success'],
        where,
        _count: { id: true },
      }),
      // Session counts
      this.prisma.client.kioskDeviceSession.aggregate({
        where: options.branchId
          ? { kioskDevice: { orgId, branchId: options.branchId } }
          : { kioskDevice: { orgId } },
        _count: { id: true },
      }),
    ]);

    // Calculate device stats
    const totalDevices = devices.reduce((sum, d) => sum + d._count.id, 0);
    const enabledDevices = devices.find(d => d.enabled)?._count.id ?? 0;
    const disabledDevices = devices.find(d => !d.enabled)?._count.id ?? 0;

    // Calculate clock events by type
    const clockEventsByType: Record<string, number> = {};
    for (const e of clockEvents) {
      clockEventsByType[e.eventType] = e._count.id;
    }

    // Calculate PIN stats
    const successfulPins = pinAttempts.find(p => p.success)?._count.id ?? 0;
    const failedPins = pinAttempts.find(p => !p.success)?._count.id ?? 0;
    const totalPins = successfulPins + failedPins;
    const pinSuccessRate = totalPins > 0 ? Math.round((successfulPins / totalPins) * 100) / 100 : 0;

    return {
      devices: {
        total: totalDevices,
        enabled: enabledDevices,
        disabled: disabledDevices,
      },
      sessions: {
        total: sessions._count.id,
      },
      clockEvents: {
        total: Object.values(clockEventsByType).reduce((sum, n) => sum + n, 0),
        byType: clockEventsByType,
      },
      pinAttempts: {
        total: totalPins,
        successful: successfulPins,
        failed: failedPins,
        successRate: pinSuccessRate,
      },
    };
  }

  /**
   * Export kiosk clock events to CSV.
   * H6: Follows M10.20 export pattern with UTF-8 BOM and SHA-256 hash trailer.
   */
  async exportClockEvents(
    orgId: string,
    options: {
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ csv: string; filename: string; count: number }> {
    const where: any = { orgId };
    if (options.branchId) where.branchId = options.branchId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const events = await this.prisma.client.kioskClockEvent.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        branch: { select: { name: true } },
        kioskDevice: { select: { name: true, publicId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build CSV
    const header = [
      'Event ID',
      'Date/Time',
      'Event Type',
      'Employee Name',
      'Employee Email',
      'Branch',
      'Kiosk Device',
      'Kiosk Public ID',
      'Time Entry ID',
      'Break Entry ID',
      'Geo Blocked',
      'Geo Overridden',
      'IP Address',
    ].join(',');

    const rows = events.map(e => {
      return [
        e.id,
        e.createdAt.toISOString(),
        e.eventType,
        `"${e.user.firstName} ${e.user.lastName}"`,
        e.user.email,
        `"${e.branch.name}"`,
        `"${e.kioskDevice.name}"`,
        e.kioskDevice.publicId,
        e.timeEntryId ?? '',
        e.breakEntryId ?? '',
        e.geoBlocked ? 'Yes' : 'No',
        e.geoOverridden ? 'Yes' : 'No',
        e.ipAddress ?? '',
      ].join(',');
    });

    // H6: Build content with proper format
    const content = [header, ...rows].join('\r\n');

    // Calculate SHA-256 hash (of content without BOM)
    const hash = createHash('sha256').update(content).digest('hex');
    const trailer = `# SHA-256: ${hash}`;

    // Add UTF-8 BOM
    const BOM = '\uFEFF';
    const csv = BOM + content + '\r\n' + trailer;

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `kiosk-events-${timestamp}.csv`;

    return { csv, filename, count: events.length };
  }

  /**
   * Get device activity report.
   */
  async getDeviceActivity(
    orgId: string,
    options: {
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const where: any = { orgId };
    if (options.branchId) where.branchId = options.branchId;

    const devices = await this.prisma.client.kioskDevice.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: {
          select: {
            sessions: true,
            clockEvents: true,
            pinAttempts: true,
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Get event counts by device within date range
    const eventWhere: any = { orgId };
    if (options.startDate || options.endDate) {
      eventWhere.createdAt = {};
      if (options.startDate) eventWhere.createdAt.gte = options.startDate;
      if (options.endDate) eventWhere.createdAt.lte = options.endDate;
    }

    const eventsByDevice = await this.prisma.client.kioskClockEvent.groupBy({
      by: ['kioskDeviceId'],
      where: eventWhere,
      _count: { id: true },
    });

    const eventsMap = new Map(eventsByDevice.map(e => [e.kioskDeviceId, e._count.id]));

    return devices.map(d => ({
      id: d.id,
      name: d.name,
      publicId: d.publicId,
      branch: d.branch,
      enabled: d.enabled,
      lastSeenAt: d.lastSeenAt,
      stats: {
        totalSessions: d._count.sessions,
        totalClockEvents: d._count.clockEvents,
        totalPinAttempts: d._count.pinAttempts,
        recentClockEvents: eventsMap.get(d.id) ?? 0,
      },
    }));
  }

  /**
   * Get top users by kiosk usage.
   */
  async getTopUsers(
    orgId: string,
    options: {
      branchId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {},
  ) {
    const where: any = { orgId };
    if (options.branchId) where.branchId = options.branchId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const userCounts = await this.prisma.client.kioskClockEvent.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: options.limit ?? 10,
    });

    // Get user details
    const userIds = userCounts.map(u => u.userId);
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const usersMap = new Map(users.map(u => [u.id, u]));

    return userCounts.map(uc => ({
      user: usersMap.get(uc.userId),
      eventCount: uc._count.id,
    }));
  }
}
