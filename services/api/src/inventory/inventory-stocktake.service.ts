import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, StocktakeStatus } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type DecimalType = Prisma.Decimal;

import {
  InventoryLedgerService,
  LedgerEntryReason,
  LedgerSourceType,
} from './inventory-ledger.service';
import { InventoryLocationsService } from './inventory-locations.service';
import { InventoryGlPostingService } from './inventory-gl-posting.service';

// ============================================
// DTOs
// ============================================

export interface CreateStocktakeDto {
  name?: string;
  description?: string;
  locationId?: string; // Optional: scope to specific location (null = all)
  blindCount?: boolean; // Default true
  varianceThresholdPct?: number; // e.g., 5.00 = 5%
  varianceThresholdAbs?: number; // Absolute qty threshold
  metadata?: Record<string, unknown>;
}

export interface StocktakeCountLineDto {
  itemId: string;
  locationId: string;
  countedQty: number | string;
  notes?: string;
}

export interface StocktakeListFilters {
  status?: StocktakeStatus | StocktakeStatus[];
  locationId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Service
// ============================================

@Injectable()
export class InventoryStocktakeService {
  private readonly logger = new Logger(InventoryStocktakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly locationsService: InventoryLocationsService,
    private readonly glPostingService: InventoryGlPostingService,
  ) {}

  // ============================================
  // Session Number Generation
  // ============================================

  private async generateSessionNumber(
    orgId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma.client;
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Find count of sessions created today for this org
    const prefix = `ST-${dateStr}-`;
    const existing = await client.stocktakeSession.count({
      where: {
        orgId,
        sessionNumber: { startsWith: prefix },
      },
    });

    const seq = String(existing + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  }

  // ============================================
  // Create Session (DRAFT state)
  // ============================================

  async createSession(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateStocktakeDto,
  ) {
    this.logger.log(`Creating stocktake session for branch ${branchId}`);

    // Validate location if provided
    if (dto.locationId) {
      const location = await this.locationsService.getLocation(orgId, dto.locationId);
      if (location.branchId !== branchId) {
        throw new BadRequestException(
          `Location ${dto.locationId} does not belong to branch ${branchId}`,
        );
      }
    }

    const sessionNumber = await this.generateSessionNumber(orgId);

    const session = await this.prisma.client.stocktakeSession.create({
      data: {
        orgId,
        branchId,
        sessionNumber,
        name: dto.name,
        description: dto.description,
        locationId: dto.locationId,
        status: StocktakeStatus.DRAFT,
        blindCount: dto.blindCount ?? true,
        varianceThresholdPct: dto.varianceThresholdPct
          ? new Decimal(dto.varianceThresholdPct)
          : null,
        varianceThresholdAbs: dto.varianceThresholdAbs
          ? new Decimal(dto.varianceThresholdAbs)
          : null,
        createdById: userId,
        metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
      include: this.getSessionInclude(),
    });

    this.logger.log(`Created stocktake session ${session.sessionNumber}`);
    return session;
  }

  // ============================================
  // Start Session (DRAFT → IN_PROGRESS)
  // Freezes snapshot of current on-hand quantities
  // ============================================

  async startSession(orgId: string, branchId: string, sessionId: string, userId: string) {
    this.logger.log(`Starting stocktake session ${sessionId}`);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
        include: { location: true },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      if (session.status !== StocktakeStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot start session with status ${session.status}. Must be DRAFT.`,
        );
      }

      // Get all inventory items (scoped to location if set)
      const items = await tx.inventoryItem.findMany({
        where: { orgId, isActive: true },
        select: { id: true },
      });

      // Get locations to count
      let locations: { id: string }[];
      if (session.locationId) {
        locations = [{ id: session.locationId }];
      } else {
        locations = await tx.inventoryLocation.findMany({
          where: { branchId, isActive: true },
          select: { id: true },
        });
      }

      // Create lines with frozen snapshot quantities
      const linesToCreate: Prisma.StocktakeLineCreateManyInput[] = [];

      for (const item of items) {
        for (const location of locations) {
          const onHand = await this.ledgerService.getOnHand(
            item.id,
            location.id,
            branchId,
            { tx },
          );

          // Only create lines for items with non-zero on-hand or that exist in this location
          if (!onHand.equals(0)) {
            linesToCreate.push({
              sessionId,
              itemId: item.id,
              locationId: location.id,
              snapshotQty: onHand,
            });
          }
        }
      }

      // Batch create lines
      if (linesToCreate.length > 0) {
        await tx.stocktakeLine.createMany({
          data: linesToCreate,
        });
      }

      // Update session status
      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.IN_PROGRESS,
          startedById: userId,
          startedAt: new Date(),
          totalLines: linesToCreate.length,
        },
        include: this.getSessionInclude(),
      });

      this.logger.log(
        `Started stocktake session ${session.sessionNumber}: ${linesToCreate.length} lines created`,
      );

      return updated;
    });
  }

  // ============================================
  // Record Count (update line with counted qty)
  // ============================================

  async recordCount(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    dto: StocktakeCountLineDto,
  ) {
    const countedQty = new Decimal(dto.countedQty);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      if (session.status !== StocktakeStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Cannot record counts for session with status ${session.status}. Must be IN_PROGRESS.`,
        );
      }

      // Verify location belongs to branch
      const location = await this.locationsService.getLocation(orgId, dto.locationId);
      if (location.branchId !== branchId) {
        throw new ForbiddenException(
          `Location ${dto.locationId} does not belong to branch ${branchId}`,
        );
      }

      // Check if location matches session scope
      if (session.locationId && session.locationId !== dto.locationId) {
        throw new BadRequestException(
          `Location ${dto.locationId} is outside session scope (${session.locationId})`,
        );
      }

      // Find existing line
      const existingLine = await tx.stocktakeLine.findUnique({
        where: {
          sessionId_itemId_locationId: {
            sessionId,
            itemId: dto.itemId,
            locationId: dto.locationId,
          },
        },
      });

      if (!existingLine) {
        // Item might not have existed during snapshot - create new line with 0 snapshot
        const line = await tx.stocktakeLine.create({
          data: {
            sessionId,
            itemId: dto.itemId,
            locationId: dto.locationId,
            snapshotQty: new Decimal(0),
            countedQty,
            variance: countedQty,
            countedById: userId,
            countedAt: new Date(),
            notes: dto.notes,
          },
          include: this.getLineInclude(session.blindCount),
        });

        // Update total lines
        await tx.stocktakeSession.update({
          where: { id: sessionId },
          data: { totalLines: { increment: 1 } },
        });

        return line;
      }

      // Update existing line
      const variance = countedQty.minus(existingLine.snapshotQty);
      const line = await tx.stocktakeLine.update({
        where: { id: existingLine.id },
        data: {
          countedQty,
          variance,
          countedById: userId,
          countedAt: new Date(),
          notes: dto.notes,
        },
        include: this.getLineInclude(session.blindCount),
      });

      this.logger.debug(
        `Recorded count: session=${sessionId}, item=${dto.itemId}, counted=${countedQty}, variance=${variance}`,
      );

      return line;
    });
  }

  // ============================================
  // Submit Session (IN_PROGRESS → SUBMITTED)
  // ============================================

  async submitSession(orgId: string, branchId: string, sessionId: string, userId: string) {
    this.logger.log(`Submitting stocktake session ${sessionId}`);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
        include: { lines: true },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      if (session.status !== StocktakeStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Cannot submit session with status ${session.status}. Must be IN_PROGRESS.`,
        );
      }

      // Verify all lines have been counted
      const uncountedLines = session.lines.filter((l) => l.countedQty === null);
      if (uncountedLines.length > 0) {
        throw new BadRequestException(
          `Cannot submit: ${uncountedLines.length} lines have not been counted`,
        );
      }

      // Calculate stats
      const linesWithVariance = session.lines.filter(
        (l) => l.variance && !l.variance.equals(0),
      ).length;

      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.SUBMITTED,
          submittedById: userId,
          submittedAt: new Date(),
          linesWithVariance,
        },
        include: this.getSessionInclude(),
      });

      this.logger.log(
        `Submitted stocktake session ${session.sessionNumber}: ${linesWithVariance} lines with variance`,
      );

      return updated;
    });
  }

  // ============================================
  // Approve Session (SUBMITTED → APPROVED)
  // ============================================

  async approveSession(orgId: string, branchId: string, sessionId: string, userId: string) {
    this.logger.log(`Approving stocktake session ${sessionId}`);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      if (session.status !== StocktakeStatus.SUBMITTED) {
        throw new BadRequestException(
          `Cannot approve session with status ${session.status}. Must be SUBMITTED.`,
        );
      }

      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
        },
        include: this.getSessionInclude(),
      });

      this.logger.log(`Approved stocktake session ${session.sessionNumber}`);
      return updated;
    });
  }

  // ============================================
  // Post Session (APPROVED → POSTED) - IDEMPOTENT
  // Creates ledger entries for all variances
  // ============================================

  async postSession(orgId: string, branchId: string, sessionId: string, userId: string) {
    this.logger.log(`Posting stocktake session ${sessionId}`);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
        include: {
          lines: {
            include: {
              item: { select: { id: true, name: true, sku: true } },
              location: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      // IDEMPOTENT: If already posted, return success
      if (session.status === StocktakeStatus.POSTED) {
        this.logger.log(`Stocktake session ${sessionId} already posted (idempotent return)`);
        return { ...session, alreadyPosted: true };
      }

      if (session.status !== StocktakeStatus.APPROVED) {
        throw new BadRequestException(
          `Cannot post session with status ${session.status}. Must be APPROVED.`,
        );
      }

      // Create ledger entries for each line with variance
      const ledgerEntries: { lineId: string; entryId: string; variance: DecimalType }[] = [];

      for (const line of session.lines) {
        if (line.variance && !line.variance.equals(0)) {
          const entry = await this.ledgerService.recordEntry(
            orgId,
            branchId,
            {
              itemId: line.itemId,
              locationId: line.locationId,
              qty: line.variance,
              reason: LedgerEntryReason.COUNT_VARIANCE,
              sourceType: LedgerSourceType.STOCKTAKE,
              sourceId: sessionId,
              notes: `Stocktake ${session.sessionNumber}: snapshot=${line.snapshotQty}, counted=${line.countedQty}`,
              createdById: userId,
            },
            { allowNegative: true, tx },
          );

          // Link ledger entry to line
          await tx.stocktakeLine.update({
            where: { id: line.id },
            data: { ledgerEntryId: entry.id },
          });

          ledgerEntries.push({
            lineId: line.id,
            entryId: entry.id,
            variance: line.variance,
          });
        }
      }

      // Update session status
      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.POSTED,
          postedById: userId,
          postedAt: new Date(),
        },
        include: this.getSessionInclude(),
      });

      // M11.13: Create GL journal entry for variance (Dr/Cr Shrink/Gain, Cr/Dr Inventory)
      // This is done outside the transaction to avoid blocking inventory updates on GL issues
      let glJournalEntryId: string | null = null;
      let glPostingStatus: 'PENDING' | 'POSTED' | 'FAILED' | 'SKIPPED' = 'PENDING';
      let glPostingError: string | null = null;

      // Calculate total variance value
      const totalVarianceValue = ledgerEntries.reduce((sum, le) => {
        const line = session.lines.find((l) => l.id === le.lineId);
        if (line && line.varianceValue) {
          return sum.plus(line.varianceValue);
        }
        return sum;
      }, new Decimal(0));

      if (!totalVarianceValue.equals(0)) {
        try {
          const glResult = await this.glPostingService.postStocktake(
            orgId,
            branchId,
            sessionId,
            totalVarianceValue,
            userId,
          );

          if (glResult.status === 'POSTED' && glResult.journalEntryId) {
            glJournalEntryId = glResult.journalEntryId;
            glPostingStatus = 'POSTED';
            this.logger.log(`GL entry ${glJournalEntryId} created for stocktake ${sessionId}`);
          } else if (glResult.status === 'SKIPPED') {
            glPostingStatus = 'SKIPPED';
            glPostingError = glResult.error || 'No GL mapping configured';
          } else {
            glPostingStatus = glResult.status;
            glPostingError = glResult.error || 'Unknown GL posting error';
          }
        } catch (glError: any) {
          glPostingStatus = 'FAILED';
          glPostingError = glError.message;
          this.logger.warn(`GL posting failed for stocktake ${sessionId}: ${glError.message}`);
        }

        // Update session with GL posting status (outside transaction)
        await this.prisma.client.stocktakeSession.update({
          where: { id: sessionId },
          data: {
            glJournalEntryId,
            glPostingStatus,
            glPostingError,
          },
        });
      } else {
        glPostingStatus = 'SKIPPED';
        glPostingError = 'No variance value to post';
        await this.prisma.client.stocktakeSession.update({
          where: { id: sessionId },
          data: { glPostingStatus, glPostingError },
        });
      }

      this.logger.log(
        `Posted stocktake session ${session.sessionNumber}: ${ledgerEntries.length} ledger entries created, GL status: ${glPostingStatus}`,
      );

      return {
        ...updated,
        ledgerEntriesCreated: ledgerEntries.length,
        ledgerEntries,
        glJournalEntryId,
        glPostingStatus,
      };
    });
  }

  // ============================================
  // Void Session (POSTED → VOID)
  // Creates reversal ledger entries
  // ============================================

  async voidSession(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    reason: string,
  ) {
    this.logger.log(`Voiding stocktake session ${sessionId}`);

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Void reason is required');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
        include: {
          lines: {
            where: { ledgerEntryId: { not: null } },
            include: {
              item: { select: { id: true, name: true, sku: true } },
              location: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      // IDEMPOTENT: If already voided, return success
      if (session.status === StocktakeStatus.VOID) {
        this.logger.log(`Stocktake session ${sessionId} already voided (idempotent return)`);
        return { ...session, alreadyVoided: true };
      }

      if (session.status !== StocktakeStatus.POSTED) {
        throw new BadRequestException(
          `Cannot void session with status ${session.status}. Must be POSTED.`,
        );
      }

      // Create reversal ledger entries
      const reversalEntries: { lineId: string; entryId: string; reversedVariance: DecimalType }[] =
        [];

      for (const line of session.lines) {
        if (line.variance && !line.variance.equals(0)) {
          // Reverse the variance (negate it)
          const reversedQty = line.variance.negated();

          const entry = await this.ledgerService.recordEntry(
            orgId,
            branchId,
            {
              itemId: line.itemId,
              locationId: line.locationId,
              qty: reversedQty,
              reason: LedgerEntryReason.COUNT_VARIANCE_REVERSAL,
              sourceType: LedgerSourceType.STOCKTAKE,
              sourceId: sessionId,
              notes: `VOID: Stocktake ${session.sessionNumber} reversal - ${reason}`,
              createdById: userId,
            },
            { allowNegative: true, tx },
          );

          // Link reversal entry to line
          await tx.stocktakeLine.update({
            where: { id: line.id },
            data: { reversalEntryId: entry.id },
          });

          reversalEntries.push({
            lineId: line.id,
            entryId: entry.id,
            reversedVariance: reversedQty,
          });
        }
      }

      // Update session status
      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.VOID,
          voidedById: userId,
          voidedAt: new Date(),
          voidReason: reason,
        },
        include: this.getSessionInclude(),
      });

      // M11.13: Create GL reversal entry if original stocktake had GL posting
      if (session.glJournalEntryId) {
        try {
          await this.glPostingService.voidStocktakeGl(
            orgId,
            branchId,
            sessionId,
            userId,
          );
          this.logger.log(`GL reversal entry created for voided stocktake ${sessionId}`);
        } catch (glError: any) {
          this.logger.warn(`GL reversal failed for stocktake ${sessionId}: ${glError.message}`);
          // GL reversal failure doesn't block stocktake void
        }
      }

      this.logger.log(
        `Voided stocktake session ${session.sessionNumber}: ${reversalEntries.length} reversal entries created`,
      );

      return {
        ...updated,
        reversalEntriesCreated: reversalEntries.length,
        reversalEntries,
      };
    });
  }

  // ============================================
  // Cancel Session (DRAFT/IN_PROGRESS → VOID)
  // No ledger entries needed - just cancel
  // ============================================

  async cancelSession(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    reason?: string,
  ) {
    this.logger.log(`Cancelling stocktake session ${sessionId}`);

    return this.prisma.client.$transaction(async (tx) => {
      const session = await tx.stocktakeSession.findFirst({
        where: { id: sessionId, orgId, branchId },
      });

      if (!session) {
        throw new NotFoundException('Stocktake session not found');
      }

      // Can only cancel DRAFT or IN_PROGRESS sessions
      if (
        session.status !== StocktakeStatus.DRAFT &&
        session.status !== StocktakeStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          `Cannot cancel session with status ${session.status}. Must be DRAFT or IN_PROGRESS.`,
        );
      }

      const updated = await tx.stocktakeSession.update({
        where: { id: sessionId },
        data: {
          status: StocktakeStatus.VOID,
          voidedById: userId,
          voidedAt: new Date(),
          voidReason: reason ?? 'Cancelled by user',
        },
        include: this.getSessionInclude(),
      });

      this.logger.log(`Cancelled stocktake session ${session.sessionNumber}`);
      return updated;
    });
  }

  // ============================================
  // Get Session Detail
  // ============================================

  async getSession(orgId: string, branchId: string, sessionId: string, includeLines = true) {
    const session = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: sessionId, orgId, branchId },
      include: includeLines ? this.getSessionWithLinesInclude() : this.getSessionInclude(),
    });

    if (!session) {
      throw new NotFoundException('Stocktake session not found');
    }

    // Filter out expectedQty (snapshotQty) if blind count and not yet submitted
    if (session.blindCount && session.status === StocktakeStatus.IN_PROGRESS && includeLines) {
      const lines = (session as any).lines ?? [];
      (session as any).lines = lines.map((line: any) => ({
        ...line,
        snapshotQty: undefined, // Hide from counters
      }));
    }

    return session;
  }

  // ============================================
  // List Sessions
  // ============================================

  async listSessions(orgId: string, branchId: string, filters: StocktakeListFilters = {}) {
    const where: Prisma.StocktakeSessionWhereInput = {
      orgId,
      branchId,
    };

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    if (filters.search) {
      where.OR = [
        { sessionNumber: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      this.prisma.client.stocktakeSession.findMany({
        where,
        include: this.getSessionInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.stocktakeSession.count({ where }),
    ]);

    return {
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // Get Session Lines
  // ============================================

  async getSessionLines(
    orgId: string,
    branchId: string,
    sessionId: string,
    filters: { counted?: boolean; withVariance?: boolean } = {},
  ) {
    const session = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: sessionId, orgId, branchId },
      select: { id: true, status: true, blindCount: true },
    });

    if (!session) {
      throw new NotFoundException('Stocktake session not found');
    }

    const where: Prisma.StocktakeLineWhereInput = { sessionId };

    if (filters.counted !== undefined) {
      where.countedQty = filters.counted ? { not: null } : null;
    }

    if (filters.withVariance) {
      where.variance = { not: new Decimal(0) };
    }

    const lines = await this.prisma.client.stocktakeLine.findMany({
      where,
      include: this.getLineInclude(session.blindCount),
      orderBy: [{ item: { name: 'asc' } }, { location: { code: 'asc' } }],
    });

    // Hide snapshot qty if blind count and in progress
    if (session.blindCount && session.status === StocktakeStatus.IN_PROGRESS) {
      return lines.map((line) => ({
        ...line,
        snapshotQty: undefined,
      }));
    }

    return lines;
  }

  // ============================================
  // Export CSV
  // ============================================

  async exportCsv(orgId: string, branchId: string, sessionId: string): Promise<{
    csv: string;
    hash: string;
    filename: string;
  }> {
    const session = await this.prisma.client.stocktakeSession.findFirst({
      where: { id: sessionId, orgId, branchId },
      include: {
        lines: {
          include: {
            item: { select: { sku: true, name: true } },
            location: { select: { code: true, name: true } },
            countedBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ item: { name: 'asc' } }, { location: { code: 'asc' } }],
        },
        location: { select: { code: true, name: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Stocktake session not found');
    }

    // Build CSV
    const headers = [
      'SKU',
      'Item Name',
      'Location Code',
      'Location Name',
      'Snapshot Qty',
      'Counted Qty',
      'Variance',
      'Counted By',
      'Counted At',
      'Notes',
    ];

    const rows = session.lines.map((line) => [
      line.item.sku ?? '',
      line.item.name,
      line.location.code,
      line.location.name,
      line.snapshotQty.toString(),
      line.countedQty?.toString() ?? '',
      line.variance?.toString() ?? '',
      line.countedBy ? `${line.countedBy.firstName} ${line.countedBy.lastName}` : '',
      line.countedAt?.toISOString() ?? '',
      line.notes ?? '',
    ]);

    // Use LF line endings for consistency
    const csvContent = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
      '\n',
    );

    // Compute SHA256 hash
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(csvContent, 'utf8').digest('hex');

    const filename = `stocktake-${session.sessionNumber}.csv`;

    return { csv: csvContent, hash, filename };
  }

  // ============================================
  // Helper: Include Objects
  // ============================================

  private getSessionInclude() {
    return {
      location: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      startedBy: { select: { id: true, firstName: true, lastName: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      postedBy: { select: { id: true, firstName: true, lastName: true } },
      voidedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  private getSessionWithLinesInclude() {
    return {
      ...this.getSessionInclude(),
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
          countedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [
          { item: { name: 'asc' as const } },
          { location: { code: 'asc' as const } },
        ],
      },
    };
  }

  private getLineInclude(blindCount: boolean) {
    return {
      item: { select: { id: true, sku: true, name: true } },
      location: { select: { id: true, code: true, name: true } },
      countedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }
}

// ============================================
// Helper: CSV Escape
// ============================================

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
