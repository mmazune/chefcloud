/**
 * M10.20: Geo-Fence Reporting Service
 *
 * Handles KPI aggregation and CSV export with BOM + SHA-256 hash for data integrity.
 *
 * H4: Export includes UTF-8 BOM and SHA-256 hash in trailer.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF';

export interface GeoFenceReportFilters {
  orgId: string;
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface GeoFenceReportRow {
  date: string;
  branch: string;
  employee: string;
  clockAction: string;
  eventType: string;
  reasonCode: string | null;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  radiusMeters: number | null;
  overrideBy: string | null;
  overrideReason: string | null;
}

@Injectable()
export class GeoFenceReportingService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get detailed geo-fence enforcement report data.
   */
  async getReportData(filters: GeoFenceReportFilters): Promise<GeoFenceReportRow[]> {
    const where: any = { orgId: filters.orgId };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const events = await this.prisma.client.geoFenceEvent.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
        overrideBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return events.map((event) => ({
      date: event.createdAt.toISOString(),
      branch: event.branch.name,
      employee: `${event.user.firstName} ${event.user.lastName}`,
      clockAction: event.clockAction,
      eventType: event.eventType,
      reasonCode: event.reasonCode,
      lat: event.lat ? Number(event.lat) : null,
      lng: event.lng ? Number(event.lng) : null,
      accuracyMeters: event.accuracyMeters ? Number(event.accuracyMeters) : null,
      distanceMeters: event.distanceMeters ? Number(event.distanceMeters) : null,
      radiusMeters: event.radiusMeters,
      overrideBy: event.overrideBy
        ? `${event.overrideBy.firstName} ${event.overrideBy.lastName}`
        : null,
      overrideReason: event.overrideReason,
    }));
  }

  /**
   * Get aggregated KPIs by branch.
   */
  async getBranchKpis(filters: GeoFenceReportFilters) {
    const where: any = { orgId: filters.orgId };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    // Group by branch and event type
    const grouped = await this.prisma.client.geoFenceEvent.groupBy({
      by: ['branchId', 'eventType'],
      where,
      _count: { id: true },
    });

    // Get branch names
    const branchIds = [...new Set(grouped.map((g) => g.branchId))];
    const branches = await this.prisma.client.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    // Aggregate by branch
    const branchKpis = new Map<
      string,
      { name: string; blocked: number; overrides: number; allowed: number }
    >();

    for (const row of grouped) {
      const branchName = branchMap.get(row.branchId) ?? 'Unknown';
      const existing = branchKpis.get(row.branchId) ?? {
        name: branchName,
        blocked: 0,
        overrides: 0,
        allowed: 0,
      };

      if (row.eventType === 'BLOCKED') existing.blocked += row._count.id;
      if (row.eventType === 'OVERRIDE') existing.overrides += row._count.id;
      if (row.eventType === 'ALLOWED') existing.allowed += row._count.id;

      branchKpis.set(row.branchId, existing);
    }

    return Array.from(branchKpis.entries()).map(([branchId, kpis]) => ({
      branchId,
      ...kpis,
      totalAttempts: kpis.blocked + kpis.overrides + kpis.allowed,
      overrideRate:
        kpis.blocked > 0 ? Math.round((kpis.overrides / kpis.blocked) * 100) / 100 : 0,
    }));
  }

  /**
   * Get daily trend data.
   */
  async getDailyTrends(filters: GeoFenceReportFilters) {
    // For daily trends, we need at least start and end date
    if (!filters.startDate || !filters.endDate) {
      const now = new Date();
      filters.endDate = now;
      filters.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    const events = await this.prisma.client.geoFenceEvent.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.branchId && { branchId: filters.branchId }),
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      select: {
        createdAt: true,
        eventType: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyData = new Map<
      string,
      { blocked: number; overrides: number; allowed: number }
    >();

    for (const event of events) {
      const dateKey = event.createdAt.toISOString().split('T')[0];
      const existing = dailyData.get(dateKey) ?? { blocked: 0, overrides: 0, allowed: 0 };

      if (event.eventType === 'BLOCKED') existing.blocked++;
      if (event.eventType === 'OVERRIDE') existing.overrides++;
      if (event.eventType === 'ALLOWED') existing.allowed++;

      dailyData.set(dateKey, existing);
    }

    return Array.from(dailyData.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }

  /**
   * H4: Generate CSV export with UTF-8 BOM and SHA-256 hash trailer.
   */
  async exportToCsv(filters: GeoFenceReportFilters): Promise<{ csv: string; hash: string }> {
    const data = await this.getReportData(filters);

    if (data.length === 0) {
      throw new BadRequestException('No data to export for the specified filters');
    }

    // CSV header
    const headers = [
      'Date',
      'Branch',
      'Employee',
      'Clock Action',
      'Event Type',
      'Reason Code',
      'Latitude',
      'Longitude',
      'Accuracy (m)',
      'Distance (m)',
      'Radius (m)',
      'Override By',
      'Override Reason',
    ];

    // CSV rows
    const rows = data.map((row) => [
      row.date,
      this.escapeCsvField(row.branch),
      this.escapeCsvField(row.employee),
      row.clockAction,
      row.eventType,
      row.reasonCode ?? '',
      row.lat?.toString() ?? '',
      row.lng?.toString() ?? '',
      row.accuracyMeters?.toString() ?? '',
      row.distanceMeters?.toString() ?? '',
      row.radiusMeters?.toString() ?? '',
      row.overrideBy ? this.escapeCsvField(row.overrideBy) : '',
      row.overrideReason ? this.escapeCsvField(row.overrideReason) : '',
    ]);

    // Build CSV content
    const csvLines = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ];

    const csvBody = csvLines.join('\n');

    // Calculate SHA-256 hash of body (before BOM)
    const hash = createHash('sha256').update(csvBody, 'utf8').digest('hex');

    // Add hash trailer
    const csvWithHash = `${csvBody}\n# SHA-256: ${hash}`;

    // Add UTF-8 BOM for Excel compatibility
    const csvWithBom = UTF8_BOM + csvWithHash;

    return { csv: csvWithBom, hash };
  }

  /**
   * Escape CSV field (handle commas, quotes, newlines).
   */
  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Get top offenders (employees with most blocked attempts).
   */
  async getTopOffenders(filters: GeoFenceReportFilters, limit = 10) {
    const where: any = {
      orgId: filters.orgId,
      eventType: 'BLOCKED',
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const grouped = await this.prisma.client.geoFenceEvent.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Get user details
    const userIds = grouped.map((g) => g.userId);
    const users = await this.prisma.client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return grouped.map((row) => ({
      userId: row.userId,
      name: userMap.get(row.userId) ?? 'Unknown',
      blockedCount: row._count.id,
    }));
  }

  /**
   * Get override summary (managers who performed overrides).
   */
  async getOverrideSummary(filters: GeoFenceReportFilters) {
    const where: any = {
      orgId: filters.orgId,
      eventType: 'OVERRIDE',
      overrideById: { not: null },
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const grouped = await this.prisma.client.geoFenceEvent.groupBy({
      by: ['overrideById'],
      where,
      _count: { id: true },
    });

    // Get manager details
    const managerIds = grouped.map((g) => g.overrideById).filter(Boolean) as string[];
    const managers = await this.prisma.client.user.findMany({
      where: { id: { in: managerIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const managerMap = new Map(managers.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

    return grouped.map((row) => ({
      managerId: row.overrideById!,
      name: managerMap.get(row.overrideById!) ?? 'Unknown',
      overrideCount: row._count.id,
    }));
  }
}
