import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WaiterMetricsService } from './waiter-metrics.service';
import { StaffInsightsService } from './staff-insights.service';
import { PromotionInsightsService } from './promotion-insights.service';
import { StaffController } from './staff.controller';
import { StaffInsightsController } from './staff-insights.controller';
import { PromotionInsightsController } from './promotion-insights.controller';
import { AntiTheftModule } from '../anti-theft/anti-theft.module';
// import { AttendanceService } from '../hr/attendance.service'; // Unused for now

@Module({
  imports: [forwardRef(() => AntiTheftModule)],
  providers: [
    PrismaService,
    WaiterMetricsService,
    StaffInsightsService,
    PromotionInsightsService,
    // AttendanceService, // Unused for now
  ],
  controllers: [StaffController, StaffInsightsController, PromotionInsightsController],
  exports: [WaiterMetricsService, StaffInsightsService, PromotionInsightsService],
})
export class StaffModule {}
