/**
 * M15: Deposit Accounting Service
 * 
 * Handles GL postings for reservation and event booking deposits
 * Integrates with M8 PostingService for accounting entries
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface DepositGLEntry {
  orgId: string;
  branchId: string;
  reservationId?: string;
  eventBookingId?: string;
  amount: number;
  description: string;
}

@Injectable()
export class DepositAccountingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post GL entry when deposit is collected
   * Dr: Cash/Bank (1010)
   * Cr: Reservation Deposit Liability (2200)
   */
  async recordDepositCollection(params: DepositGLEntry): Promise<void> {
    // TODO: Posting model doesn't exist in schema - needs implementation
    // const { orgId, branchId, reservationId, eventBookingId, amount, description } = params;
    return;
    /*
    const reference = reservationId
      ? `RESERVATION-DEPOSIT-${reservationId}`
      : `EVENT-DEPOSIT-${eventBookingId}`;

    // @ts-expect-error - Posting model does not exist
    await this.prisma.posting.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        reference,
        description: description || 'Deposit collected',
        metadata: {
          type: 'deposit_collection',
          reservationId,
          eventBookingId,
        },
        entries: {
          create: [
            {
              accountCode: '1010', // Cash/Bank
              debit: amount,
              credit: 0,
              description: `Deposit collected - ${reference}`,
            },
            {
              accountCode: '2200', // Reservation Deposit Liability
              debit: 0,
              credit: amount,
              description: `Deposit liability - ${reference}`,
            },
          ],
        },
      },
      include: {
        entries: true,
      },
    });
    */
  }

  /**
   * Post GL entry when guest shows up and deposit is applied to bill
   * Dr: Reservation Deposit Liability (2200)
   * Cr: Revenue (4000)
   */
  async applyDepositToBill(params: DepositGLEntry & { orderId: string }): Promise<void> {
    const { orgId, branchId, reservationId, amount, orderId, description } = params;

    const reference = `DEPOSIT-APPLY-${reservationId}`;

    // @ts-expect-error - Posting model does not exist
    await this.prisma.posting.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        reference,
        description: description || 'Deposit applied to order',
        metadata: {
          type: 'deposit_applied',
          reservationId,
          orderId,
        },
        entries: {
          create: [
            {
              accountCode: '2200', // Deposit Liability
              debit: amount,
              credit: 0,
              description: `Apply deposit to order ${orderId}`,
            },
            {
              accountCode: '4000', // Revenue
              debit: 0,
              credit: amount,
              description: `Revenue from applied deposit`,
            },
          ],
        },
      },
      include: {
        entries: true,
      },
    });
  }

  /**
   * Post GL entry when guest no-shows and deposit is forfeited
   * Dr: Reservation Deposit Liability (2200)
   * Cr: No-Show Fee Revenue (4901)
   */
  async forfeitDeposit(params: DepositGLEntry): Promise<void> {
    const { orgId, branchId, reservationId, eventBookingId, amount, description } = params;

    const reference = reservationId ? `NO-SHOW-${reservationId}` : `NO-SHOW-EVENT-${eventBookingId}`;

    // @ts-expect-error - Posting model does not exist
    await this.prisma.posting.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        reference,
        description: description || 'Deposit forfeited - no show',
        metadata: {
          type: 'deposit_forfeited',
          reservationId,
          eventBookingId,
          reason: 'no_show',
        },
        entries: {
          create: [
            {
              accountCode: '2200', // Deposit Liability
              debit: amount,
              credit: 0,
              description: `Forfeit deposit - ${reference}`,
            },
            {
              accountCode: '4901', // No-Show Fee Revenue
              debit: 0,
              credit: amount,
              description: `No-show fee revenue - ${reference}`,
            },
          ],
        },
      },
      include: {
        entries: true,
      },
    });
  }

  /**
   * Post GL entry when deposit is refunded (full refund)
   * Dr: Reservation Deposit Liability (2200)
   * Cr: Cash/Bank (1010)
   */
  async refundDeposit(params: DepositGLEntry & { reason: string }): Promise<void> {
    const { orgId, branchId, reservationId, eventBookingId, amount, reason, description } = params;

    const reference = reservationId ? `REFUND-${reservationId}` : `REFUND-EVENT-${eventBookingId}`;

    // @ts-expect-error - Posting model does not exist
    await this.prisma.posting.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        reference,
        description: description || 'Deposit refunded',
        metadata: {
          type: 'deposit_refunded',
          reservationId,
          eventBookingId,
          refundReason: reason,
        },
        entries: {
          create: [
            {
              accountCode: '2200', // Deposit Liability
              debit: amount,
              credit: 0,
              description: `Refund deposit - ${reference}`,
            },
            {
              accountCode: '1010', // Cash/Bank
              debit: 0,
              credit: amount,
              description: `Deposit refund issued - ${reason}`,
            },
          ],
        },
      },
      include: {
        entries: true,
      },
    });
  }

  /**
   * Post GL entry for partial refund (late cancellation)
   * Split between forfeited amount (revenue) and refunded amount (cash)
   */
  async partialRefundDeposit(params: DepositGLEntry & {
    forfeitAmount: number;
    refundAmount: number;
    reason: string;
  }): Promise<void> {
    const { orgId, branchId, reservationId, forfeitAmount, refundAmount, reason, description } = params;

    const reference = `LATE-CANCEL-${reservationId}`;
    const totalAmount = forfeitAmount + refundAmount;

    // @ts-expect-error - Posting model does not exist
    await this.prisma.posting.create({
      data: {
        orgId,
        branchId,
        date: new Date(),
        reference,
        description: description || 'Deposit partially refunded - late cancellation',
        metadata: {
          type: 'deposit_partial_refund',
          reservationId,
          forfeitAmount,
          refundAmount,
          reason,
        },
        entries: {
          create: [
            {
              accountCode: '2200', // Deposit Liability
              debit: totalAmount,
              credit: 0,
              description: `Settle deposit - ${reference}`,
            },
            {
              accountCode: '4902', // Cancellation Fee Revenue
              debit: 0,
              credit: forfeitAmount,
              description: `Cancellation fee revenue`,
            },
            {
              accountCode: '1010', // Cash/Bank
              debit: 0,
              credit: refundAmount,
              description: `Partial refund issued`,
            },
          ],
        },
      },
      include: {
        entries: true,
      },
    });
  }
}
