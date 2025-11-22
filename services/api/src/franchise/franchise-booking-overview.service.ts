/**
 * M15: Franchise Booking Overview Service
 * 
 * Provides aggregated booking metrics across franchise branches
 * Integrates with M6 franchise patterns
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReservationStatus, DepositStatus, EventBookingStatus } from '@prisma/client';

export interface BranchBookingSummary {
  branchId: string;
  branchName: string;
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    showUpRate: number;
    noShowRate: number;
    avgPartySize: number;
  };
  deposits: {
    collected: number;
    applied: number;
    forfeited: number;
    refunded: number;
  };
  events: {
    total: number;
    ticketsSold: number;
    ticketsUsed: number;
    revenue: number;
  };
}

export interface FranchiseBookingOverview {
  franchiseId: string;
  period: { from: Date; to: Date };
  branches: BranchBookingSummary[];
  totals: {
    reservations: number;
    showUpRate: number;
    deposits: {
      collected: number;
      applied: number;
      forfeited: number;
      refunded: number;
    };
    events: {
      total: number;
      ticketsSold: number;
      revenue: number;
    };
  };
}

@Injectable()
export class FranchiseBookingOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get booking summary for a single branch
   */
  async getBranchBookingSummary(params: {
    branchId: string;
    from: Date;
    to: Date;
  }): Promise<BranchBookingSummary> {
    const { branchId, from, to } = params;

    // Get branch info
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Get reservations
    const reservations = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        startAt: { gte: from, lte: to },
      },
      select: {
        status: true,
        partySize: true,
        deposit: true,
        depositStatus: true,
      },
    });

    // Calculate reservation metrics
    const byStatus: Record<string, number> = {};
    let totalPartySize = 0;
    const deposits = {
      collected: 0,
      applied: 0,
      forfeited: 0,
      refunded: 0,
    };

    for (const res of reservations) {
      // Count by status
      byStatus[res.status] = (byStatus[res.status] || 0) + 1;
      totalPartySize += res.partySize;

      // Sum deposits
      const amount = Number(res.deposit);
      if (res.depositStatus === DepositStatus.CAPTURED) {
        deposits.collected += amount;
      } else if (res.depositStatus === DepositStatus.FORFEITED) {
        deposits.forfeited += amount;
      } else if (res.depositStatus === DepositStatus.REFUNDED) {
        deposits.refunded += amount;
      }
    }

    // Calculate show-up and no-show rates
    const confirmed = byStatus[ReservationStatus.CONFIRMED] || 0;
    const seated = byStatus[ReservationStatus.SEATED] || 0;
    const noShow = byStatus[ReservationStatus.NO_SHOW] || 0;
    const totalConfirmed = confirmed + seated + noShow;
    const showUpRate = totalConfirmed > 0 ? (seated / totalConfirmed) * 100 : 0;
    const noShowRate = totalConfirmed > 0 ? (noShow / totalConfirmed) * 100 : 0;

    // Get events and bookings
    const events = await this.prisma.client.event.findMany({
      where: {
        branchId,
        startsAt: { gte: from, lte: to },
      },
      include: {
        bookings: {
          select: {
            status: true,
            eventTable: {
              select: {
                deposit: true,
              },
            },
          },
        },
      },
    });

    let ticketsSold = 0;
    let ticketsUsed = 0;
    let eventRevenue = 0;

    for (const event of events) {
      for (const booking of event.bookings) {
        if ([EventBookingStatus.CONFIRMED, EventBookingStatus.CHECKED_IN].includes(booking.status as EventBookingStatus)) {
          ticketsSold++;
          eventRevenue += Number(booking.eventTable.deposit);
        }
        if (booking.status === EventBookingStatus.CHECKED_IN) {
          ticketsUsed++;
        }
      }
    }

    return {
      branchId,
      branchName: branch.name,
      reservations: {
        total: reservations.length,
        byStatus,
        showUpRate: Math.round(showUpRate * 10) / 10,
        noShowRate: Math.round(noShowRate * 10) / 10,
        avgPartySize: reservations.length > 0 ? Math.round((totalPartySize / reservations.length) * 10) / 10 : 0,
      },
      deposits,
      events: {
        total: events.length,
        ticketsSold,
        ticketsUsed,
        revenue: eventRevenue,
      },
    };
  }

  /**
   * Get aggregated booking overview for entire franchise
   */
  async getFranchiseBookingOverview(params: {
    franchiseId: string;
    from: Date;
    to: Date;
  }): Promise<FranchiseBookingOverview> {
    const { franchiseId, from, to } = params;

    // Get all branches in franchise
    const franchise = await this.prisma.client.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        branches: {
          select: { id: true },
        },
      },
    });

    if (!franchise) {
      throw new Error(`Franchise ${franchiseId} not found`);
    }

    // Get summary for each branch
    const branchSummaries = await Promise.all(
      franchise.branches.map((branch) =>
        this.getBranchBookingSummary({
          branchId: branch.id,
          from,
          to,
        })
      )
    );

    // Aggregate totals
    const totals = {
      reservations: 0,
      showUpRate: 0,
      deposits: {
        collected: 0,
        applied: 0,
        forfeited: 0,
        refunded: 0,
      },
      events: {
        total: 0,
        ticketsSold: 0,
        revenue: 0,
      },
    };

    let totalShowUpRate = 0;
    let branchesWithReservations = 0;

    for (const summary of branchSummaries) {
      totals.reservations += summary.reservations.total;
      totals.deposits.collected += summary.deposits.collected;
      totals.deposits.applied += summary.deposits.applied;
      totals.deposits.forfeited += summary.deposits.forfeited;
      totals.deposits.refunded += summary.deposits.refunded;
      totals.events.total += summary.events.total;
      totals.events.ticketsSold += summary.events.ticketsSold;
      totals.events.revenue += summary.events.revenue;

      if (summary.reservations.total > 0) {
        totalShowUpRate += summary.reservations.showUpRate;
        branchesWithReservations++;
      }
    }

    // Calculate average show-up rate across branches
    totals.showUpRate = branchesWithReservations > 0
      ? Math.round((totalShowUpRate / branchesWithReservations) * 10) / 10
      : 0;

    return {
      franchiseId,
      period: { from, to },
      branches: branchSummaries,
      totals,
    };
  }
}
