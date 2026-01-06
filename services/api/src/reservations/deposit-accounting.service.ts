/**
 * M9.2: Deposit Accounting Service
 * 
 * Manages reservation deposits with proper GL integration:
 * - PAID: Dr Cash, Cr Deposits Held (liability)
 * - REFUNDED: Dr Deposits Held, Cr Cash (reversal)
 * - APPLIED: Dr Deposits Held, Cr Revenue (recognition)
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// GL Account codes
const ACCOUNT_CASH = '1000';
const ACCOUNT_DEPOSITS_HELD = '2100';
const ACCOUNT_REVENUE = '4000';

interface RequireDepositParams {
  orgId: string;
  reservationId: string;
  amount: number;
  createdById?: string;
}

interface PayDepositParams {
  orgId: string;
  depositId: string;
  paymentMethod?: 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER';
  paidById?: string;
}

interface RefundDepositParams {
  orgId: string;
  depositId: string;
  reason?: string;
  refundedById?: string;
}

interface ApplyDepositParams {
  orgId: string;
  depositId: string;
  appliedById?: string;
}

@Injectable()
export class DepositAccountingService {
  private readonly logger = new Logger(DepositAccountingService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a deposit requirement for a reservation
   */
  async requireDeposit(params: RequireDepositParams): Promise<unknown> {
    const { orgId, reservationId, amount, createdById } = params;

    // Check reservation exists
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.orgId !== orgId) {
      throw new NotFoundException('Reservation not found');
    }

    // Check for existing deposit
    const existing = await this.prisma.client.reservationDeposit.findFirst({
      where: { reservationId },
    });

    if (existing) {
      throw new ConflictException('Deposit already exists for this reservation');
    }

    const deposit = await this.prisma.client.reservationDeposit.create({
      data: {
        orgId,
        reservationId,
        amount,
        status: 'REQUIRED',
        createdById,
      },
    });

    this.logger.log(`Created deposit requirement: ${deposit.id} (${amount})`);
    return deposit;
  }

  /**
   * Record deposit payment and post GL entry
   * Dr Cash/Bank, Cr Deposits Held
   */
  async payDeposit(params: PayDepositParams): Promise<unknown> {
    const { orgId, depositId, paymentMethod, paidById } = params;

    const deposit = await this.prisma.client.reservationDeposit.findUnique({
      where: { id: depositId },
      include: { reservation: true },
    });

    if (!deposit || deposit.orgId !== orgId) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status !== 'REQUIRED') {
      throw new ConflictException(`Cannot pay deposit in status ${deposit.status}`);
    }

    // Get GL accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: { in: [ACCOUNT_CASH, ACCOUNT_DEPOSITS_HELD] },
      },
    });

    const cashAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_CASH);
    let depositsAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_DEPOSITS_HELD);

    if (!cashAccount) {
      throw new ConflictException('Cash account (1000) not found');
    }

    // Create Deposits Held account if missing
    if (!depositsAccount) {
      depositsAccount = await this.prisma.client.account.create({
        data: {
          orgId,
          code: ACCOUNT_DEPOSITS_HELD,
          name: 'Deposits Held',
          type: 'LIABILITY',
        },
      });
    }

    const amount = Number(deposit.amount);

    // Create journal entry
    const journalEntry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        branchId: deposit.reservation.branchId,
        date: new Date(),
        memo: `Deposit paid - Reservation ${deposit.reservationId.slice(-8)}`,
        source: 'RESERVATION_DEPOSIT',
        sourceId: depositId,
        status: 'POSTED',
        postedById: paidById,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: cashAccount.id,
              branchId: deposit.reservation.branchId,
              debit: amount,
              credit: 0,
              meta: { depositId },
            },
            {
              accountId: depositsAccount.id,
              branchId: deposit.reservation.branchId,
              debit: 0,
              credit: amount,
              meta: { depositId },
            },
          ],
        },
      },
    });

    // Update deposit status
    const updatedDeposit = await this.prisma.client.reservationDeposit.update({
      where: { id: depositId },
      data: {
        status: 'PAID',
        paymentMethod: paymentMethod || 'CASH',
        journalEntryId: journalEntry.id,
        paidAt: new Date(),
        paidById,
      },
    });

    this.logger.log(`Deposit paid: ${depositId} → JE ${journalEntry.id}`);
    return updatedDeposit;
  }

  /**
   * Refund deposit with reversal journal entry
   * Dr Deposits Held, Cr Cash
   */
  async refundDeposit(params: RefundDepositParams): Promise<unknown> {
    const { orgId, depositId, reason, refundedById } = params;

    const deposit = await this.prisma.client.reservationDeposit.findUnique({
      where: { id: depositId },
      include: { reservation: true },
    });

    if (!deposit || deposit.orgId !== orgId) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status !== 'PAID') {
      throw new ConflictException(`Cannot refund deposit in status ${deposit.status}`);
    }

    // Get GL accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: { in: [ACCOUNT_CASH, ACCOUNT_DEPOSITS_HELD] },
      },
    });

    const cashAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_CASH);
    const depositsAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_DEPOSITS_HELD);

    if (!cashAccount || !depositsAccount) {
      throw new ConflictException('Required GL accounts not found');
    }

    const amount = Number(deposit.amount);

    // Create reversal journal entry
    const journalEntry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        branchId: deposit.reservation.branchId,
        date: new Date(),
        memo: `Deposit refund - Reservation ${deposit.reservationId.slice(-8)}${reason ? ` (${reason})` : ''}`,
        source: 'RESERVATION_DEPOSIT_REFUND',
        sourceId: depositId,
        status: 'POSTED',
        postedById: refundedById,
        postedAt: new Date(),
        reversesEntryId: deposit.journalEntryId || undefined,
        lines: {
          create: [
            {
              accountId: depositsAccount.id,
              branchId: deposit.reservation.branchId,
              debit: amount,
              credit: 0,
              meta: { depositId, refund: true },
            },
            {
              accountId: cashAccount.id,
              branchId: deposit.reservation.branchId,
              debit: 0,
              credit: amount,
              meta: { depositId, refund: true },
            },
          ],
        },
      },
    });

    // Update deposit status
    const updatedDeposit = await this.prisma.client.reservationDeposit.update({
      where: { id: depositId },
      data: {
        status: 'REFUNDED',
        refundJournalId: journalEntry.id,
        refundedAt: new Date(),
        refundReason: reason,
        refundedById,
      },
    });

    this.logger.log(`Deposit refunded: ${depositId} → JE ${journalEntry.id}`);
    return updatedDeposit;
  }

  /**
   * Apply deposit to bill (recognize as revenue)
   * Dr Deposits Held, Cr Revenue
   */
  async applyDeposit(params: ApplyDepositParams): Promise<unknown> {
    const { orgId, depositId, appliedById } = params;

    const deposit = await this.prisma.client.reservationDeposit.findUnique({
      where: { id: depositId },
      include: { reservation: true },
    });

    if (!deposit || deposit.orgId !== orgId) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.status !== 'PAID') {
      throw new ConflictException(`Cannot apply deposit in status ${deposit.status}`);
    }

    // Get GL accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: { in: [ACCOUNT_DEPOSITS_HELD, ACCOUNT_REVENUE] },
      },
    });

    const depositsAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_DEPOSITS_HELD);
    const revenueAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_REVENUE);

    if (!depositsAccount || !revenueAccount) {
      throw new ConflictException('Required GL accounts not found');
    }

    const amount = Number(deposit.amount);

    // Create revenue recognition journal entry
    const journalEntry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        branchId: deposit.reservation.branchId,
        date: new Date(),
        memo: `Deposit applied - Reservation ${deposit.reservationId.slice(-8)}`,
        source: 'RESERVATION_DEPOSIT_APPLY',
        sourceId: depositId,
        status: 'POSTED',
        postedById: appliedById,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: depositsAccount.id,
              branchId: deposit.reservation.branchId,
              debit: amount,
              credit: 0,
              meta: { depositId, applied: true },
            },
            {
              accountId: revenueAccount.id,
              branchId: deposit.reservation.branchId,
              debit: 0,
              credit: amount,
              meta: { depositId, applied: true },
            },
          ],
        },
      },
    });

    // Update deposit status
    const updatedDeposit = await this.prisma.client.reservationDeposit.update({
      where: { id: depositId },
      data: {
        status: 'APPLIED',
        applyJournalId: journalEntry.id,
        appliedAt: new Date(),
        appliedById,
      },
    });

    this.logger.log(`Deposit applied: ${depositId} → JE ${journalEntry.id}`);
    return updatedDeposit;
  }

  /**
   * Forfeit deposit (no-show) - mark as forfeited but don't refund
   */
  async forfeitDeposit(depositId: string, orgId: string): Promise<unknown> {
    const deposit = await this.prisma.client.reservationDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit || deposit.orgId !== orgId) {
      throw new NotFoundException('Deposit not found');
    }

    if (!['REQUIRED', 'PAID'].includes(deposit.status)) {
      throw new ConflictException(`Cannot forfeit deposit in status ${deposit.status}`);
    }

    const updatedDeposit = await this.prisma.client.reservationDeposit.update({
      where: { id: depositId },
      data: {
        status: 'FORFEITED',
      },
    });

    this.logger.log(`Deposit forfeited: ${depositId}`);
    return updatedDeposit;
  }

  /**
   * Get deposit for a reservation
   */
  async getDeposit(orgId: string, reservationId: string): Promise<unknown> {
    return this.prisma.client.reservationDeposit.findFirst({
      where: {
        orgId,
        reservationId,
      },
      include: {
        journalEntry: { include: { lines: true } },
        refundJournal: { include: { lines: true } },
        applyJournal: { include: { lines: true } },
      },
    });
  }
}
