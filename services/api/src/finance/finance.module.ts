import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { CostInsightsService } from './cost-insights.service';
import { BudgetController } from './budget.controller';
import { PrismaService } from '../prisma.service';
import { RemindersService } from '../service-providers/reminders.service';

@Module({
  providers: [BudgetService, CostInsightsService, RemindersService, PrismaService],
  controllers: [BudgetController],
  exports: [BudgetService, CostInsightsService],
})
export class FinanceModule {}
