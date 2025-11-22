import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { PlatformAccessGuard } from './auth/platform-access.guard';
import { MeModule } from './me/me.module';
import { DeviceModule } from './device/device.module';
import { MenuModule } from './menu/menu.module';
import { FloorModule } from './floor/floor.module';
import { PosModule } from './pos/pos.module';
import { KdsModule } from './kds/kds.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ShiftTemplatesModule } from './shift-templates/shift-templates.module';
import { ShiftSchedulesModule } from './shift-schedules/shift-schedules.module';
import { ShiftAssignmentsModule } from './shift-assignments/shift-assignments.module';
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
import { OpsModule } from './ops/ops.module';
import { SupportModule } from './support/support.module';
import { HardwareModule } from './hardware/hardware.module';
import { OwnerModule } from './owner/owner.module';
import { StreamModule } from './stream/stream.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { ThresholdsModule } from './thresholds/thresholds.module';
import { AccessModule } from './access/access.module';
import { DevPortalModule } from './dev-portal/dev-portal.module';
import { BillingModule } from './billing/billing.module';
import { FranchiseModule } from './franchise/franchise.module';
import { BadgesModule } from './badges/badges.module';
import { KpisModule } from './kpis/kpis.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CashModule } from './cash/cash.module';
import { AccountingModule } from './accounting/accounting.module';
import { CurrencyModule } from './currency/currency.module';
import { TaxModule } from './tax/tax.module';
import { SettingsModule } from './settings/settings.module';
import { BookingsModule } from './bookings/bookings.module';
import { WorkforceModule } from './workforce/workforce.module';
import { ObservabilityModule } from './observability/observability.module';
import { MetaModule } from './meta/meta.module';
import { DocumentsModule } from './documents/documents.module'; // M18
import { FeedbackModule } from './feedback/feedback.module'; // M20
import { LoggerMiddleware } from './logger.middleware';
import { WriteBlockMiddleware } from './ops/write-block.middleware';
import { RedisService } from './common/redis.service';
import { WebhookVerificationGuard } from './common/webhook-verification.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: parseInt(process.env.RATE_LIMIT_PUBLIC || '60'),
      },
    ]),
    AuthModule,
    MeModule,
    DeviceModule,
    MenuModule,
    FloorModule,
    PosModule,
    KdsModule,
    ShiftsModule,
    ShiftTemplatesModule,
    ShiftSchedulesModule,
    ShiftAssignmentsModule,
    ReportsModule,
    AnalyticsModule,
    InventoryModule,
    PurchasingModule,
    WebAuthnModule,
    PaymentsModule,
    EfrisModule,
    AlertsModule,
    ReservationsModule,
    OpsModule,
    SupportModule,
    HardwareModule,
    OwnerModule,
    StreamModule,
    DashboardsModule,
    ThresholdsModule,
    AccessModule,
    DevPortalModule,
    BillingModule,
    FranchiseModule,
    BadgesModule,
    KpisModule,
    PromotionsModule,
    CashModule,
    AccountingModule,
    CurrencyModule,
    TaxModule,
    SettingsModule,
    BookingsModule,
    WorkforceModule,
    ObservabilityModule,
    MetaModule,
    DocumentsModule, // M18
    FeedbackModule, // M20
  ],
  controllers: [HealthController, WebhooksController],
  providers: [
    PrismaService,
    RedisService,
    WebhookVerificationGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformAccessGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    consumer.apply(WriteBlockMiddleware).forRoutes('*');
  }
}
