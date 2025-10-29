/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CountsService } from '../inventory/counts.service';
import { OpenShiftDto, CloseShiftDto } from './shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject('KpisService') private kpisService?: any,
    @Optional() private countsService?: CountsService,
  ) {}

  private markKpisDirty(orgId: string, branchId: string) {
    if (this.kpisService) {
      this.kpisService.markDirty(orgId, branchId);
    }
  }

  async openShift(
    orgId: string,
    branchId: string,
    userId: string,
    dto: OpenShiftDto,
  ): Promise<any> {
    // Check if there's an open shift for this branch
    const existingShift = await this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
    });

    if (existingShift) {
      throw new BadRequestException('A shift is already open for this branch');
    }

    const result = await this.prisma.client.shift.create({
      data: {
        orgId,
        branchId,
        openedById: userId,
        openingFloat: dto.openingFloat,
        notes: dto.notes,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Invalidate KPI cache
    this.markKpisDirty(orgId, branchId);

    return result;
  }

  async closeShift(shiftId: string, userId: string, dto: CloseShiftDto): Promise<any> {
    const shift = await this.prisma.client.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (shift.closedAt) {
      throw new BadRequestException('Shift is already closed');
    }

    // E45-s1: Validate stock count before closing shift
    let reconciliation: any = null;
    if (this.countsService) {
      try {
        reconciliation = await this.countsService.validateShiftStockCount(shiftId);

        // Log reconciliation summary to audit
        await this.prisma.client.auditEvent.create({
          data: {
            branchId: shift.branchId,
            userId,
            action: 'shift.stock_reconciliation',
            resource: 'shifts',
            resourceId: shiftId,
            metadata: reconciliation,
          },
        });
      } catch (error: any) {
        // If ConflictException, re-throw to block shift close
        if (error.status === 409 || error.response?.code) {
          throw error;
        }
        // Other errors (e.g., service unavailable), log and continue
        console.warn('Stock count validation failed:', error.message);
      }
    }

    // Calculate over/short
    // This is simplified - in production you'd sum all payments for the shift
    const overShort = Number(dto.declaredCash) - Number(shift.openingFloat);

    const result = await this.prisma.client.shift.update({
      where: { id: shiftId },
      data: {
        closedById: userId,
        closedAt: new Date(),
        declaredCash: dto.declaredCash,
        overShort,
        notes: dto.notes || shift.notes,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Enqueue shift-close digest jobs
    const { Queue } = await import('bullmq');
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
    const digestQueue = new Queue('digest', { connection });

    await digestQueue.add('owner-digest-shift-close', {
      type: 'owner-digest-shift-close',
      orgId: shift.orgId,
      branchId: shift.branchId,
      shiftId: shift.id,
    });

    // Invalidate KPI cache
    this.markKpisDirty(shift.orgId, shift.branchId);

    return result;
  }

  async getCurrentShift(branchId: string): Promise<any> {
    return this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getShiftHistory(branchId: string, limit = 10): Promise<any> {
    return this.prisma.client.shift.findMany({
      where: { branchId },
      orderBy: { openedAt: 'desc' },
      take: limit,
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
