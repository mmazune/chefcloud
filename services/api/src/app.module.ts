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
import { WebAuthnModule } from './webauthn/webauthn.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksController } from './webhooks.controller';
import { EfrisModule } from './efris/efris.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReservationsModule } from './reservations/reservations.module';

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
    WebAuthnModule,
    PaymentsModule,
    EfrisModule,
    AlertsModule,
    ReservationsModule,
  ],
  controllers: [HealthController, WebhooksController],
  providers: [PrismaService],
})
export class AppModule {}
