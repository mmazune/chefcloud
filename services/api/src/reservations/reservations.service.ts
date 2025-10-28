/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReservationDto } from './reservations.dto';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, dto: CreateReservationDto): Promise<any> {
    const { deposit, tableId, startAt, endAt, ...rest } = dto;

    // Check for overlapping reservations if tableId is provided
    if (tableId) {
      const overlap = await this.prisma.reservation.findFirst({
        where: {
          tableId,
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
      });

      if (overlap) {
        throw new ConflictException(
          `Table ${tableId} is already reserved from ${overlap.startAt.toISOString()} to ${overlap.endAt.toISOString()}`,
        );
      }
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

  async findAll(orgId: string, from?: string, to?: string, status?: string): Promise<any> {
    const where: any = { orgId };

    if (from && to) {
      where.startAt = { gte: new Date(from) };
      where.endAt = { lte: new Date(to) };
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        table: true,
        branch: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
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
      throw new BadRequestException(`Cannot confirm reservation with depositStatus ${reservation.depositStatus}`);
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

  async cancel(orgId: string, id: string): Promise<any> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { paymentIntent: true },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status === 'SEATED') {
      throw new ConflictException('Cannot cancel a seated reservation');
    }

    const updateData: any = { status: 'CANCELLED' };

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
              ...((typeof reservation.paymentIntent?.metadata === 'object' && reservation.paymentIntent.metadata !== null) ? reservation.paymentIntent.metadata : {}),
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
          reason: 'Reservation cancelled',
          status: 'COMPLETED',
          createdById: orgId, // Using orgId as stub - should be actual userId
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
      data: { status: 'SEATED' },
    });
  }

  async getSummary(orgId: string, from: string, to: string): Promise<any> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        orgId,
        startAt: { gte: new Date(from) },
        endAt: { lte: new Date(to) },
      },
    });

    const summary = {
      total: reservations.length,
      byStatus: {} as Record<string, number>,
      deposits: {
        totalHeld: 0,
        totalCaptured: 0,
        totalRefunded: 0,
      },
    };

    for (const res of reservations) {
      // Count by status
      summary.byStatus[res.status] = (summary.byStatus[res.status] || 0) + 1;

      // Sum deposits by depositStatus
      const amount = Number(res.deposit);
      if (res.depositStatus === 'HELD') {
        summary.deposits.totalHeld += amount;
      } else if (res.depositStatus === 'CAPTURED') {
        summary.deposits.totalCaptured += amount;
      } else if (res.depositStatus === 'REFUNDED') {
        summary.deposits.totalRefunded += amount;
      }
    }

    return summary;
  }
}
