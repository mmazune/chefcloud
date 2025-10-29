/**
 * E42-s1: Bookings Module
 * 
 * Provides public event booking portal and admin event management.
 */

import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PublicBookingsController } from './public-bookings.controller';
import { PrismaService } from '../prisma.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController, PublicBookingsController],
  providers: [BookingsService, PrismaService],
  exports: [BookingsService],
})
export class BookingsModule {}
