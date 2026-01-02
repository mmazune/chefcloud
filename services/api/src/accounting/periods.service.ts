import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPeriod(orgId: string, name: string, startsAt: Date, endsAt: Date) {
    if (startsAt >= endsAt) {
      throw new BadRequestException('Period start must be before end');
    }

    const overlap = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        OR: [{ startsAt: { lte: endsAt }, endsAt: { gte: startsAt } }],
      },
    });

    if (overlap) {
      throw new BadRequestException(`Period overlaps with ${overlap.name}`);
    }

    const period = await this.prisma.client.fiscalPeriod.create({
      data: { orgId, name, startsAt, endsAt, status: 'OPEN' },
    });

    this.logger.log(`Created fiscal period: ${name}`);
    return period;
  }

  async lockPeriod(periodId: string, userId: string) {
    const period = await this.prisma.client.fiscalPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period ${periodId} not found`);
    }

    if (period.status === 'LOCKED') {
      throw new BadRequestException(`Period ${period.name} is already locked`);
    }

    const updated = await this.prisma.client.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'LOCKED', lockedById: userId, lockedAt: new Date() },
    });

    this.logger.log(`Locked fiscal period: ${period.name}`);
    return updated;
  }

  async closePeriod(periodId: string, userId: string) {
    const period = await this.prisma.client.fiscalPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period ${periodId} not found`);
    }

    if (period.status !== 'OPEN') {
      throw new BadRequestException(`Period ${period.name} is not open (current status: ${period.status})`);
    }

    const updated = await this.prisma.client.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'CLOSED', closedById: userId, closedAt: new Date() },
    });

    this.logger.log(`Closed fiscal period: ${period.name}`);
    return updated;
  }

  async listPeriods(orgId: string, status?: 'OPEN' | 'CLOSED' | 'LOCKED') {
    return this.prisma.client.fiscalPeriod.findMany({
      where: { orgId, ...(status && { status }) },
      orderBy: { startsAt: 'desc' },
    });
  }

  async getPeriod(periodId: string) {
    const period = await this.prisma.client.fiscalPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period ${periodId} not found`);
    }

    return period;
  }
}
