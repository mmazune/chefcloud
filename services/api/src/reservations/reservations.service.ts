/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

    // Create PaymentIntent if deposit > 0
    let paymentIntentId: string | undefined;
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
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        orgId,
        ...rest,
        tableId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        deposit: deposit || 0,
        paymentIntentId,
        status: 'HELD',
      },
      include: {
        table: true,
        paymentIntent: true,
      },
    });

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

    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
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

    // Emit refund stub if deposit exists
    if (reservation.paymentIntentId && Number(reservation.deposit) > 0) {
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

    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
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
}
