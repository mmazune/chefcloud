/**
 * M13.4: POS Cash Sessions Service
 *
 * Handles cash drawer sessions for accountability:
 * - Open session with opening float
 * - Close session with counted cash
 * - Compute expected cash from CASH payments in session window
 * - One OPEN session per branch enforced
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface OpenCashSessionDto {
  branchId: string;
  openingFloatCents: number;
}

export interface CloseCashSessionDto {
  countedCashCents: number;
  note?: string;
}

@Injectable()
export class PosCashSessionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Open a new cash session for a branch
   * Only one OPEN session per branch allowed
   */
  async openSession(
    dto: OpenCashSessionDto,
    orgId: string,
    userId: string,
  ): Promise<any> {
    // Check for existing open session (H5: Multiple open sessions)
    const existingOpen = await this.prisma.client.cashSession.findFirst({
      where: {
        orgId,
        branchId: dto.branchId,
        status: 'OPEN',
      },
    });

    if (existingOpen) {
      throw new BadRequestException({
        code: 'SESSION_ALREADY_OPEN',
        message: 'A cash session is already open for this branch. Close it before opening a new one.',
      });
    }

    // Validate branch belongs to org
    const branch = await this.prisma.client.branch.findFirst({
      where: {
        id: dto.branchId,
        orgId,
      },
    });

    if (!branch) {
      throw new BadRequestException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found or access denied',
      });
    }

    // Validate opening float is non-negative
    if (dto.openingFloatCents < 0) {
      throw new BadRequestException({
        code: 'INVALID_FLOAT',
        message: 'Opening float cannot be negative',
      });
    }

    const session = await this.prisma.client.cashSession.create({
      data: {
        orgId,
        branchId: dto.branchId,
        openedById: userId,
        openingFloatCents: dto.openingFloatCents,
        status: 'OPEN',
      },
    });

    return session;
  }

  /**
   * Close an open cash session
   * Computes expected cash from CASH payments during session
   */
  async closeSession(
    sessionId: string,
    dto: CloseCashSessionDto,
    orgId: string,
    userId: string,
  ): Promise<any> {
    const session = await this.prisma.client.cashSession.findFirst({
      where: {
        id: sessionId,
        orgId,
      },
    });

    if (!session) {
      throw new BadRequestException({
        code: 'SESSION_NOT_FOUND',
        message: 'Cash session not found or access denied',
      });
    }

    if (session.status === 'CLOSED') {
      // Idempotent: return existing closed session
      return session;
    }

    // Validate counted cash is non-negative
    if (dto.countedCashCents < 0) {
      throw new BadRequestException({
        code: 'INVALID_COUNT',
        message: 'Counted cash cannot be negative',
      });
    }

    // Compute expected cash from CASH payments during session
    const cashPayments = await this.prisma.client.payment.findMany({
      where: {
        orgId,
        branchId: session.branchId,
        method: 'CASH',
        posStatus: 'CAPTURED',
        createdAt: {
          gte: session.openedAt,
        },
      },
    });

    const cashSalesCents = cashPayments.reduce((sum, p) => sum + p.capturedCents, 0);
    const expectedCashCents = session.openingFloatCents + cashSalesCents;

    const closed = await this.prisma.client.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closedAt: new Date(),
        expectedCashCents,
        countedCashCents: dto.countedCashCents,
        note: dto.note,
      },
    });

    return {
      ...closed,
      varianceCents: dto.countedCashCents - expectedCashCents,
      cashSalesCents,
    };
  }

  /**
   * Get open session for a branch
   */
  async getOpenSession(
    branchId: string,
    orgId: string,
  ): Promise<any | null> {
    return this.prisma.client.cashSession.findFirst({
      where: {
        orgId,
        branchId,
        status: 'OPEN',
      },
    });
  }

  /**
   * Get session by ID
   */
  async getSession(
    sessionId: string,
    orgId: string,
  ): Promise<any> {
    const session = await this.prisma.client.cashSession.findFirst({
      where: {
        id: sessionId,
        orgId,
      },
    });

    if (!session) {
      throw new BadRequestException({
        code: 'SESSION_NOT_FOUND',
        message: 'Cash session not found or access denied',
      });
    }

    return session;
  }

  /**
   * List sessions with filters
   */
  async listSessions(
    orgId: string,
    branchId?: string,
    status?: 'OPEN' | 'CLOSED',
    limit = 50,
  ): Promise<any[]> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.client.cashSession.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Export cash sessions to CSV with hash
   */
  async exportSessionsCsv(
    orgId: string,
    branchId?: string,
    from?: string,
    to?: string,
  ): Promise<{ csv: string; hash: string }> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (from || to) {
      where.openedAt = {};
      if (from) where.openedAt.gte = new Date(from);
      if (to) where.openedAt.lte = new Date(to);
    }

    const sessions = await this.prisma.client.cashSession.findMany({
      where,
      orderBy: { openedAt: 'asc' },
      take: 10000,
    });

    // Build CSV with BOM
    const BOM = '\uFEFF';
    const headers = [
      'session_id',
      'branch_id',
      'status',
      'opened_at',
      'closed_at',
      'opened_by_id',
      'closed_by_id',
      'opening_float_cents',
      'expected_cash_cents',
      'counted_cash_cents',
      'variance_cents',
      'note',
    ];

    const rows = sessions.map((s) => {
      const variance =
        s.countedCashCents !== null && s.expectedCashCents !== null
          ? s.countedCashCents - s.expectedCashCents
          : '';
      return [
        s.id,
        s.branchId,
        s.status,
        s.openedAt.toISOString(),
        s.closedAt?.toISOString() || '',
        s.openedById,
        s.closedById || '',
        s.openingFloatCents,
        s.expectedCashCents || '',
        s.countedCashCents || '',
        variance,
        (s.note || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',');
    });

    const csv = BOM + [headers.join(','), ...rows].join('\n');

    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(csv, 'utf8').digest('hex');

    return { csv, hash };
  }
}
