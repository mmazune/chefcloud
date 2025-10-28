/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Default thresholds
const DEFAULT_THRESHOLDS = {
  lateVoidMin: 5,
  heavyDiscountUGX: 5000,
  noDrinksWarnRate: 0.25,
};

@Injectable()
export class ThresholdsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get anomaly thresholds for organization
   * Falls back to defaults if not set
   */
  async getThresholds(orgId: string): Promise<any> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });

    if (!settings || !settings.anomalyThresholds) {
      return DEFAULT_THRESHOLDS;
    }

    // Merge with defaults to ensure all fields present
    return {
      ...DEFAULT_THRESHOLDS,
      ...(typeof settings.anomalyThresholds === 'object' ? settings.anomalyThresholds : {}),
    };
  }

  /**
   * Update anomaly thresholds and emit audit event
   */
  async updateThresholds(
    orgId: string,
    userId: string,
    updates: {
      lateVoidMin?: number;
      heavyDiscountUGX?: number;
      noDrinksWarnRate?: number;
    },
  ): Promise<any> {
    // Get current settings or defaults
    const current = await this.getThresholds(orgId);

    // Merge updates
    const newThresholds = {
      ...current,
      ...updates,
    };

    // Upsert settings
    const settings = await this.prisma.client.orgSettings.upsert({
      where: { orgId },
      update: {
        anomalyThresholds: newThresholds,
      },
      create: {
        orgId,
        anomalyThresholds: newThresholds,
      },
    });

    // Get first branch for audit event
    const branch = await this.prisma.client.branch.findFirst({
      where: { orgId },
    });

    if (branch) {
      // Create audit event
      await this.prisma.client.auditEvent.create({
        data: {
          branchId: branch.id,
          userId,
          action: 'THRESHOLDS_UPDATE',
          resource: 'org_settings',
          resourceId: settings.id,
          metadata: {
            previous: current,
            updated: newThresholds,
          },
        },
      });
    }

    return newThresholds;
  }
}
