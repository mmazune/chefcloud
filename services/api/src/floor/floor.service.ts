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
}
