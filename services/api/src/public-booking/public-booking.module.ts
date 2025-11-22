import { Module } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';
import { ReservationsService } from '../reservations/reservations.service';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [PublicBookingController],
  providers: [ReservationsService, BookingsService, PrismaService],
})
export class PublicBookingModule {}
