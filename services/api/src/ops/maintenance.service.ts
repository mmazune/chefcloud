import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if writes are blocked due to an active maintenance window.
   * Returns { blocked: boolean, message?: string }
   */
  async isBlockedWrite(now: Date, orgId?: string): Promise<{ blocked: boolean; message?: string }> {
    const window = await this.prisma.client.maintenanceWindow.findFirst({
      where: {
        orgId: orgId ?? null,
        startsAt: { lte: now },
        endsAt: { gte: now },
        blockWrites: true,
      },
      orderBy: { startsAt: 'desc' },
    });

    if (window) {
      return {
        blocked: true,
        message: window.message || 'System is under maintenance. Please try again later.',
      };
    }

    return { blocked: false };
  }

  /**
   * Create a maintenance window.
   */
  async create(data: {
    orgId?: string;
    startsAt: Date;
    endsAt: Date;
    message?: string;
    blockWrites?: boolean;
    createdById?: string;
  }): Promise<any> {
    return this.prisma.client.maintenanceWindow.create({
      data: {
        orgId: data.orgId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        message: data.message,
        blockWrites: data.blockWrites ?? true,
        createdById: data.createdById,
      },
    });
  }

  /**
   * Get currently active maintenance windows.
   */
  async getActive(orgId?: string): Promise<any[]> {
    const now = new Date();
    return this.prisma.client.maintenanceWindow.findMany({
      where: {
        orgId: orgId ?? null,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  /**
   * Get all maintenance windows (past and future).
   */
  async findAll(orgId?: string): Promise<any[]> {
    return this.prisma.client.maintenanceWindow.findMany({
      where: orgId ? { orgId } : {},
      orderBy: { startsAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
