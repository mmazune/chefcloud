/**
 * M11.13 Inventory GL Posting Service
 * 
 * Creates journal entries for inventory movements:
 * - Goods Receipt: Dr Inventory Asset, Cr GRNI
 * - Depletion: Dr COGS, Cr Inventory Asset
 * - Waste: Dr Waste Expense, Cr Inventory Asset
 * - Stocktake: Dr/Cr Shrink/Gain, Cr/Dr Inventory Asset
 * 
 * Key features:
 * - Idempotent (source+sourceId unique check)
 * - Period lock enforcement
 * - Reversal support for voids
 * - Audit logging
 */
import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryPostingMappingService, ResolvedPostingMapping } from './inventory-posting-mapping.service';
import { Prisma, GlPostingStatus, JournalEntryStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type DecimalType = Prisma.Decimal;

// Journal source constants for inventory GL entries
export const GL_SOURCE = {
  GOODS_RECEIPT: 'INV_GOODS_RECEIPT',
  GOODS_RECEIPT_VOID: 'INV_GOODS_RECEIPT_VOID',
  DEPLETION: 'INV_DEPLETION',
  WASTE: 'INV_WASTE',
  WASTE_VOID: 'INV_WASTE_VOID',
  STOCKTAKE: 'INV_STOCKTAKE',
  STOCKTAKE_VOID: 'INV_STOCKTAKE_VOID',
} as const;

export interface GlPostingResult {
  journalEntryId: string | null;
  status: GlPostingStatus;
  error: string | null;
  isIdempotent: boolean;
}

@Injectable()
export class InventoryGlPostingService {
  private readonly logger = new Logger(InventoryGlPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mappingService: InventoryPostingMappingService,
  ) {}

  // ================================================================
  // Goods Receipt GL Posting
  // ================================================================

  /**
   * Post GL entry for goods receipt
   * Dr Inventory Asset, Cr GRNI
   */
  async postGoodsReceipt(
    orgId: string,
    branchId: string,
    receiptId: string,
    totalValue: DecimalType | number,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    const client = tx ?? this.prisma.client;
    const source = GL_SOURCE.GOODS_RECEIPT;

    this.logger.log(`Posting GL for goods receipt ${receiptId}, value=${totalValue}`);

    // Check idempotency
    const existing = await client.journalEntry.findFirst({
      where: { orgId, source, sourceId: receiptId },
    });

    if (existing) {
      this.logger.log(`GL already posted for receipt ${receiptId} (idempotent)`);
      return {
        journalEntryId: existing.id,
        status: 'POSTED',
        error: null,
        isIdempotent: true,
      };
    }

    // Skip if zero amount
    const amount = new Decimal(totalValue);
    if (amount.isZero() || amount.isNeg()) {
      this.logger.log(`Skipping GL posting for receipt ${receiptId}: zero or negative amount`);
      return {
        journalEntryId: null,
        status: 'SKIPPED',
        error: 'Zero or negative receipt value',
        isIdempotent: false,
      };
    }

    // Check period lock
    await this.checkPeriodLock(orgId, new Date(), client);

    // Resolve mapping
    let mapping: ResolvedPostingMapping;
    try {
      mapping = await this.mappingService.resolveMapping(orgId, branchId);
    } catch {
      return {
        journalEntryId: null,
        status: 'FAILED',
        error: 'GL integration not configured',
        isIdempotent: false,
      };
    }

    // Create journal entry
    const journal = await client.journalEntry.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        memo: `Goods Receipt: ${receiptId}`,
        source,
        sourceId: receiptId,
        status: JournalEntryStatus.POSTED,
        postedById: userId,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: mapping.inventoryAssetAccountId,
              debit: amount,
              credit: new Decimal(0),
              meta: { type: 'INVENTORY_ASSET_INCREASE' },
            },
            {
              accountId: mapping.grniAccountId,
              debit: new Decimal(0),
              credit: amount,
              meta: { type: 'GRNI_LIABILITY_INCREASE' },
            },
          ],
        },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'gl.posting.created',
      resourceType: 'JournalEntry',
      resourceId: journal.id,
      metadata: { documentType: 'GOODS_RECEIPT', documentId: receiptId, amount: amount.toString() },
    });

    this.logger.log(`Created GL journal ${journal.id} for receipt ${receiptId}`);
    return {
      journalEntryId: journal.id,
      status: 'POSTED',
      error: null,
      isIdempotent: false,
    };
  }

  /**
   * Create reversal GL entry for voided goods receipt
   */
  async voidGoodsReceiptGl(
    orgId: string,
    branchId: string,
    receiptId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    return this.createReversalEntry(
      orgId,
      branchId,
      GL_SOURCE.GOODS_RECEIPT,
      GL_SOURCE.GOODS_RECEIPT_VOID,
      receiptId,
      userId,
      'Void Goods Receipt',
      tx,
    );
  }

  // ================================================================
  // Depletion (COGS) GL Posting
  // ================================================================

  /**
   * Post GL entry for order depletion (COGS)
   * Dr COGS, Cr Inventory Asset
   */
  async postDepletion(
    orgId: string,
    branchId: string,
    depletionId: string,
    cogsAmount: DecimalType | number,
    userId: string | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    const client = tx ?? this.prisma.client;
    const source = GL_SOURCE.DEPLETION;

    this.logger.log(`Posting GL for depletion ${depletionId}, COGS=${cogsAmount}`);

    // Check idempotency
    const existing = await client.journalEntry.findFirst({
      where: { orgId, source, sourceId: depletionId },
    });

    if (existing) {
      this.logger.log(`GL already posted for depletion ${depletionId} (idempotent)`);
      return {
        journalEntryId: existing.id,
        status: 'POSTED',
        error: null,
        isIdempotent: true,
      };
    }

    // Skip if zero COGS
    const amount = new Decimal(cogsAmount);
    if (amount.isZero()) {
      this.logger.log(`Skipping GL posting for depletion ${depletionId}: zero COGS`);
      return {
        journalEntryId: null,
        status: 'SKIPPED',
        error: 'Zero COGS amount',
        isIdempotent: false,
      };
    }

    // Check period lock
    await this.checkPeriodLock(orgId, new Date(), client);

    // Resolve mapping
    let mapping: ResolvedPostingMapping;
    try {
      mapping = await this.mappingService.resolveMapping(orgId, branchId);
    } catch {
      return {
        journalEntryId: null,
        status: 'FAILED',
        error: 'GL integration not configured',
        isIdempotent: false,
      };
    }

    // COGS is always positive expense
    const absAmount = amount.abs();

    // Create journal entry
    const journal = await client.journalEntry.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        memo: `Order Depletion COGS: ${depletionId}`,
        source,
        sourceId: depletionId,
        status: JournalEntryStatus.POSTED,
        postedById: userId ?? null,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: mapping.cogsAccountId,
              debit: absAmount,
              credit: new Decimal(0),
              meta: { type: 'COGS_EXPENSE' },
            },
            {
              accountId: mapping.inventoryAssetAccountId,
              debit: new Decimal(0),
              credit: absAmount,
              meta: { type: 'INVENTORY_ASSET_DECREASE' },
            },
          ],
        },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'gl.posting.created',
      resourceType: 'JournalEntry',
      resourceId: journal.id,
      metadata: { documentType: 'DEPLETION', documentId: depletionId, cogs: absAmount.toString() },
    });

    this.logger.log(`Created GL journal ${journal.id} for depletion ${depletionId}`);
    return {
      journalEntryId: journal.id,
      status: 'POSTED',
      error: null,
      isIdempotent: false,
    };
  }

  // ================================================================
  // Waste GL Posting
  // ================================================================

  /**
   * Post GL entry for waste document
   * Dr Waste Expense, Cr Inventory Asset
   */
  async postWaste(
    orgId: string,
    branchId: string,
    wasteId: string,
    totalValue: DecimalType | number,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    const client = tx ?? this.prisma.client;
    const source = GL_SOURCE.WASTE;

    this.logger.log(`Posting GL for waste ${wasteId}, value=${totalValue}`);

    // Check idempotency
    const existing = await client.journalEntry.findFirst({
      where: { orgId, source, sourceId: wasteId },
    });

    if (existing) {
      this.logger.log(`GL already posted for waste ${wasteId} (idempotent)`);
      return {
        journalEntryId: existing.id,
        status: 'POSTED',
        error: null,
        isIdempotent: true,
      };
    }

    // Skip if zero amount
    const amount = new Decimal(totalValue);
    if (amount.isZero()) {
      this.logger.log(`Skipping GL posting for waste ${wasteId}: zero value`);
      return {
        journalEntryId: null,
        status: 'SKIPPED',
        error: 'Zero waste value',
        isIdempotent: false,
      };
    }

    // Check period lock
    await this.checkPeriodLock(orgId, new Date(), client);

    // Resolve mapping
    let mapping: ResolvedPostingMapping;
    try {
      mapping = await this.mappingService.resolveMapping(orgId, branchId);
    } catch {
      return {
        journalEntryId: null,
        status: 'FAILED',
        error: 'GL integration not configured',
        isIdempotent: false,
      };
    }

    const absAmount = amount.abs();

    // Create journal entry
    const journal = await client.journalEntry.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        memo: `Inventory Waste: ${wasteId}`,
        source,
        sourceId: wasteId,
        status: JournalEntryStatus.POSTED,
        postedById: userId,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: mapping.wasteExpenseAccountId,
              debit: absAmount,
              credit: new Decimal(0),
              meta: { type: 'WASTE_EXPENSE' },
            },
            {
              accountId: mapping.inventoryAssetAccountId,
              debit: new Decimal(0),
              credit: absAmount,
              meta: { type: 'INVENTORY_ASSET_DECREASE' },
            },
          ],
        },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'gl.posting.created',
      resourceType: 'JournalEntry',
      resourceId: journal.id,
      metadata: { documentType: 'WASTE', documentId: wasteId, amount: absAmount.toString() },
    });

    this.logger.log(`Created GL journal ${journal.id} for waste ${wasteId}`);
    return {
      journalEntryId: journal.id,
      status: 'POSTED',
      error: null,
      isIdempotent: false,
    };
  }

  /**
   * Create reversal GL entry for voided waste
   */
  async voidWasteGl(
    orgId: string,
    branchId: string,
    wasteId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    return this.createReversalEntry(
      orgId,
      branchId,
      GL_SOURCE.WASTE,
      GL_SOURCE.WASTE_VOID,
      wasteId,
      userId,
      'Void Waste Document',
      tx,
    );
  }

  // ================================================================
  // Stocktake GL Posting
  // ================================================================

  /**
   * Post GL entries for stocktake variances
   * Negative variance (shrinkage): Dr Shrink Expense, Cr Inventory Asset
   * Positive variance (gain): Dr Inventory Asset, Cr Inventory Gain
   */
  async postStocktake(
    orgId: string,
    branchId: string,
    sessionId: string,
    totalVarianceValue: DecimalType | number, // Positive = gain, Negative = shrinkage
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    const client = tx ?? this.prisma.client;
    const source = GL_SOURCE.STOCKTAKE;

    this.logger.log(`Posting GL for stocktake ${sessionId}, variance=${totalVarianceValue}`);

    // Check idempotency
    const existing = await client.journalEntry.findFirst({
      where: { orgId, source, sourceId: sessionId },
    });

    if (existing) {
      this.logger.log(`GL already posted for stocktake ${sessionId} (idempotent)`);
      return {
        journalEntryId: existing.id,
        status: 'POSTED',
        error: null,
        isIdempotent: true,
      };
    }

    const variance = new Decimal(totalVarianceValue);
    
    // Skip if zero variance
    if (variance.isZero()) {
      this.logger.log(`Skipping GL posting for stocktake ${sessionId}: zero variance`);
      return {
        journalEntryId: null,
        status: 'SKIPPED',
        error: 'Zero variance value',
        isIdempotent: false,
      };
    }

    // Check period lock
    await this.checkPeriodLock(orgId, new Date(), client);

    // Resolve mapping
    let mapping: ResolvedPostingMapping;
    try {
      mapping = await this.mappingService.resolveMapping(orgId, branchId);
    } catch {
      return {
        journalEntryId: null,
        status: 'FAILED',
        error: 'GL integration not configured',
        isIdempotent: false,
      };
    }

    const absVariance = variance.abs();
    const isGain = variance.isPos();

    // Build journal lines based on variance direction
    const lines: Array<{ accountId: string; debit: DecimalType; credit: DecimalType; meta?: Prisma.InputJsonValue }> = [];

    if (isGain) {
      // Positive variance = inventory gain
      // Dr Inventory Asset, Cr Inventory Gain (or Shrink if no gain account)
      lines.push({
        accountId: mapping.inventoryAssetAccountId,
        debit: absVariance,
        credit: new Decimal(0),
        meta: { type: 'INVENTORY_ASSET_INCREASE', reason: 'STOCKTAKE_GAIN' },
      });
      lines.push({
        accountId: mapping.inventoryGainAccountId ?? mapping.shrinkExpenseAccountId,
        debit: new Decimal(0),
        credit: absVariance,
        meta: { type: 'INVENTORY_GAIN', reason: 'STOCKTAKE_GAIN' },
      });
    } else {
      // Negative variance = shrinkage
      // Dr Shrink Expense, Cr Inventory Asset
      lines.push({
        accountId: mapping.shrinkExpenseAccountId,
        debit: absVariance,
        credit: new Decimal(0),
        meta: { type: 'SHRINK_EXPENSE', reason: 'STOCKTAKE_SHRINK' },
      });
      lines.push({
        accountId: mapping.inventoryAssetAccountId,
        debit: new Decimal(0),
        credit: absVariance,
        meta: { type: 'INVENTORY_ASSET_DECREASE', reason: 'STOCKTAKE_SHRINK' },
      });
    }

    // Create journal entry
    const journal = await client.journalEntry.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        memo: `Stocktake Variance: ${sessionId} (${isGain ? 'Gain' : 'Shrinkage'})`,
        source,
        sourceId: sessionId,
        status: JournalEntryStatus.POSTED,
        postedById: userId,
        postedAt: new Date(),
        lines: {
          create: lines,
        },
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'gl.posting.created',
      resourceType: 'JournalEntry',
      resourceId: journal.id,
      metadata: {
        documentType: 'STOCKTAKE',
        documentId: sessionId,
        variance: variance.toString(),
        varianceType: isGain ? 'GAIN' : 'SHRINKAGE',
      },
    });

    this.logger.log(`Created GL journal ${journal.id} for stocktake ${sessionId}`);
    return {
      journalEntryId: journal.id,
      status: 'POSTED',
      error: null,
      isIdempotent: false,
    };
  }

  /**
   * Create reversal GL entry for voided stocktake
   */
  async voidStocktakeGl(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    return this.createReversalEntry(
      orgId,
      branchId,
      GL_SOURCE.STOCKTAKE,
      GL_SOURCE.STOCKTAKE_VOID,
      sessionId,
      userId,
      'Void Stocktake',
      tx,
    );
  }

  // ================================================================
  // Helper Methods
  // ================================================================

  /**
   * Check if posting date falls within a locked fiscal period
   */
  private async checkPeriodLock(
    orgId: string,
    date: Date,
    client: Prisma.TransactionClient | typeof this.prisma.client,
  ): Promise<void> {
    const period = await client.fiscalPeriod.findFirst({
      where: {
        orgId,
        startsAt: { lte: date },
        endsAt: { gte: date },
      },
    });

    if (period?.status === 'LOCKED') {
      throw new ForbiddenException(
        `Cannot post in locked fiscal period: ${period.name}`
      );
    }
  }

  /**
   * Create a reversal entry for an existing journal
   */
  private async createReversalEntry(
    orgId: string,
    branchId: string,
    originalSource: string,
    reversalSource: string,
    sourceId: string,
    userId: string,
    memoPrefix: string,
    tx?: Prisma.TransactionClient,
  ): Promise<GlPostingResult> {
    const client = tx ?? this.prisma.client;

    // Find original journal entry
    const original = await client.journalEntry.findFirst({
      where: { orgId, source: originalSource, sourceId },
      include: { lines: true },
    });

    if (!original) {
      this.logger.log(`No GL journal found for ${originalSource}:${sourceId} to reverse`);
      return {
        journalEntryId: null,
        status: 'SKIPPED',
        error: 'No original journal to reverse',
        isIdempotent: false,
      };
    }

    // Check if already reversed
    const existingReversal = await client.journalEntry.findFirst({
      where: { orgId, source: reversalSource, sourceId },
    });

    if (existingReversal) {
      this.logger.log(`Reversal already exists for ${sourceId} (idempotent)`);
      return {
        journalEntryId: existingReversal.id,
        status: 'POSTED',
        error: null,
        isIdempotent: true,
      };
    }

    // Check period lock
    await this.checkPeriodLock(orgId, new Date(), client);

    // Create reversal entry with swapped debits/credits
    const reversal = await client.journalEntry.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        memo: `${memoPrefix}: ${sourceId}`,
        source: reversalSource,
        sourceId,
        status: JournalEntryStatus.POSTED,
        postedById: userId,
        postedAt: new Date(),
        reversesEntryId: original.id,
        lines: {
          create: original.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.credit, // Swap
            credit: line.debit, // Swap
            meta: { type: 'REVERSAL', originalLineId: line.id },
          })),
        },
      },
    });

    // Mark original as reversed
    await client.journalEntry.update({
      where: { id: original.id },
      data: {
        status: JournalEntryStatus.REVERSED,
        reversedById: userId,
        reversedAt: new Date(),
      },
    });

    await this.auditLog.log({
      orgId,
      branchId,
      userId,
      action: 'gl.posting.reversed',
      resourceType: 'JournalEntry',
      resourceId: reversal.id,
      metadata: { originalJournalId: original.id, documentId: sourceId },
    });

    this.logger.log(`Created reversal journal ${reversal.id} for ${original.id}`);
    return {
      journalEntryId: reversal.id,
      status: 'POSTED',
      error: null,
      isIdempotent: false,
    };
  }

  /**
   * Get GL posting preview for a document
   */
  async previewPosting(
    orgId: string,
    branchId: string,
    documentType: 'GOODS_RECEIPT' | 'DEPLETION' | 'WASTE' | 'STOCKTAKE',
    amount: number,
  ) {
    const mapping = await this.mappingService.resolveMapping(orgId, branchId);
    const absAmount = Math.abs(amount);

    const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];

    switch (documentType) {
      case 'GOODS_RECEIPT': {
        const invAsset = await this.prisma.client.account.findUnique({
          where: { id: mapping.inventoryAssetAccountId },
        });
        const grni = await this.prisma.client.account.findUnique({
          where: { id: mapping.grniAccountId },
        });
        lines.push(
          { accountCode: invAsset?.code ?? '', accountName: invAsset?.name ?? '', debit: absAmount, credit: 0 },
          { accountCode: grni?.code ?? '', accountName: grni?.name ?? '', debit: 0, credit: absAmount },
        );
        break;
      }
      case 'DEPLETION': {
        const cogs = await this.prisma.client.account.findUnique({
          where: { id: mapping.cogsAccountId },
        });
        const invAsset = await this.prisma.client.account.findUnique({
          where: { id: mapping.inventoryAssetAccountId },
        });
        lines.push(
          { accountCode: cogs?.code ?? '', accountName: cogs?.name ?? '', debit: absAmount, credit: 0 },
          { accountCode: invAsset?.code ?? '', accountName: invAsset?.name ?? '', debit: 0, credit: absAmount },
        );
        break;
      }
      case 'WASTE': {
        const waste = await this.prisma.client.account.findUnique({
          where: { id: mapping.wasteExpenseAccountId },
        });
        const invAsset = await this.prisma.client.account.findUnique({
          where: { id: mapping.inventoryAssetAccountId },
        });
        lines.push(
          { accountCode: waste?.code ?? '', accountName: waste?.name ?? '', debit: absAmount, credit: 0 },
          { accountCode: invAsset?.code ?? '', accountName: invAsset?.name ?? '', debit: 0, credit: absAmount },
        );
        break;
      }
      case 'STOCKTAKE': {
        const isGain = amount > 0;
        const invAsset = await this.prisma.client.account.findUnique({
          where: { id: mapping.inventoryAssetAccountId },
        });
        const shrink = await this.prisma.client.account.findUnique({
          where: { id: mapping.shrinkExpenseAccountId },
        });
        const gain = mapping.inventoryGainAccountId
          ? await this.prisma.client.account.findUnique({ where: { id: mapping.inventoryGainAccountId } })
          : null;

        if (isGain) {
          lines.push(
            { accountCode: invAsset?.code ?? '', accountName: invAsset?.name ?? '', debit: absAmount, credit: 0 },
            { accountCode: gain?.code ?? shrink?.code ?? '', accountName: gain?.name ?? shrink?.name ?? '', debit: 0, credit: absAmount },
          );
        } else {
          lines.push(
            { accountCode: shrink?.code ?? '', accountName: shrink?.name ?? '', debit: absAmount, credit: 0 },
            { accountCode: invAsset?.code ?? '', accountName: invAsset?.name ?? '', debit: 0, credit: absAmount },
          );
        }
        break;
      }
    }

    return {
      documentType,
      amount: absAmount,
      lines,
      totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
      totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
      balanced: true,
    };
  }
}
