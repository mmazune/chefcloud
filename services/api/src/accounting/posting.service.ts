/**
 * E40-s1: Accounting Core - Posting Service
 * 
 * Creates balanced journal entries from operational transactions.
 * Enforces double-entry accounting: debits = credits.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ACCOUNT_CASH,
  ACCOUNT_SALES,
  ACCOUNT_COGS,
  ACCOUNT_INVENTORY,
  ACCOUNT_AR,
  ACCOUNT_EQUITY,
} from './posting-map';

@Injectable()
export class PostingService {
  private readonly logger = new Logger(PostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post sale to GL when order is closed.
   * 
   * Dr Cash (or AR)    [total]
   *   Cr Sales         [subtotal]
   *   Cr Service       [serviceFee if any]
   * 
   * @param orderId - The closed order ID
   * @param userId - User who posted
   */
  async postSale(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        orderItems: true,
        payments: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'CLOSED') {
      throw new Error(`Order ${orderId} is not closed`);
    }

    // Check if already posted
    const existing = await this.prisma.client.journalEntry.findFirst({
      where: {
        source: 'ORDER',
        sourceId: orderId,
      },
    });

    if (existing) {
      this.logger.warn(`Order ${orderId} already posted to GL as ${existing.id}`);
      return;
    }

    const orgId = order.branch.orgId;
    const branchId = order.branchId;
    const total = Number(order.total);
    const subtotal = Number(order.subtotal);

    // Get account IDs
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: {
          in: [ACCOUNT_CASH, ACCOUNT_AR, ACCOUNT_SALES],
        },
      },
    });

    const cashAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_CASH);
    const arAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_AR);
    const salesAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_SALES);

    if (!cashAccount || !salesAccount) {
      throw new Error(`Missing required accounts for org ${orgId}`);
    }

    // Determine debit account: Cash if paid, AR if on credit
    const isPaid = order.payments && order.payments.length > 0;
    const debitAccountId = isPaid ? cashAccount.id : (arAccount?.id || cashAccount.id);

    // Create journal entry
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        date: order.updatedAt,
        memo: `Sale - Order #${order.id.slice(-8)}`,
        source: 'ORDER',
        sourceId: orderId,
        postedById: userId,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              branchId,
              debit: total,
              credit: 0,
              meta: { orderId },
            },
            {
              accountId: salesAccount.id,
              branchId,
              debit: 0,
              credit: subtotal,
              meta: { orderId },
            },
          ],
        },
      },
      include: { lines: true },
    });

    this.logger.log(
      `Posted sale for order ${orderId} → JE ${entry.id} (${entry.lines.length} lines)`,
    );
  }

  /**
   * Post COGS to GL when order is closed.
   * 
   * Dr COGS          [cost]
   *   Cr Inventory   [cost]
   * 
   * @param orderId - The closed order ID
   * @param userId - User who posted
   */
  async postCOGS(orderId: string, userId: string): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        branch: true,
        orderItems: {
          include: {
            menuItem: {
              include: {
                recipeIngredients: {
                  include: {
                    item: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'CLOSED') {
      throw new Error(`Order ${orderId} is not closed`);
    }

    // Check if COGS already posted
    const existing = await this.prisma.client.journalEntry.findFirst({
      where: {
        source: 'COGS',
        sourceId: orderId,
      },
    });

    if (existing) {
      this.logger.warn(`COGS for order ${orderId} already posted as ${existing.id}`);
      return;
    }

    const orgId = order.branch.orgId;
    const branchId = order.branchId;

    // Calculate total COGS from order items
    let totalCost = 0;
    for (const item of order.orderItems) {
      if (item.menuItem.recipeIngredients && item.menuItem.recipeIngredients.length > 0) {
        for (const ingredient of item.menuItem.recipeIngredients) {
          // Get latest batch cost for this ingredient
          const batch = await this.prisma.client.stockBatch.findFirst({
            where: {
              orgId,
              branchId,
              itemId: ingredient.itemId,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'asc' },
          });

          if (batch) {
            const ingredientCost = Number(batch.unitCost) * Number(ingredient.qtyPerUnit) * item.quantity;
            totalCost += ingredientCost;
          }
        }
      }
    }

    if (totalCost === 0) {
      this.logger.warn(`Order ${orderId} has zero COGS, skipping GL posting`);
      return;
    }

    // Get accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: {
          in: [ACCOUNT_COGS, ACCOUNT_INVENTORY],
        },
      },
    });

    const cogsAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_COGS);
    const inventoryAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_INVENTORY);

    if (!cogsAccount || !inventoryAccount) {
      throw new Error(`Missing COGS/Inventory accounts for org ${orgId}`);
    }

    // Create COGS journal entry
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        date: order.updatedAt,
        memo: `COGS - Order #${order.id.slice(-8)}`,
        source: 'COGS',
        sourceId: orderId,
        postedById: userId,
        lines: {
          create: [
            {
              accountId: cogsAccount.id,
              branchId,
              debit: totalCost,
              credit: 0,
              meta: { orderId, totalCost },
            },
            {
              accountId: inventoryAccount.id,
              branchId,
              debit: 0,
              credit: totalCost,
              meta: { orderId, totalCost },
            },
          ],
        },
      },
      include: { lines: true },
    });

    this.logger.log(`Posted COGS for order ${orderId} → JE ${entry.id} (cost: ${totalCost})`);
  }

  /**
   * Post refund to GL when refund is issued.
   * 
   * Dr Sales         [amount]
   *   Cr Cash        [amount]
   * 
   * @param refundId - The refund ID
   * @param userId - User who posted
   */
  async postRefund(refundId: string, userId: string): Promise<void> {
    const refund = await this.prisma.client.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    // Check if already posted
    const existing = await this.prisma.client.journalEntry.findFirst({
      where: {
        source: 'REFUND',
        sourceId: refundId,
      },
    });

    if (existing) {
      this.logger.warn(`Refund ${refundId} already posted as ${existing.id}`);
      return;
    }

    const orgId = refund.order.branch.orgId;
    const branchId = refund.order.branchId;
    const amount = Number(refund.amount);

    // Get accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: {
          in: [ACCOUNT_CASH, ACCOUNT_SALES],
        },
      },
    });

    const cashAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_CASH);
    const salesAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_SALES);

    if (!cashAccount || !salesAccount) {
      throw new Error(`Missing accounts for org ${orgId}`);
    }

    // Create refund journal entry (reverse of sale)
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        date: refund.createdAt,
        memo: `Refund - ${refund.reason || 'No reason'}`,
        source: 'REFUND',
        sourceId: refundId,
        postedById: userId,
        lines: {
          create: [
            {
              accountId: salesAccount.id,
              branchId,
              debit: amount,
              credit: 0,
              meta: { refundId, orderId: refund.orderId },
            },
            {
              accountId: cashAccount.id,
              branchId,
              debit: 0,
              credit: amount,
              meta: { refundId, orderId: refund.orderId },
            },
          ],
        },
      },
      include: { lines: true },
    });

    this.logger.log(`Posted refund ${refundId} → JE ${entry.id} (amount: ${amount})`);
  }

  /**
   * Post cash movement to GL.
   * 
   * For DEPOSIT (add cash to till):
   * Dr Cash  [amount]
   *   Cr Equity  [amount]
   * 
   * For WITHDRAWAL (remove cash from till):
   * Dr Equity  [amount]
   *   Cr Cash  [amount]
   * 
   * @param movementId - The cash movement ID
   * @param userId - User who posted
   */
  async postCashMovement(movementId: string, userId: string): Promise<void> {
    const movement = await this.prisma.client.cashMovement.findUnique({
      where: { id: movementId },
    });

    if (!movement) {
      throw new Error(`CashMovement ${movementId} not found`);
    }

    // Check if already posted
    const existing = await this.prisma.client.journalEntry.findFirst({
      where: {
        source: 'CASH_MOVEMENT',
        sourceId: movementId,
      },
    });

    if (existing) {
      this.logger.warn(`CashMovement ${movementId} already posted as ${existing.id}`);
      return;
    }

    const orgId = movement.orgId;
    const branchId = movement.branchId;
    const amount = Math.abs(Number(movement.amount));
    const isDeposit = movement.type === 'PAID_IN';

    // Get accounts
    const accounts = await this.prisma.client.account.findMany({
      where: {
        orgId,
        code: {
          in: [ACCOUNT_CASH, ACCOUNT_EQUITY],
        },
      },
    });

    const cashAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_CASH);
    const equityAccount = accounts.find((a: { code: string }) => a.code === ACCOUNT_EQUITY);

    if (!cashAccount || !equityAccount) {
      throw new Error(`Missing accounts for org ${orgId}`);
    }

    // Create cash movement journal entry
    const entry = await this.prisma.client.journalEntry.create({
      data: {
        orgId,
        date: movement.createdAt,
        memo: `Cash ${movement.type} - ${movement.reason || 'No reason'}`,
        source: 'CASH_MOVEMENT',
        sourceId: movementId,
        postedById: userId,
        lines: {
          create: isDeposit
            ? [
                {
                  accountId: cashAccount.id,
                  branchId,
                  debit: amount,
                  credit: 0,
                  meta: { movementId, type: movement.type },
                },
                {
                  accountId: equityAccount.id,
                  branchId,
                  debit: 0,
                  credit: amount,
                  meta: { movementId, type: movement.type },
                },
              ]
            : [
                {
                  accountId: equityAccount.id,
                  branchId,
                  debit: amount,
                  credit: 0,
                  meta: { movementId, type: movement.type },
                },
                {
                  accountId: cashAccount.id,
                  branchId,
                  debit: 0,
                  credit: amount,
                  meta: { movementId, type: movement.type },
                },
              ],
        },
      },
      include: { lines: true },
    });

    this.logger.log(
      `Posted cash movement ${movementId} (${movement.type}) → JE ${entry.id} (amount: ${amount})`,
    );
  }
}
