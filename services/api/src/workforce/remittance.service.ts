/**
 * M10.9: Remittance Service
 * M10.10: Extended with Provider Directory, Reconciliation, Idempotent Generation
 *
 * Manages liability settlement batches (taxes, deductions, employer contributions).
 * State machine: DRAFT → APPROVED → POSTED → PAID (+ VOID from any state)
 *
 * Journal behavior (preferred approach):
 * - POSTED: Locks batch, no journal yet
 * - PAID: Creates journal (Dr Liability / Cr Cash)
 * - VOID: Reverses journal if exists
 *
 * M10.10 additions:
 * - Provider directory (TAX_AUTHORITY, BENEFITS, PENSION, OTHER)
 * - Component → Provider mapping
 * - Reconciliation fields (externalReference, settledAt, settlementMethod, receiptNote)
 * - Idempotent generation with source links
 * - Bank upload stub export
 */
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, RemittanceBatchStatus, RemittanceBatchType, RemittanceProviderType, SettlementMethod } from '@chefcloud/db';
import * as crypto from 'crypto';

// Valid state transitions
const VALID_TRANSITIONS: Record<RemittanceBatchStatus, RemittanceBatchStatus[]> = {
  DRAFT: ['APPROVED', 'VOID'],
  APPROVED: ['POSTED', 'VOID'],
  POSTED: ['PAID', 'VOID'],
  PAID: ['VOID'],
  VOID: [],
};

export interface CreateBatchDto {
  branchId?: string;
  type: RemittanceBatchType;
  currencyCode?: string;
  periodId?: string;
  idempotencyKey?: string;
  memo?: string;
}

export interface AddLineDto {
  componentId?: string;
  liabilityAccountId: string;
  counterAccountId: string;
  amount: string | number;
  payeeName?: string;
  referenceCode?: string;
}

export interface BatchListFilters {
  status?: RemittanceBatchStatus;
  type?: RemittanceBatchType;
  branchId?: string;
}

// M10.10: Provider DTOs
export interface CreateProviderDto {
  branchId?: string;
  name: string;
  type: RemittanceProviderType;
  referenceFormatHint?: string;
  defaultLiabilityAccountId?: string;
  defaultCashAccountId?: string;
  enabled?: boolean;
}

export interface UpdateProviderDto {
  name?: string;
  type?: RemittanceProviderType;
  referenceFormatHint?: string;
  defaultLiabilityAccountId?: string;
  defaultCashAccountId?: string;
  enabled?: boolean;
}

// M10.10: Mapping DTO
export interface CreateMappingDto {
  componentId: string;
  providerId: string;
  remittanceType: RemittanceBatchType;
}

// M10.10: Mark settled DTO
export interface MarkSettledDto {
  externalReference?: string;
  settlementMethod: SettlementMethod;
  receiptNote?: string;
}

// M10.10: Generate from payroll DTO
export interface GenerateFromPayrollDto {
  branchId?: string;
  payrollRunIds: string[];
}

@Injectable()
export class RemittanceService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a new remittance batch in DRAFT status
   */
  async createBatch(orgId: string, userId: string, dto: CreateBatchDto): Promise<any> {
    // Check idempotency key collision
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.remittanceBatch.findFirst({
        where: { orgId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        throw new ConflictException({
          message: 'Idempotency key already exists',
          existingBatchId: existing.id,
        });
      }
    }

    return this.prisma.client.remittanceBatch.create({
      data: {
        orgId,
        branchId: dto.branchId || null,
        type: dto.type,
        currencyCode: dto.currencyCode || 'UGX',
        periodId: dto.periodId || null,
        idempotencyKey: dto.idempotencyKey || null,
        memo: dto.memo || null,
        createdById: userId,
      },
      include: { lines: true },
    });
  }

  /**
   * Get batch by ID with validation
   */
  async getBatch(orgId: string, batchId: string): Promise<any> {
    const batch = await this.prisma.client.remittanceBatch.findFirst({
      where: { id: batchId, orgId },
      include: {
        lines: {
          include: {
            liabilityAccount: true,
            counterAccount: true,
            component: true,
          },
        },
        journalLinks: {
          include: {
            journalEntry: {
              include: { lines: { include: { account: true } } },
            },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        paidBy: { select: { id: true, firstName: true, lastName: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!batch) {
      throw new NotFoundException('Remittance batch not found');
    }
    return batch;
  }

  /**
   * List batches with filters
   */
  async listBatches(orgId: string, filters: BatchListFilters = {}): Promise<any[]> {
    const where: Prisma.RemittanceBatchWhereInput = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.branchId) where.branchId = filters.branchId;

    return this.prisma.client.remittanceBatch.findMany({
      where,
      include: {
        lines: true,
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a DRAFT batch
   */
  async updateBatch(orgId: string, batchId: string, dto: Partial<CreateBatchDto>): Promise<any> {
    const batch = await this.getBatch(orgId, batchId);
    if (batch.status !== 'DRAFT') {
      throw new BadRequestException('Can only update DRAFT batches');
    }

    return this.prisma.client.remittanceBatch.update({
      where: { id: batchId },
      data: {
        branchId: dto.branchId ?? batch.branchId,
        type: dto.type ?? batch.type,
        memo: dto.memo ?? batch.memo,
      },
      include: { lines: true },
    });
  }

  /**
   * Delete a DRAFT batch
   */
  async deleteBatch(orgId: string, batchId: string) {
    const batch = await this.getBatch(orgId, batchId);
    if (batch.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete DRAFT batches');
    }
    await this.prisma.client.remittanceBatch.delete({ where: { id: batchId } });
    return { deleted: true };
  }

  /**
   * Add a line to a DRAFT batch
   */
  async addLine(orgId: string, batchId: string, dto: AddLineDto): Promise<any> {
    const batch = await this.getBatch(orgId, batchId);
    if (batch.status !== 'DRAFT') {
      throw new BadRequestException('Can only add lines to DRAFT batches');
    }

    const amount = new Prisma.Decimal(dto.amount);

    const line = await this.prisma.client.remittanceLine.create({
      data: {
        batchId,
        componentId: dto.componentId || null,
        liabilityAccountId: dto.liabilityAccountId,
        counterAccountId: dto.counterAccountId,
        amount,
        payeeName: dto.payeeName || null,
        referenceCode: dto.referenceCode || null,
      },
      include: {
        liabilityAccount: true,
        counterAccount: true,
      },
    });

    // Update batch total
    await this.recalculateBatchTotal(batchId);

    return line;
  }

  /**
   * Remove a line from a DRAFT batch
   */
  async removeLine(orgId: string, batchId: string, lineId: string) {
    const batch = await this.getBatch(orgId, batchId);
    if (batch.status !== 'DRAFT') {
      throw new BadRequestException('Can only remove lines from DRAFT batches');
    }

    await this.prisma.client.remittanceLine.delete({ where: { id: lineId } });
    await this.recalculateBatchTotal(batchId);
    return { deleted: true };
  }

  /**
   * Recalculate batch total from lines
   */
  private async recalculateBatchTotal(batchId: string) {
    const lines = await this.prisma.client.remittanceLine.findMany({ where: { batchId } });
    const total = lines.reduce((sum, l) => sum.add(l.amount), new Prisma.Decimal(0));
    await this.prisma.client.remittanceBatch.update({
      where: { id: batchId },
      data: { totalAmount: total },
    });
  }

  /**
   * Transition batch status with validation
   */
  async transitionStatus(
    orgId: string,
    batchId: string,
    userId: string,
    targetStatus: RemittanceBatchStatus,
  ): Promise<any> {
    const batch = await this.getBatch(orgId, batchId);
    const allowedTargets = VALID_TRANSITIONS[batch.status];

    if (!allowedTargets.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${batch.status} to ${targetStatus}`,
      );
    }

    // State-specific validation
    switch (targetStatus) {
      case 'APPROVED':
        return this.approveBatch(batch, userId);
      case 'POSTED':
        return this.postBatch(batch, userId);
      case 'PAID':
        return this.payBatch(batch, userId);
      case 'VOID':
        return this.voidBatch(batch, userId);
      default:
        throw new BadRequestException(`Unknown target status: ${targetStatus}`);
    }
  }

  /**
   * Approve batch (DRAFT → APPROVED)
   */
  private async approveBatch(batch: any, userId: string) {
    if (batch.lines.length === 0) {
      throw new BadRequestException('Cannot approve batch with no lines');
    }

    return this.prisma.client.remittanceBatch.update({
      where: { id: batch.id },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: { lines: true },
    });
  }

  /**
   * Post batch (APPROVED → POSTED) - locks batch, no journal yet
   */
  private async postBatch(batch: any, userId: string) {
    return this.prisma.client.remittanceBatch.update({
      where: { id: batch.id },
      data: {
        status: 'POSTED',
        postedById: userId,
        postedAt: new Date(),
      },
      include: { lines: true },
    });
  }

  /**
   * Pay batch (POSTED → PAID) - creates journal entry
   */
  private async payBatch(batch: any, userId: string) {
    // Check fiscal period lock
    await this.checkPeriodLock(batch.orgId, new Date());

    // Build journal lines: Dr Liability / Cr Counter for each line
    const journalLines: { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[] = [];

    for (const line of batch.lines) {
      // Debit liability account (reduce liability)
      journalLines.push({
        accountId: line.liabilityAccountId,
        debit: line.amount,
        credit: new Prisma.Decimal(0),
      });
      // Credit counter account (cash outflow)
      journalLines.push({
        accountId: line.counterAccountId,
        debit: new Prisma.Decimal(0),
        credit: line.amount,
      });
    }

    // Create journal entry and link
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create journal entry
      const journal = await tx.journalEntry.create({
        data: {
          orgId: batch.orgId,
          branchId: batch.branchId,
          date: new Date(),
          memo: `Remittance payment: ${batch.memo || batch.type}`,
          source: 'REMITTANCE',
          sourceId: batch.id,
          status: 'POSTED',
          postedById: userId,
          postedAt: new Date(),
          lines: {
            create: journalLines,
          },
        },
        include: { lines: true },
      });

      // Create link
      await tx.remittanceJournalLink.create({
        data: {
          batchId: batch.id,
          journalEntryId: journal.id,
          type: 'PAYMENT',
        },
      });

      // Update batch status
      const updated = await tx.remittanceBatch.update({
        where: { id: batch.id },
        data: {
          status: 'PAID',
          paidById: userId,
          paidAt: new Date(),
        },
        include: { lines: true, journalLinks: { include: { journalEntry: true } } },
      });

      return updated;
    });

    return result;
  }

  /**
   * Void batch - reverses journal if exists
   */
  private async voidBatch(batch: any, userId: string) {
    const result = await this.prisma.client.$transaction(async (tx) => {
      // If batch has journal links (was PAID), create reversal
      if (batch.journalLinks && batch.journalLinks.length > 0) {
        for (const link of batch.journalLinks) {
          if (link.type === 'PAYMENT') {
            const originalJournal = link.journalEntry;

            // Create reversal journal (opposite debits/credits)
            const reversalLines = originalJournal.lines.map((line: any) => ({
              accountId: line.accountId,
              debit: line.credit, // Swap
              credit: line.debit, // Swap
            }));

            const reversalJournal = await tx.journalEntry.create({
              data: {
                orgId: batch.orgId,
                branchId: batch.branchId,
                date: new Date(),
                memo: `VOID: ${originalJournal.memo}`,
                source: 'REMITTANCE_VOID',
                sourceId: batch.id,
                status: 'POSTED',
                postedById: userId,
                postedAt: new Date(),
                reversesEntryId: originalJournal.id,
                lines: { create: reversalLines },
              },
            });

            // Mark original as reversed
            await tx.journalEntry.update({
              where: { id: originalJournal.id },
              data: {
                reversedById: userId,
                reversedAt: new Date(),
              },
            });

            // Create reversal link
            await tx.remittanceJournalLink.create({
              data: {
                batchId: batch.id,
                journalEntryId: reversalJournal.id,
                type: 'REVERSAL',
              },
            });
          }
        }
      }

      // Update batch status
      const updated = await tx.remittanceBatch.update({
        where: { id: batch.id },
        data: {
          status: 'VOID',
          voidedById: userId,
          voidedAt: new Date(),
        },
        include: { lines: true, journalLinks: { include: { journalEntry: true } } },
      });

      return updated;
    });

    return result;
  }

  /**
   * Check if posting date falls within a locked fiscal period
   */
  private async checkPeriodLock(orgId: string, date: Date) {
    const period = await this.prisma.client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: date },
        endsAt: { gte: date },
        status: 'LOCKED',
      },
    });

    if (period) {
      throw new ForbiddenException({
        message: 'Cannot post to locked fiscal period',
        periodId: period.id,
        periodName: period.name,
      });
    }
  }

  /**
   * Get preview of journal entries before payment
   */
  async getPaymentPreview(orgId: string, batchId: string) {
    const batch = await this.getBatch(orgId, batchId);

    if (!['APPROVED', 'POSTED'].includes(batch.status)) {
      throw new BadRequestException('Can only preview APPROVED or POSTED batches');
    }

    const lines: { account: string; accountId: string; debit: string; credit: string }[] = [];
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of batch.lines) {
      // Debit liability
      lines.push({
        account: line.liabilityAccount.name,
        accountId: line.liabilityAccountId,
        debit: line.amount.toString(),
        credit: '0.00',
      });
      totalDebit = totalDebit.add(line.amount);

      // Credit counter
      lines.push({
        account: line.counterAccount.name,
        accountId: line.counterAccountId,
        debit: '0.00',
        credit: line.amount.toString(),
      });
      totalCredit = totalCredit.add(line.amount);
    }

    return {
      batchId: batch.id,
      type: batch.type,
      totalAmount: batch.totalAmount.toString(),
      lines,
      totals: {
        debit: totalDebit.toString(),
        credit: totalCredit.toString(),
        balanced: totalDebit.equals(totalCredit),
      },
    };
  }

  /**
   * Generate draft batch from payroll runs
   */
  async generateFromPayrollRuns(
    orgId: string,
    userId: string,
    options: {
      branchId?: string;
      payrollRunIds?: string[];
      idempotencyKey?: string;
    },
  ) {
    // Check idempotency
    if (options.idempotencyKey) {
      const existing = await this.prisma.client.remittanceBatch.findFirst({
        where: { orgId, idempotencyKey: options.idempotencyKey },
      });
      if (existing) {
        return { existingBatchId: existing.id, created: false };
      }
    }

    // Find payroll runs
    const where: Prisma.PayrollRunWhereInput = {
      orgId,
      status: { in: ['POSTED', 'PAID'] },
    };
    if (options.branchId) where.branchId = options.branchId;
    if (options.payrollRunIds) where.id = { in: options.payrollRunIds };

    const runs = await this.prisma.client.payrollRun.findMany({
      where,
      include: {
        journalLinks: {
          include: {
            journalEntry: {
              include: { lines: { include: { account: true } } },
            },
          },
        },
      },
    });

    if (runs.length === 0) {
      throw new BadRequestException('No matching payroll runs found');
    }

    // Aggregate liabilities from journal entries
    const liabilityTotals = new Map<string, { accountId: string; amount: Prisma.Decimal; name: string }>();

    for (const run of runs) {
      for (const link of run.journalLinks) {
        for (const line of link.journalEntry.lines) {
          // Credit lines on payroll posting are liabilities
          if (line.credit.gt(0) && line.account.type === 'LIABILITY') {
            const existing = liabilityTotals.get(line.accountId);
            if (existing) {
              existing.amount = existing.amount.add(line.credit);
            } else {
              liabilityTotals.set(line.accountId, {
                accountId: line.accountId,
                amount: line.credit,
                name: line.account.name,
              });
            }
          }
        }
      }
    }

    if (liabilityTotals.size === 0) {
      throw new BadRequestException('No liabilities found in payroll runs');
    }

    // Find default cash account
    const cashAccount = await this.prisma.client.account.findFirst({
      where: { orgId, code: '1000' },
    });
    if (!cashAccount) {
      throw new BadRequestException('Cash account (1000) not found');
    }

    // Create batch with lines
    const batch = await this.prisma.client.remittanceBatch.create({
      data: {
        orgId,
        branchId: options.branchId || null,
        type: 'MIXED',
        idempotencyKey: options.idempotencyKey || null,
        memo: `Generated from ${runs.length} payroll run(s)`,
        createdById: userId,
        lines: {
          create: Array.from(liabilityTotals.values()).map((l) => ({
            liabilityAccountId: l.accountId,
            counterAccountId: cashAccount.id,
            amount: l.amount,
            payeeName: l.name,
          })),
        },
      },
      include: { lines: true },
    });

    // Update total
    await this.recalculateBatchTotal(batch.id);

    return { batchId: batch.id, created: true, lineCount: liabilityTotals.size };
  }

  /**
   * Get KPIs for remittances
   */
  async getKpis(orgId: string, branchId?: string) {
    const where: Prisma.RemittanceBatchWhereInput = { orgId };
    if (branchId) where.branchId = branchId;

    const batches = await this.prisma.client.remittanceBatch.findMany({
      where,
      select: { status: true, type: true, totalAmount: true },
    });

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalPaid = new Prisma.Decimal(0);
    let totalPending = new Prisma.Decimal(0);

    for (const b of batches) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      byType[b.type] = (byType[b.type] || 0) + 1;

      if (b.status === 'PAID') {
        totalPaid = totalPaid.add(b.totalAmount);
      } else if (['DRAFT', 'APPROVED', 'POSTED'].includes(b.status)) {
        totalPending = totalPending.add(b.totalAmount);
      }
    }

    return {
      totalBatches: batches.length,
      byStatus,
      byType,
      totalPaid: totalPaid.toString(),
      totalPending: totalPending.toString(),
    };
  }

  /**
   * Export batches as CSV
   */
  async exportBatchesCsv(orgId: string, filters: BatchListFilters = {}) {
    const batches = await this.listBatches(orgId, filters);

    const headers = ['id', 'status', 'type', 'branchName', 'totalAmount', 'memo', 'createdAt', 'paidAt'];
    const rows = batches.map((b) => [
      b.id,
      b.status,
      b.type,
      b.branch?.name || '',
      b.totalAmount.toString(),
      b.memo || '',
      b.createdAt.toISOString(),
      b.paidAt?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Export lines as CSV
   */
  async exportLinesCsv(orgId: string, batchId?: string) {
    const where: Prisma.RemittanceLineWhereInput = {};
    if (batchId) {
      where.batchId = batchId;
    } else {
      where.batch = { orgId };
    }

    const lines = await this.prisma.client.remittanceLine.findMany({
      where,
      include: {
        batch: { select: { id: true, type: true } },
        liabilityAccount: { select: { code: true, name: true } },
        counterAccount: { select: { code: true, name: true } },
      },
    });

    const headers = ['lineId', 'batchId', 'batchType', 'liabilityAccount', 'counterAccount', 'amount', 'payeeName', 'referenceCode'];
    const rows = lines.map((l) => [
      l.id,
      l.batchId,
      l.batch.type,
      `${l.liabilityAccount.code} - ${l.liabilityAccount.name}`,
      `${l.counterAccount.code} - ${l.counterAccount.name}`,
      l.amount.toString(),
      l.payeeName || '',
      l.referenceCode || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  // ============== M10.10: Provider Directory ==============

  /**
   * Create a remittance provider
   */
  async createProvider(orgId: string, dto: CreateProviderDto): Promise<any> {
    return this.prisma.client.remittanceProvider.create({
      data: {
        orgId,
        branchId: dto.branchId || null,
        name: dto.name,
        type: dto.type,
        referenceFormatHint: dto.referenceFormatHint || null,
        defaultLiabilityAccountId: dto.defaultLiabilityAccountId || null,
        defaultCashAccountId: dto.defaultCashAccountId || null,
        enabled: dto.enabled ?? true,
      },
      include: {
        defaultLiabilityAccount: { select: { id: true, code: true, name: true } },
        defaultCashAccount: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * List providers
   */
  async listProviders(orgId: string, branchId?: string): Promise<any[]> {
    const where: Prisma.RemittanceProviderWhereInput = { orgId };
    if (branchId) {
      where.OR = [{ branchId }, { branchId: null }];
    }

    return this.prisma.client.remittanceProvider.findMany({
      where,
      include: {
        defaultLiabilityAccount: { select: { id: true, code: true, name: true } },
        defaultCashAccount: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { componentMappings: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get provider by ID
   */
  async getProvider(orgId: string, providerId: string): Promise<any> {
    const provider = await this.prisma.client.remittanceProvider.findFirst({
      where: { id: providerId, orgId },
      include: {
        defaultLiabilityAccount: { select: { id: true, code: true, name: true } },
        defaultCashAccount: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
        componentMappings: {
          include: {
            component: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException('Remittance provider not found');
    }
    return provider;
  }

  /**
   * Update provider
   */
  async updateProvider(orgId: string, providerId: string, dto: UpdateProviderDto): Promise<any> {
    await this.getProvider(orgId, providerId);
    return this.prisma.client.remittanceProvider.update({
      where: { id: providerId },
      data: {
        name: dto.name,
        type: dto.type,
        referenceFormatHint: dto.referenceFormatHint,
        defaultLiabilityAccountId: dto.defaultLiabilityAccountId,
        defaultCashAccountId: dto.defaultCashAccountId,
        enabled: dto.enabled,
      },
      include: {
        defaultLiabilityAccount: { select: { id: true, code: true, name: true } },
        defaultCashAccount: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Delete provider (fails if mappings exist)
   */
  async deleteProvider(orgId: string, providerId: string): Promise<{ deleted: boolean }> {
    const provider = await this.getProvider(orgId, providerId);
    if (provider.componentMappings.length > 0) {
      throw new BadRequestException('Cannot delete provider with existing mappings');
    }
    await this.prisma.client.remittanceProvider.delete({ where: { id: providerId } });
    return { deleted: true };
  }

  // ============== M10.10: Component → Provider Mappings ==============

  /**
   * Create or update a component → provider mapping
   */
  async upsertMapping(orgId: string, dto: CreateMappingDto): Promise<any> {
    // Verify component belongs to org
    const component = await this.prisma.client.compensationComponent.findFirst({
      where: { id: dto.componentId, orgId },
    });
    if (!component) {
      throw new NotFoundException('Compensation component not found');
    }

    // Verify provider belongs to org
    const provider = await this.prisma.client.remittanceProvider.findFirst({
      where: { id: dto.providerId, orgId },
    });
    if (!provider) {
      throw new NotFoundException('Remittance provider not found');
    }

    // Upsert mapping (unique on componentId)
    return this.prisma.client.compensationRemittanceMapping.upsert({
      where: { componentId: dto.componentId },
      create: {
        orgId,
        componentId: dto.componentId,
        providerId: dto.providerId,
        remittanceType: dto.remittanceType,
      },
      update: {
        providerId: dto.providerId,
        remittanceType: dto.remittanceType,
      },
      include: {
        component: { select: { id: true, code: true, name: true, type: true } },
        provider: { select: { id: true, name: true, type: true } },
      },
    });
  }

  /**
   * List all mappings
   */
  async listMappings(orgId: string, providerId?: string): Promise<any[]> {
    const where: Prisma.CompensationRemittanceMappingWhereInput = { orgId };
    if (providerId) where.providerId = providerId;

    return this.prisma.client.compensationRemittanceMapping.findMany({
      where,
      include: {
        component: { select: { id: true, code: true, name: true, type: true } },
        provider: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(orgId: string, mappingId: string): Promise<{ deleted: boolean }> {
    const mapping = await this.prisma.client.compensationRemittanceMapping.findFirst({
      where: { id: mappingId, orgId },
    });
    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }
    await this.prisma.client.compensationRemittanceMapping.delete({ where: { id: mappingId } });
    return { deleted: true };
  }

  // ============== M10.10: Idempotent Generation from Payroll Runs ==============

  /**
   * Generate remittance batch from payroll runs with idempotency
   * Uses deterministic key: hash(orgId, branchId, sorted payrollRunIds, type)
   */
  async generateFromPayrollRunsV2(
    orgId: string,
    userId: string,
    dto: GenerateFromPayrollDto,
  ): Promise<{ batchId: string; created: boolean; lineCount: number }> {
    if (!dto.payrollRunIds || dto.payrollRunIds.length === 0) {
      throw new BadRequestException('At least one payroll run ID is required');
    }

    // Sort run IDs for deterministic key
    const sortedRunIds = [...dto.payrollRunIds].sort();
    const idempotencyKey = this.computeIdempotencyKey(orgId, dto.branchId, sortedRunIds, 'MIXED');

    // Check for existing batch with same key
    const existing = await this.prisma.client.remittanceBatch.findFirst({
      where: { orgId, idempotencyKey },
    });
    if (existing) {
      return { batchId: existing.id, created: false, lineCount: 0 };
    }

    // Check if any payroll run already has a source link
    const existingLinks = await this.prisma.client.remittanceSourceLink.findMany({
      where: { payrollRunId: { in: sortedRunIds } },
    });
    if (existingLinks.length > 0) {
      throw new ConflictException({
        message: 'One or more payroll runs already linked to a remittance batch',
        linkedRunIds: existingLinks.map((l) => l.payrollRunId),
      });
    }

    // Fetch payroll runs
    const runs = await this.prisma.client.payrollRun.findMany({
      where: {
        id: { in: sortedRunIds },
        orgId,
        status: { in: ['POSTED', 'PAID'] },
      },
      include: {
        journalLinks: {
          include: {
            journalEntry: {
              include: { lines: { include: { account: true } } },
            },
          },
        },
      },
    });

    if (runs.length !== sortedRunIds.length) {
      throw new BadRequestException('Some payroll runs not found or not in valid status');
    }

    // Aggregate liabilities from journal entries
    const liabilityTotals = new Map<string, { accountId: string; amount: Prisma.Decimal; name: string }>();

    for (const run of runs) {
      for (const link of run.journalLinks) {
        for (const line of link.journalEntry.lines) {
          // Credit lines on payroll posting are liabilities
          if (line.credit.gt(0) && line.account.type === 'LIABILITY') {
            const existing = liabilityTotals.get(line.accountId);
            if (existing) {
              existing.amount = existing.amount.add(line.credit);
            } else {
              liabilityTotals.set(line.accountId, {
                accountId: line.accountId,
                amount: line.credit,
                name: line.account.name,
              });
            }
          }
        }
      }
    }

    if (liabilityTotals.size === 0) {
      throw new BadRequestException('No liabilities found in payroll runs');
    }

    // Find default cash account
    const cashAccount = await this.prisma.client.account.findFirst({
      where: { orgId, code: '1000' },
    });
    if (!cashAccount) {
      throw new BadRequestException('Cash account (1000) not found');
    }

    // Create batch with lines and source links in transaction
    const batch = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.remittanceBatch.create({
        data: {
          orgId,
          branchId: dto.branchId || null,
          type: 'MIXED',
          idempotencyKey,
          memo: `Generated from ${runs.length} payroll run(s)`,
          createdById: userId,
          lines: {
            create: Array.from(liabilityTotals.values()).map((l) => ({
              liabilityAccountId: l.accountId,
              counterAccountId: cashAccount.id,
              amount: l.amount,
              payeeName: l.name,
            })),
          },
          sourceLinks: {
            create: sortedRunIds.map((runId) => ({ payrollRunId: runId })),
          },
        },
        include: { lines: true, sourceLinks: true },
      });

      // Update total
      const total = created.lines.reduce((sum, l) => sum.add(l.amount), new Prisma.Decimal(0));
      await tx.remittanceBatch.update({
        where: { id: created.id },
        data: { totalAmount: total },
      });

      return created;
    });

    return { batchId: batch.id, created: true, lineCount: liabilityTotals.size };
  }

  /**
   * Compute deterministic idempotency key
   */
  private computeIdempotencyKey(
    orgId: string,
    branchId: string | undefined,
    sortedRunIds: string[],
    type: string,
  ): string {
    const payload = JSON.stringify({ orgId, branchId: branchId || null, runIds: sortedRunIds, type });
    return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
  }

  // ============== M10.10: Mark Settled (Reconciliation) ==============

  /**
   * Mark a PAID batch as settled with reconciliation metadata
   * L5 only operation
   */
  async markSettled(orgId: string, batchId: string, dto: MarkSettledDto): Promise<any> {
    const batch = await this.getBatch(orgId, batchId);

    if (batch.status !== 'PAID') {
      throw new BadRequestException('Can only mark PAID batches as settled');
    }

    if (batch.settledAt) {
      throw new BadRequestException('Batch is already marked as settled');
    }

    return this.prisma.client.remittanceBatch.update({
      where: { id: batchId },
      data: {
        externalReference: dto.externalReference || null,
        settlementMethod: dto.settlementMethod,
        settledAt: new Date(),
        receiptNote: dto.receiptNote || null,
      },
      include: { lines: true },
    });
  }

  // ============== M10.10: Bank Upload Export (Stub) ==============

  /**
   * Export batch as bank upload CSV (stub format)
   * Returns: payeeName, referenceCode, amount, currencyCode
   */
  async exportBankUploadCsv(orgId: string, batchId: string): Promise<string> {
    const batch = await this.getBatch(orgId, batchId);

    const headers = ['payeeName', 'referenceCode', 'amount', 'currencyCode'];
    const rows = batch.lines.map((l: any) => [
      l.payeeName || 'Unknown',
      l.referenceCode || '',
      l.amount.toString(),
      batch.currencyCode,
    ]);

    return [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
  }
}
