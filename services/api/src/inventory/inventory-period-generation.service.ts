/**
 * M12.2: Period Generation Service
 *
 * Auto-generates monthly OPEN inventory periods for a branch.
 * Idempotent - skips existing periods.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { addMonths, parse, isValid } from 'date-fns';
import { InventoryPeriodEventsService } from './inventory-period-events.service';

export interface GeneratePeriodsDto {
  branchId: string;
  fromMonth: string; // YYYY-MM format
  toMonth: string;   // YYYY-MM format (inclusive)
}

export interface GeneratePeriodsResult {
  createdCount: number;
  existingCount: number;
  periods: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    isNew: boolean;
  }>;
}

@Injectable()
export class InventoryPeriodGenerationService {
  private readonly logger = new Logger(InventoryPeriodGenerationService.name);
  private readonly MAX_MONTHS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: InventoryPeriodEventsService,
  ) {}

  /**
   * Generate monthly periods for a branch.
   * Idempotent - existing periods are skipped.
   */
  async generatePeriods(
    orgId: string,
    userId: string,
    dto: GeneratePeriodsDto,
  ): Promise<GeneratePeriodsResult> {
    // Validate branch belongs to org
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: dto.branchId, orgId },
    });

    if (!branch) {
      throw new BadRequestException('Branch not found or does not belong to org');
    }

    // Parse fromMonth
    const fromDate = parse(dto.fromMonth, 'yyyy-MM', new Date());
    if (!isValid(fromDate)) {
      throw new BadRequestException('fromMonth must be in YYYY-MM format');
    }

    // Parse toMonth
    const toDate = parse(dto.toMonth, 'yyyy-MM', new Date());
    if (!isValid(toDate)) {
      throw new BadRequestException('toMonth must be in YYYY-MM format');
    }

    // Validate range
    if (toDate < fromDate) {
      throw new BadRequestException('toMonth must be >= fromMonth');
    }

    // Calculate number of months (inclusive)
    const fromYear = fromDate.getFullYear();
    const fromMonthNum = fromDate.getMonth();
    const toYear = toDate.getFullYear();
    const toMonthNum = toDate.getMonth();
    const months = (toYear - fromYear) * 12 + (toMonthNum - fromMonthNum) + 1;

    if (months > this.MAX_MONTHS) {
      throw new BadRequestException(`Cannot generate more than ${this.MAX_MONTHS} periods at once`);
    }

    const result: GeneratePeriodsResult = {
      createdCount: 0,
      existingCount: 0,
      periods: [],
    };

    // Generate each month
    for (let i = 0; i < months; i++) {
      const monthDate = addMonths(fromDate, i);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      // Create UTC dates explicitly to avoid local timezone issues
      const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // Day 0 of next month = last day of current month

      // Check if period already exists
      const existing = await this.prisma.client.inventoryPeriod.findFirst({
        where: {
          orgId,
          branchId: dto.branchId,
          startDate,
          endDate,
        },
      });

      if (existing) {
        result.existingCount++;
        result.periods.push({
          id: existing.id,
          startDate: existing.startDate.toISOString(),
          endDate: existing.endDate.toISOString(),
          status: existing.status,
          isNew: false,
        });
        continue;
      }

      // Create new period
      const period = await this.prisma.client.inventoryPeriod.create({
        data: {
          orgId,
          branchId: dto.branchId,
          startDate,
          endDate,
          status: 'OPEN',
        },
      });

      // Log event
      await this.eventsService.logEvent({
        orgId,
        branchId: dto.branchId,
        periodId: period.id,
        type: 'CREATED',
        actorUserId: userId,
        metadataJson: { source: 'auto-generate', fromMonth: dto.fromMonth },
      });

      result.createdCount++;
      result.periods.push({
        id: period.id,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        status: period.status,
        isNew: true,
      });
    }

    this.logger.log(
      `Generated ${result.createdCount} periods (${result.existingCount} existing) for branch ${dto.branchId}`,
    );

    return result;
  }
}
