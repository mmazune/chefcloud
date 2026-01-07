/**
 * M11.13 Inventory Posting Mapping Service
 * 
 * CRUD operations for InventoryPostingMapping:
 * - Maps inventory document types to GL accounts
 * - Org-level default with optional branch-level overrides
 * - Account type validation (Asset, Expense, Liability)
 * - Resolution method: branch-specific → org default
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AccountType } from '@chefcloud/db';

export interface CreateInventoryPostingMappingDto {
  branchId?: string | null;
  inventoryAssetAccountId: string;
  cogsAccountId: string;
  wasteExpenseAccountId: string;
  shrinkExpenseAccountId: string;
  grniAccountId: string;
  inventoryGainAccountId?: string | null;
}

export interface UpdateInventoryPostingMappingDto {
  inventoryAssetAccountId?: string;
  cogsAccountId?: string;
  wasteExpenseAccountId?: string;
  shrinkExpenseAccountId?: string;
  grniAccountId?: string;
  inventoryGainAccountId?: string | null;
}

export interface ResolvedPostingMapping {
  inventoryAssetAccountId: string;
  cogsAccountId: string;
  wasteExpenseAccountId: string;
  shrinkExpenseAccountId: string;
  grniAccountId: string;
  inventoryGainAccountId: string | null;
  isOrgDefault: boolean;
  mappingId: string;
}

const INCLUDE_ACCOUNTS = {
  inventoryAssetAccount: { select: { id: true, code: true, name: true, type: true } },
  cogsAccount: { select: { id: true, code: true, name: true, type: true } },
  wasteExpenseAccount: { select: { id: true, code: true, name: true, type: true } },
  shrinkExpenseAccount: { select: { id: true, code: true, name: true, type: true } },
  grniAccount: { select: { id: true, code: true, name: true, type: true } },
  inventoryGainAccount: { select: { id: true, code: true, name: true, type: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

@Injectable()
export class InventoryPostingMappingService {
  private readonly logger = new Logger(InventoryPostingMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Create a new posting mapping
   */
  async create(orgId: string, userId: string, dto: CreateInventoryPostingMappingDto) {
    this.logger.log(`Creating inventory posting mapping for org=${orgId}, branch=${dto.branchId || 'ORG_DEFAULT'}`);

    // Check for existing mapping
    const existing = await this.prisma.client.inventoryPostingMapping.findUnique({
      where: { orgId_branchId: { orgId, branchId: dto.branchId ?? null } },
    });

    if (existing) {
      throw new BadRequestException(
        dto.branchId 
          ? `Posting mapping already exists for branch ${dto.branchId}`
          : 'Org default posting mapping already exists'
      );
    }

    // Validate branch exists if provided
    if (dto.branchId) {
      const branch = await this.prisma.client.branch.findFirst({
        where: { id: dto.branchId, orgId },
      });
      if (!branch) {
        throw new BadRequestException(`Branch ${dto.branchId} not found`);
      }
    }

    // Validate account types
    await this.validateAccountTypes(orgId, dto);

    const mapping = await this.prisma.client.inventoryPostingMapping.create({
      data: {
        orgId,
        branchId: dto.branchId ?? null,
        inventoryAssetAccountId: dto.inventoryAssetAccountId,
        cogsAccountId: dto.cogsAccountId,
        wasteExpenseAccountId: dto.wasteExpenseAccountId,
        shrinkExpenseAccountId: dto.shrinkExpenseAccountId,
        grniAccountId: dto.grniAccountId,
        inventoryGainAccountId: dto.inventoryGainAccountId ?? null,
        createdById: userId,
      },
      include: INCLUDE_ACCOUNTS,
    });

    await this.auditLog.log({
      orgId,
      userId,
      action: 'inventory.mapping.created',
      resourceType: 'InventoryPostingMapping',
      resourceId: mapping.id,
      metadata: { branchId: dto.branchId ?? 'ORG_DEFAULT' },
    });

    this.logger.log(`Created inventory posting mapping ${mapping.id}`);
    return mapping;
  }

  /**
   * Get all mappings for an org
   */
  async findAll(orgId: string) {
    return this.prisma.client.inventoryPostingMapping.findMany({
      where: { orgId },
      include: INCLUDE_ACCOUNTS,
      orderBy: [{ branchId: 'asc' }], // org default (null) first
    });
  }

  /**
   * Get a specific mapping by ID
   */
  async findById(orgId: string, id: string) {
    const mapping = await this.prisma.client.inventoryPostingMapping.findFirst({
      where: { id, orgId },
      include: INCLUDE_ACCOUNTS,
    });

    if (!mapping) {
      throw new NotFoundException(`Mapping ${id} not found`);
    }

    return mapping;
  }

  /**
   * Update a mapping
   */
  async update(orgId: string, id: string, userId: string, dto: UpdateInventoryPostingMappingDto) {
    const existing = await this.prisma.client.inventoryPostingMapping.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Mapping ${id} not found`);
    }

    // Validate account types for changed accounts
    await this.validateAccountTypes(orgId, {
      inventoryAssetAccountId: dto.inventoryAssetAccountId ?? existing.inventoryAssetAccountId,
      cogsAccountId: dto.cogsAccountId ?? existing.cogsAccountId,
      wasteExpenseAccountId: dto.wasteExpenseAccountId ?? existing.wasteExpenseAccountId,
      shrinkExpenseAccountId: dto.shrinkExpenseAccountId ?? existing.shrinkExpenseAccountId,
      grniAccountId: dto.grniAccountId ?? existing.grniAccountId,
      inventoryGainAccountId: dto.inventoryGainAccountId ?? existing.inventoryGainAccountId,
    });

    const updated = await this.prisma.client.inventoryPostingMapping.update({
      where: { id },
      data: {
        ...(dto.inventoryAssetAccountId && { inventoryAssetAccountId: dto.inventoryAssetAccountId }),
        ...(dto.cogsAccountId && { cogsAccountId: dto.cogsAccountId }),
        ...(dto.wasteExpenseAccountId && { wasteExpenseAccountId: dto.wasteExpenseAccountId }),
        ...(dto.shrinkExpenseAccountId && { shrinkExpenseAccountId: dto.shrinkExpenseAccountId }),
        ...(dto.grniAccountId && { grniAccountId: dto.grniAccountId }),
        ...(dto.inventoryGainAccountId !== undefined && { inventoryGainAccountId: dto.inventoryGainAccountId }),
      },
      include: INCLUDE_ACCOUNTS,
    });

    await this.auditLog.log({
      orgId,
      userId,
      action: 'inventory.mapping.updated',
      resourceType: 'InventoryPostingMapping',
      resourceId: id,
      metadata: { changes: dto },
    });

    this.logger.log(`Updated inventory posting mapping ${id}`);
    return updated;
  }

  /**
   * Delete a mapping
   */
  async delete(orgId: string, id: string, userId: string) {
    const existing = await this.prisma.client.inventoryPostingMapping.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException(`Mapping ${id} not found`);
    }

    await this.prisma.client.inventoryPostingMapping.delete({ where: { id } });

    await this.auditLog.log({
      orgId,
      userId,
      action: 'inventory.mapping.deleted',
      resourceType: 'InventoryPostingMapping',
      resourceId: id,
      metadata: { branchId: existing.branchId ?? 'ORG_DEFAULT' },
    });

    this.logger.log(`Deleted inventory posting mapping ${id}`);
    return { success: true };
  }

  /**
   * Resolve the posting mapping for a branch
   * Falls back to org default if branch-specific mapping not found
   */
  async resolveMapping(orgId: string, branchId: string): Promise<ResolvedPostingMapping> {
    // First try branch-specific mapping
    const branchMapping = await this.prisma.client.inventoryPostingMapping.findUnique({
      where: { orgId_branchId: { orgId, branchId } },
    });

    if (branchMapping) {
      return {
        inventoryAssetAccountId: branchMapping.inventoryAssetAccountId,
        cogsAccountId: branchMapping.cogsAccountId,
        wasteExpenseAccountId: branchMapping.wasteExpenseAccountId,
        shrinkExpenseAccountId: branchMapping.shrinkExpenseAccountId,
        grniAccountId: branchMapping.grniAccountId,
        inventoryGainAccountId: branchMapping.inventoryGainAccountId,
        isOrgDefault: false,
        mappingId: branchMapping.id,
      };
    }

    // Fall back to org default
    const orgDefault = await this.prisma.client.inventoryPostingMapping.findUnique({
      where: { orgId_branchId: { orgId, branchId: null } },
    });

    if (orgDefault) {
      return {
        inventoryAssetAccountId: orgDefault.inventoryAssetAccountId,
        cogsAccountId: orgDefault.cogsAccountId,
        wasteExpenseAccountId: orgDefault.wasteExpenseAccountId,
        shrinkExpenseAccountId: orgDefault.shrinkExpenseAccountId,
        grniAccountId: orgDefault.grniAccountId,
        inventoryGainAccountId: orgDefault.inventoryGainAccountId,
        isOrgDefault: true,
        mappingId: orgDefault.id,
      };
    }

    throw new BadRequestException(
      'GL integration not configured. Please set up inventory posting mappings.'
    );
  }

  /**
   * Check if mapping exists for org (for optional GL posting)
   */
  async hasMappingForOrg(orgId: string): Promise<boolean> {
    const count = await this.prisma.client.inventoryPostingMapping.count({
      where: { orgId },
    });
    return count > 0;
  }

  /**
   * Validate account types match expected types
   */
  private async validateAccountTypes(
    orgId: string,
    dto: Partial<CreateInventoryPostingMappingDto>,
  ): Promise<void> {
    const accountChecks: { id: string | null | undefined; expectedType: AccountType; label: string }[] = [
      { id: dto.inventoryAssetAccountId, expectedType: 'ASSET', label: 'Inventory Asset' },
      { id: dto.cogsAccountId, expectedType: 'EXPENSE', label: 'COGS' },
      { id: dto.wasteExpenseAccountId, expectedType: 'EXPENSE', label: 'Waste Expense' },
      { id: dto.shrinkExpenseAccountId, expectedType: 'EXPENSE', label: 'Shrink Expense' },
      { id: dto.grniAccountId, expectedType: 'LIABILITY', label: 'GRNI' },
      { id: dto.inventoryGainAccountId, expectedType: 'REVENUE', label: 'Inventory Gain' },
    ];

    for (const check of accountChecks) {
      if (!check.id) continue;

      const account = await this.prisma.client.account.findFirst({
        where: { id: check.id, orgId },
      });

      if (!account) {
        throw new BadRequestException(`${check.label} account not found: ${check.id}`);
      }

      if (account.type !== check.expectedType) {
        throw new BadRequestException(
          `${check.label} account must be ${check.expectedType} type, got ${account.type}`
        );
      }

      if (!account.isActive) {
        throw new BadRequestException(`${check.label} account is inactive: ${account.code}`);
      }
    }
  }
}
