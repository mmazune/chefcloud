/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KdsTicketDto, SlaState, UpdateKdsSlaConfigDto } from './dto/kds-ticket.dto';

@Injectable()
export class KdsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * M1-KDS: Enhanced queue method with:
   * - Waiter name included
   * - SLA state calculation
   * - Ordering by sentAt (oldest first)
   * - Optional "since" parameter for incremental sync
   */
  async getQueue(station: string, since?: string): Promise<KdsTicketDto[]> {
    const whereClause: any = {
      station: station as any,
      status: { in: ['QUEUED', 'READY'] },
    };

    // M1-KDS: Support incremental sync with "since" parameter
    if (since) {
      whereClause.updatedAt = {
        gte: new Date(since),
      };
    }

    const tickets = await this.prisma.client.kdsTicket.findMany({
      where: whereClause,
      include: {
        order: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            table: {
              select: {
                label: true,
              },
            },
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
      orderBy: { sentAt: 'asc' }, // M1-KDS: Oldest tickets first
    });

    // Get SLA config for this org and station
    let orgId: string | null = null;
    if (tickets.length > 0) {
      const branch = await this.prisma.client.branch.findUnique({
        where: { id: tickets[0].order.branchId },
        select: { orgId: true },
      });
      orgId = branch?.orgId || null;
    }

    let slaConfig: any = null;
    if (orgId) {
      slaConfig = await this.prisma.client.kdsSlaConfig.findUnique({
        where: {
          orgId_station: {
            orgId,
            station: station as any,
          },
        },
      });
    }

    // Transform to DTOs with SLA state
    return tickets.map((ticket) => this.toDto(ticket, slaConfig));
  }

  /**
   * M1-KDS: Get SLA configuration for a station
   */
  async getSlaConfig(orgId: string, station: string): Promise<any> {
    let config = await this.prisma.client.kdsSlaConfig.findUnique({
      where: {
        orgId_station: {
          orgId,
          station: station as any,
        },
      },
    });

    // If no config exists, create default
    if (!config) {
      config = await this.prisma.client.kdsSlaConfig.create({
        data: {
          orgId,
          station: station as any,
          greenThresholdSec: 300, // 5 minutes
          orangeThresholdSec: 600, // 10 minutes
        },
      });
    }

    return config;
  }

  /**
   * M1-KDS: Update SLA configuration
   */
  async updateSlaConfig(
    orgId: string,
    station: string,
    dto: UpdateKdsSlaConfigDto,
  ): Promise<any> {
    const config = await this.prisma.client.kdsSlaConfig.upsert({
      where: {
        orgId_station: {
          orgId,
          station: station as any,
        },
      },
      update: {
        greenThresholdSec: dto.greenThresholdSec,
        orangeThresholdSec: dto.orangeThresholdSec,
      },
      create: {
        orgId,
        station: station as any,
        greenThresholdSec: dto.greenThresholdSec,
        orangeThresholdSec: dto.orangeThresholdSec,
      },
    });

    return config;
  }

  /**
   * M1-KDS: Helper to convert Prisma ticket to DTO with SLA calculation
   */
  private toDto(ticket: any, slaConfig: any): KdsTicketDto {
    const now = new Date();
    const sentAt = new Date(ticket.sentAt);
    const elapsedSeconds = Math.floor((now.getTime() - sentAt.getTime()) / 1000);

    // Calculate SLA state
    let slaState: SlaState = SlaState.GREEN;
    if (slaConfig) {
      if (elapsedSeconds >= slaConfig.orangeThresholdSec) {
        slaState = SlaState.RED;
      } else if (elapsedSeconds >= slaConfig.greenThresholdSec) {
        slaState = SlaState.ORANGE;
      }
    }

    // Build waiter name
    const waiterName = `${ticket.order.user.firstName} ${ticket.order.user.lastName}`;

    // Build items list
    const items = ticket.order.orderItems.map((item: any) => ({
      id: item.id,
      name: item.menuItem.name,
      quantity: item.qty,
      modifiers: item.modifiers || [],
      notes: item.notes,
    }));

    return {
      id: ticket.id,
      orderId: ticket.orderId,
      orderNumber: ticket.order.orderNumber,
      tableNumber: ticket.order.table?.label,
      station: ticket.station,
      status: ticket.status,
      sentAt: ticket.sentAt,
      readyAt: ticket.readyAt,
      waiterName,
      slaState,
      elapsedSeconds,
      items,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
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
