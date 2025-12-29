/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CountsService } from '../inventory/counts.service';
import { OpenShiftDto, CloseShiftDto } from './shifts.dto';
import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis.config';

@Injectable()
export class ShiftsService implements OnModuleDestroy {
  private digestQueue: Queue;

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject('KpisService') private kpisService?: any,
    @Optional() private countsService?: CountsService,
  ) {
    this.digestQueue = new Queue('digest', {
      connection: getRedisConnectionOptions(),
    });
  }

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
    let stockCountOutOfTolerance = false;
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
        // M2-SHIFTS: Handle out-of-tolerance stock counts with manager override
        if (error.status === 409 && error.response?.code === 'COUNT_OUT_OF_TOLERANCE') {
          stockCountOutOfTolerance = true;

          // If override not provided, block shift close
          if (!dto.override) {
            throw error;
          }

          // Verify user has permission to override (L4 or L5 only)
          const user = await this.prisma.client.user.findUnique({
            where: { id: userId },
            select: { roleLevel: true },
          });

          if (!user || (user.roleLevel !== 'L4' && user.roleLevel !== 'L5')) {
            throw new ForbiddenException(
              'Only managers (L4) or owners (L5) can override out-of-tolerance stock counts',
            );
          }

          // Log override to audit
          await this.prisma.client.auditEvent.create({
            data: {
              branchId: shift.branchId,
              userId,
              action: 'shift.stock_count_override',
              resource: 'shifts',
              resourceId: shiftId,
              metadata: {
                reason: dto.override.reason,
                originalError: error.response,
                overrideBy: userId,
                overrideAt: new Date(),
              },
            },
          });
        } else if (error.status === 409 || error.response?.code) {
          // Other conflict errors, re-throw
          throw error;
        } else {
          // Other errors (e.g., service unavailable), log and continue
          console.warn('Stock count validation failed:', error.message);
        }
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
        // M2-SHIFTS: Record override if stock count was out of tolerance
        ...(stockCountOutOfTolerance && dto.override
          ? {
              overrideUserId: userId,
              overrideReason: dto.override.reason,
              overrideAt: new Date(),
            }
          : {}),
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        overrideBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Enqueue shift-close digest jobs (legacy and new subscription-based)
    // Legacy: Enqueue for old OwnerDigest system (sendOnShiftClose flag)
    await this.digestQueue.add('owner-digest-shift-close', {
      type: 'owner-digest-shift-close',
      orgId: shift.orgId,
      branchId: shift.branchId,
      shiftId: shift.id,
    });

    // M4: Enqueue for new subscription-based shift-end reports
    await this.digestQueue.add('shift-end-report', {
      type: 'shift-end-report',
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

  async onModuleDestroy() {
    if (this.digestQueue) {
      await this.digestQueue.close();
    }
  }
}
