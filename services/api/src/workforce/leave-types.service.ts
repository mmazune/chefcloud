/**
 * M10.17: Leave Types Service
 *
 * Manages leave type definitions for organizations.
 * Leave types define categories like Annual, Sick, Parental, etc.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeaveTypeCode } from '@chefcloud/db';

export interface CreateLeaveTypeDto {
  orgId: string;
  name: string;
  code: LeaveTypeCode;
  isPaid?: boolean;
  requiresApproval?: boolean;
  minNoticeHours?: number;
  maxConsecutiveDays?: number;
}

export interface UpdateLeaveTypeDto {
  name?: string;
  isPaid?: boolean;
  requiresApproval?: boolean;
  minNoticeHours?: number;
  maxConsecutiveDays?: number;
  isActive?: boolean;
}

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new leave type for an organization
   */
  async create(dto: CreateLeaveTypeDto): Promise<any> {
    // Check for duplicate code in org
    const existing = await this.prisma.client.leaveTypeDefinition.findUnique({
      where: {
        orgId_code: {
          orgId: dto.orgId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Leave type with code ${dto.code} already exists`);
    }

    return this.prisma.client.leaveTypeDefinition.create({
      data: {
        orgId: dto.orgId,
        name: dto.name,
        code: dto.code,
        isPaid: dto.isPaid ?? true,
        requiresApproval: dto.requiresApproval ?? true,
        minNoticeHours: dto.minNoticeHours ?? 0,
        maxConsecutiveDays: dto.maxConsecutiveDays ?? 30,
      },
    });
  }

  /**
   * List all leave types for an organization
   */
  async findAll(orgId: string, includeInactive = false): Promise<any[]> {
    return this.prisma.client.leaveTypeDefinition.findMany({
      where: {
        orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single leave type by ID
   */
  async findOne(id: string, orgId: string): Promise<any> {
    const leaveType = await this.prisma.client.leaveTypeDefinition.findUnique({
      where: { id },
    });

    if (!leaveType || leaveType.orgId !== orgId) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  /**
   * Update a leave type
   */
  async update(id: string, orgId: string, dto: UpdateLeaveTypeDto): Promise<any> {
    const leaveType = await this.findOne(id, orgId);

    return this.prisma.client.leaveTypeDefinition.update({
      where: { id: leaveType.id },
      data: dto,
    });
  }

  /**
   * Soft delete (deactivate) a leave type
   */
  async deactivate(id: string, orgId: string): Promise<any> {
    const leaveType = await this.findOne(id, orgId);

    // Check if there are active policies using this type
    const activePolicies = await this.prisma.client.leavePolicy.count({
      where: {
        leaveTypeId: leaveType.id,
        isActive: true,
      },
    });

    if (activePolicies > 0) {
      throw new ConflictException(
        `Cannot deactivate leave type with ${activePolicies} active policies`,
      );
    }

    return this.prisma.client.leaveTypeDefinition.update({
      where: { id: leaveType.id },
      data: { isActive: false },
    });
  }
}
