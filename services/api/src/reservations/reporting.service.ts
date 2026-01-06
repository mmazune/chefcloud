/**
 * M9.4: Reporting Service
 * 
 * Reservation KPIs and analytics with CSV export
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface ReportFilters {
  branchId?: string;
  from: string;
  to: string;
}

interface ReservationKPIs {
  totalReservations: number;
  byStatus: Record<string, number>;
  noShowRate: number;
  averagePartySize: number;
  conversionRates: {
    heldToConfirmed: number;
    waitlistToSeated: number;
  };
  deposits: {
    required: number;
    paid: number;
    applied: number;
    refunded: number;
    forfeited: number;
    totalRequiredAmount: number;
    totalPaidAmount: number;
    totalAppliedAmount: number;
    totalRefundedAmount: number;
    totalForfeitedAmount: number;
  };
  bySource: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get reservation KPIs for a branch/date range
   */
  async getSummary(orgId: string, filters: ReportFilters): Promise<ReservationKPIs> {
    const { branchId, from, to } = filters;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Base where clause
    const whereClause = {
      orgId,
      ...(branchId && { branchId }),
      startAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // Get all reservations in range
    const reservations = await this.prisma.reservation.findMany({
      where: whereClause,
      include: {
        deposits: true,
      },
    });

    // Calculate status breakdown
    const byStatus: Record<string, number> = {};
    reservations.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    // Calculate no-show rate
    const noShowCount = byStatus['NO_SHOW'] || 0;
    const completedCount = byStatus['COMPLETED'] || 0;
    const seatedCount = byStatus['SEATED'] || 0;
    const totalFinal = noShowCount + completedCount + seatedCount;
    const noShowRate = totalFinal > 0 ? (noShowCount / totalFinal) * 100 : 0;

    // Calculate average party size
    const totalPartySize = reservations.reduce((sum, r) => sum + r.partySize, 0);
    const averagePartySize = reservations.length > 0 ? totalPartySize / reservations.length : 0;

    // Calculate conversion rates
    const heldCount = reservations.filter((r) => r.status === 'HELD').length;
    const confirmedFromHeld = reservations.filter(
      (r) => r.status === 'CONFIRMED' || r.status === 'SEATED' || r.status === 'COMPLETED',
    ).length;
    const heldToConfirmed = heldCount + confirmedFromHeld > 0
      ? (confirmedFromHeld / (heldCount + confirmedFromHeld)) * 100
      : 0;

    // Get waitlist conversions
    const waitlistEntries = await this.prisma.waitlistEntry.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    const waitlistSeated = waitlistEntries.filter((w) => w.status === 'SEATED').length;
    const waitlistToSeated = waitlistEntries.length > 0
      ? (waitlistSeated / waitlistEntries.length) * 100
      : 0;

    // Calculate deposit stats
    const deposits = {
      required: 0,
      paid: 0,
      applied: 0,
      refunded: 0,
      forfeited: 0,
      totalRequiredAmount: 0,
      totalPaidAmount: 0,
      totalAppliedAmount: 0,
      totalRefundedAmount: 0,
      totalForfeitedAmount: 0,
    };

    reservations.forEach((r) => {
      r.deposits.forEach((d) => {
        deposits.required++;
        deposits.totalRequiredAmount += Number(d.amount);

        switch (d.status) {
          case 'PAID':
            deposits.paid++;
            deposits.totalPaidAmount += Number(d.amount);
            break;
          case 'APPLIED':
            deposits.applied++;
            deposits.totalAppliedAmount += Number(d.amount);
            break;
          case 'REFUNDED':
            deposits.refunded++;
            deposits.totalRefundedAmount += Number(d.amount);
            break;
          case 'FORFEITED':
            deposits.forfeited++;
            deposits.totalForfeitedAmount += Number(d.amount);
            break;
        }
      });
    });

    // Calculate source breakdown
    const bySource: Record<string, number> = {};
    reservations.forEach((r) => {
      bySource[r.source] = (bySource[r.source] || 0) + 1;
    });

    // Calculate day of week breakdown
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek: Record<string, number> = {};
    dayNames.forEach((d) => (byDayOfWeek[d] = 0));
    reservations.forEach((r) => {
      const day = dayNames[r.startAt.getDay()];
      byDayOfWeek[day]++;
    });

    // Calculate peak hours
    const hourCounts: Record<number, number> = {};
    reservations.forEach((r) => {
      const hour = r.startAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalReservations: reservations.length,
      byStatus,
      noShowRate: Math.round(noShowRate * 100) / 100,
      averagePartySize: Math.round(averagePartySize * 100) / 100,
      conversionRates: {
        heldToConfirmed: Math.round(heldToConfirmed * 100) / 100,
        waitlistToSeated: Math.round(waitlistToSeated * 100) / 100,
      },
      deposits,
      bySource,
      byDayOfWeek,
      peakHours,
    };
  }

  /**
   * Export reservations as CSV
   */
  async exportCSV(orgId: string, filters: ReportFilters): Promise<string> {
    const { branchId, from, to } = filters;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        startAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        branch: { select: { name: true } },
        table: { select: { label: true } },
        deposits: { select: { amount: true, status: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    // Build CSV
    const headers = [
      'ID',
      'Branch',
      'Date',
      'Time',
      'Name',
      'Phone',
      'Party Size',
      'Status',
      'Source',
      'Table',
      'Deposit Amount',
      'Deposit Status',
      'Notes',
    ];

    const rows = reservations.map((r) => [
      this.escapeCSV(r.id),
      this.escapeCSV(r.branch.name),
      this.escapeCSV(r.startAt.toISOString().split('T')[0]),
      this.escapeCSV(r.startAt.toTimeString().slice(0, 5)),
      this.escapeCSV(r.name),
      this.escapeCSV(r.phone || ''),
      r.partySize.toString(),
      this.escapeCSV(r.status),
      this.escapeCSV(r.source),
      this.escapeCSV(r.table?.label || ''),
      r.deposits[0]?.amount?.toString() || '0',
      this.escapeCSV(r.deposits[0]?.status || 'NONE'),
      this.escapeCSV(r.notes || ''),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }

  /**
   * Escape a value for CSV output
   */
  private escapeCSV(value: string): string {
    if (!value) return '';
    // Escape double quotes and wrap in quotes if needed
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Get detailed deposit report
   */
  async getDepositReport(
    orgId: string,
    filters: ReportFilters,
  ): Promise<{
    summary: {
      totalAmount: number;
      paidAmount: number;
      refundedAmount: number;
      forfeitedAmount: number;
      appliedAmount: number;
      pendingAmount: number;
    };
    entries: Array<{
      reservationId: string;
      name: string;
      date: Date;
      amount: number;
      status: string;
    }>;
  }> {
    const { branchId, from, to } = filters;
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const deposits = await this.prisma.reservationDeposit.findMany({
      where: {
        orgId,
        reservation: {
          ...(branchId && { branchId }),
          startAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      include: {
        reservation: { select: { id: true, name: true, startAt: true } },
      },
    });

    const summary = {
      totalAmount: 0,
      paidAmount: 0,
      refundedAmount: 0,
      forfeitedAmount: 0,
      appliedAmount: 0,
      pendingAmount: 0,
    };

    const entries = deposits.map((d) => {
      const amount = Number(d.amount);
      summary.totalAmount += amount;

      switch (d.status) {
        case 'PAID':
          summary.paidAmount += amount;
          break;
        case 'REFUNDED':
          summary.refundedAmount += amount;
          break;
        case 'FORFEITED':
          summary.forfeitedAmount += amount;
          break;
        case 'APPLIED':
          summary.appliedAmount += amount;
          break;
        case 'REQUIRED':
          summary.pendingAmount += amount;
          break;
      }

      return {
        reservationId: d.reservation.id,
        name: d.reservation.name,
        date: d.reservation.startAt,
        amount,
        status: d.status,
      };
    });

    return { summary, entries };
  }
}
