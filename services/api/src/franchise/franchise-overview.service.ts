import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReconciliationService } from '../inventory/reconciliation.service';
import { WastageService } from '../inventory/wastage.service';
import { WaiterMetricsService } from '../staff/waiter-metrics.service';

/**
 * M6: Franchise Overview Service
 * 
 * Single source of truth for franchise-level aggregated metrics.
 * Uses canonical services from M3 (inventory), M5 (staff), M1 (KDS) to ensure consistency.
 */

export interface BranchMetrics {
  branchId: string;
  branchName: string;
  
  // Sales & Revenue (from POS orders)
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  
  // Cost & Margin (from Reconciliation M3)
  totalCOGS: number;
  grossMargin: number;
  grossMarginPercent: number;
  
  // Wastage (from WastageService M3)
  wastageCost: number;
  wastagePercent: number;
  
  // KDS Performance (from KDS tickets M1)
  kdsSlaScore: number; // % of tickets in green/orange
  
  // Staff Performance (from WaiterMetrics M5)
  staffScore: number; // Average waiter score
  
  // Budget vs Actual (if budgets configured)
  revenueTarget?: number;
  revenueDelta?: number;
  revenueDeltaPercent?: number;
  
  cogsTarget?: number;
  cogsDelta?: number;
  
  // Period info
  periodStart: Date;
  periodEnd: Date;
}

export interface FranchiseSummary {
  // Aggregated totals
  totalSales: number;
  totalCOGS: number;
  totalGrossMargin: number;
  totalWastageCost: number;
  
  // Averages
  avgGrossMarginPercent: number;
  avgWastagePercent: number;
  avgKdsSlaScore: number;
  avgStaffScore: number;
  
  // Per-branch breakdown
  branches: BranchMetrics[];
  
  // Period info
  periodStart: Date;
  periodEnd: Date;
  
  // Budget totals (if configured)
  totalRevenueTarget?: number;
  totalRevenueDelta?: number;
  totalCogsTarget?: number;
  totalCogsDelta?: number;
}

@Injectable()
export class FranchiseOverviewService {
  private readonly logger = new Logger(FranchiseOverviewService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: ReconciliationService,
    private readonly wastageService: WastageService,
    private readonly waiterMetricsService: WaiterMetricsService,
  ) {}
  
  /**
   * Get metrics for a single branch
   */
  async getBranchMetrics(
    orgId: string,
    branchId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<BranchMetrics> {
    this.logger.log(`Fetching branch metrics for ${branchId}, period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
    
    // Get branch name
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });
    
    if (!branch) {
      throw new Error(`Branch ${branchId} not found`);
    }
    
    // 1. Sales & Revenue from Orders
    const orders = await this.prisma.client.order.findMany({
      where: {
        branchId,
        status: { in: ['CLOSED', 'SERVED'] },
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { total: true },
    });
    
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
    
    // 2. COGS from Reconciliation (M3)
    let totalCOGS = 0;
    try {
      const reconciliation = await this.reconciliationService.reconcile({
        orgId,
        branchId,
        startDate: periodStart,
        endDate: periodEnd,
      });
      
      // Sum theoretical usage cost (represents COGS)
      totalCOGS = reconciliation.reduce((sum, item) => sum + item.theoreticalUsageCost, 0);
    } catch (err) {
      this.logger.warn(`Failed to get reconciliation for branch ${branchId}: ${err}`);
      // Fallback: estimate COGS as 35% of sales (typical restaurant margin)
      totalCOGS = totalSales * 0.35;
    }
    
    const grossMargin = totalSales - totalCOGS;
    const grossMarginPercent = totalSales > 0 ? (grossMargin / totalSales) * 100 : 0;
    
    // 3. Wastage from WastageService (M3)
    let wastageCost = 0;
    try {
      const wastageSummary = await this.wastageService.getWastageSummary(
        orgId,
        branchId,
        periodStart,
        periodEnd,
      );
      wastageCost = wastageSummary.totalCost;
    } catch (err) {
      this.logger.warn(`Failed to get wastage for branch ${branchId}: ${err}`);
    }
    
    const wastagePercent = totalSales > 0 ? (wastageCost / totalSales) * 100 : 0;
    
    // 4. KDS SLA Score from tickets (M1)
    let kdsSlaScore = 100; // Default to 100% if no tickets
    try {
      const kdsTickets = await this.prisma.client.kdsTicket.findMany({
        where: {
          order: { branchId },
          sentAt: { gte: periodStart, lte: periodEnd },
          readyAt: { not: null },
        },
        select: {
          sentAt: true,
          readyAt: true,
        },
      });
      
      if (kdsTickets.length > 0) {
        let greenCount = 0;
        let orangeCount = 0;
        
        kdsTickets.forEach((ticket) => {
          if (!ticket.readyAt) return;
          const durationMin = (ticket.readyAt.getTime() - ticket.sentAt.getTime()) / (1000 * 60);
          
          if (durationMin <= 5) {
            greenCount++;
          } else if (durationMin <= 10) {
            orangeCount++;
          }
          // Red tickets don't count towards SLA score
        });
        
        kdsSlaScore = ((greenCount + orangeCount) / kdsTickets.length) * 100;
      }
    } catch (err) {
      this.logger.warn(`Failed to get KDS metrics for branch ${branchId}: ${err}`);
    }
    
    // 5. Staff Score from WaiterMetricsService (M5)
    let staffScore = 0;
    try {
      const rankedWaiters = await this.waiterMetricsService.getRankedWaiters({
        orgId,
        branchId,
        from: periodStart,
        to: periodEnd,
      });
      
      if (rankedWaiters.length > 0) {
        const avgScore = rankedWaiters.reduce((sum, w) => sum + w.score, 0) / rankedWaiters.length;
        // Convert to 0-100 scale (scores are typically -1 to 1 range)
        staffScore = Math.max(0, Math.min(100, (avgScore + 1) * 50));
      }
    } catch (err) {
      this.logger.warn(`Failed to get staff metrics for branch ${branchId}: ${err}`);
    }
    
    // 6. Budget vs Actual (if configured)
    const periodStr = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
    let revenueTarget: number | undefined;
    let revenueDelta: number | undefined;
    let revenueDeltaPercent: number | undefined;
    let cogsTarget: number | undefined;
    let cogsDelta: number | undefined;
    
    try {
      const budget = await this.prisma.client.branchBudget.findUnique({
        where: {
          orgId_branchId_period: {
            orgId,
            branchId,
            period: periodStr,
          },
        },
      });
      
      if (budget) {
        revenueTarget = Number(budget.revenueTarget);
        revenueDelta = totalSales - revenueTarget;
        revenueDeltaPercent = revenueTarget > 0 ? (revenueDelta / revenueTarget) * 100 : 0;
        
        cogsTarget = Number(budget.cogsTarget);
        cogsDelta = totalCOGS - cogsTarget;
      }
    } catch (err) {
      this.logger.warn(`Failed to get budget for branch ${branchId}: ${err}`);
    }
    
    return {
      branchId,
      branchName: branch.name,
      totalSales,
      orderCount,
      avgOrderValue,
      totalCOGS,
      grossMargin,
      grossMarginPercent,
      wastageCost,
      wastagePercent,
      kdsSlaScore,
      staffScore,
      revenueTarget,
      revenueDelta,
      revenueDeltaPercent,
      cogsTarget,
      cogsDelta,
      periodStart,
      periodEnd,
    };
  }
  
  /**
   * Get franchise-wide summary (all branches aggregated)
   */
  async getFranchiseSummary(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<FranchiseSummary> {
    this.logger.log(`Fetching franchise summary for org ${orgId}, period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
    
    // Get all branches for this org
    const branches = await this.prisma.client.branch.findMany({
      where: { orgId },
      select: { id: true },
    });
    
    if (branches.length === 0) {
      throw new Error(`No branches found for org ${orgId}`);
    }
    
    // Fetch metrics for each branch in parallel
    const branchMetrics = await Promise.all(
      branches.map((branch) =>
        this.getBranchMetrics(orgId, branch.id, periodStart, periodEnd)
      )
    );
    
    // Aggregate totals
    const totalSales = branchMetrics.reduce((sum, b) => sum + b.totalSales, 0);
    const totalCOGS = branchMetrics.reduce((sum, b) => sum + b.totalCOGS, 0);
    const totalGrossMargin = branchMetrics.reduce((sum, b) => sum + b.grossMargin, 0);
    const totalWastageCost = branchMetrics.reduce((sum, b) => sum + b.wastageCost, 0);
    
    // Calculate averages
    const avgGrossMarginPercent = totalSales > 0 ? (totalGrossMargin / totalSales) * 100 : 0;
    const avgWastagePercent = totalSales > 0 ? (totalWastageCost / totalSales) * 100 : 0;
    const avgKdsSlaScore = branchMetrics.reduce((sum, b) => sum + b.kdsSlaScore, 0) / branchMetrics.length;
    const avgStaffScore = branchMetrics.reduce((sum, b) => sum + b.staffScore, 0) / branchMetrics.length;
    
    // Aggregate budget data
    const branchesWithTargets = branchMetrics.filter((b) => b.revenueTarget !== undefined);
    const totalRevenueTarget = branchesWithTargets.reduce((sum, b) => sum + (b.revenueTarget || 0), 0);
    const totalRevenueDelta = branchesWithTargets.reduce((sum, b) => sum + (b.revenueDelta || 0), 0);
    const totalCogsTarget = branchesWithTargets.reduce((sum, b) => sum + (b.cogsTarget || 0), 0);
    const totalCogsDelta = branchesWithTargets.reduce((sum, b) => sum + (b.cogsDelta || 0), 0);
    
    return {
      totalSales,
      totalCOGS,
      totalGrossMargin,
      totalWastageCost,
      avgGrossMarginPercent,
      avgWastagePercent,
      avgKdsSlaScore,
      avgStaffScore,
      branches: branchMetrics,
      periodStart,
      periodEnd,
      totalRevenueTarget: branchesWithTargets.length > 0 ? totalRevenueTarget : undefined,
      totalRevenueDelta: branchesWithTargets.length > 0 ? totalRevenueDelta : undefined,
      totalCogsTarget: branchesWithTargets.length > 0 ? totalCogsTarget : undefined,
      totalCogsDelta: branchesWithTargets.length > 0 ? totalCogsDelta : undefined,
    };
  }
}
