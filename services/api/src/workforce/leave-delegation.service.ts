/**
 * M10.18: Leave Delegation Service
 *
 * Manages approval delegation for managers:
 * - CRUD for ApprovalDelegate
 * - Validation of delegation windows
 * - Query for active delegates during approval
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateDelegateDto {
  principalUserId: string;
  delegateUserId: string;
  branchId?: string | null;
  startAt: Date;
  endAt: Date;
}

export interface UpdateDelegateDto {
  startAt?: Date;
  endAt?: Date;
  enabled?: boolean;
}

@Injectable()
export class LeaveDelegationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create an approval delegate
   * RBAC: L4+ can create branch delegates, L5 can create org-wide (branchId null)
   */
  async createDelegate(
    orgId: string,
    dto: CreateDelegateDto,
    actorId: string,
    actorRoleLevel: number,
  ): Promise<any> {
    // Validate role level for org-wide delegates
    if (!dto.branchId && actorRoleLevel < 5) {
      throw new ForbiddenException('Only L5 can create org-wide delegates');
    }

    // Validate that principal and delegate are different
    if (dto.principalUserId === dto.delegateUserId) {
      throw new BadRequestException('Cannot delegate to self');
    }

    // Validate date range
    if (dto.startAt >= dto.endAt) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate users exist in org
    const [principal, delegate] = await Promise.all([
      this.prisma.client.user.findFirst({
        where: { id: dto.principalUserId, orgId },
      }),
      this.prisma.client.user.findFirst({
        where: { id: dto.delegateUserId, orgId },
      }),
    ]);

    if (!principal) {
      throw new NotFoundException('Principal user not found in organization');
    }
    if (!delegate) {
      throw new NotFoundException('Delegate user not found in organization');
    }

    // Create delegation
    return this.prisma.client.approvalDelegate.create({
      data: {
        orgId,
        principalUserId: dto.principalUserId,
        delegateUserId: dto.delegateUserId,
        branchId: dto.branchId || null,
        startAt: dto.startAt,
        endAt: dto.endAt,
        enabled: true,
      },
      include: {
        principal: { select: { id: true, firstName: true, lastName: true } },
        delegate: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * List delegates for an org (optionally filtered by branch or principal)
   */
  async listDelegates(
    orgId: string,
    options?: { branchId?: string; principalUserId?: string; activeOnly?: boolean },
  ): Promise<any[]> {
    const where: any = { orgId };

    if (options?.branchId) {
      where.OR = [{ branchId: options.branchId }, { branchId: null }];
    }
    if (options?.principalUserId) {
      where.principalUserId = options.principalUserId;
    }
    if (options?.activeOnly) {
      const now = new Date();
      where.enabled = true;
      where.startAt = { lte: now };
      where.endAt = { gte: now };
    }

    return this.prisma.client.approvalDelegate.findMany({
      where,
      include: {
        principal: { select: { id: true, firstName: true, lastName: true } },
        delegate: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'desc' },
    });
  }

  /**
   * Get a single delegate by ID
   */
  async getDelegate(orgId: string, id: string): Promise<any> {
    const delegate = await this.prisma.client.approvalDelegate.findFirst({
      where: { id, orgId },
      include: {
        principal: { select: { id: true, firstName: true, lastName: true } },
        delegate: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!delegate) {
      throw new NotFoundException('Delegate not found');
    }

    return delegate;
  }

  /**
   * Update a delegate
   */
  async updateDelegate(
    orgId: string,
    id: string,
    dto: UpdateDelegateDto,
  ): Promise<any> {
    const existing = await this.prisma.client.approvalDelegate.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Delegate not found');
    }

    // Validate date range if both provided
    const startAt = dto.startAt || existing.startAt;
    const endAt = dto.endAt || existing.endAt;
    if (startAt >= endAt) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.prisma.client.approvalDelegate.update({
      where: { id },
      data: {
        startAt: dto.startAt,
        endAt: dto.endAt,
        enabled: dto.enabled,
      },
      include: {
        principal: { select: { id: true, firstName: true, lastName: true } },
        delegate: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Delete a delegate
   */
  async deleteDelegate(orgId: string, id: string): Promise<void> {
    const existing = await this.prisma.client.approvalDelegate.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Delegate not found');
    }

    await this.prisma.client.approvalDelegate.delete({ where: { id } });
  }

  /**
   * Check if a user can act as delegate for approval
   * Returns the principal they're delegating for, or null if not authorized
   */
  async canActAsDelegate(
    orgId: string,
    delegateUserId: string,
    branchId: string,
  ): Promise<{ principalId: string; principalName: string } | null> {
    const now = new Date();

    // Find active delegation for this delegate
    const delegation = await this.prisma.client.approvalDelegate.findFirst({
      where: {
        orgId,
        delegateUserId,
        enabled: true,
        startAt: { lte: now },
        endAt: { gte: now },
        OR: [
          { branchId: null }, // Org-wide
          { branchId }, // Specific branch
        ],
      },
      include: {
        principal: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    if (!delegation) {
      return null;
    }

    return {
      principalId: delegation.principalUserId,
      principalName: `${delegation.principal.firstName} ${delegation.principal.lastName}`,
    };
  }
}
