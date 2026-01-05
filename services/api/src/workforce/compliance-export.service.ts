/**
 * M10.19: Compliance Export Service
 *
 * Provides audit-grade CSV exports with:
 * - UTF-8 BOM for Excel compatibility
 * - Stable column order
 * - Stable row order (date asc, userId asc, id asc)
 * - SHA256 hash header for tamper evidence
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';

const UTF8_BOM = '\ufeff';

export interface ExportResult {
  csv: string;
  hash: string; // SHA256 of raw CSV body (after BOM)
  rowCount: number;
}

@Injectable()
export class ComplianceExportService {
  private readonly logger = new Logger(ComplianceExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escape CSV field value.
   */
  private escapeCSV(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Format date for CSV (ISO format, or empty if null).
   */
  private formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return date.toISOString();
  }

  /**
   * Compute SHA256 hash of content (excluding BOM).
   * Use consistent line endings (LF) to avoid platform differences (H4).
   */
  private computeHash(content: string): string {
    // Normalize line endings to LF for consistent hashing
    const normalized = content.replace(/\r\n/g, '\n');
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Export compliance incidents as CSV.
   */
  async exportIncidents(
    orgId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<ExportResult> {
    const incidents = await this.prisma.client.opsIncident.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: from, lte: to },
      },
      orderBy: [
        { incidentDate: 'asc' },
        { userId: 'asc' },
        { id: 'asc' },
      ],
    });

    // Get users and branches for lookups
    const userIds = [...new Set(incidents.map((i) => i.userId).filter(Boolean))] as string[];
    const branchIds = [...new Set(incidents.map((i) => i.branchId).filter(Boolean))] as string[];

    const [users, branches] = await Promise.all([
      this.prisma.client.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.client.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`.trim(), email: u.email }]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    // Stable column order
    const headers = [
      'Incident ID',
      'Incident Date',
      'Type',
      'Severity',
      'Title',
      'User ID',
      'User Name',
      'User Email',
      'Branch ID',
      'Branch Name',
      'Time Entry ID',
      'Penalty Minutes',
      'Penalty Amount Cents',
      'Currency',
      'Resolved',
      'Resolved At',
      'Created At',
    ];

    const rows = incidents.map((inc) => {
      const user = inc.userId ? userMap.get(inc.userId) : null;
      const branch = inc.branchId ? branchMap.get(inc.branchId) : null;
      return [
        this.escapeCSV(inc.id),
        this.formatDate(inc.incidentDate),
        this.escapeCSV(inc.type),
        this.escapeCSV(inc.severity),
        this.escapeCSV(inc.title),
        this.escapeCSV(inc.userId),
        this.escapeCSV(user?.name),
        this.escapeCSV(user?.email),
        this.escapeCSV(inc.branchId),
        this.escapeCSV(branch?.name),
        this.escapeCSV(inc.timeEntryId),
        this.escapeCSV(inc.penaltyMinutes),
        this.escapeCSV(inc.penaltyAmountCents),
        this.escapeCSV(inc.currency),
        this.escapeCSV(inc.resolved),
        this.formatDate(inc.resolvedAt),
        this.formatDate(inc.createdAt),
      ];
    });

    const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const hash = this.computeHash(csvBody);
    const csv = UTF8_BOM + csvBody;

    this.logger.log(`Exported ${incidents.length} incidents, hash: ${hash.substring(0, 16)}...`);

    return { csv, hash, rowCount: incidents.length };
  }

  /**
   * Export penalty summary as CSV.
   */
  async exportPenalties(
    orgId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<ExportResult> {
    const incidents = await this.prisma.client.opsIncident.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: from, lte: to },
        penaltyMinutes: { not: null },
      },
      orderBy: [
        { incidentDate: 'asc' },
        { userId: 'asc' },
        { id: 'asc' },
      ],
    });

    // Get users and branches for lookups
    const userIds = [...new Set(incidents.map((i) => i.userId).filter(Boolean))] as string[];
    const branchIds = [...new Set(incidents.map((i) => i.branchId).filter(Boolean))] as string[];

    const [users, branches] = await Promise.all([
      this.prisma.client.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      this.prisma.client.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`.trim(), email: u.email }]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    // Stable column order
    const headers = [
      'User ID',
      'User Name',
      'User Email',
      'Incident Date',
      'Incident Type',
      'Branch Name',
      'Penalty Minutes',
      'Penalty Amount Cents',
      'Currency',
      'Time Entry ID',
    ];

    const rows = incidents.map((inc) => {
      const user = inc.userId ? userMap.get(inc.userId) : null;
      const branch = inc.branchId ? branchMap.get(inc.branchId) : null;
      return [
        this.escapeCSV(inc.userId),
        this.escapeCSV(user?.name),
        this.escapeCSV(user?.email),
        this.formatDate(inc.incidentDate),
        this.escapeCSV(inc.type),
        this.escapeCSV(branch?.name),
        this.escapeCSV(inc.penaltyMinutes),
        this.escapeCSV(inc.penaltyAmountCents),
        this.escapeCSV(inc.currency),
        this.escapeCSV(inc.timeEntryId),
      ];
    });

    const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const hash = this.computeHash(csvBody);
    const csv = UTF8_BOM + csvBody;

    return { csv, hash, rowCount: incidents.length };
  }

  /**
   * Export time entries with geo metadata as CSV.
   */
  async exportTimeEntriesWithGeo(
    orgId: string,
    from: Date,
    to: Date,
    branchId?: string,
  ): Promise<ExportResult> {
    const entries = await this.prisma.client.timeEntry.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
        clockInAt: { gte: from, lte: to },
      },
      orderBy: [
        { clockInAt: 'asc' },
        { userId: 'asc' },
        { id: 'asc' },
      ],
    });

    // Get user and shift lookups separately
    const userIds = [...new Set(entries.map((e) => e.userId))];
    const shiftIds = [...new Set(entries.map((e) => e.shiftId).filter(Boolean))] as string[];

    const [users, shifts] = await Promise.all([
      this.prisma.client.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      shiftIds.length > 0
        ? this.prisma.client.scheduledShift.findMany({
            where: { id: { in: shiftIds } },
            select: { id: true, role: true },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`.trim(), email: u.email }]));
    const shiftMap = new Map(shifts.map((s) => [s.id, s]));

    // Stable column order with geo fields
    const headers = [
      'Entry ID',
      'User ID',
      'User Name',
      'User Email',
      'Clock In',
      'Clock Out',
      'Method',
      'Overtime Minutes',
      'Approved',
      'Shift ID',
      'Role',
      // Geo-fencing metadata (C)
      'Clock In Lat',
      'Clock In Lng',
      'Clock In Accuracy (m)',
      'Clock In Source',
      'Clock Out Lat',
      'Clock Out Lng',
      'Clock Out Accuracy (m)',
      'Clock Out Source',
    ];

    const rows = entries.map((e) => {
      const user = userMap.get(e.userId);
      const shift = e.shiftId ? shiftMap.get(e.shiftId) : null;
      return [
        this.escapeCSV(e.id),
        this.escapeCSV(e.userId),
        this.escapeCSV(user?.name),
        this.escapeCSV(user?.email),
        this.formatDate(e.clockInAt),
        this.formatDate(e.clockOutAt),
        this.escapeCSV(e.method),
        this.escapeCSV(e.overtimeMinutes),
        this.escapeCSV(e.approved),
        this.escapeCSV(shift?.id),
        this.escapeCSV(shift?.role),
        // Geo fields - omit if null (never fabricate)
        this.escapeCSV(e.clockInLat),
        this.escapeCSV(e.clockInLng),
        this.escapeCSV(e.clockInAccuracyMeters),
        this.escapeCSV(e.clockInSource),
        this.escapeCSV(e.clockOutLat),
        this.escapeCSV(e.clockOutLng),
        this.escapeCSV(e.clockOutAccuracyMeters),
        this.escapeCSV(e.clockOutSource),
      ];
    });

    const csvBody = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const hash = this.computeHash(csvBody);
    const csv = UTF8_BOM + csvBody;

    return { csv, hash, rowCount: entries.length };
  }
}
