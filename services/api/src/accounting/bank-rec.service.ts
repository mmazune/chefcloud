import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { parseBankCSV } from './csv-parser';

@Injectable()
export class BankRecService {
  private readonly logger = new Logger(BankRecService.name);
  constructor(private readonly prisma: PrismaService) {}

  async upsertBankAccount(orgId: string, name: string, currencyCode = 'UGX', lastFour?: string) {
    const existing = await this.prisma.client.bankAccount.findFirst({ where: { orgId, name } });
    if (existing) {
      const updated = await this.prisma.client.bankAccount.update({ where: { id: existing.id }, data: { currencyCode, lastFour } });
      this.logger.log(`Updated bank account: ${name}`);
      return updated;
    }
    const account = await this.prisma.client.bankAccount.create({ data: { orgId, name, currencyCode, lastFour } });
    this.logger.log(`Created bank account: ${name}`);
    return account;
  }

  async importCSV(accountId: string, csvText: string): Promise<{ imported: number; transactions: any[] }> {
    const account = await this.prisma.client.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Bank account ${accountId} not found`);

    const rows = parseBankCSV(csvText);
    if (rows.length === 0) throw new BadRequestException('No transactions in CSV');

    const txns = await this.prisma.client.$transaction(rows.map(row =>
      this.prisma.client.bankTxn.create({ data: { bankAccountId: accountId, postedAt: row.date, amount: row.amount, description: row.description, ref: row.ref, reconciled: false } })
    ));

    this.logger.log(`Imported ${txns.length} transactions`);
    return { imported: txns.length, transactions: txns };
  }

  async matchTransaction(bankTxnId: string, source: 'PAYMENT' | 'REFUND' | 'CASH_SAFE_DROP' | 'CASH_PICKUP', sourceId: string, userId: string) {
    const bankTxn = await this.prisma.client.bankTxn.findUnique({ where: { id: bankTxnId } });
    if (!bankTxn) throw new NotFoundException(`Bank txn ${bankTxnId} not found`);
    if (bankTxn.reconciled) throw new BadRequestException('Already reconciled');

    const match = await this.prisma.client.reconcileMatch.create({ data: { bankTxnId, source, sourceId, matchedById: userId } });
    await this.prisma.client.bankTxn.update({ where: { id: bankTxnId }, data: { reconciled: true } });

    this.logger.log(`Matched bank txn ${bankTxnId} to ${source} ${sourceId}`);
    return match;
  }

  async autoMatch(accountId: string, fromDate?: Date, toDate?: Date) {
    const account = await this.prisma.client.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);

    const bankTxns = await this.prisma.client.bankTxn.findMany({
      where: { bankAccountId: accountId, reconciled: false, ...(fromDate && { postedAt: { gte: fromDate } }), ...(toDate && { postedAt: { lte: toDate } }) },
      orderBy: { postedAt: 'asc' },
    });

    let matchCount = 0;
    for (const txn of bankTxns) {
      const payment = await this.prisma.client.payment.findFirst({
        where: { amount: Math.abs(+txn.amount), status: 'completed', createdAt: { gte: new Date(txn.postedAt.getTime() - 3*86400000), lte: new Date(txn.postedAt.getTime() + 3*86400000) } }
      });

      if (payment && !(await this.prisma.client.reconcileMatch.findFirst({ where: { source: 'PAYMENT', sourceId: payment.id } }))) {
        await this.prisma.client.reconcileMatch.create({ data: { bankTxnId: txn.id, source: 'PAYMENT', sourceId: payment.id, matchedById: null } });
        await this.prisma.client.bankTxn.update({ where: { id: txn.id }, data: { reconciled: true } });
        matchCount++;
        continue;
      }

      const refund = await this.prisma.client.refund.findFirst({
        where: { amount: Math.abs(+txn.amount), status: 'COMPLETED', createdAt: { gte: new Date(txn.postedAt.getTime() - 3*86400000), lte: new Date(txn.postedAt.getTime() + 3*86400000) } }
      });

      if (refund && !(await this.prisma.client.reconcileMatch.findFirst({ where: { source: 'REFUND', sourceId: refund.id } }))) {
        await this.prisma.client.reconcileMatch.create({ data: { bankTxnId: txn.id, source: 'REFUND', sourceId: refund.id, matchedById: null } });
        await this.prisma.client.bankTxn.update({ where: { id: txn.id }, data: { reconciled: true } });
        matchCount++;
      }
    }

    this.logger.log(`Auto-matched ${matchCount} transactions`);
    return { matched: matchCount };
  }

  async getUnreconciled(accountId?: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    return this.prisma.client.bankTxn.findMany({
      where: { ...(accountId && { bankAccountId: accountId }), reconciled: false, ...(fromDate && { postedAt: { gte: fromDate } }), ...(toDate && { postedAt: { lte: toDate } }) },
      include: { bankAccount: { select: { name: true, currencyCode: true } } },
      orderBy: { postedAt: 'desc' },
    });
  }

  async listAccounts(orgId: string) {
    return this.prisma.client.bankAccount.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
  }
}
