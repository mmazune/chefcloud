/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, forwardRef, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KdsTicketDto, SlaState, UpdateKdsSlaConfigDto } from './dto/kds-ticket.dto';
import { KdsGateway } from './kds.gateway';

@Injectable()
export class KdsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    @Inject(forwardRef(() => KdsGateway))
    private kdsGateway?: KdsGateway,
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
      quantity: item.quantity ?? 1, // M13.5.1: Use `quantity` from OrderItem schema
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

    // M28-KDS-S3: Broadcast real-time update to all connected clients
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
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

    // M28-KDS-S3: Broadcast real-time update to all connected clients
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return ticket;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // M13.3 Kitchen Routing + KDS Tickets + Order Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * M13.3: Get KDS board with all tickets for a branch
   * Supports filtering by station and status
   */
  async getBoard(
    orgId: string,
    branchId: string,
    stationId?: string,
    status?: string,
  ): Promise<KdsTicketDto[]> {
    // Build where clause with branch scope
    const whereClause: any = {
      order: {
        branch: {
          id: branchId,
          orgId, // Enforce org scope to prevent cross-branch leakage
        },
      },
    };

    if (stationId) {
      whereClause.station = stationId as any;
    }

    if (status) {
      whereClause.status = status as any;
    } else {
      // Default: show active tickets (QUEUED, IN_PROGRESS, READY)
      whereClause.status = { in: ['QUEUED', 'IN_PROGRESS', 'READY'] };
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
            },
          },
        },
        lines: true, // M13.3: Include ticket lines
      },
      orderBy: { sentAt: 'asc' },
    });

    // Get SLA config for the org
    const slaConfigs = await this.prisma.client.kdsSlaConfig.findMany({
      where: { orgId },
    });

    // Map SLA configs by station
    const slaByStation = new Map<string, any>();
    for (const config of slaConfigs) {
      slaByStation.set(config.station, config);
    }

    // Transform to DTOs
    return tickets.map((ticket) => {
      const slaConfig = slaByStation.get(ticket.station) || null;
      return this.toDto(ticket, slaConfig);
    });
  }

  /**
   * M13.3: Start working on a ticket (QUEUED → IN_PROGRESS)
   */
  async startTicket(
    ticketId: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    // Fetch ticket with org/branch validation
    const ticket = await this.prisma.client.kdsTicket.findFirst({
      where: {
        id: ticketId,
        order: {
          branch: {
            id: branchId,
            orgId,
          },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found or access denied',
      });
    }

    // Validate state transition: only QUEUED → IN_PROGRESS allowed
    if (ticket.status !== 'QUEUED') {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot start ticket in ${ticket.status} state. Only QUEUED tickets can be started.`,
      });
    }

    const updated = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Publish event
    this.eventBus.publish('kds', {
      ticketId: updated.id,
      orderId: updated.orderId,
      station: updated.station,
      status: 'IN_PROGRESS',
      userId,
      at: new Date().toISOString(),
    });

    // Broadcast update
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return updated;
  }

  /**
   * M13.3: Mark ticket as ready (IN_PROGRESS → READY)
   */
  async readyTicket(
    ticketId: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    // Fetch ticket with org/branch validation
    const ticket = await this.prisma.client.kdsTicket.findFirst({
      where: {
        id: ticketId,
        order: {
          branch: {
            id: branchId,
            orgId,
          },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found or access denied',
      });
    }

    // Validate state transition: only IN_PROGRESS → READY allowed
    if (ticket.status !== 'IN_PROGRESS') {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot mark ticket ready in ${ticket.status} state. Only IN_PROGRESS tickets can be marked ready.`,
      });
    }

    const updated = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'READY',
        readyAt: new Date(),
      },
    });

    // Publish event
    this.eventBus.publish('kds', {
      ticketId: updated.id,
      orderId: updated.orderId,
      station: updated.station,
      status: 'READY',
      userId,
      at: new Date().toISOString(),
    });

    // Broadcast update
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return updated;
  }

  /**
   * M13.3: Mark ticket as done (READY → DONE)
   * Also checks if all tickets for the order are done to auto-complete the order
   */
  async doneTicket(
    ticketId: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    // Fetch ticket with org/branch validation
    const ticket = await this.prisma.client.kdsTicket.findFirst({
      where: {
        id: ticketId,
        order: {
          branch: {
            id: branchId,
            orgId,
          },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found or access denied',
      });
    }

    // Validate state transition: only READY → DONE allowed
    if (ticket.status !== 'READY') {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot mark ticket done in ${ticket.status} state. Only READY tickets can be marked done.`,
      });
    }

    const updated = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'DONE',
        doneAt: new Date(),
      },
    });

    // Publish event
    this.eventBus.publish('kds', {
      ticketId: updated.id,
      orderId: updated.orderId,
      station: updated.station,
      status: 'DONE',
      userId,
      at: new Date().toISOString(),
    });

    // Check if all tickets for this order are done → auto-complete order
    const allTickets = await this.prisma.client.kdsTicket.findMany({
      where: { orderId: ticket.orderId },
    });

    const allDone = allTickets.every((t) => t.status === 'DONE' || t.status === 'VOID');

    if (allDone) {
      await this.prisma.client.order.update({
        where: { id: ticket.orderId },
        data: { status: 'SERVED' }, // All kitchen tickets done = ready to serve
      });

      // Publish order served event via KDS topic
      this.eventBus.publish('kds', {
        type: 'ORDER_SERVED',
        orderId: ticket.orderId,
        status: 'SERVED',
        at: new Date().toISOString(),
      });
    }

    // Broadcast update
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return updated;
  }

  /**
   * M13.3: Void a ticket (any state → VOID)
   * Requires L4+ and a reason with minimum 10 characters
   */
  async voidTicket(
    ticketId: string,
    reason: string,
    orgId: string,
    branchId: string,
    userId: string,
  ): Promise<any> {
    // Validate reason length (also enforced in DTO)
    if (!reason || reason.length < 10) {
      throw new BadRequestException({
        code: 'VOID_REASON_REQUIRED',
        message: 'Void reason must be at least 10 characters',
      });
    }

    // Fetch ticket with org/branch validation
    const ticket = await this.prisma.client.kdsTicket.findFirst({
      where: {
        id: ticketId,
        order: {
          branch: {
            id: branchId,
            orgId,
          },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket not found or access denied',
      });
    }

    // Cannot void already voided tickets
    if (ticket.status === 'VOID') {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Ticket is already voided',
      });
    }

    const updated = await this.prisma.client.kdsTicket.update({
      where: { id: ticketId },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidReason: reason,
      },
    });

    // Publish event with audit trail
    this.eventBus.publish('kds', {
      ticketId: updated.id,
      orderId: updated.orderId,
      station: updated.station,
      status: 'VOID',
      reason,
      userId,
      at: new Date().toISOString(),
    });

    // Broadcast update
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return updated;
  }

  /**
   * M13.3: Export tickets to CSV with SHA-256 hash for audit
   */
  async exportTicketsCsv(
    orgId: string,
    branchId?: string,
    from?: string,
    to?: string,
    stationId?: string,
  ): Promise<{ csv: string; hash: string }> {
    // Build where clause
    const whereClause: any = {
      order: {
        branch: {
          orgId,
        },
      },
    };

    if (branchId) {
      whereClause.order.branch.id = branchId;
    }

    if (stationId) {
      whereClause.station = stationId as any;
    }

    // Date range filter
    if (from || to) {
      whereClause.sentAt = {};
      if (from) {
        whereClause.sentAt.gte = new Date(from);
      }
      if (to) {
        whereClause.sentAt.lte = new Date(to);
      }
    }

    const tickets = await this.prisma.client.kdsTicket.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            orderNumber: true,
            branchId: true,
          },
        },
        lines: true,
      },
      orderBy: { sentAt: 'asc' },
    });

    // Build CSV
    const headers = [
      'ticket_id',
      'order_id',
      'order_number',
      'branch_id',
      'station',
      'status',
      'sent_at',
      'started_at',
      'ready_at',
      'done_at',
      'voided_at',
      'void_reason',
      'line_count',
    ];

    const rows = tickets.map((ticket) => [
      ticket.id,
      ticket.orderId,
      ticket.order.orderNumber,
      ticket.order.branchId,
      ticket.station,
      ticket.status,
      ticket.sentAt?.toISOString() || '',
      ticket.startedAt?.toISOString() || '',
      ticket.readyAt?.toISOString() || '',
      ticket.doneAt?.toISOString() || '',
      ticket.voidedAt?.toISOString() || '',
      ticket.voidReason || '',
      ticket.lines?.length || 0,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Calculate SHA-256 hash for audit integrity
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csv).digest('hex');

    return { csv, hash };
  }

  /**
   * M13.3: Generate KDS tickets from an order
   * Groups order items by station and creates tickets with line snapshots
   * Idempotent via [orderId, station] unique constraint
   */
  async generateTicketsFromOrder(
    orderId: string,
    orgId: string,
    branchId: string,
  ): Promise<any[]> {
    // Fetch order with items and menu item station info
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        branch: {
          id: branchId,
          orgId,
        },
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: {
                station: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found or access denied',
      });
    }

    // Group items by station
    const itemsByStation = new Map<string, any[]>();

    for (const item of order.orderItems) {
      // Use MenuItem.station, default to KITCHEN if null
      const station = item.menuItem?.station || 'KITCHEN';

      if (!itemsByStation.has(station)) {
        itemsByStation.set(station, []);
      }
      itemsByStation.get(station)!.push(item);
    }

    // Create tickets for each station (idempotent via unique constraint)
    const tickets: any[] = [];

    for (const [station, items] of itemsByStation) {
      try {
        // Generate idempotency key
        const idempotencyKey = `${orderId}-${station}`;

        // Upsert ticket (idempotent)
        const ticket = await this.prisma.client.kdsTicket.upsert({
          where: {
            orderId_station: {
              orderId,
              station: station as any,
            },
          },
          create: {
            orderId,
            station: station as any,
            status: 'QUEUED',
            sentAt: new Date(),
            idempotencyKey,
            lines: {
              create: items.map((item) => ({
                orderItemId: item.id,
                itemNameSnapshot: item.itemNameSnapshot || item.menuItem?.name || 'Unknown',
                qty: item.quantity ?? 1, // M13.5.1: Use `quantity` from OrderItem schema (fallback to 1)
                modifiersSnapshot: item.selectedModifiersSnapshot || {},
                status: 'PENDING',
              })),
            },
          },
          update: {
            // If ticket exists, don't modify (idempotent)
          },
          include: {
            lines: true,
          },
        });

        tickets.push(ticket);
      } catch (error: any) {
        // Handle unique constraint violation (P2002) - ticket already exists
        if (error.code === 'P2002') {
          const existing = await this.prisma.client.kdsTicket.findUnique({
            where: {
              orderId_station: {
                orderId,
                station: station as any,
              },
            },
            include: { lines: true },
          });
          if (existing) {
            tickets.push(existing);
          }
        } else {
          throw error;
        }
      }
    }

    // Publish event for each ticket
    for (const ticket of tickets) {
      this.eventBus.publish('kds', {
        ticketId: ticket.id,
        orderId: ticket.orderId,
        station: ticket.station,
        status: 'QUEUED',
        at: new Date().toISOString(),
      });
    }

    // Broadcast update
    if (this.kdsGateway) {
      await this.kdsGateway.broadcastOrdersUpdated();
    }

    return tickets;
  }
}
