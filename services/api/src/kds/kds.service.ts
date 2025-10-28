/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class KdsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async getQueue(station: string): Promise<any> {
    const tickets = await this.prisma.client.kdsTicket.findMany({
      where: {
        station: station as any,
        status: { in: ['QUEUED', 'READY'] },
      },
      include: {
        order: {
          include: {
            orderItems: {
              include: {
                menuItem: true,
              },
              where: {
                menuItem: {
                  station: station as any,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tickets;
  }

  async markReady(ticketId: string) {
    const ticket = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'READY',
        readyAt: new Date(),
      },
    });

    // Publish KDS event
    this.eventBus.publish('kds', {
      ticketId: ticket.id,
      orderId: ticket.orderId,
      station: ticket.station,
      status: 'READY',
      at: new Date().toISOString(),
    });

    // Check if all tickets for this order are ready
    const allTickets = await this.prisma.client.kdsTicket.findMany({
      where: { orderId: ticket.orderId },
    });

    const allReady = allTickets.every((t) => t.status === 'READY');

    if (allReady) {
      await this.prisma.client.order.update({
        where: { id: ticket.orderId },
        data: { status: 'READY' },
      });
    }

    return ticket;
  }

  async recallTicket(ticketId: string) {
    const ticket = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'RECALLED',
        readyAt: null,
      },
    });

    // Publish KDS event
    this.eventBus.publish('kds', {
      ticketId: ticket.id,
      orderId: ticket.orderId,
      station: ticket.station,
      status: 'RECALLED',
      at: new Date().toISOString(),
    });

    return ticket;
  }
}
