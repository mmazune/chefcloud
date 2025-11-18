import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateSubscriptionDto {
  reportType: 'SHIFT_END' | 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'MONTHLY_SUMMARY' | 'FRANCHISE_WEEKLY';
  branchId?: string;
  deliveryChannel?: 'EMAIL' | 'SLACK';
  recipientType: 'USER' | 'ROLE';
  recipientId?: string; // userId or role code
  recipientEmail?: string;
  includeCSVs?: boolean;
  includePDF?: boolean;
  metadata?: any;
}

export interface UpdateSubscriptionDto {
  reportType?: string;
  deliveryChannel?: string;
  recipientType?: string;
  recipientId?: string;
  recipientEmail?: string;
  enabled?: boolean;
  includeCSVs?: boolean;
  includePDF?: boolean;
  metadata?: any;
}

/**
 * M4: Report Subscription Management Service
 * Manages who receives which reports and when
 */
@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all subscriptions for an organization
   */
  async getSubscriptions(orgId: string, branchId?: string): Promise<any[]> {
    return this.prisma.client.reportSubscription.findMany({
      where: {
        orgId,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get subscriptions for a specific report type
   */
  async getSubscriptionsForReportType(
    orgId: string,
    reportType: string,
    branchId?: string,
  ): Promise<any[]> {
    return this.prisma.client.reportSubscription.findMany({
      where: {
        orgId,
        reportType,
        ...(branchId ? { branchId } : {}),
        enabled: true,
      },
    });
  }

  /**
   * Create a new subscription
   */
  async createSubscription(orgId: string, dto: CreateSubscriptionDto): Promise<any> {
    return this.prisma.client.reportSubscription.create({
      data: {
        orgId,
        branchId: dto.branchId || null,
        reportType: dto.reportType,
        deliveryChannel: dto.deliveryChannel || 'EMAIL',
        recipientType: dto.recipientType,
        recipientId: dto.recipientId || null,
        recipientEmail: dto.recipientEmail || null,
        enabled: true,
        includeCSVs: dto.includeCSVs ?? true,
        includePDF: dto.includePDF ?? true,
        metadata: dto.metadata || null,
      },
    });
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    orgId: string,
    subscriptionId: string,
    updates: UpdateSubscriptionDto,
  ): Promise<any> {
    // Verify ownership
    const existing = await this.prisma.client.reportSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.client.reportSubscription.update({
      where: { id: subscriptionId },
      data: updates,
    });
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(orgId: string, subscriptionId: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.client.reportSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!existing || existing.orgId !== orgId) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.client.reportSubscription.delete({
      where: { id: subscriptionId },
    });
  }

  /**
   * Resolve recipients for a subscription
   * If recipientType is ROLE, find all users with that role
   */
  async resolveRecipients(subscription: any): Promise<string[]> {
    const recipients: string[] = [];

    if (subscription.recipientType === 'USER') {
      // Direct user email
      if (subscription.recipientEmail) {
        recipients.push(subscription.recipientEmail);
      } else if (subscription.recipientId) {
        // Lookup user email
        const user = await this.prisma.client.user.findUnique({
          where: { id: subscription.recipientId },
          select: { email: true },
        });
        if (user) {
          recipients.push(user.email);
        }
      }
    } else if (subscription.recipientType === 'ROLE') {
      // Find all users with this role in the org/branch
      const where: any = {
        orgId: subscription.orgId,
        isActive: true,
      };

      // Map role codes to roleLevel
      const roleMap: Record<string, string> = {
        OWNER: 'L5',
        MANAGER: 'L4',
        ASSISTANT_MANAGER: 'L3',
        ACCOUNTANT: 'ACCOUNTANT',
        PROCUREMENT: 'PROCUREMENT',
        HR: 'HR',
        FRANCHISE: 'FRANCHISE',
      };

      const roleLevel = roleMap[subscription.recipientId || ''];
      if (roleLevel) {
        where.roleLevel = roleLevel;
      }

      if (subscription.branchId) {
        where.branchId = subscription.branchId;
      }

      const users = await this.prisma.client.user.findMany({
        where,
        select: { email: true },
      });

      recipients.push(...users.map((u) => u.email));
    }

    return recipients;
  }

  /**
   * Find all subscriptions that should trigger for a shift-end
   */
  async getShiftEndSubscriptions(orgId: string, branchId: string): Promise<any[]> {
    return this.getSubscriptionsForReportType(orgId, 'SHIFT_END', branchId);
  }

  /**
   * Find all subscriptions that should trigger for daily digests
   */
  async getDailySubscriptions(orgId: string, branchId?: string): Promise<any[]> {
    return this.getSubscriptionsForReportType(orgId, 'DAILY_SUMMARY', branchId);
  }

  /**
   * Find all subscriptions for weekly digests
   */
  async getWeeklySubscriptions(orgId: string, branchId?: string): Promise<any[]> {
    return this.getSubscriptionsForReportType(orgId, 'WEEKLY_SUMMARY', branchId);
  }

  /**
   * Find all subscriptions for monthly digests
   */
  async getMonthlySubscriptions(orgId: string, branchId?: string): Promise<any[]> {
    return this.getSubscriptionsForReportType(orgId, 'MONTHLY_SUMMARY', branchId);
  }

  /**
   * Find all franchise-level subscriptions
   */
  async getFranchiseSubscriptions(orgId: string): Promise<any[]> {
    return this.getSubscriptionsForReportType(orgId, 'FRANCHISE_WEEKLY');
  }
}
