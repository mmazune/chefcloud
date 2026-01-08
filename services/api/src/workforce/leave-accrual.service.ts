/**
 * M10.17: Leave Accrual Service
 *
 * Handles balance accrual operations (callable, no intervals):
 * - FIXED_MONTHLY: Fixed hours per month
 * - HOURS_WORKED_RATE: Proportional to hours worked
 *
 * Features:
 * - Decimal(10,4) precision to prevent rounding drift
 * - Carryover cap enforcement
 * - Max balance enforcement
 * - Ledger CREDIT entries with full audit trail
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

export interface AccrualRunResult {
  userId: string;
  leaveTypeId: string;
  accrued: number;
  previousBalance: number;
  newBalance: number;
  cappedAt?: number;
}

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Run monthly accrual for an org
   * Called by cron job or manually - NO intervals inside
   */
  async runMonthlyAccrual(orgId: string, periodMonth: number, periodYear: number): Promise<AccrualRunResult[]> {
    const results: AccrualRunResult[] = [];

    // Get all active policies for the org
    const policies = await this.prisma.client.leavePolicy.findMany({
      where: {
        orgId,
        isActive: true,
        accrualMethod: { not: 'NONE' },
      },
      include: {
        leaveType: true,
      },
    });

    // Group policies by branchId (null = org-wide)
    const orgPolicies = policies.filter((p) => !p.branchId);
    const branchPolicies = policies.filter((p) => p.branchId);

    // Get all active employees in the org
    const employees = await this.prisma.client.user.findMany({
      where: {
        orgId,
        isActive: true,
      },
    });

    for (const employee of employees) {
      const branchId = employee.branchId;

      // Get effective policies for this employee
      const effectivePolicies = this.getEffectivePolicies(orgPolicies, branchPolicies, branchId);

      for (const policy of effectivePolicies) {
        const accrualResult = await this.accrueForEmployee(
          employee.id,
          policy,
          orgId,
          periodMonth,
          periodYear,
        );

        if (accrualResult) {
          results.push(accrualResult);
        }
      }
    }

    this.logger.log(`Monthly accrual completed for org ${orgId}: ${results.length} accruals processed`);
    return results;
  }

  /**
   * Run accrual for a single employee+policy
   */
  private async accrueForEmployee(
    userId: string,
    policy: any,
    orgId: string,
    periodMonth: number,
    periodYear: number,
  ): Promise<AccrualRunResult | null> {
    // Check if accrual already processed for this period
    const existingEntry = await this.prisma.client.leaveBalanceLedger.findFirst({
      where: {
        userId,
        leaveTypeId: policy.leaveTypeId,
        referenceType: 'ACCRUAL',
        reason: { contains: `${periodYear}-${String(periodMonth).padStart(2, '0')}` },
      },
    });

    if (existingEntry) {
      // Already accrued for this period
      return null;
    }

    let accrualHours: Prisma.Decimal;

    if (policy.accrualMethod === 'FIXED_MONTHLY') {
      accrualHours = policy.accrualRate;
    } else if (policy.accrualMethod === 'HOURS_WORKED_RATE') {
      // Calculate hours worked in the period
      const hoursWorked = await this.getHoursWorkedInPeriod(userId, periodMonth, periodYear);
      accrualHours = hoursWorked.mul(policy.accrualRate);
    } else {
      return null;
    }

    // Get current balance
    const currentBalance = await this.getCurrentBalance(userId, policy.leaveTypeId);

    // Calculate new balance with cap
    let newBalance = currentBalance.add(accrualHours);

    // Enforce max balance cap
    if (policy.maxBalanceHours && newBalance.gt(policy.maxBalanceHours)) {
      newBalance = policy.maxBalanceHours;
    }

    // Calculate actual accrual (may be less due to cap)
    const actualAccrual = newBalance.sub(currentBalance);

    if (actualAccrual.lte(0)) {
      return null; // Already at cap
    }

    // Create ledger CREDIT entry
    await this.prisma.client.leaveBalanceLedger.create({
      data: {
        orgId,
        userId,
        leaveTypeId: policy.leaveTypeId,
        entryType: 'CREDIT',
        deltaHours: actualAccrual,
        balanceAfter: newBalance,
        reason: `Monthly accrual for ${periodYear}-${String(periodMonth).padStart(2, '0')}`,
        referenceType: 'ACCRUAL',
        // Note: referenceId is FK to LeaveRequestV2, so we don't set it for accruals
      },
    });

    return {
      userId,
      leaveTypeId: policy.leaveTypeId,
      accrued: actualAccrual.toNumber(),
      previousBalance: currentBalance.toNumber(),
      newBalance: newBalance.toNumber(),
      cappedAt: policy.maxBalanceHours ? policy.maxBalanceHours.toNumber() : undefined,
    };
  }

  /**
   * Run year-end carryover processing
   */
  async runYearEndCarryover(orgId: string, year: number): Promise<{ userId: string; leaveTypeId: string; carriedOver: number; forfeited: number }[]> {
    const results: { userId: string; leaveTypeId: string; carriedOver: number; forfeited: number }[] = [];

    // Get all policies with carryover rules
    const policies = await this.prisma.client.leavePolicy.findMany({
      where: {
        orgId,
        isActive: true,
        carryoverMaxHours: { not: null },
      },
    });

    for (const policy of policies) {
      // Get all users with balances for this leave type
      const userBalances = await this.prisma.client.leaveBalanceLedger.groupBy({
        by: ['userId'],
        where: {
          leaveTypeId: policy.leaveTypeId,
        },
      });

      for (const { userId } of userBalances) {
        const currentBalance = await this.getCurrentBalance(userId, policy.leaveTypeId);

        if (currentBalance.lte(0)) continue;

        const carryoverMax = policy.carryoverMaxHours || new Prisma.Decimal(0);
        const carriedOver = Prisma.Decimal.min(currentBalance, carryoverMax);
        const forfeited = currentBalance.sub(carriedOver);

        if (forfeited.gt(0)) {
          // Create forfeiture entry
          await this.prisma.client.leaveBalanceLedger.create({
            data: {
              orgId,
              userId,
              leaveTypeId: policy.leaveTypeId,
              entryType: 'DEBIT',
              deltaHours: forfeited.negated(),
              balanceAfter: carriedOver,
              reason: `Year-end carryover adjustment for ${year}. Forfeited: ${forfeited.toNumber()} hours`,
              referenceType: 'CARRYOVER',
              referenceId: `${year}-carryover`,
            },
          });

          results.push({
            userId,
            leaveTypeId: policy.leaveTypeId,
            carriedOver: carriedOver.toNumber(),
            forfeited: forfeited.toNumber(),
          });
        }
      }
    }

    this.logger.log(`Year-end carryover completed for org ${orgId}: ${results.length} adjustments`);
    return results;
  }

  /**
   * Manual balance adjustment (admin action)
   */
  async adjustBalance(
    orgId: string,
    userId: string,
    leaveTypeId: string,
    deltaHours: number,
    reason: string,
    adjustedBy: string,
  ): Promise<any> {
    // Validate required fields
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    if (!leaveTypeId) {
      throw new BadRequestException('Leave type ID is required');
    }

    const currentBalance = await this.getCurrentBalance(userId, leaveTypeId);
    const delta = new Prisma.Decimal(deltaHours);
    const newBalance = currentBalance.add(delta);

    return this.prisma.client.leaveBalanceLedger.create({
      data: {
        orgId,
        userId,
        leaveTypeId,
        entryType: deltaHours >= 0 ? 'CREDIT' : 'DEBIT',
        deltaHours: delta,
        balanceAfter: newBalance,
        reason: `Manual adjustment: ${reason} (by ${adjustedBy})`,
        referenceType: 'ADJUSTMENT',
      },
    });
  }

  /**
   * Get current balance for user+leaveType
   */
  async getCurrentBalance(userId: string, leaveTypeId: string): Promise<Prisma.Decimal> {
    const lastEntry = await this.prisma.client.leaveBalanceLedger.findFirst({
      where: { userId, leaveTypeId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    return lastEntry?.balanceAfter ?? new Prisma.Decimal(0);
  }

  /**
   * Get balance ledger history
   */
  async getLedgerHistory(userId: string, leaveTypeId: string, limit = 50): Promise<any[]> {
    const where: any = { userId };
    if (leaveTypeId && leaveTypeId.length > 0) {
      where.leaveTypeId = leaveTypeId;
    }
    return this.prisma.client.leaveBalanceLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get hours worked in a period (from approved timesheets)
   */
  private async getHoursWorkedInPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<Prisma.Decimal> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const timesheets = await this.prisma.client.timeEntry.findMany({
      where: {
        userId,
        approved: true,
        clockInAt: { gte: startDate, lte: endDate },
      },
    });

    let totalHours = new Prisma.Decimal(0);
    for (const ts of timesheets) {
      // Calculate hours from clockIn to clockOut
      if (ts.clockOutAt) {
        const diffMs = ts.clockOutAt.getTime() - ts.clockInAt.getTime();
        const hours = diffMs / (1000 * 60 * 60);
        totalHours = totalHours.add(new Prisma.Decimal(hours));
      }
    }

    return totalHours;
  }

  /**
   * Get effective policies for an employee
   */
  private getEffectivePolicies(
    orgPolicies: any[],
    branchPolicies: any[],
    branchId: string | null | undefined,
  ): any[] {
    const result: any[] = [];
    const coveredLeaveTypes = new Set<string>();

    // First, add branch-specific policies
    if (branchId) {
      for (const policy of branchPolicies) {
        if (policy.branchId === branchId) {
          result.push(policy);
          coveredLeaveTypes.add(policy.leaveTypeId);
        }
      }
    }

    // Then, add org-wide policies for uncovered leave types
    for (const policy of orgPolicies) {
      if (!coveredLeaveTypes.has(policy.leaveTypeId)) {
        result.push(policy);
      }
    }

    return result;
  }
}
