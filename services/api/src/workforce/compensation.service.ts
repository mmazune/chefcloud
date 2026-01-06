/**
 * M10.7: Compensation Service
 * 
 * CRUD operations for compensation components and employee assignments.
 * Supports org-scoped components with optional branch overrides.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type CompensationComponentType = 'EARNING' | 'DEDUCTION_PRE' | 'DEDUCTION_POST' | 'TAX' | 'EMPLOYER_CONTRIB';
export type CalcMethod = 'FIXED' | 'PERCENT_OF_GROSS' | 'PERCENT_OF_EARNINGS_CODE' | 'PER_HOUR';
export type RoundingRule = 'HALF_UP_CENTS' | 'HALF_UP_UNIT';

export interface CreateComponentDto {
  code: string;
  name: string;
  type: CompensationComponentType;
  calcMethod: CalcMethod;
  rate?: number;
  amount?: number;
  earningsCode?: string;
  capMin?: number;
  capMax?: number;
  roundingRule?: RoundingRule;
  branchId?: string;
  enabled?: boolean;
}

export interface UpdateComponentDto {
  name?: string;
  rate?: number;
  amount?: number;
  earningsCode?: string;
  capMin?: number | null;
  capMax?: number | null;
  roundingRule?: RoundingRule;
  enabled?: boolean;
}

export interface CreateProfileDto {
  userId: string;
  startDate: Date;
  endDate?: Date;
  components?: Array<{
    componentId: string;
    overrideRate?: number;
    overrideAmount?: number;
  }>;
}

export interface UpdateProfileDto {
  endDate?: Date | null;
  components?: Array<{
    componentId: string;
    overrideRate?: number | null;
    overrideAmount?: number | null;
  }>;
}

@Injectable()
export class CompensationService {
  private readonly logger = new Logger(CompensationService.name);

  constructor(private readonly prisma: PrismaService) { }

  // ==================== COMPONENT CRUD ====================

  /**
   * Create a new compensation component
   */
  async createComponent(orgId: string, dto: CreateComponentDto): Promise<any> {
    // Validate caps
    if (dto.capMin != null && dto.capMax != null && dto.capMin > dto.capMax) {
      throw new BadRequestException('capMin cannot exceed capMax');
    }

    // Validate rate/amount are non-negative
    if (dto.rate != null && dto.rate < 0) {
      throw new BadRequestException('rate cannot be negative');
    }
    if (dto.amount != null && dto.amount < 0) {
      throw new BadRequestException('amount cannot be negative');
    }

    // Validate PERCENT_OF_EARNINGS_CODE requires earningsCode
    if (dto.calcMethod === 'PERCENT_OF_EARNINGS_CODE' && !dto.earningsCode) {
      throw new BadRequestException('earningsCode is required for PERCENT_OF_EARNINGS_CODE method');
    }

    // Check for duplicate code in same org+branch scope
    const existing = await this.prisma.client.compensationComponent.findFirst({
      where: {
        orgId,
        code: dto.code,
        branchId: dto.branchId ?? null,
      },
    });

    if (existing) {
      throw new BadRequestException(`Component with code "${dto.code}" already exists`);
    }

    const component = await this.prisma.client.compensationComponent.create({
      data: {
        orgId,
        branchId: dto.branchId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        calcMethod: dto.calcMethod,
        rate: dto.rate ?? 0,
        amount: dto.amount ?? 0,
        earningsCode: dto.earningsCode,
        capMin: dto.capMin,
        capMax: dto.capMax,
        roundingRule: dto.roundingRule ?? 'HALF_UP_CENTS',
        enabled: dto.enabled ?? true,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Created component ${dto.code} for org ${orgId}`);
    return component;
  }

  /**
   * List components for an org (optionally filtered by branch)
   */
  async listComponents(
    orgId: string,
    options?: { branchId?: string; enabled?: boolean; type?: CompensationComponentType },
  ): Promise<any[]> {
    const where: any = { orgId };

    if (options?.branchId) {
      // Include org-level (null branchId) and specific branch
      where.OR = [
        { branchId: null },
        { branchId: options.branchId },
      ];
    }

    if (options?.enabled !== undefined) {
      where.enabled = options.enabled;
    }

    if (options?.type) {
      where.type = options.type;
    }

    return this.prisma.client.compensationComponent.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get a single component
   */
  async getComponent(orgId: string, componentId: string): Promise<any> {
    const component = await this.prisma.client.compensationComponent.findFirst({
      where: { id: componentId, orgId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!component) {
      throw new NotFoundException('Compensation component not found');
    }

    return component;
  }

  /**
   * Update a component
   */
  async updateComponent(orgId: string, componentId: string, dto: UpdateComponentDto): Promise<any> {
    const existing = await this.prisma.client.compensationComponent.findFirst({
      where: { id: componentId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Compensation component not found');
    }

    // Validate caps
    const newCapMin = dto.capMin !== undefined ? dto.capMin : existing.capMin?.toNumber();
    const newCapMax = dto.capMax !== undefined ? dto.capMax : existing.capMax?.toNumber();
    if (newCapMin != null && newCapMax != null && newCapMin > newCapMax) {
      throw new BadRequestException('capMin cannot exceed capMax');
    }

    // Validate rate/amount
    if (dto.rate != null && dto.rate < 0) {
      throw new BadRequestException('rate cannot be negative');
    }
    if (dto.amount != null && dto.amount < 0) {
      throw new BadRequestException('amount cannot be negative');
    }

    const updated = await this.prisma.client.compensationComponent.update({
      where: { id: componentId },
      data: {
        name: dto.name,
        rate: dto.rate,
        amount: dto.amount,
        earningsCode: dto.earningsCode,
        capMin: dto.capMin,
        capMax: dto.capMax,
        roundingRule: dto.roundingRule,
        enabled: dto.enabled,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Updated component ${componentId}`);
    return updated;
  }

  /**
   * Disable a component (soft delete)
   */
  async disableComponent(orgId: string, componentId: string): Promise<any> {
    const existing = await this.prisma.client.compensationComponent.findFirst({
      where: { id: componentId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Compensation component not found');
    }

    const disabled = await this.prisma.client.compensationComponent.update({
      where: { id: componentId },
      data: { enabled: false },
    });

    this.logger.log(`Disabled component ${componentId}`);
    return disabled;
  }

  // ==================== PROFILE CRUD ====================

  /**
   * Create an employee compensation profile
   */
  async createProfile(orgId: string, dto: CreateProfileDto): Promise<any> {
    // Validate user exists
    const user = await this.prisma.client.user.findFirst({
      where: { id: dto.userId, orgId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate components exist
    if (dto.components?.length) {
      const componentIds = dto.components.map(c => c.componentId);
      const validComponents = await this.prisma.client.compensationComponent.findMany({
        where: { id: { in: componentIds }, orgId, enabled: true },
      });

      if (validComponents.length !== componentIds.length) {
        throw new BadRequestException('One or more component IDs are invalid');
      }
    }

    const profile = await this.prisma.client.employeeCompensationProfile.create({
      data: {
        orgId,
        userId: dto.userId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        components: dto.components?.length ? {
          create: dto.components.map(c => ({
            componentId: c.componentId,
            overrideRate: c.overrideRate,
            overrideAmount: c.overrideAmount,
          })),
        } : undefined,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        components: {
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    this.logger.log(`Created compensation profile for user ${dto.userId}`);
    return profile;
  }

  /**
   * List profiles for an org
   */
  async listProfiles(
    orgId: string,
    options?: { userId?: string; activeOn?: Date },
  ): Promise<any[]> {
    const where: any = { orgId };

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.activeOn) {
      where.startDate = { lte: options.activeOn };
      where.OR = [
        { endDate: null },
        { endDate: { gte: options.activeOn } },
      ];
    }

    return this.prisma.client.employeeCompensationProfile.findMany({
      where,
      orderBy: [{ userId: 'asc' }, { startDate: 'desc' }],
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        components: {
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });
  }

  /**
   * Get a single profile
   */
  async getProfile(orgId: string, profileId: string): Promise<any> {
    const profile = await this.prisma.client.employeeCompensationProfile.findFirst({
      where: { id: profileId, orgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        components: {
          include: {
            component: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Compensation profile not found');
    }

    return profile;
  }

  /**
   * Update a profile (e.g., set end date or modify components)
   */
  async updateProfile(orgId: string, profileId: string, dto: UpdateProfileDto): Promise<any> {
    const existing = await this.prisma.client.employeeCompensationProfile.findFirst({
      where: { id: profileId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Compensation profile not found');
    }

    // Handle component updates
    if (dto.components) {
      // Delete existing assignments and recreate
      await this.prisma.client.employeeCompensationComponent.deleteMany({
        where: { profileId },
      });

      for (const c of dto.components) {
        await this.prisma.client.employeeCompensationComponent.create({
          data: {
            profileId,
            componentId: c.componentId,
            overrideRate: c.overrideRate,
            overrideAmount: c.overrideAmount,
          },
        });
      }
    }

    // Update profile fields
    const updated = await this.prisma.client.employeeCompensationProfile.update({
      where: { id: profileId },
      data: {
        endDate: dto.endDate,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        components: {
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });

    this.logger.log(`Updated compensation profile ${profileId}`);
    return updated;
  }

  // ==================== RESOLUTION ====================

  /**
   * Get effective components for a user at a given date, considering branch overrides
   */
  async getEffectiveComponents(
    orgId: string,
    userId: string,
    effectiveDate: Date,
    branchId?: string,
  ): Promise<Array<{
    component: any;
    overrideRate?: number;
    overrideAmount?: number;
  }>> {
    // Find active profile
    const profile = await this.prisma.client.employeeCompensationProfile.findFirst({
      where: {
        orgId,
        userId,
        startDate: { lte: effectiveDate },
        OR: [
          { endDate: null },
          { endDate: { gte: effectiveDate } },
        ],
      },
      include: {
        components: {
          include: {
            component: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!profile) {
      return [];
    }

    // Merge components: branch overrides org-level
    const effectiveComponents: Map<string, { component: any; overrideRate?: number; overrideAmount?: number }> = new Map();

    for (const assignment of profile.components) {
      const comp = assignment.component;

      // Skip disabled components
      if (!comp.enabled) continue;

      // Skip if component is branch-specific and doesn't match
      if (comp.branchId && branchId && comp.branchId !== branchId) {
        continue;
      }

      const key = comp.code;
      const existing = effectiveComponents.get(key);

      // Branch override takes precedence over org-level
      if (!existing || (comp.branchId && !existing.component.branchId)) {
        effectiveComponents.set(key, {
          component: comp,
          overrideRate: assignment.overrideRate?.toNumber(),
          overrideAmount: assignment.overrideAmount?.toNumber(),
        });
      }
    }

    return Array.from(effectiveComponents.values());
  }
}
