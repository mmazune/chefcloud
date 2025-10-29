import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface CreatePromotionDto {
  name: string;
  code?: string;
  startsAt?: Date;
  endsAt?: Date;
  scope?: {
    branches?: string[];
    categories?: string[];
    items?: string[];
  };
  daypart?: {
    days?: number[]; // 1-7 (Monday-Sunday)
    start?: string; // "HH:mm"
    end?: string; // "HH:mm"
  };
  priority?: number;
  exclusive?: boolean;
  requiresApproval?: boolean;
  effects: Array<{
    type: 'PERCENT_OFF' | 'FIXED_OFF' | 'HAPPY_HOUR' | 'BUNDLE';
    value?: number;
    meta?: Record<string, unknown>;
  }>;
}

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, dto: CreatePromotionDto): Promise<any> {
    const promotion = await this.prisma.client.promotion.create({
      data: {
        orgId,
        name: dto.name,
        code: dto.code,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        scope: dto.scope || {},
        daypart: dto.daypart || {},
        priority: dto.priority ?? 100,
        exclusive: dto.exclusive ?? false,
        requiresApproval: dto.requiresApproval ?? true,
        active: dto.requiresApproval === false, // Auto-activate if no approval required
        effects: {
          create: dto.effects.map((e) => ({
            type: e.type,
            value: e.value,
            meta: e.meta as any || {},
          })),
        },
      },
      include: { effects: true },
    });

    return promotion;
  }

  async list(orgId: string, filters?: { active?: boolean; code?: string }): Promise<any> {
    return this.prisma.client.promotion.findMany({
      where: {
        orgId,
        ...(filters?.active !== undefined && { active: filters.active }),
        ...(filters?.code && { code: filters.code }),
      },
      include: { effects: true, approvedBy: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { priority: 'desc' },
    });
  }

  async approve(orgId: string, promotionId: string, userId: string): Promise<any> {
    const promotion = await this.prisma.client.promotion.findUnique({
      where: { id: promotionId },
    });

    if (!promotion || promotion.orgId !== orgId) {
      throw new NotFoundException('Promotion not found');
    }

    if (!promotion.requiresApproval) {
      throw new ForbiddenException('Promotion does not require approval');
    }

    if (promotion.active && promotion.approvedById) {
      throw new ForbiddenException('Promotion already approved');
    }

    return this.prisma.client.promotion.update({
      where: { id: promotionId },
      data: {
        approvedById: userId,
        approvedAt: new Date(),
        active: true,
      },
      include: { effects: true },
    });
  }

  async toggle(orgId: string, promotionId: string, active: boolean): Promise<any> {
    const promotion = await this.prisma.client.promotion.findUnique({
      where: { id: promotionId },
    });

    if (!promotion || promotion.orgId !== orgId) {
      throw new NotFoundException('Promotion not found');
    }

    if (active && promotion.requiresApproval && !promotion.approvedById) {
      throw new ForbiddenException('Promotion must be approved before activation');
    }

    return this.prisma.client.promotion.update({
      where: { id: promotionId },
      data: { active },
      include: { effects: true },
    });
  }

  // Helper to evaluate if promotion applies to an order
  async evaluatePromotion(
    promotion: any,
    context: {
      branchId: string;
      items: Array<{ menuItemId: string; category?: string }>;
      timestamp: Date;
      couponCode?: string;
    },
  ): Promise<boolean> {
    // Check active status
    if (!promotion.active) return false;

    // Check time window
    if (promotion.startsAt && context.timestamp < new Date(promotion.startsAt)) {
      return false;
    }
    if (promotion.endsAt && context.timestamp > new Date(promotion.endsAt)) {
      return false;
    }

    // Check daypart
    if (promotion.daypart && Object.keys(promotion.daypart).length > 0) {
      const daypart = promotion.daypart as { days?: number[]; start?: string; end?: string };
      const currentDay = context.timestamp.getDay() || 7; // Sunday=0 -> 7
      const currentTime = `${String(context.timestamp.getHours()).padStart(2, '0')}:${String(context.timestamp.getMinutes()).padStart(2, '0')}`;

      if (daypart.days && !daypart.days.includes(currentDay)) {
        return false;
      }

      if (daypart.start && currentTime < daypart.start) {
        return false;
      }

      if (daypart.end && currentTime > daypart.end) {
        return false;
      }
    }

    // Check scope
    if (promotion.scope && Object.keys(promotion.scope).length > 0) {
      const scope = promotion.scope as { branches?: string[]; categories?: string[]; items?: string[] };

      if (scope.branches && !scope.branches.includes(context.branchId)) {
        return false;
      }

      if (scope.categories || scope.items) {
        const hasMatchingItem = context.items.some(
          (item) =>
            (scope.items && scope.items.includes(item.menuItemId)) ||
            (scope.categories && item.category && scope.categories.includes(item.category)),
        );
        if (!hasMatchingItem) return false;
      }
    }

    // Check coupon code
    if (promotion.code && promotion.code !== context.couponCode) {
      return false;
    }

    return true;
  }
}
