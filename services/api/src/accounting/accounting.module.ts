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

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, PostingService],
  exports: [PostingService],
})
export class AccountingModule {}
