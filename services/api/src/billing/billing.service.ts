import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getSubscription(orgId: string): Promise<{
    plan: Record<string, unknown>;
    status: string;
    nextRenewalAt: Date;
    graceUntil: Date | null;
  }> {
    const subscription = await this.prisma.orgSubscription.findUnique({
      where: { orgId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription');
    }

    return {
      plan: subscription.plan as unknown as Record<string, unknown>,
      status: subscription.status,
      nextRenewalAt: subscription.nextRenewalAt,
      graceUntil: subscription.graceUntil,
    };
  }

  async requestPlanChange(orgId: string, newPlanCode: string) {
    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: newPlanCode },
    });

    if (!newPlan || !newPlan.isActive) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const subscription = await this.prisma.orgSubscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription');
    }

    // Log request for plan change (effective next cycle)
    await this.prisma.subscriptionEvent.create({
      data: {
        orgId,
        type: 'RENEWAL_DUE',
        meta: { requestedPlan: newPlanCode, currentPlanId: subscription.planId },
      },
    });

    return {
      message: 'Plan change requested. Will take effect on next renewal.',
      currentPlan: subscription.planId,
      requestedPlan: newPlan.id,
      effectiveDate: subscription.nextRenewalAt,
    };
  }

  async requestCancellation(orgId: string) {
    const subscription = await this.prisma.orgSubscription.findUnique({
      where: { orgId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription');
    }

    // Log cancellation request
    await this.prisma.subscriptionEvent.create({
      data: {
        orgId,
        type: 'CANCELLED',
        meta: { cancelledAt: new Date(), effectiveDate: subscription.nextRenewalAt },
      },
    });

    return {
      message: 'Cancellation scheduled. Access continues until period end.',
      effectiveDate: subscription.nextRenewalAt,
    };
  }
}
