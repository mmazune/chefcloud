import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to detect if error is due to missing maintenance_windows table.
   * Fail-open behavior: if table doesn't exist, assume no maintenance window.
   */
  private isMissingMaintenanceWindowsTable(error: any): boolean {
    // Prisma error code P2021: "The table does not exist in the current database"
    if (error?.code === 'P2021') {
      return true;
    }

    // Fallback: check error message for table reference
    const errorMessage = error?.message || String(error);
    return (
      errorMessage.includes('maintenance_windows') &&
      (errorMessage.includes('does not exist') || errorMessage.includes("doesn't exist"))
    );
  }

  /**
   * Check if writes are blocked due to an active maintenance window.
   * Returns { blocked: false } if maintenance_windows table doesn't exist (fail-open).
   */
  async isBlockedWrite(now: Date, orgId?: string): Promise<{ blocked: boolean; message?: string }> {
    try {
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
    } catch (error) {
      // Fail-open: if table doesn't exist, assume no maintenance configured
      if (this.isMissingMaintenanceWindowsTable(error)) {
        this.logger.warn(
          'maintenance_windows table does not exist - failing open (no maintenance check)',
          { orgId },
        );
        return { blocked: false };
      }

      // Re-throw any other database errors
      throw error;
    }
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
   * Returns empty array if maintenance_windows table doesn't exist (fail-open).
   */
  async getActive(orgId?: string): Promise<any[]> {
    try {
      const now = new Date();
      return await this.prisma.client.maintenanceWindow.findMany({
        where: {
          orgId: orgId ?? null,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        orderBy: { startsAt: 'desc' },
      });
    } catch (error) {
      if (this.isMissingMaintenanceWindowsTable(error)) {
        this.logger.warn('maintenance_windows table does not exist - returning empty array', {
          orgId,
        });
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all maintenance windows (past and future).
   * Returns empty array if maintenance_windows table doesn't exist (fail-open).
   */
  async findAll(orgId?: string): Promise<any[]> {
    try {
      return await this.prisma.client.maintenanceWindow.findMany({
        where: orgId ? { orgId } : {},
        orderBy: { startsAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    } catch (error) {
      if (this.isMissingMaintenanceWindowsTable(error)) {
        this.logger.warn('maintenance_windows table does not exist - returning empty array', {
          orgId,
        });
        return [];
      }
      throw error;
    }
  }
}
