/**
 * E42-s1: Bookings Module
 *
 * Provides public event booking portal and admin event management.
 */

import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PublicBookingsController } from './public-bookings.controller';
import { CheckinService } from './checkin.service'; // E42-s2
import { CheckinController } from './checkin.controller'; // E42-s2
import { PrismaService } from '../prisma.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController, PublicBookingsController, CheckinController], // E42-s2
  providers: [BookingsService, CheckinService, PrismaService], // E42-s2
  exports: [BookingsService, CheckinService], // E42-s2
})
export class BookingsModule {}
