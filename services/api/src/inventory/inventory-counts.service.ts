import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
import { InventoryLedgerService, LedgerEntryReason, LedgerSourceType } from './inventory-ledger.service';
import { InventoryLocationsService } from './inventory-locations.service';

export enum CountSessionStatus {
  OPEN = 'OPEN',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED',
}

export interface CreateCountSessionDto {
  name: string;
  description?: string;
  locationId?: string; // Optional: scope to specific location
  metadata?: Record<string, unknown>;
}

export interface CountLineDto {
  itemId: string;
  locationId: string;
  countedQty: number | string;
  notes?: string;
}

@Injectable()
export class InventoryCountsService {
  private readonly logger = new Logger(InventoryCountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly locationsService: InventoryLocationsService,
  ) { }

  /**
   * Create a new count session
   */
  async createSession(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateCountSessionDto,
  ) {
    this.logger.log(`Creating count session: ${dto.name}`);

    // Validate location if provided
    if (dto.locationId) {
      await this.locationsService.getLocation(orgId, dto.locationId);
    }

    const session = await this.prisma.client.countSession.create({
      data: {
        orgId,
        branchId,
        name: dto.name,
        description: dto.description,
        locationId: dto.locationId,
        status: CountSessionStatus.OPEN,
        createdById: userId,
        metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
      include: {
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Created count session ${session.id}`);
    return session;
  }

  /**
   * Add or update a count line
   * Uses upsert to allow re-counting items
   */
  async upsertCountLine(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    dto: CountLineDto,
  ) {
    const countedQty = new Decimal(dto.countedQty);

    // Verify session exists and is open
    const session = await this.prisma.client.countSession.findFirst({
      where: { id: sessionId, orgId, branchId },
    });

    if (!session) {
      throw new BadRequestException('Count session not found');
    }

    if (session.status !== CountSessionStatus.OPEN) {
      throw new BadRequestException(`Cannot modify count session with status ${session.status}`);
    }

    // Verify item exists
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, orgId },
    });

    if (!item) {
      throw new BadRequestException('Inventory item not found');
    }

    // Verify location exists and matches session scope if set
    const location = await this.locationsService.getLocation(orgId, dto.locationId);

    if (session.locationId && session.locationId !== dto.locationId) {
      throw new BadRequestException(
        `Count line location ${dto.locationId} does not match session location ${session.locationId}`,
      );
    }

    // Get current on-hand for expected qty calculation
    const expectedQty = await this.ledgerService.getOnHand(dto.itemId, dto.locationId, branchId);

    // Upsert count line
    const line = await this.prisma.client.countSessionLine.upsert({
      where: {
        sessionId_itemId_locationId: {
          sessionId,
          itemId: dto.itemId,
          locationId: dto.locationId,
        },
      },
      create: {
        sessionId,
        itemId: dto.itemId,
        locationId: dto.locationId,
        expectedQty,
        countedQty,
        variance: countedQty.minus(expectedQty),
        countedById: userId,
        notes: dto.notes,
      },
      update: {
        expectedQty,
        countedQty,
        variance: countedQty.minus(expectedQty),
        countedById: userId,
        notes: dto.notes,
        countedAt: new Date(),
      },
      include: {
        item: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, code: true, name: true } },
        countedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(
      `Upserted count line: session=${sessionId}, item=${dto.itemId}, counted=${countedQty}, variance=${line.variance}`,
    );

    return line;
  }

  /**
   * Finalize count session - IDEMPOTENT
   * Creates adjustment ledger entries for all variances
   */
  async finalizeSession(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    options?: { allowNegative?: boolean },
  ) {
    this.logger.log(`Finalizing count session ${sessionId}`);

    // Use transaction for atomicity and idempotence check
    return this.prisma.client.$transaction(async (tx) => {
      // Get session with pessimistic lock pattern (check status first)
      const session = await tx.countSession.findFirst({
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
        throw new BadRequestException('Count session not found');
      }

      // IDEMPOTENT: If already finalized, return success without re-processing
      if (session.status === CountSessionStatus.FINALIZED) {
        this.logger.log(`Count session ${sessionId} already finalized (idempotent return)`);
        return {
          ...session,
          alreadyFinalized: true,
        };
      }

      if (session.status === CountSessionStatus.CANCELLED) {
        throw new BadRequestException('Cannot finalize cancelled count session');
      }

      if (session.lines.length === 0) {
        throw new BadRequestException('Cannot finalize count session with no lines');
      }

      // Update session status first
      const finalizedSession = await tx.countSession.update({
        where: { id: sessionId },
        data: {
          status: CountSessionStatus.FINALIZED,
          finalizedById: userId,
          finalizedAt: new Date(),
        },
        include: {
          lines: {
            include: {
              item: { select: { id: true, name: true, sku: true } },
              location: { select: { id: true, code: true, name: true } },
            },
          },
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          finalizedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Create ledger entries for each line with non-zero variance
      const adjustments: any[] = [];
      for (const line of session.lines) {
        if (!line.variance.equals(0)) {
          // Create ledger entry for the variance
          const entry = await this.ledgerService.recordEntry(
            orgId,
            branchId,
            {
              itemId: line.itemId,
              locationId: line.locationId,
              qty: line.variance,
              reason: LedgerEntryReason.CYCLE_COUNT,
              sourceType: LedgerSourceType.COUNT_SESSION,
              sourceId: sessionId,
              notes: `Cycle count adjustment: expected ${line.expectedQty}, counted ${line.countedQty}`,
              createdById: userId,
            },
            { allowNegative: options?.allowNegative, tx },
          );

          adjustments.push({
            itemId: line.itemId,
            locationId: line.locationId,
            variance: line.variance,
            ledgerEntryId: entry.id,
          });
        }
      }

      this.logger.log(
        `Finalized count session ${sessionId}: ${session.lines.length} lines, ${adjustments.length} adjustments`,
      );

      return {
        ...finalizedSession,
        adjustmentsCreated: adjustments.length,
        adjustments,
      };
    });
  }

  /**
   * Cancel a count session
   */
  async cancelSession(
    orgId: string,
    branchId: string,
    sessionId: string,
    userId: string,
    reason?: string,
  ) {
    const session = await this.prisma.client.countSession.findFirst({
      where: { id: sessionId, orgId, branchId },
    });

    if (!session) {
      throw new BadRequestException('Count session not found');
    }

    if (session.status !== CountSessionStatus.OPEN) {
      throw new BadRequestException(`Cannot cancel count session with status ${session.status}`);
    }

    const cancelled = await this.prisma.client.countSession.update({
      where: { id: sessionId },
      data: {
        status: CountSessionStatus.CANCELLED,
        metadata: {
          ...(session.metadata as object ?? {}),
          cancelledById: userId,
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason,
        },
      },
      include: {
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Cancelled count session ${sessionId} by ${userId}`);

    return cancelled;
  }

  /**
   * List count sessions
   */
  async listSessions(
    orgId: string,
    branchId: string,
    filters: {
      status?: CountSessionStatus | string;
      locationId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { orgId, branchId };

    if (filters.status) where.status = filters.status;
    if (filters.locationId) where.locationId = filters.locationId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [sessions, total] = await Promise.all([
      this.prisma.client.countSession.findMany({
        where,
        include: {
          location: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          finalizedBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
      }),
      this.prisma.client.countSession.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Get count session by ID with lines
   */
  async getSession(orgId: string, branchId: string, sessionId: string) {
    const session = await this.prisma.client.countSession.findFirst({
      where: { id: sessionId, orgId, branchId },
      include: {
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        finalizedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: {
            item: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, code: true, name: true } },
            countedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { countedAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new BadRequestException('Count session not found');
    }

    // Calculate summary statistics
    const summary = {
      totalLines: session.lines.length,
      positiveVariances: session.lines.filter((l) => l.variance.greaterThan(0)).length,
      negativeVariances: session.lines.filter((l) => l.variance.lessThan(0)).length,
      noVariances: session.lines.filter((l) => l.variance.equals(0)).length,
      totalVarianceValue: session.lines.reduce(
        (sum, l) => sum.plus(l.variance.abs()),
        new Decimal(0),
      ),
    };

    return { ...session, summary };
  }

  /**
   * Get count lines for a session
   */
  async getSessionLines(
    orgId: string,
    branchId: string,
    sessionId: string,
    filters?: {
      hasVariance?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    // Verify session exists
    const session = await this.prisma.client.countSession.findFirst({
      where: { id: sessionId, orgId, branchId },
    });

    if (!session) {
      throw new BadRequestException('Count session not found');
    }

    const where: any = { sessionId };

    if (filters?.hasVariance === true) {
      where.NOT = { variance: 0 };
    } else if (filters?.hasVariance === false) {
      where.variance = 0;
    }

    const [lines, total] = await Promise.all([
      this.prisma.client.countSessionLine.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true, unit: true } },
          location: { select: { id: true, code: true, name: true } },
          countedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { countedAt: 'desc' },
        take: filters?.limit ?? 100,
        skip: filters?.offset ?? 0,
      }),
      this.prisma.client.countSessionLine.count({ where }),
    ]);

    return { lines, total };
  }
}
