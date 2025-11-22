import { Module, forwardRef } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportGeneratorService } from './report-generator.service';
import { SubscriptionService } from './subscription.service';
import { CsvGeneratorService } from './csv-generator.service';
import { PrismaService } from '../prisma.service';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FranchiseModule } from '../franchise/franchise.module';
import { StaffModule } from '../staff/staff.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [
    forwardRef(() => DashboardsModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => FranchiseModule),
    forwardRef(() => StaffModule),
    FeedbackModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportGeneratorService,
    SubscriptionService,
    CsvGeneratorService,
    PrismaService,
  ],
  exports: [ReportsService, ReportGeneratorService, SubscriptionService, CsvGeneratorService],
})
export class ReportsModule {}
