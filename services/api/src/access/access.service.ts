import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

export interface PlatformFlags {
  desktop: boolean;
  web: boolean;
  mobile: boolean;
}

export type PlatformAccessMatrix = Record<string, PlatformFlags>;

export const DEFAULT_PLATFORM_ACCESS: PlatformAccessMatrix = {
  WAITER: { desktop: true, web: false, mobile: false },
  CASHIER: { desktop: true, web: false, mobile: false },
  SUPERVISOR: { desktop: true, web: false, mobile: false },
  HEAD_CHEF: { desktop: true, web: false, mobile: true },
  ASSISTANT_CHEF: { desktop: true, web: false, mobile: true },
  HEAD_BARISTA: { desktop: true, web: false, mobile: true },
  STOCK: { desktop: false, web: true, mobile: true },
  PROCUREMENT: { desktop: false, web: true, mobile: true },
  ASSISTANT_MANAGER: { desktop: false, web: true, mobile: true },
  EVENT_MANAGER: { desktop: false, web: true, mobile: true },
  TICKET_MASTER: { desktop: true, web: false, mobile: false },
  MANAGER: { desktop: false, web: true, mobile: true },
  ACCOUNTANT: { desktop: false, web: true, mobile: true },
  OWNER: { desktop: false, web: true, mobile: true },
  DEV_ADMIN: { desktop: false, web: true, mobile: false },
  // Alias for HEAD_CHEF
  CHEF: { desktop: true, web: false, mobile: true },
  ADMIN: { desktop: false, web: true, mobile: true },
} as const;

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the platform access matrix for an organization.
   * Returns the stored matrix or defaults if not set.
   */
  async getMatrix(orgId: string): Promise<{
    platformAccess: PlatformAccessMatrix;
    defaults: PlatformAccessMatrix;
  }> {
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
      select: { platformAccess: true },
    });

    const platformAccess = settings?.platformAccess
      ? (settings.platformAccess as unknown as PlatformAccessMatrix)
      : DEFAULT_PLATFORM_ACCESS;

    return {
      platformAccess,
      defaults: DEFAULT_PLATFORM_ACCESS,
    };
  }

  /**
   * Patch (update) the platform access matrix for an organization.
   * Validates that all values are properly formatted.
   */
  async patchMatrix(
    orgId: string,
    updates: Record<string, PlatformFlags>,
  ): Promise<PlatformAccessMatrix> {
    // Validate the updates structure
    for (const [role, config] of Object.entries(updates)) {
      if (typeof config !== 'object' || config === null) {
        throw new Error(
          `Invalid config for role ${role}: must be an object with desktop/web/mobile flags`,
        );
      }

      const { desktop, web, mobile } = config;
      if (typeof desktop !== 'boolean' || typeof web !== 'boolean' || typeof mobile !== 'boolean') {
        throw new Error(
          `Invalid config for role ${role}: desktop, web, and mobile must be booleans`,
        );
      }
    }

    // Upsert the org settings with the new platform access
    const result = await this.prisma.orgSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        platformAccess: updates as unknown as Prisma.InputJsonObject,
      },
      update: {
        platformAccess: updates as unknown as Prisma.InputJsonObject,
      },
    });

    return result.platformAccess as unknown as PlatformAccessMatrix;
  }

  /**
   * Reset organization's platform access matrix to recommended defaults.
   * Returns whether the matrix was updated.
   */
  async resetToDefaults(
    orgId: string,
    _userId: string,
  ): Promise<{ updated: boolean; matrix: PlatformAccessMatrix }> {
    const settings = await this.prisma.orgSettings.findUnique({
      where: { orgId },
      select: { platformAccess: true },
    });

    const currentMatrix = settings?.platformAccess as unknown as PlatformAccessMatrix;
    const isEqual =
      currentMatrix && JSON.stringify(currentMatrix) === JSON.stringify(DEFAULT_PLATFORM_ACCESS);

    if (isEqual) {
      return {
        updated: false,
        matrix: DEFAULT_PLATFORM_ACCESS,
      };
    }

    // Update to defaults
    const result = await this.prisma.orgSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        platformAccess: DEFAULT_PLATFORM_ACCESS as unknown as Prisma.InputJsonObject,
      },
      update: {
        platformAccess: DEFAULT_PLATFORM_ACCESS as unknown as Prisma.InputJsonObject,
      },
    });

    // Note: Audit event would require branchId which we don't have at org level
    // Skip audit for now or log to a separate org-level audit table if needed

    return {
      updated: true,
      matrix: result.platformAccess as unknown as PlatformAccessMatrix,
    };
  }
}
