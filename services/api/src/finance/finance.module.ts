import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { CostInsightsService } from './cost-insights.service';
import { BudgetController } from './budget.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [BudgetService, CostInsightsService, PrismaService],
  controllers: [BudgetController],
  exports: [BudgetService, CostInsightsService],
})
export class FinanceModule {}
