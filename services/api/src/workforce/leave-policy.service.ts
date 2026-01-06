/**
 * M10.17: Leave Policy Service
 *
 * Manages leave policies with accrual rules.
 * Policies can be org-wide or branch-specific overrides.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AccrualMethod, Prisma } from '@chefcloud/db';

export interface CreateLeavePolicyDto {
  orgId: string;
  branchId?: string;
  leaveTypeId: string;
  name: string;
  accrualMethod?: AccrualMethod;
  accrualRate?: number;
  carryoverMaxHours?: number;
  maxBalanceHours?: number;
  roundingPrecision?: number;
}

export interface UpdateLeavePolicyDto {
  name?: string;
  accrualMethod?: AccrualMethod;
  accrualRate?: number;
  carryoverMaxHours?: number;
  maxBalanceHours?: number;
  roundingPrecision?: number;
  isActive?: boolean;
}

@Injectable()
export class LeavePolicyService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a new leave policy
   */
  async create(dto: CreateLeavePolicyDto): Promise<any> {
    // Verify leave type exists and belongs to org
    const leaveType = await this.prisma.client.leaveTypeDefinition.findUnique({
      where: { id: dto.leaveTypeId },
    });

    if (!leaveType || leaveType.orgId !== dto.orgId) {
      throw new NotFoundException('Leave type not found');
    }

    // Check for duplicate policy (same org + leaveType + branch)
    const existing = await this.prisma.client.leavePolicy.findUnique({
      where: {
        orgId_leaveTypeId_branchId: {
          orgId: dto.orgId,
          leaveTypeId: dto.leaveTypeId,
          branchId: dto.branchId ?? null,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Policy already exists for this leave type' + (dto.branchId ? ' and branch' : ''),
      );
    }

    return this.prisma.client.leavePolicy.create({
      data: {
        orgId: dto.orgId,
        branchId: dto.branchId,
        leaveTypeId: dto.leaveTypeId,
        name: dto.name,
        accrualMethod: dto.accrualMethod ?? 'NONE',
        accrualRate: new Prisma.Decimal(dto.accrualRate ?? 0),
        carryoverMaxHours: new Prisma.Decimal(dto.carryoverMaxHours ?? 0),
        maxBalanceHours: new Prisma.Decimal(dto.maxBalanceHours ?? 480),
        roundingPrecision: dto.roundingPrecision ?? 2,
      },
      include: {
        leaveType: true,
      },
    });
  }

  /**
   * List all policies for an org (optionally filtered by branch)
   */
  async findAll(orgId: string, branchId?: string, includeInactive = false): Promise<any[]> {
    return this.prisma.client.leavePolicy.findMany({
      where: {
        orgId,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        leaveType: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get effective policy for a user (branch override or org default)
   */
  async getEffectivePolicy(orgId: string, branchId: string, leaveTypeId: string): Promise<any> {
    // Try branch-specific first
    let policy = await this.prisma.client.leavePolicy.findUnique({
      where: {
        orgId_leaveTypeId_branchId: {
          orgId,
          leaveTypeId,
          branchId,
        },
      },
      include: { leaveType: true },
    });

    // Fall back to org-wide policy
    if (!policy) {
      policy = await this.prisma.client.leavePolicy.findUnique({
        where: {
          orgId_leaveTypeId_branchId: {
            orgId,
            leaveTypeId,
            branchId: null,
          },
        },
        include: { leaveType: true },
      });
    }

    return policy;
  }

  /**
   * Get a single policy by ID
   */
  async findOne(id: string, orgId: string): Promise<any> {
    const policy = await this.prisma.client.leavePolicy.findUnique({
      where: { id },
      include: { leaveType: true },
    });

    if (!policy || policy.orgId !== orgId) {
      throw new NotFoundException('Leave policy not found');
    }

    return policy;
  }

  /**
   * Update a policy
   */
  async update(id: string, orgId: string, dto: UpdateLeavePolicyDto): Promise<any> {
    const policy = await this.findOne(id, orgId);

    return this.prisma.client.leavePolicy.update({
      where: { id: policy.id },
      data: {
        name: dto.name,
        accrualMethod: dto.accrualMethod,
        accrualRate: dto.accrualRate !== undefined ? new Prisma.Decimal(dto.accrualRate) : undefined,
        carryoverMaxHours: dto.carryoverMaxHours !== undefined ? new Prisma.Decimal(dto.carryoverMaxHours) : undefined,
        maxBalanceHours: dto.maxBalanceHours !== undefined ? new Prisma.Decimal(dto.maxBalanceHours) : undefined,
        roundingPrecision: dto.roundingPrecision,
        isActive: dto.isActive,
      },
      include: { leaveType: true },
    });
  }

  /**
   * Deactivate a policy
   */
  async deactivate(id: string, orgId: string): Promise<any> {
    const policy = await this.findOne(id, orgId);

    return this.prisma.client.leavePolicy.update({
      where: { id: policy.id },
      data: { isActive: false },
    });
  }
}
