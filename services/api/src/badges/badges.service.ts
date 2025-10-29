/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const BadgeState = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  LOST: 'LOST',
  RETURNED: 'RETURNED',
} as const;

@Injectable()
export class BadgesService {
  constructor(private prisma: PrismaService) {}

  async register(orgId: string, code: string): Promise<any> {
    const existing = await this.prisma.client.badgeAsset.findUnique({
      where: { code },
    });
    if (existing) return existing;

    return this.prisma.client.badgeAsset.create({
      data: { orgId, code, state: BadgeState.ACTIVE, custody: [] },
    });
  }

  async assign(code: string, userId: string, _actorId: string): Promise<any> {
    const badge = await this.prisma.client.badgeAsset.findUnique({
      where: { code },
    });
    if (!badge) throw new NotFoundException(`Badge ${code} not found`);
    if (badge.state !== BadgeState.ACTIVE && badge.state !== BadgeState.RETURNED) {
      throw new BadRequestException(`Badge ${code} is ${badge.state}, cannot assign`);
    }

    const custody = (badge.custody as any[]) || [];
    custody.push({
      assignedTo: userId,
      assignedAt: new Date().toISOString(),
      assignedBy: _actorId,
    });

    return this.prisma.client.badgeAsset.update({
      where: { code },
      data: { assignedUserId: userId, state: BadgeState.ACTIVE, custody },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async revoke(code: string, _reason: string): Promise<any> {
    const badge = await this.prisma.client.badgeAsset.findUnique({ where: { code } });
    if (!badge) throw new NotFoundException(`Badge ${code} not found`);

    return this.prisma.client.badgeAsset.update({
      where: { code },
      data: { state: BadgeState.REVOKED, assignedUserId: null },
    });
  }

  async reportLost(code: string): Promise<any> {
    const badge = await this.prisma.client.badgeAsset.findUnique({ where: { code } });
    if (!badge) throw new NotFoundException(`Badge ${code} not found`);

    return this.prisma.client.badgeAsset.update({
      where: { code },
      data: { state: BadgeState.LOST, assignedUserId: null },
    });
  }

  async markReturned(code: string, _actorId: string): Promise<any> {
    const badge = await this.prisma.client.badgeAsset.findUnique({ where: { code } });
    if (!badge) throw new NotFoundException(`Badge ${code} not found`);

    const custody = (badge.custody as any[]) || [];
    if (custody.length > 0) {
      const lastEntry = custody[custody.length - 1];
      if (lastEntry && !lastEntry.returnedAt) {
        lastEntry.returnedAt = new Date().toISOString();
        lastEntry.returnedBy = _actorId;
      }
    }

    return this.prisma.client.badgeAsset.update({
      where: { code },
      data: { state: BadgeState.RETURNED, assignedUserId: null, custody },
    });
  }

  async list(orgId: string): Promise<any[]> {
    return this.prisma.client.badgeAsset.findMany({
      where: { orgId },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByCode(code: string): Promise<any> {
    return this.prisma.client.badgeAsset.findUnique({
      where: { code },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async checkUserBadgeForSeparation(userId: string, force: boolean) {
    const badge = await this.prisma.client.badgeAsset.findFirst({
      where: { assignedUserId: userId, state: { in: ['ACTIVE'] } },
    });

    if (!badge) return { canSeparate: true };
    if (!force) return { canSeparate: false, badgeNotReturned: true, badgeCode: badge.code };

    await this.prisma.client.badgeAsset.update({
      where: { id: badge.id },
      data: { state: 'LOST', assignedUserId: null },
    });

    return { canSeparate: true, badgeForcedLost: true, badgeCode: badge.code };
  }
}
