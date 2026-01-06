/**
 * M10.8: Payroll Posting Mapping Service
 *
 * Manages configurable GL account mappings for payroll posting.
 * Supports org-level defaults with optional branch-level overrides.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Default account codes for initial setup
export const DEFAULT_ACCOUNT_CODES = {
  laborExpense: '6000',        // Labor Expense
  wagesPayable: '2105',        // Wages Payable
  taxesPayable: '2110',        // Taxes Payable
  deductionsPayable: '2115',   // Deductions Payable
  employerContribExpense: '6050', // Employer Contribution Expense
  employerContribPayable: '2120', // Employer Contribution Payable
  cash: '1000',                // Cash/Bank
} as const;

export interface PayrollMappingDto {
  branchId?: string | null;
  laborExpenseAccountId: string;
  wagesPayableAccountId: string;
  taxesPayableAccountId: string;
  deductionsPayableAccountId: string;
  employerContribExpenseAccountId: string;
  employerContribPayableAccountId: string;
  cashAccountId: string;
  enabled?: boolean;
}

export interface PayrollMappingPreview {
  laborExpenseAccount: { id: string; code: string; name: string };
  wagesPayableAccount: { id: string; code: string; name: string };
  taxesPayableAccount: { id: string; code: string; name: string };
  deductionsPayableAccount: { id: string; code: string; name: string };
  employerContribExpenseAccount: { id: string; code: string; name: string };
  employerContribPayableAccount: { id: string; code: string; name: string };
  cashAccount: { id: string; code: string; name: string };
  enabled: boolean;
  branchId: string | null;
}

@Injectable()
export class PayrollMappingService {
  private readonly logger = new Logger(PayrollMappingService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get mapping for org (optionally for specific branch).
   * Falls back to org-level if no branch mapping exists.
   */
  async getMapping(orgId: string, branchId?: string | null): Promise<PayrollMappingPreview | null> {
    // If branchId provided, try branch-specific first
    if (branchId) {
      const branchMapping = await this.prisma.client.payrollPostingMapping.findUnique({
        where: { orgId_branchId: { orgId, branchId } },
        include: {
          laborExpenseAccount: { select: { id: true, code: true, name: true } },
          wagesPayableAccount: { select: { id: true, code: true, name: true } },
          taxesPayableAccount: { select: { id: true, code: true, name: true } },
          deductionsPayableAccount: { select: { id: true, code: true, name: true } },
          employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
          employerContribPayableAccount: { select: { id: true, code: true, name: true } },
          cashAccount: { select: { id: true, code: true, name: true } },
        },
      });
      if (branchMapping) {
        return this.toPreview(branchMapping);
      }
    }

    // Fall back to org-level (branchId = null)
    const orgMapping = await this.prisma.client.payrollPostingMapping.findFirst({
      where: { orgId, branchId: null },
      include: {
        laborExpenseAccount: { select: { id: true, code: true, name: true } },
        wagesPayableAccount: { select: { id: true, code: true, name: true } },
        taxesPayableAccount: { select: { id: true, code: true, name: true } },
        deductionsPayableAccount: { select: { id: true, code: true, name: true } },
        employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
        employerContribPayableAccount: { select: { id: true, code: true, name: true } },
        cashAccount: { select: { id: true, code: true, name: true } },
      },
    });

    return orgMapping ? this.toPreview(orgMapping) : null;
  }

  /**
   * Get mapping by ID (for audit/validation)
   */
  async getMappingById(orgId: string, mappingId: string): Promise<PayrollMappingPreview | null> {
    const mapping = await this.prisma.client.payrollPostingMapping.findFirst({
      where: { id: mappingId, orgId },
      include: {
        laborExpenseAccount: { select: { id: true, code: true, name: true } },
        wagesPayableAccount: { select: { id: true, code: true, name: true } },
        taxesPayableAccount: { select: { id: true, code: true, name: true } },
        deductionsPayableAccount: { select: { id: true, code: true, name: true } },
        employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
        employerContribPayableAccount: { select: { id: true, code: true, name: true } },
        cashAccount: { select: { id: true, code: true, name: true } },
      },
    });
    return mapping ? this.toPreview(mapping) : null;
  }

  /**
   * List all mappings for org (org-level + all branch overrides)
   */
  async listMappings(orgId: string): Promise<Array<PayrollMappingPreview & { id: string }>> {
    const mappings = await this.prisma.client.payrollPostingMapping.findMany({
      where: { orgId },
      include: {
        laborExpenseAccount: { select: { id: true, code: true, name: true } },
        wagesPayableAccount: { select: { id: true, code: true, name: true } },
        taxesPayableAccount: { select: { id: true, code: true, name: true } },
        deductionsPayableAccount: { select: { id: true, code: true, name: true } },
        employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
        employerContribPayableAccount: { select: { id: true, code: true, name: true } },
        cashAccount: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ branchId: 'asc' }], // Org-level (null) first
    });

    return mappings.map((m) => ({
      id: m.id,
      ...this.toPreview(m),
    }));
  }

  /**
   * Upsert mapping (create or update).
   * branchId = null for org-level default.
   */
  async upsertMapping(orgId: string, dto: PayrollMappingDto): Promise<{ id: string } & PayrollMappingPreview> {
    // Validate all accounts exist and belong to org
    const accountIds = [
      dto.laborExpenseAccountId,
      dto.wagesPayableAccountId,
      dto.taxesPayableAccountId,
      dto.deductionsPayableAccountId,
      dto.employerContribExpenseAccountId,
      dto.employerContribPayableAccountId,
      dto.cashAccountId,
    ];

    const accounts = await this.prisma.client.account.findMany({
      where: { id: { in: accountIds }, orgId },
      select: { id: true, code: true, name: true },
    });

    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missing = accountIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Account(s) not found or not in org: ${missing.join(', ')}`);
    }

    // If branchId provided, validate it belongs to org
    if (dto.branchId) {
      const branch = await this.prisma.client.branch.findFirst({
        where: { id: dto.branchId, orgId },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found or not in org');
      }
    }

    const branchId = dto.branchId ?? null;

    // Find existing mapping (Prisma upsert doesn't work well with nullable unique fields)
    const existing = await this.prisma.client.payrollPostingMapping.findFirst({
      where: branchId ? { orgId, branchId } : { orgId, branchId: null },
    });

    const data = {
      laborExpenseAccountId: dto.laborExpenseAccountId,
      wagesPayableAccountId: dto.wagesPayableAccountId,
      taxesPayableAccountId: dto.taxesPayableAccountId,
      deductionsPayableAccountId: dto.deductionsPayableAccountId,
      employerContribExpenseAccountId: dto.employerContribExpenseAccountId,
      employerContribPayableAccountId: dto.employerContribPayableAccountId,
      cashAccountId: dto.cashAccountId,
      enabled: dto.enabled ?? true,
    };

    let result;
    if (existing) {
      result = await this.prisma.client.payrollPostingMapping.update({
        where: { id: existing.id },
        data,
        include: {
          laborExpenseAccount: { select: { id: true, code: true, name: true } },
          wagesPayableAccount: { select: { id: true, code: true, name: true } },
          taxesPayableAccount: { select: { id: true, code: true, name: true } },
          deductionsPayableAccount: { select: { id: true, code: true, name: true } },
          employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
          employerContribPayableAccount: { select: { id: true, code: true, name: true } },
          cashAccount: { select: { id: true, code: true, name: true } },
        },
      });
    } else {
      result = await this.prisma.client.payrollPostingMapping.create({
        data: {
          orgId,
          branchId,
          ...data,
        },
        include: {
          laborExpenseAccount: { select: { id: true, code: true, name: true } },
          wagesPayableAccount: { select: { id: true, code: true, name: true } },
          taxesPayableAccount: { select: { id: true, code: true, name: true } },
          deductionsPayableAccount: { select: { id: true, code: true, name: true } },
          employerContribExpenseAccount: { select: { id: true, code: true, name: true } },
          employerContribPayableAccount: { select: { id: true, code: true, name: true } },
          cashAccount: { select: { id: true, code: true, name: true } },
        },
      });
    }

    this.logger.log(`Upserted payroll mapping for org=${orgId} branch=${branchId}`);

    return { id: result.id, ...this.toPreview(result) };
  }

  /**
   * Delete a mapping (branch-specific only; org-level cannot be deleted, only updated)
   */
  async deleteMapping(orgId: string, mappingId: string): Promise<void> {
    const mapping = await this.prisma.client.payrollPostingMapping.findFirst({
      where: { id: mappingId, orgId },
    });

    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }

    if (!mapping.branchId) {
      throw new BadRequestException('Cannot delete org-level mapping; update it instead');
    }

    await this.prisma.client.payrollPostingMapping.delete({
      where: { id: mappingId },
    });

    this.logger.log(`Deleted payroll mapping ${mappingId}`);
  }

  /**
   * Initialize default mapping for org using standard account codes.
   * Only creates if no mapping exists.
   */
  async initializeDefaultMapping(orgId: string): Promise<{ id: string } & PayrollMappingPreview | null> {
    // Check if org-level mapping already exists
    const existing = await this.prisma.client.payrollPostingMapping.findFirst({
      where: { orgId, branchId: null },
    });

    if (existing) {
      this.logger.log(`Default mapping already exists for org=${orgId}`);
      return null;
    }

    // Find accounts by default codes
    const codes = Object.values(DEFAULT_ACCOUNT_CODES);
    const accounts = await this.prisma.client.account.findMany({
      where: { orgId, code: { in: codes } },
      select: { id: true, code: true, name: true },
    });

    const accountByCode = new Map(accounts.map((a) => [a.code, a]));

    // Check all required accounts exist
    const missing: string[] = [];
    for (const [key, code] of Object.entries(DEFAULT_ACCOUNT_CODES)) {
      if (!accountByCode.has(code)) {
        missing.push(`${key} (${code})`);
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException(`Cannot initialize default mapping. Missing accounts: ${missing.join(', ')}`);
    }

    return this.upsertMapping(orgId, {
      branchId: null,
      laborExpenseAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.laborExpense)!.id,
      wagesPayableAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.wagesPayable)!.id,
      taxesPayableAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.taxesPayable)!.id,
      deductionsPayableAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.deductionsPayable)!.id,
      employerContribExpenseAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.employerContribExpense)!.id,
      employerContribPayableAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.employerContribPayable)!.id,
      cashAccountId: accountByCode.get(DEFAULT_ACCOUNT_CODES.cash)!.id,
      enabled: true,
    });
  }

  /**
   * Get effective mapping for a payroll run (handles branch fallback)
   */
  async getEffectiveMapping(orgId: string, branchId?: string | null): Promise<PayrollMappingPreview> {
    const mapping = await this.getMapping(orgId, branchId);
    if (!mapping) {
      throw new BadRequestException(
        'No payroll posting mapping configured. Please configure GL account mappings first.',
      );
    }
    if (!mapping.enabled) {
      throw new BadRequestException('Payroll posting mapping is disabled');
    }
    return mapping;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toPreview(mapping: any): PayrollMappingPreview {
    return {
      laborExpenseAccount: mapping.laborExpenseAccount,
      wagesPayableAccount: mapping.wagesPayableAccount,
      taxesPayableAccount: mapping.taxesPayableAccount,
      deductionsPayableAccount: mapping.deductionsPayableAccount,
      employerContribExpenseAccount: mapping.employerContribExpenseAccount,
      employerContribPayableAccount: mapping.employerContribPayableAccount,
      cashAccount: mapping.cashAccount,
      enabled: mapping.enabled,
      branchId: mapping.branchId,
    };
  }
}
