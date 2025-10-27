/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FloorService {
  constructor(private prisma: PrismaService) {}

  async getFloor(branchId: string): Promise<unknown> {
    const floorPlans = await this.prisma.client.floorPlan.findMany({
      where: { org: { branches: { some: { id: branchId } } } },
      include: {
        tables: {
          where: { branchId },
        },
      },
    });

    return { floorPlans };
  }

  async updateTableStatus(tableId: string, status: string): Promise<unknown> {
    return this.prisma.client.table.update({
      where: { id: tableId },
      data: { status: status as any },
    });
  }

  async getAvailability(branchId: string, from?: string, to?: string): Promise<any> {
    const tables = await this.prisma.client.table.findMany({
      where: { branchId, isActive: true },
      include: {
        orders: {
          where: { status: { in: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'] } },
          select: { id: true, status: true },
        },
      },
    });

    // If no time range provided, just return current table statuses
    if (!from || !to) {
      return tables.map((table) => ({
        id: table.id,
        label: table.label,
        capacity: table.capacity,
        status: table.orders.length > 0 ? 'OCCUPIED' : table.status,
      }));
    }

    // Get reservations in time range
    const reservations = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        status: { in: ['HELD', 'CONFIRMED', 'SEATED'] },
        OR: [
          {
            AND: [
              { startAt: { lte: new Date(to) } },
              { endAt: { gt: new Date(from) } },
            ],
          },
        ],
      },
      select: { tableId: true },
    });

    const reservedTableIds = new Set(
      reservations.map((r) => r.tableId).filter((id): id is string => !!id),
    );

    return tables.map((table) => {
      let status: string;
      if (table.orders.length > 0) {
        status = 'OCCUPIED';
      } else if (reservedTableIds.has(table.id)) {
        status = 'RESERVED';
      } else if (table.status === 'RESERVED') {
        status = 'HELD';
      } else {
        status = 'FREE';
      }

      return {
        id: table.id,
        label: table.label,
        capacity: table.capacity,
        status,
      };
    });
  }
}
