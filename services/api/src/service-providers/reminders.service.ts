import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateReminderDto, ServiceReminderResponse, ReminderSummary } from './dto/reminder.dto';
import { ContractFrequency, ContractStatus, ReminderSeverity, ReminderStatus } from '@chefcloud/db';

/**
 * M7: Service Payable Reminders
 *
 * Manages payment reminders for service contracts with automatic
 * generation based on contract terms and due dates.
 */
@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get reminders for an organization with optional filters
   */
  async getReminders(
    orgId: string,
    branchId?: string,
    status?: ReminderStatus,
    severity?: ReminderSeverity,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ServiceReminderResponse[]> {
    const reminders = await this.prisma.client.servicePayableReminder.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        ...(status && { status }),
        ...(severity && { severity }),
        ...(startDate &&
          endDate && {
            dueDate: { gte: startDate, lte: endDate },
          }),
      },
      include: {
        contract: {
          include: {
            provider: {
              select: { name: true, category: true },
            },
          },
        },
        branch: {
          select: { name: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { severity: 'desc' }],
    });

    return reminders.map(this.mapReminderResponse);
  }

  /**
   * Get a single reminder
   */
  async getReminder(orgId: string, reminderId: string): Promise<ServiceReminderResponse> {
    const reminder = await this.prisma.client.servicePayableReminder.findFirst({
      where: { id: reminderId, orgId },
      include: {
        contract: {
          include: {
            provider: {
              select: { name: true, category: true },
            },
          },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return this.mapReminderResponse(reminder);
  }

  /**
   * Update reminder status (PAID, IGNORED, ACKED)
   */
  async updateReminder(
    orgId: string,
    reminderId: string,
    userId: string,
    dto: UpdateReminderDto,
  ): Promise<ServiceReminderResponse> {
    // Verify reminder exists
    await this.getReminder(orgId, reminderId);

    const reminder = await this.prisma.client.servicePayableReminder.update({
      where: { id: reminderId },
      data: {
        status: dto.status,
        notes: dto.notes,
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
      include: {
        contract: {
          include: {
            provider: {
              select: { name: true, category: true },
            },
          },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    return this.mapReminderResponse(reminder);
  }

  /**
   * Get reminder summary statistics
   */
  async getReminderSummary(orgId: string, branchId?: string): Promise<ReminderSummary> {
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }

    const reminders = await this.prisma.client.servicePayableReminder.findMany({
      where: {
        ...where,
        status: { in: ['PENDING', 'SENT'] },
      },
      include: {
        contract: {
          select: { amount: true },
        },
      },
    });

    const summary: ReminderSummary = {
      overdue: 0,
      dueToday: 0,
      dueSoon: 0,
      total: reminders.length,
      totalAmount: 0,
    };

    for (const reminder of reminders) {
      summary.totalAmount += Number(reminder.contract.amount);

      if (reminder.severity === 'OVERDUE') {
        summary.overdue++;
      } else if (reminder.severity === 'DUE_TODAY') {
        summary.dueToday++;
      } else if (reminder.severity === 'DUE_SOON') {
        summary.dueSoon++;
      }
    }

    return summary;
  }

  /**
   * Generate reminders for all active contracts
   * Called by worker job daily
   */
  async generateReminders(): Promise<{ created: number; updated: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let created = 0;
    let updated = 0;

    // Get all active contracts
    const contracts = await this.prisma.client.serviceContract.findMany({
      where: {
        status: ContractStatus.ACTIVE,
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      include: {
        provider: {
          select: { orgId: true },
        },
      },
    });

    for (const contract of contracts) {
      const dueDates = this.calculateDueDates(contract, today);

      for (const dueDate of dueDates) {
        const severity = this.calculateSeverity(dueDate, today);

        if (severity) {
          // Try to find existing reminder for this date and severity
          const existing = await this.prisma.client.servicePayableReminder.findUnique({
            where: {
              contractId_dueDate_severity: {
                contractId: contract.id,
                dueDate,
                severity,
              },
            },
          });

          if (!existing) {
            // Create new reminder
            await this.prisma.client.servicePayableReminder.create({
              data: {
                contractId: contract.id,
                branchId: contract.branchId,
                orgId: contract.provider.orgId,
                dueDate,
                severity,
                status: ReminderStatus.PENDING,
              },
            });
            created++;
          } else if (existing.status === ReminderStatus.PENDING) {
            // Update severity if it changed (e.g., DUE_SOON -> DUE_TODAY)
            if (existing.severity !== severity) {
              await this.prisma.client.servicePayableReminder.update({
                where: { id: existing.id },
                data: { severity },
              });
              updated++;
            }
          }
        }
      }
    }

    return { created, updated };
  }

  /**
   * Calculate upcoming due dates for a contract
   */
  private calculateDueDates(contract: any, fromDate: Date): Date[] {
    const dates: Date[] = [];
    const lookAheadDays = 30; // Look ahead 30 days

    if (contract.frequency === ContractFrequency.ONE_OFF) {
      // One-off contract due on start date
      if (contract.startDate >= fromDate) {
        dates.push(contract.startDate);
      }
    } else if (contract.frequency === ContractFrequency.DAILY) {
      // Daily contracts - create reminders for next 7 days
      for (let i = 0; i <= 7; i++) {
        const date = new Date(fromDate);
        date.setDate(date.getDate() + i);
        if (!contract.endDate || date <= contract.endDate) {
          dates.push(date);
        }
      }
    } else if (contract.frequency === ContractFrequency.WEEKLY && contract.dueDay !== null) {
      // Weekly contracts - find next occurrences of dueDay (0=Sunday, 6=Saturday)
      const date = new Date(fromDate);
      const endDate = new Date(fromDate);
      endDate.setDate(endDate.getDate() + lookAheadDays);

      while (date <= endDate) {
        if (date.getDay() === contract.dueDay) {
          if (!contract.endDate || date <= contract.endDate) {
            dates.push(new Date(date));
          }
        }
        date.setDate(date.getDate() + 1);
      }
    } else if (contract.frequency === ContractFrequency.MONTHLY && contract.dueDay !== null) {
      // Monthly contracts - find next occurrences of dueDay
      const currentDate = new Date(fromDate);
      const endDate = new Date(fromDate);
      endDate.setMonth(endDate.getMonth() + 3); // Look ahead 3 months

      const checkDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        contract.dueDay,
      );

      while (checkDate <= endDate) {
        if (checkDate >= fromDate) {
          if (!contract.endDate || checkDate <= contract.endDate) {
            dates.push(new Date(checkDate));
          }
        }
        // Move to next month
        checkDate.setMonth(checkDate.getMonth() + 1);
      }
    }

    return dates;
  }

  /**
   * Calculate severity based on due date vs today
   */
  private calculateSeverity(dueDate: Date, today: Date): ReminderSeverity | null {
    const dueDateOnly = new Date(dueDate);
    dueDateOnly.setHours(0, 0, 0, 0);

    const todayOnly = new Date(today);
    todayOnly.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (dueDateOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      return ReminderSeverity.OVERDUE;
    } else if (diffDays === 0) {
      return ReminderSeverity.DUE_TODAY;
    } else if (diffDays <= 7) {
      return ReminderSeverity.DUE_SOON;
    }

    // Don't create reminders for dates > 7 days away
    return null;
  }

  private mapReminderResponse(reminder: any): ServiceReminderResponse {
    return {
      id: reminder.id,
      contractId: reminder.contractId,
      branchId: reminder.branchId,
      orgId: reminder.orgId,
      dueDate: reminder.dueDate,
      status: reminder.status,
      severity: reminder.severity,
      acknowledgedById: reminder.acknowledgedById,
      acknowledgedAt: reminder.acknowledgedAt,
      notes: reminder.notes,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
      providerName: reminder.contract?.provider?.name,
      providerCategory: reminder.contract?.provider?.category,
      contractAmount: reminder.contract?.amount ? Number(reminder.contract.amount) : undefined,
      contractCurrency: reminder.contract?.currency,
      branchName: reminder.branch?.name,
    };
  }
}
