import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BankRecService } from './bank-rec.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User } from '../me/user.decorator';

@Controller('accounting/bank')
@UseGuards(RolesGuard)
export class BankRecController {
  constructor(private readonly bankRecService: BankRecService) {}

  @Post('accounts')
  @Roles('L4', 'L5')
  async upsertAccount(@User() user: any, @Body() body: { name: string; currencyCode?: string; lastFour?: string }) {
    const account = await this.bankRecService.upsertBankAccount(user.orgId, body.name, body.currencyCode, body.lastFour);
    return { success: true, account };
  }

  @Get('accounts')
  @Roles('L4', 'L5')
  async listAccounts(@User() user: any) {
    const accounts = await this.bankRecService.listAccounts(user.orgId);
    return { success: true, accounts };
  }

  @Post(':accountId/import-csv')
  @Roles('L4', 'L5')
  async importCSV(@Param('accountId') accountId: string, @Body() body: { csv: string }): Promise<any> {
    const result = await this.bankRecService.importCSV(accountId, body.csv);
    return { success: true, ...result };
  }

  @Post('match')
  @Roles('L4', 'L5')
  async matchTransaction(@User() user: any, @Body() body: { bankTxnId: string; source: 'PAYMENT' | 'REFUND' | 'CASH_SAFE_DROP' | 'CASH_PICKUP'; sourceId: string }) {
    const match = await this.bankRecService.matchTransaction(body.bankTxnId, body.source, body.sourceId, user.id);
    return { success: true, match };
  }

  @Post(':accountId/auto-match')
  @Roles('L4', 'L5')
  async autoMatch(@Param('accountId') accountId: string, @Body() body?: { fromDate?: string; toDate?: string }) {
    const result = await this.bankRecService.autoMatch(accountId, body?.fromDate ? new Date(body.fromDate) : undefined, body?.toDate ? new Date(body.toDate) : undefined);
    return { success: true, ...result };
  }

  @Get('unreconciled')
  @Roles('L4', 'L5')
  async getUnreconciled(@Query('accountId') accountId?: string, @Query('from') from?: string, @Query('to') to?: string): Promise<any> {
    const txns = await this.bankRecService.getUnreconciled(accountId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return { success: true, transactions: txns, count: txns.length };
  }
}
