import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { PolicyService } from './policy.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    PolicyService,
    DepositAccountingService,
    NotificationService,
    PrismaService,
  ],
  exports: [ReservationsService, PolicyService, DepositAccountingService, NotificationService],
})
export class ReservationsModule {}
