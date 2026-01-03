/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateReservationDto,
  UpdateReservationDto,
  CancelReservationDto,
  NoShowReservationDto,
  AvailabilityQueryDto,
} from './reservations.dto';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, dto: CreateReservationDto, userId?: string): Promise<any> {
    const { deposit, tableId, startAt, endAt, source, notes, ...rest } = dto;

    // Check for overlapping reservations if tableId is provided
    if (tableId) {
      await this.validateTableAvailability(tableId, startAt, endAt);
    }

    // Get reservationHoldMinutes from settings
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });
    const holdMinutes = settings?.reservationHoldMinutes || 30;

    // Create PaymentIntent if deposit > 0
    let paymentIntentId: string | undefined;
    let depositStatus = 'NONE';
    let autoCancelAt: Date | undefined;

    if (deposit && deposit > 0) {
      const intent = await this.prisma.paymentIntent.create({
        data: {
          orgId,
          branchId: dto.branchId,
          orderId: 'reservation-pending', // Temporary, will link to order on seat
          provider: 'MOMO',
          amount: deposit,
          status: 'PENDING',
          metadata: { type: 'reservation_deposit' },
        },
      });
      paymentIntentId = intent.id;
      depositStatus = 'HELD';
      autoCancelAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        orgId,
        ...rest,
        tableId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        deposit: deposit || 0,
        depositStatus,
        paymentIntentId,
        autoCancelAt,
        status: 'HELD',
        source: source || 'PHONE',
        notes,
        createdById: userId,
      },
      include: {
        table: true,
        paymentIntent: true,
      },
    });

    // Create reminder if startAt > 24h from now
    const hoursUntilStart = (new Date(startAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart > 24 && dto.phone) {
      const reminderTime = new Date(new Date(startAt).getTime() - 24 * 60 * 60 * 1000);
      await this.prisma.client.reservationReminder.create({
        data: {
          reservationId: reservation.id,
          channel: 'SMS',
          target: dto.phone,
          scheduledAt: reminderTime,
        },
      });
    }

    return reservation;
  }

  async findAll(
    orgId: string,
    from?: string,
    to?: string,
    status?: string,
    branchId?: string,
  ): Promise<any> {
    const where: any = { orgId };

    if (from && to) {
      where.startAt = { gte: new Date(from) };
      where.endAt = { lte: new Date(to) };
    }

    if (status) {
      where.status = status;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        table: true,
        branch: { select: { id: true, name: true } },
        floorPlan: { select: { id: true, name: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(orgId: string, id: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        table: true,
        branch: { select: { id: true, name: true } },
        floorPlan: { select: { id: true, name: true } },
        paymentIntent: true,
        reminders: true,
      },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    return reservation;
  }

  async update(orgId: string, id: string, dto: UpdateReservationDto, userId?: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    // Cannot update completed, cancelled, or no-show reservations
    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(reservation.status)) {
      throw new ConflictException(`Cannot update reservation in status ${reservation.status}`);
    }

    // Cannot update seated reservations (except notes)
    if (reservation.status === 'SEATED') {
      const allowedFields = ['notes'];
      const providedFields = Object.keys(dto).filter(
        (k) => dto[k as keyof UpdateReservationDto] !== undefined,
      );
      const disallowed = providedFields.filter((f) => !allowedFields.includes(f));
      if (disallowed.length > 0) {
        throw new ConflictException(
          `Cannot update fields [${disallowed.join(', ')}] on seated reservation`,
        );
      }
    }

    // If changing tableId or time, validate no overlap
    const newTableId = dto.tableId || reservation.tableId;
    const newStartAt = dto.startAt || reservation.startAt.toISOString();
    const newEndAt = dto.endAt || reservation.endAt.toISOString();

    if (newTableId && (dto.tableId || dto.startAt || dto.endAt)) {
      await this.validateTableAvailability(newTableId, newStartAt, newEndAt, id);
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        updatedById: userId,
      },
      include: {
        table: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async confirm(orgId: string, id: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'HELD') {
      throw new ConflictException(`Cannot confirm reservation in status ${reservation.status}`);
    }

    if (!['NONE', 'HELD'].includes(reservation.depositStatus)) {
      throw new BadRequestException(
        `Cannot confirm reservation with depositStatus ${reservation.depositStatus}`,
      );
    }

    const updateData: any = { status: 'CONFIRMED', autoCancelAt: null };

    // If depositStatus is HELD, capture it
    if (reservation.depositStatus === 'HELD') {
      updateData.depositStatus = 'CAPTURED';
      // In production, would call payment adapter to capture
      // For now, simulate success
    }

    return this.prisma.reservation.update({
      where: { id },
      data: updateData,
    });
  }

  async cancel(orgId: string, id: string, dto?: CancelReservationDto, userId?: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { paymentIntent: true },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (['SEATED', 'COMPLETED'].includes(reservation.status)) {
      throw new ConflictException(`Cannot cancel reservation in status ${reservation.status}`);
    }

    const updateData: any = {
      status: 'CANCELLED',
      cancellationReason: dto?.reason,
      cancelledById: userId,
    };

    // Handle deposit refund based on depositStatus
    if (reservation.depositStatus === 'HELD') {
      // Mark as refunded (simulate via payment adapter)
      updateData.depositStatus = 'REFUNDED';
      if (reservation.paymentIntentId) {
        await this.prisma.paymentIntent.update({
          where: { id: reservation.paymentIntentId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...(typeof reservation.paymentIntent?.metadata === 'object' &&
              reservation.paymentIntent.metadata !== null
                ? reservation.paymentIntent.metadata
                : {}),
              refund_reason: 'reservation_cancelled',
            },
          },
        });
      }
    } else if (reservation.depositStatus === 'CAPTURED' && Number(reservation.deposit) > 0) {
      // Create Refund record
      const lastPaymentId = reservation.paymentIntentId || 'unknown';
      await this.prisma.refund.create({
        data: {
          orderId: 'reservation-' + reservation.id,
          paymentId: lastPaymentId,
          provider: 'MOMO',
          amount: reservation.deposit,
          reason: dto?.reason || 'Reservation cancelled',
          status: 'COMPLETED',
          createdById: userId || orgId, // Using orgId as stub - should be actual userId
        },
      });
      updateData.depositStatus = 'REFUNDED';
    }

    return this.prisma.reservation.update({
      where: { id },
      data: updateData,
    });
  }

  async seat(orgId: string, id: string, orderId?: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (!['HELD', 'CONFIRMED'].includes(reservation.status)) {
      throw new ConflictException(`Cannot seat reservation in status ${reservation.status}`);
    }

    // If orderId provided, link it to the table
    if (orderId && reservation.tableId) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { tableId: reservation.tableId },
      });
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'SEATED',
        seatedAt: new Date(),
      },
    });
  }

  async complete(orgId: string, id: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status !== 'SEATED') {
      throw new ConflictException(`Cannot complete reservation in status ${reservation.status}`);
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  async noShow(orgId: string, id: string, dto?: NoShowReservationDto, userId?: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (!['HELD', 'CONFIRMED'].includes(reservation.status)) {
      throw new ConflictException(`Cannot mark no-show for reservation in status ${reservation.status}`);
    }

    // Forfeit deposit on no-show
    const updateData: any = {
      status: 'NO_SHOW',
      cancellationReason: dto?.reason || 'Customer did not show up',
      cancelledById: userId,
    };

    // If deposit was held or captured, mark as forfeited (no refund)
    if (['HELD', 'CAPTURED'].includes(reservation.depositStatus)) {
      updateData.depositStatus = 'CAPTURED'; // Forfeit = keep the deposit
    }

    return this.prisma.reservation.update({
      where: { id },
      data: updateData,
    });
  }

  async getAvailability(orgId: string, query: AvailabilityQueryDto): Promise<any> {
    const { branchId, startAt, endAt, partySize, floorPlanId } = query;

    // Get all floor plans for the branch
    const floorPlansWhere: any = { branchId };
    if (floorPlanId) {
      floorPlansWhere.id = floorPlanId;
    }

    const floorPlans = await this.prisma.client.floorPlan.findMany({
      where: floorPlansWhere,
      select: { id: true },
    });
    const floorPlanIds = floorPlans.map((fp) => fp.id);

    // Get all tables for those floor plans
    const tables = (await this.prisma.client.table.findMany({
      where: {
        floorPlanId: { in: floorPlanIds },
      },
      include: {
        floorPlan: { select: { id: true, name: true } },
      },
    })) as any[];

    // Get reservations that overlap with the requested time
    const overlappingReservations = await this.prisma.reservation.findMany({
      where: {
        orgId,
        branchId,
        status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
        OR: [
          {
            AND: [
              { startAt: { lte: new Date(startAt) } },
              { endAt: { gt: new Date(startAt) } },
            ],
          },
          {
            AND: [
              { startAt: { lt: new Date(endAt) } },
              { endAt: { gte: new Date(endAt) } },
            ],
          },
          {
            AND: [
              { startAt: { gte: new Date(startAt) } },
              { endAt: { lte: new Date(endAt) } },
            ],
          },
        ],
      },
      select: { tableId: true },
    });

    const occupiedTableIds = new Set(
      overlappingReservations.filter((r) => r.tableId).map((r) => r.tableId),
    );

    // Categorize tables
    const available = tables.filter((t) => {
      const isOccupied = occupiedTableIds.has(t.id);
      const hasCapacity = partySize ? t.capacity >= partySize : true;
      return !isOccupied && hasCapacity;
    });

    const occupied = tables.filter((t) => occupiedTableIds.has(t.id));

    return {
      timeSlot: { startAt, endAt },
      partySize,
      available: available.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        floorPlan: t.floorPlan,
      })),
      occupied: occupied.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        floorPlan: t.floorPlan,
      })),
      summary: {
        totalTables: tables.length,
        availableCount: available.length,
        occupiedCount: occupied.length,
      },
    };
  }

  async assignTables(orgId: string, id: string, tableIds: string[], userId?: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(reservation.status)) {
      throw new ConflictException(`Cannot assign tables to reservation in status ${reservation.status}`);
    }

    // For now, just assign the first table (multi-table support can be added later)
    const primaryTableId = tableIds[0];
    if (!primaryTableId) {
      throw new BadRequestException('At least one tableId is required');
    }

    // Validate no overlap
    await this.validateTableAvailability(
      primaryTableId,
      reservation.startAt.toISOString(),
      reservation.endAt.toISOString(),
      id,
    );

    return this.prisma.reservation.update({
      where: { id },
      data: {
        tableId: primaryTableId,
        updatedById: userId,
      },
      include: {
        table: true,
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getSummary(orgId: string, from: string, to: string, branchId?: string): Promise<any> {
    const where: any = {
      orgId,
      startAt: { gte: new Date(from) },
      endAt: { lte: new Date(to) },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const reservations = await this.prisma.reservation.findMany({ where });

    const summary = {
      total: reservations.length,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      deposits: {
        totalHeld: 0,
        totalCaptured: 0,
        totalRefunded: 0,
      },
      averagePartySize: 0,
    };

    let totalPartySize = 0;
    for (const res of reservations) {
      // Count by status
      summary.byStatus[res.status] = (summary.byStatus[res.status] || 0) + 1;

      // Count by source
      summary.bySource[res.source] = (summary.bySource[res.source] || 0) + 1;

      // Sum deposits by depositStatus
      const amount = Number(res.deposit);
      if (res.depositStatus === 'HELD') {
        summary.deposits.totalHeld += amount;
      } else if (res.depositStatus === 'CAPTURED') {
        summary.deposits.totalCaptured += amount;
      } else if (res.depositStatus === 'REFUNDED') {
        summary.deposits.totalRefunded += amount;
      }

      totalPartySize += res.partySize;
    }

    if (reservations.length > 0) {
      summary.averagePartySize = Math.round((totalPartySize / reservations.length) * 10) / 10;
    }

    return summary;
  }

  // Private helper methods
  private async validateTableAvailability(
    tableId: string,
    startAt: string,
    endAt: string,
    excludeReservationId?: string,
  ): Promise<void> {
    const overlapWhere: any = {
      tableId,
      status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
      OR: [
        {
          AND: [{ startAt: { lte: new Date(startAt) } }, { endAt: { gt: new Date(startAt) } }],
        },
        {
          AND: [{ startAt: { lt: new Date(endAt) } }, { endAt: { gte: new Date(endAt) } }],
        },
        {
          AND: [{ startAt: { gte: new Date(startAt) } }, { endAt: { lte: new Date(endAt) } }],
        },
      ],
    };

    if (excludeReservationId) {
      overlapWhere.id = { not: excludeReservationId };
    }

    const overlap = await this.prisma.reservation.findFirst({
      where: overlapWhere,
    });

    if (overlap) {
      throw new ConflictException(
        `Table ${tableId} is already reserved from ${overlap.startAt.toISOString()} to ${overlap.endAt.toISOString()}`,
      );
    }
  }
}
