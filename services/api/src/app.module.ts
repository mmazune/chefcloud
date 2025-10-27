import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { DeviceModule } from './device/device.module';
import { MenuModule } from './menu/menu.module';
import { FloorModule } from './floor/floor.module';
import { PosModule } from './pos/pos.module';
import { KdsModule } from './kds/kds.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasingModule } from './purchasing/purchasing.module';

@Module({
  imports: [
    AuthModule,
    MeModule,
    DeviceModule,
    MenuModule,
    FloorModule,
    PosModule,
    KdsModule,
    ShiftsModule,
    ReportsModule,
    AnalyticsModule,
    InventoryModule,
    PurchasingModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
