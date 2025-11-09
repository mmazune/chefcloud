/**
 * E40-s1: Accounting Core Module
 *
 * Provides:
 * - Vendor management (AP)
 * - Customer account management (AR)
 * - Bill and payment tracking
 * - GL reports (Trial Balance, P&L, Balance Sheet)
 * - Aging reports (AP/AR)
 */

import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { PostingService } from './posting.service';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { BankRecController } from './bank-rec.controller';
import { BankRecService } from './bank-rec.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AccountingController, PeriodsController, BankRecController],
  providers: [AccountingService, PostingService, PeriodsService, BankRecService, PrismaService],
  exports: [PostingService],
})
export class AccountingModule {}
