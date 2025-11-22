import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateBudgetDto,
  BudgetResponse,
  BudgetSummaryResponse,
  FranchiseBudgetSummaryResponse,
} from './dto/budget.dto';
import { BudgetCategory } from '@chefcloud/db';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create or update a budget for a specific branch, year, month, and category
   */
  async setBudget(orgId: string, dto: CreateBudgetDto): Promise<BudgetResponse> {
    // Validate branch belongs to org
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check if budget already exists
    const existing = await this.prisma.client.opsBudget.findFirst({
      where: {
        branchId: dto.branchId,
        year: dto.year,
        month: dto.month,
        category: dto.category,
      },
    });

    let budget;
    if (existing) {
      budget = await this.prisma.client.opsBudget.update({
        where: { id: existing.id },
        data: { budgetAmount: dto.budgetAmount },
        include: { branch: true },
      });
    } else {
      budget = await this.prisma.client.opsBudget.create({
        data: {
          orgId,
          branchId: dto.branchId,
          year: dto.year,
          month: dto.month,
          category: dto.category,
          budgetAmount: dto.budgetAmount,
          actualAmount: 0,
        },
        include: { branch: true },
      });
    }

    return this.formatBudgetResponse(budget);
  }

  /**
   * Get budgets for a specific branch and period
   */
  async getBudgets(
    orgId: string,
    branchId: string,
    year: number,
    month: number,
  ): Promise<BudgetResponse[]> {
    // Validate branch belongs to org
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const budgets = await this.prisma.client.opsBudget.findMany({
      where: { branchId, year, month },
      include: { branch: true },
      orderBy: { category: 'asc' },
    });

    return budgets.map((b) => this.formatBudgetResponse(b));
  }

  /**
   * Get budget summary for a branch and period
   */
  async getBudgetSummary(
    orgId: string,
    branchId: string,
    year: number,
    month: number,
  ): Promise<BudgetSummaryResponse> {
    const budgets = await this.getBudgets(orgId, branchId, year, month);

    const totalBudget = budgets.reduce((sum, b) => sum + b.budgetAmount, 0);
    const totalActual = budgets.reduce((sum, b) => sum + b.actualAmount, 0);
    const totalVariance = totalActual - totalBudget;
    const totalVariancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });

    return {
      branchId,
      branchName: branch?.name || 'Unknown',
      period: `${year}-${String(month).padStart(2, '0')}`,
      totalBudget,
      totalActual,
      totalVariance,
      totalVariancePercent,
      byCategory: budgets.map((b) => ({
        category: b.category as BudgetCategory,
        budgetAmount: b.budgetAmount,
        actualAmount: b.actualAmount,
        variance: b.variance,
        variancePercent: b.variancePercent,
      })),
    };
  }

  /**
   * Get franchise-wide budget summary
   */
  async getFranchiseBudgetSummary(
    orgId: string,
    year: number,
    month: number,
  ): Promise<FranchiseBudgetSummaryResponse> {
    // Get all branches for this org
    const branches = await this.prisma.branch.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    const byBranch = [];
    let franchiseTotalBudget = 0;
    let franchiseTotalActual = 0;

    for (const branch of branches) {
      const summary = await this.getBudgetSummary(orgId, branch.id, year, month);

      franchiseTotalBudget += summary.totalBudget;
      franchiseTotalActual += summary.totalActual;

      // Find top 3 overspends
      const overspends = summary.byCategory
        .filter((c) => c.variance > 0)
        .sort((a, b) => b.variance - a.variance)
        .slice(0, 3)
        .map((c) => ({
          category: c.category,
          variance: c.variance,
          variancePercent: c.variancePercent,
        }));

      byBranch.push({
        branchId: branch.id,
        branchName: branch.name,
        totalBudget: summary.totalBudget,
        totalActual: summary.totalActual,
        totalVariance: summary.totalVariance,
        topOverspends: overspends,
      });
    }

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      franchiseTotal: {
        totalBudget: franchiseTotalBudget,
        totalActual: franchiseTotalActual,
        totalVariance: franchiseTotalActual - franchiseTotalBudget,
      },
      byBranch,
    };
  }

  /**
   * Update budget actuals based on real transactions
   * This should be called by a worker job at the end of each month or on-demand
   */
  async updateBudgetActuals(
    branchId: string,
    year: number,
    month: number,
  ): Promise<{ updated: number }> {
    this.logger.log({ branchId, year, month }, 'Updating budget actuals');

    // Get branch to access orgId
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Get all budgets for this period
    const budgets = await this.prisma.client.opsBudget.findMany({
      where: { branchId, year, month },
    });

    if (budgets.length === 0) {
      this.logger.warn({ branchId, year, month }, 'No budgets found for period');
      return { updated: 0 };
    }

    // Calculate date range for this month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    let updated = 0;

    for (const budget of budgets) {
      let actualAmount = 0;

      try {
        switch (budget.category) {
          case 'STOCK': {
            // Get stock costs from reconciliation or purchase orders
            const purchaseOrders = await this.prisma.client.purchaseOrder.findMany({
              where: {
                branchId,
                status: 'received',
                placedAt: { gte: startDate, lte: endDate },
              },
            });
            actualAmount = purchaseOrders.reduce(
              (sum: number, po: any) => sum + Number(po.totalAmount),
              0,
            );
            break;
          }

          case 'PAYROLL': {
            // Get payroll costs from payroll postings
            const payrollPostings = await this.prisma.client.journalEntry.findMany({
              where: {
                orgId: branch.orgId,
                date: { gte: startDate, lte: endDate },
                OR: [
                  { source: { equals: 'PAYROLL' } },
                  { memo: { contains: 'Payroll' } },
                  { memo: { contains: 'Salary' } },
                ],
              },
            });
            actualAmount = payrollPostings.reduce((sum: number, je: any) => {
              // Sum debit amounts for expense accounts
              const debitTotal = je.lineItems
                .filter((li: any) => li.debit > 0)
                .reduce((s: number, li: any) => s + Number(li.debit), 0);
              return sum + debitTotal;
            }, 0);
            break;
          }

          case 'UTILITIES':
          case 'RENT':
          case 'MARKETING':
          case 'SERVICE_PROVIDERS':
          case 'MISC': {
            // Get actuals from service contracts matching this category
            const categoryMap: Record<string, string[]> = {
              UTILITIES: ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET'],
              RENT: ['RENT'],
              MARKETING: ['MARKETING', 'DJ', 'PHOTOGRAPHER'],
              EQUIPMENT: ['EQUIPMENT'],
              SUPPLIES: ['SUPPLIES'],
              INSURANCE: ['INSURANCE'],
              MAINTENANCE: ['MAINTENANCE'],
              OTHER: ['OTHER'],
            };

            const providerCategories = categoryMap[budget.category] || [];

            // Get all paid reminders for matching contracts in this period
            const paidReminders = await this.prisma.client.servicePayableReminder.findMany({
              where: {
                dueDate: { gte: startDate, lte: endDate },
                status: 'PAID',
                contract: {
                  branchId,
                  provider: {
                    category: { in: providerCategories as any },
                  },
                },
              },
              include: { contract: true },
            });

            actualAmount = paidReminders.reduce(
              (sum: number, reminder: any) => sum + Number(reminder.contract.amount),
              0,
            );
            break;
          }

          default:
            this.logger.warn({ category: budget.category }, 'Unknown budget category');
        }

        // Update the budget with actual amount
        await this.prisma.client.opsBudget.update({
          where: { id: budget.id },
          data: { actualAmount },
        });

        updated++;
        this.logger.log(
          { category: budget.category, actualAmount },
          'Updated budget actual amount',
        );
      } catch (error) {
        this.logger.error(
          { category: budget.category, error },
          'Failed to update budget actual amount',
        );
      }
    }

    return { updated };
  }

  private formatBudgetResponse(budget: any): BudgetResponse {
    const variance = Number(budget.actualAmount) - Number(budget.budgetAmount);
    const variancePercent =
      Number(budget.budgetAmount) > 0 ? (variance / Number(budget.budgetAmount)) * 100 : 0;

    return {
      id: budget.id,
      branchId: budget.branchId,
      branchName: budget.branch?.name || 'Unknown',
      year: budget.year,
      month: budget.month,
      category: budget.category,
      budgetAmount: Number(budget.budgetAmount),
      actualAmount: Number(budget.actualAmount),
      variance,
      variancePercent,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
