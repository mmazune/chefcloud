import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma.service';
import { AccountingModule } from '../accounting/accounting.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryAnalyticsService } from '../inventory/inventory-analytics.service';

@Module({
  imports: [AccountingModule, FinanceModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, InventoryAnalyticsService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
