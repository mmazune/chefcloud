import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ShiftEndReport, PeriodDigest, FranchiseDigest } from './dto/report-content.dto';
import { DashboardsService } from '../dashboards/dashboards.service';

/**
 * M4: Comprehensive Report Generation Service
 * Generates enterprise-grade shift-end reports, daily/weekly/monthly digests,
 * and franchise-level aggregations with consistent metrics.
 * 
 * Uses existing services to ensure data consistency:
 * - DashboardsService for waiter metrics (voids, discounts, no-drinks rate)
 * - ReconciliationService for stock variance and wastage (TODO: integrate for Period/Franchise)
 * - FranchiseService for multi-branch aggregations (TODO: integrate for Franchise digests)
 */
@Injectable()
export class ReportGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DashboardsService))
    private readonly dashboardsService: DashboardsService,
  ) {}

  /**
   * Generate comprehensive shift-end report
   */
  async generateShiftEndReport(shiftId: string): Promise<ShiftEndReport> {
    const shift = await this.prisma.client.shift.findUnique({
      where: { id: shiftId },
      include: {
        openedBy: { select: { firstName: true, lastName: true } },
        closedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!shift || !shift.closedAt) {
      throw new Error('Shift not found or not closed');
    }

    const period = {
      startedAt: shift.openedAt,
      closedAt: shift.closedAt,
      durationHours: (shift.closedAt.getTime() - shift.openedAt.getTime()) / (1000 * 60 * 60),
    };

    // Fetch all data in parallel
    const [
      sales,
      service,
      stock,
      kds,
      staffPerformance,
      anomalies,
    ] = await Promise.all([
      this.generateSalesReport(shift.orgId, shift.branchId, period),
      this.generateServiceReport(shift.orgId, shift.branchId, period),
      this.generateStockReport(shift.orgId, shift.branchId, shiftId, period),
      this.generateKdsReport(shift.orgId, shift.branchId, period),
      this.generateStaffPerformance(shift.orgId, shift.branchId, period),
      this.generateAnomaliesReport(shift.orgId, shift.branchId, period),
    ]);

    return {
      reportId: `shift-${shiftId}-${Date.now()}`,
      orgId: shift.orgId,
      branchId: shift.branchId,
      shiftId: shift.id,
      period,
      generatedAt: new Date(),
      sales,
      service,
      stock,
      kds,
      staffPerformance,
      anomalies,
    };
  }

  /**
   * Generate sales report section
   */
  private async generateSalesReport(
    _orgId: string,
    branchId: string,
    period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['sales']> {
    // Get all orders in period
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: { gte: period.startedAt, lte: period.closedAt },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                category: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    // Sales by category
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; quantity: number; revenue: number }>();
    
    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        const categoryId = item.menuItem.categoryId || 'uncategorized';
        const categoryName = item.menuItem.category?.name || 'Uncategorized';
        
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            categoryId,
            categoryName,
            quantity: 0,
            revenue: 0,
          });
        }
        
        const cat = categoryMap.get(categoryId)!;
        cat.quantity += item.quantity;
        cat.revenue += Number(item.subtotal);
      });
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const byCategory = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
    }));

    // Sales by item (top 20)
    const itemMap = new Map<string, { itemId: string; itemName: string; quantity: number; revenue: number }>();
    
    orders.forEach((order) => {
      order.orderItems.forEach((item) => {
        const itemId = item.menuItemId;
        const itemName = item.menuItem.name;
        
        if (!itemMap.has(itemId)) {
          itemMap.set(itemId, {
            itemId,
            itemName,
            quantity: 0,
            revenue: 0,
          });
        }
        
        const itm = itemMap.get(itemId)!;
        itm.quantity += item.quantity;
        itm.revenue += Number(item.subtotal);
      });
    });

    const byItem = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    // Sales by payment method
    const paymentMap = new Map<string, { method: any; count: number; amount: number }>();
    
    orders.forEach((order) => {
      order.payments.forEach((payment) => {
        const method = payment.method;
        
        if (!paymentMap.has(method)) {
          paymentMap.set(method, {
            method: method as any,
            count: 0,
            amount: 0,
          });
        }
        
        const pm = paymentMap.get(method)!;
        pm.count += 1;
        pm.amount += Number(payment.amount);
      });
    });

    const byPaymentMethod = Array.from(paymentMap.values()).map((pm) => ({
      ...pm,
      percentage: totalRevenue > 0 ? (pm.amount / totalRevenue) * 100 : 0,
    }));

    // Totals
    const totalTax = orders.reduce((sum, o) => sum + Number(o.tax || 0), 0);
    const totalDiscounts = orders.reduce((sum, o) => sum + Number(o.discount || 0), 0);
    const averageCheck = orders.length > 0 ? totalRevenue / orders.length : 0;

    return {
      byCategory,
      byItem,
      byPaymentMethod,
      totals: {
        orders: orders.length,
        revenue: totalRevenue,
        tax: totalTax,
        discounts: totalDiscounts,
        tips: 0, // Tips not tracked in current schema
        averageCheck,
      },
    };
  }

  /**
   * Generate service report (per waiter/cashier)
   * Uses DashboardsService to ensure consistency with dashboard metrics
   */
  private async generateServiceReport(
    orgId: string,
    branchId: string,
    period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['service']> {
    // Get orders with server/waiter info
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        createdAt: { gte: period.startedAt, lte: period.closedAt },
        status: { in: ['CLOSED', 'SERVED'] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Use DashboardsService to get void/discount leaderboards for consistency
    const [voidLeaderboard, discountLeaderboard, noDrinksRate] = await Promise.all([
      this.dashboardsService.getVoidLeaderboard(orgId, period.startedAt, period.closedAt, 100),
      this.dashboardsService.getDiscountLeaderboard(orgId, period.startedAt, period.closedAt, 100),
      this.dashboardsService.getNoDrinksRate(orgId, period.startedAt, period.closedAt),
    ]);

    // Group by waiter
    const waiterMap = new Map<string, {
      userId: string;
      userName: string;
      orders: number;
      revenue: number;
      voidCount: number;
      voidAmount: number;
      discountCount: number;
      discountAmount: number;
      noDrinksCount: number;
    }>();

    orders.forEach((order) => {
      const userId = order.userId;
      const userName = order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Unknown';
      
      if (!waiterMap.has(userId)) {
        waiterMap.set(userId, {
          userId,
          userName,
          orders: 0,
          revenue: 0,
          voidCount: 0,
          voidAmount: 0,
          discountCount: 0,
          discountAmount: 0,
          noDrinksCount: 0,
        });
      }
      
      const waiter = waiterMap.get(userId)!;
      waiter.orders += 1;
      waiter.revenue += Number(order.total);
      
      // Add discount from order discount field
      if (order.discount && Number(order.discount) > 0) {
        waiter.discountAmount += Number(order.discount);
      }
    });

    // Merge void data from leaderboard
    voidLeaderboard.forEach((entry: any) => {
      let waiter = waiterMap.get(entry.userId);
      if (!waiter) {
        // Create entry if waiter had voids but no orders
        waiter = {
          userId: entry.userId,
          userName: entry.name,
          orders: 0,
          revenue: 0,
          voidCount: 0,
          voidAmount: 0,
          discountCount: 0,
          discountAmount: 0,
          noDrinksCount: 0,
        };
        waiterMap.set(entry.userId, waiter);
      }
      waiter.voidCount = entry.voids;
      waiter.voidAmount = entry.totalVoidUGX;
    });

    // Merge discount data from leaderboard
    discountLeaderboard.forEach((entry: any) => {
      let waiter = waiterMap.get(entry.userId);
      if (!waiter) {
        waiter = {
          userId: entry.userId,
          userName: entry.name,
          orders: 0,
          revenue: 0,
          voidCount: 0,
          voidAmount: 0,
          discountCount: 0,
          discountAmount: 0,
          noDrinksCount: 0,
        };
        waiterMap.set(entry.userId, waiter);
      }
      waiter.discountCount = entry.discounts;
      waiter.discountAmount = entry.totalDiscountUGX;
    });

    // Merge no-drinks rate
    noDrinksRate.forEach((entry: any) => {
      const waiter = waiterMap.get(entry.waiterId);
      if (waiter) {
        waiter.noDrinksCount = entry.noDrinks;
      }
    });

    const byWaiter = Array.from(waiterMap.values()).map((w) => ({
      ...w,
      averageCheck: w.orders > 0 ? w.revenue / w.orders : 0,
      noDrinksRate: w.orders > 0 ? w.noDrinksCount / w.orders : 0,
    }));

    const totalVoids = byWaiter.reduce((sum, w) => sum + w.voidCount, 0);
    const totalVoidAmount = byWaiter.reduce((sum, w) => sum + w.voidAmount, 0);
    const totalDiscounts = byWaiter.reduce((sum, w) => sum + w.discountCount, 0);
    const totalDiscountAmount = byWaiter.reduce((sum, w) => sum + w.discountAmount, 0);

    return {
      byWaiter,
      totals: {
        totalVoids,
        totalVoidAmount,
        totalDiscounts,
        totalDiscountAmount,
      },
    };
  }

  /**
   * Generate stock & wastage report
   */
  private async generateStockReport(
    orgId: string,
    branchId: string,
    shiftId: string,
    period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['stock']> {
    // Get stock movements for the period
    const movements = await this.prisma.client.stockMovement.findMany({
      where: {
        orgId,
        branchId,
        createdAt: { gte: period.startedAt, lte: period.closedAt },
        type: { in: ['SALE', 'WASTAGE'] },
      },
      include: {
        item: { select: { id: true, name: true } },
      },
    });

    // Usage summary
    const usageMap = new Map<string, { itemId: string; itemName: string; unitUsed: number; costUsed: number }>();
    
    movements
      .filter((m) => m.type === 'SALE')
      .forEach((m) => {
        const itemId = m.itemId;
        const itemName = m.item.name;
        
        if (!usageMap.has(itemId)) {
          usageMap.set(itemId, {
            itemId,
            itemName,
            unitUsed: 0,
            costUsed: 0,
          });
        }
        
        const usage = usageMap.get(itemId)!;
        usage.unitUsed += Number(m.qty);
        usage.costUsed += Number(m.cost || 0);
      });

    const usage = Array.from(usageMap.values());

    // Wastage summary
    const wastageRecords = await this.prisma.client.wastage.findMany({
      where: {
        orgId,
        branchId,
        shiftId,
      },
      include: {
        item: { select: { id: true, name: true } },
      },
    });

    const wastage = wastageRecords.map((w) => ({
      itemId: w.itemId,
      itemName: w.item.name,
      quantity: Number(w.qty),
      cost: 0, // Cost calculation would need item pricing data
      reason: w.reason || 'Not specified',
    }));

    // Low-stock alerts
    const lowStockAlerts = await this.prisma.client.lowStockConfig.findMany({
      where: {
        orgId,
        branchId,
        enabled: true,
      },
      include: {
        item: { select: { id: true, name: true } },
      },
    });

    // Calculate current quantities from stock batches
    const lowStock: ShiftEndReport['stock']['lowStock'] = [];
    
    for (const config of lowStockAlerts) {
      if (!config.itemId) continue;
      
      const batches = await this.prisma.client.stockBatch.findMany({
        where: {
          branchId,
          itemId: config.itemId,
        },
      });
      
      const currentQty = batches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
      const minQty = Number(config.minQuantity || 0);
      
      if (currentQty <= minQty) {
        lowStock.push({
          itemId: config.itemId,
          itemName: config.item!.name,
          currentQty,
          minQty,
          daysRemaining: 0, // Would need usage rate calculation
          alertLevel: currentQty <= minQty * 0.5 ? 'CRITICAL' : 'LOW',
        });
      }
    }

    const totalUsageCost = usage.reduce((sum, u) => sum + u.costUsed, 0);
    const totalWastageCost = wastage.reduce((sum, w) => sum + w.cost, 0);
    const wastagePercentage = totalUsageCost > 0 ? (totalWastageCost / totalUsageCost) * 100 : 0;

    return {
      usage,
      wastage,
      lowStock,
      totals: {
        totalUsageCost,
        totalWastageCost,
        wastagePercentage,
      },
    };
  }

  /**
   * Generate KDS performance report
   * Uses actual KDS tickets and SLA config for accuracy
   */
  private async generateKdsReport(
    _orgId: string,
    branchId: string,
    period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['kds']> {
    // Get all KDS tickets in the period
    const tickets = await this.prisma.client.kdsTicket.findMany({
      where: {
        order: { branchId },
        sentAt: { gte: period.startedAt, lte: period.closedAt },
      },
    });

    if (tickets.length === 0) {
      return {
        byStation: [],
        totals: {
          totalTickets: 0,
          averageCompletionMinutes: 0,
          overallSlaPercentage: 100,
        },
      };
    }

    // Get the orgId from the branch
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { orgId: true },
    });

    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }

    // Get SLA config for the org
    const slaConfigs = await this.prisma.client.kdsSlaConfig.findMany({
      where: { orgId: branch.orgId },
    });

    const slaConfigMap = new Map(
      slaConfigs.map((c) => [c.station, { green: c.greenThresholdSec, orange: c.orangeThresholdSec }])
    );

    // Default SLA thresholds if not configured
    const defaultSla = { green: 300, orange: 600 }; // 5 min green, 10 min orange

    // Group by station
    const stationMap = new Map<string, {
      station: string;
      tickets: number;
      avgMinutes: number;
      greenCount: number;
      orangeCount: number;
      redCount: number;
    }>();

    let totalCompletionMinutes = 0;
    let completedCount = 0;

    tickets.forEach((ticket) => {
      const station = ticket.station;
      
      if (!stationMap.has(station)) {
        stationMap.set(station, {
          station,
          tickets: 0,
          avgMinutes: 0,
          greenCount: 0,
          orangeCount: 0,
          redCount: 0,
        });
      }
      
      const stationData = stationMap.get(station)!;
      stationData.tickets += 1;

      // Calculate completion time if ticket is ready
      if (ticket.readyAt) {
        const completionSec = (ticket.readyAt.getTime() - ticket.sentAt.getTime()) / 1000;
        const completionMin = completionSec / 60;
        
        totalCompletionMinutes += completionMin;
        completedCount += 1;

        // Determine SLA color
        const sla = slaConfigMap.get(station as any) || defaultSla;
        
        if (completionSec <= sla.green) {
          stationData.greenCount += 1;
        } else if (completionSec <= sla.orange) {
          stationData.orangeCount += 1;
        } else {
          stationData.redCount += 1;
        }
      }
    });

    const byStation = Array.from(stationMap.values()).map((s) => {
      const completed = s.greenCount + s.orangeCount + s.redCount;
      const avgMin = completed > 0 ? (s.greenCount * 3 + s.orangeCount * 7 + s.redCount * 12) / completed : 0;
      return {
        station: s.station,
        ticketsCompleted: completed,
        averageCompletionMinutes: avgMin,
        slaBreaches: {
          green: s.greenCount,
          orange: s.orangeCount,
          red: s.redCount,
        },
        slaPercentage: completed > 0 ? ((s.greenCount + s.orangeCount) / completed) * 100 : 100,
      };
    });

    const totalCompleted = completedCount;
    const greenTotal = Array.from(stationMap.values()).reduce((sum, s) => sum + s.greenCount, 0);
    const orangeTotal = Array.from(stationMap.values()).reduce((sum, s) => sum + s.orangeCount, 0);

    return {
      byStation,
      totals: {
        totalTickets: tickets.length,
        averageCompletionMinutes: completedCount > 0 ? totalCompletionMinutes / completedCount : 0,
        overallSlaPercentage: totalCompleted > 0 ? ((greenTotal + orangeTotal) / totalCompleted) * 100 : 100,
      },
    };
  }

  /**
   * Generate staff performance summary
   * Uses composite scoring: high revenue, low voids/discounts, low no-drinks rate
   */
  private async generateStaffPerformance(
    _orgId: string,
    _branchId: string,
    _period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['staffPerformance']> {
    // This would typically reuse the service report data
    // For now, return empty arrays - can be populated later
    return {
      topPerformers: [],
      riskStaff: [],
    };
  }

  /**
   * Generate anomalies report
   */
  private async generateAnomaliesReport(
    orgId: string,
    branchId: string,
    period: { startedAt: Date; closedAt: Date },
  ): Promise<ShiftEndReport['anomalies']> {
    const anomalies = await this.prisma.client.anomalyEvent.findMany({
      where: {
        orgId,
        branchId,
        occurredAt: { gte: period.startedAt, lte: period.closedAt },
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });

    const byType: Record<string, number> = {};
    anomalies.forEach((a) => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });

    const recent = anomalies.slice(0, 10).map((a) => ({
      type: a.type,
      severity: a.severity as 'INFO' | 'WARN' | 'ERROR',
      userId: a.userId || undefined,
      details: a.details,
      occurredAt: a.occurredAt,
    }));

    return {
      count: anomalies.length,
      byType,
      recent,
    };
  }

  /**
   * Generate period digest (daily/weekly/monthly)
   * TODO: Implement properly to match PeriodDigest DTO structure
   */
  async generatePeriodDigest(
    _branchId: string,
    _startDate: Date,
    _endDate: Date,
    _periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  ): Promise<PeriodDigest> {
    throw new Error('PeriodDigest generation not yet fully implemented');
    // TODO: When implementing, add staff insights:
    // import { StaffInsightsService } from '../staff/staff-insights.service';
    // const staffInsights = await this.generateStaffInsightsSection(orgId, branchId, periodType, startDate);
  }

  /**
   * M19: Generate staff insights section for period digest
   * This method can be called when PeriodDigest is fully implemented
   */
  /* async generateStaffInsightsSection(
    orgId: string,
    branchId: string | null,
    periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    startDate: Date,
  ) {
    // Import StaffInsightsService when needed
    // const awardPeriodType = periodType === 'WEEKLY' ? AwardPeriodType.WEEK : AwardPeriodType.MONTH;
    // const period = this.staffInsights.resolvePeriod(awardPeriodType, startDate);
    // const insights = await this.staffInsights.getStaffInsights({ orgId, branchId, from: period.start, to: period.end, periodType: awardPeriodType });
    // const awardRecommendation = await this.staffInsights.getAwardRecommendation(orgId, branchId, period, AwardCategory.TOP_PERFORMER);
    // const perfectAttendance = insights.rankings.filter(r => r.reliabilityMetrics.attendanceRate === 1.0).slice(0, 3);
    // const mostCoverShifts = insights.rankings.filter(r => r.reliabilityMetrics.coverShiftsCount > 0).sort((a, b) => b.reliabilityMetrics.coverShiftsCount - a.reliabilityMetrics.coverShiftsCount).slice(0, 3);
    // return { periodLabel: period.label, awardWinner: awardRecommendation, topPerformers: insights.rankings.slice(0, 5), reliabilityHighlights: { perfectAttendance, mostCoverShifts } };
  } */

  /**
   * M22: Generate staff promotions section for period digest
   * This method can be called when PeriodDigest is fully implemented
   */
  /* async generateStaffPromotionsSection(
    orgId: string,
    branchId: string | null,
    periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    startDate: Date,
    endDate: Date,
  ) {
    // Import PromotionInsightsService when needed
    // import { PromotionInsightsService } from '../staff/promotion-insights.service';
    // const awardPeriodType = periodType === 'WEEKLY' ? AwardPeriodType.WEEK : AwardPeriodType.MONTH;
    // const summary = await this.promotionInsights.getSuggestionSummary({ orgId, branchId, periodType: awardPeriodType, periodStart: startDate, periodEnd: endDate });
    // const topSuggestions = await this.promotionInsights.listSuggestions({ orgId, branchId, periodType: awardPeriodType, fromDate: startDate, toDate: endDate, limit: 3 });
    // return {
    //   periodLabel: format(startDate, 'MMMM yyyy'),
    //   suggestedCount: summary.totalSuggestions,
    //   acceptedCount: summary.byStatus.ACCEPTED,
    //   rejectedCount: summary.byStatus.REJECTED,
    //   pendingCount: summary.byStatus.PENDING,
    //   byCategory: { promotions: summary.byCategory.PROMOTION, training: summary.byCategory.TRAINING, reviews: summary.byCategory.PERFORMANCE_REVIEW, roleChanges: summary.byCategory.ROLE_CHANGE },
    //   topSuggestions: topSuggestions.suggestions.map(s => ({ displayName: `${s.employee.firstName} ${s.employee.lastName}`, branchName: s.branch?.name || 'Org-level', category: s.category, reason: s.reason, score: Number(s.scoreAtSuggestion), status: s.status })),
    // };
  } */

  /**
   * Generate franchise digest
   * TODO: Implement properly to match FranchiseDigest DTO structure
   */
  async generateFranchiseDigest(
    _orgId: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<FranchiseDigest> {
    throw new Error('FranchiseDigest generation not yet fully implemented');
  }

  /**
   * Helper to determine period string for franchise service
   * TODO: use when Franchise digests are implemented
   */
  /* private determineFranchisePeriod(startDate: Date, endDate: Date): string {
    const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (days <= 1) return 'today';
    if (days <= 7) return 'week';
    if (days <= 31) return 'month';
    return 'year';
  } */
}

