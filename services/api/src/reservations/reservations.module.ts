import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { PublicBookingController } from './public-booking.controller';
import { ReservationsService } from './reservations.service';
import { PolicyService } from './policy.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { NotificationService } from './notification.service';
import { AutomationService } from './automation.service';
import { HostOpsService } from './host-ops.service';
import { AccessTokenService } from './access-token.service';
import { PublicBookingService } from './public-booking.service';
import { ReportingService } from './reporting.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [ReservationsController, PublicBookingController],
  providers: [
    ReservationsService,
    PolicyService,
    DepositAccountingService,
    NotificationService,
    AutomationService,
    HostOpsService,
    AccessTokenService,
    PublicBookingService,
    ReportingService,
    PrismaService,
  ],
  exports: [
    ReservationsService,
    PolicyService,
    DepositAccountingService,
    NotificationService,
    AutomationService,
    HostOpsService,
    AccessTokenService,
    PublicBookingService,
    ReportingService,
  ],
})
export class ReservationsModule {}
