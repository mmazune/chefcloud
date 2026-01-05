/**
 * M10.18: Leave Projection Service
 *
 * Provides deterministic balance projections:
 * - Uses current ledger + policy to forecast balance month-by-month
 * - Pure computation - NO database mutations
 * - Deterministic rounding using policy's roundingPrecision
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

export interface ProjectionMonth {
  month: number;
  year: number;
  monthLabel: string;
  startingBalance: number;
  accrual: number;
  pendingDeductions: number;
  projectedBalance: number;
  atCap: boolean;
}

export interface ProjectionResult {
  userId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  currentBalance: number;
  projections: ProjectionMonth[];
}

@Injectable()
export class LeaveProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get balance projection for a user and leave type
   * This is a PURE COMPUTATION - no DB mutations
   */
  async getProjection(
    orgId: string,
    userId: string,
    leaveTypeId: string,
    months: number = 12,
  ): Promise<ProjectionResult> {
    // Get user's branch for policy lookup
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, orgId },
      select: { id: true, branchId: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get leave type
    const leaveType = await this.prisma.client.leaveTypeDefinition.findFirst({
      where: { id: leaveTypeId, orgId },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    // Get effective policy (branch-specific or org-level)
    const policy = await this.prisma.client.leavePolicy.findFirst({
      where: {
        orgId,
        leaveTypeId,
        isActive: true,
        OR: [
          { branchId: user.branchId },
          { branchId: null },
        ],
      },
      orderBy: { branchId: 'desc' }, // Prefer branch-specific
    });

    // Get current balance from ledger
    const currentBalance = await this.getCurrentBalance(orgId, userId, leaveTypeId);

    // Get pending deductions (SUBMITTED or APPROVED_STEP1 requests)
    const pendingRequests = await this.getPendingDeductions(orgId, userId, leaveTypeId);

    // Generate projections
    const projections = this.calculateProjections(
      currentBalance,
      pendingRequests,
      policy,
      months,
    );

    return {
      userId,
      leaveTypeId,
      leaveTypeName: leaveType.name,
      currentBalance,
      projections,
    };
  }

  /**
   * Get current balance from ledger
   */
  private async getCurrentBalance(
    orgId: string,
    userId: string,
    leaveTypeId: string,
  ): Promise<number> {
    const lastEntry = await this.prisma.client.leaveBalanceLedger.findFirst({
      where: { orgId, userId, leaveTypeId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    return lastEntry ? Number(lastEntry.balanceAfter) : 0;
  }

  /**
   * Get pending deductions by month (requests that will reduce balance when approved)
   */
  private async getPendingDeductions(
    orgId: string,
    userId: string,
    leaveTypeId: string,
  ): Promise<Map<string, number>> {
    const pending = await this.prisma.client.leaveRequestV2.findMany({
      where: {
        orgId,
        userId,
        leaveTypeId,
        status: { in: ['SUBMITTED', 'APPROVED_STEP1'] },
      },
      select: { startDate: true, totalHours: true },
    });

    // Group by month
    const deductionsByMonth = new Map<string, number>();
    for (const req of pending) {
      const monthKey = `${req.startDate.getFullYear()}-${String(req.startDate.getMonth() + 1).padStart(2, '0')}`;
      const current = deductionsByMonth.get(monthKey) || 0;
      deductionsByMonth.set(monthKey, current + Number(req.totalHours));
    }

    return deductionsByMonth;
  }

  /**
   * Calculate month-by-month projections (deterministic)
   */
  private calculateProjections(
    currentBalance: number,
    pendingDeductions: Map<string, number>,
    policy: any | null,
    months: number,
  ): ProjectionMonth[] {
    const projections: ProjectionMonth[] = [];
    let balance = currentBalance;

    const now = new Date();
    const precision = policy?.roundingPrecision ?? 2;
    const maxBalance = policy ? Number(policy.maxBalanceHours) : Infinity;

    for (let i = 0; i < months; i++) {
      const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = projDate.getMonth() + 1;
      const year = projDate.getFullYear();
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthLabel = projDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      const startingBalance = this.round(balance, precision);

      // Calculate accrual for this month
      let accrual = 0;
      if (policy && policy.accrualMethod !== 'NONE') {
        accrual = this.calculateMonthlyAccrual(policy);
      }

      // Get pending deductions for this month
      const deductions = pendingDeductions.get(monthKey) || 0;

      // Calculate projected balance (with cap)
      let projectedBalance = startingBalance + accrual - deductions;
      const atCap = projectedBalance >= maxBalance;
      if (atCap) {
        projectedBalance = maxBalance;
      }
      projectedBalance = this.round(projectedBalance, precision);

      projections.push({
        month,
        year,
        monthLabel,
        startingBalance,
        accrual: this.round(accrual, precision),
        pendingDeductions: this.round(deductions, precision),
        projectedBalance,
        atCap,
      });

      // Update running balance for next month
      balance = projectedBalance;
    }

    return projections;
  }

  /**
   * Calculate monthly accrual based on policy
   */
  private calculateMonthlyAccrual(policy: any): number {
    if (!policy || policy.accrualMethod === 'NONE') {
      return 0;
    }

    // FIXED_MONTHLY: accrualRate is hours per month
    if (policy.accrualMethod === 'FIXED_MONTHLY') {
      return Number(policy.accrualRate);
    }

    // HOURS_WORKED_RATE: Would need actual hours worked data
    // For projection, assume average of 160 hours/month
    if (policy.accrualMethod === 'HOURS_WORKED_RATE') {
      const assumedMonthlyHours = 160;
      return Number(policy.accrualRate) * assumedMonthlyHours;
    }

    return 0;
  }

  /**
   * Deterministic rounding
   */
  private round(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Bulk projection for all leave types for a user
   */
  async getAllProjections(
    orgId: string,
    userId: string,
    months: number = 12,
  ): Promise<ProjectionResult[]> {
    // Get all active leave types for the org
    const leaveTypes = await this.prisma.client.leaveTypeDefinition.findMany({
      where: { orgId, isActive: true },
    });

    const results: ProjectionResult[] = [];
    for (const lt of leaveTypes) {
      try {
        const projection = await this.getProjection(orgId, userId, lt.id, months);
        results.push(projection);
      } catch {
        // Skip if projection fails for a specific type
      }
    }

    return results;
  }
}
