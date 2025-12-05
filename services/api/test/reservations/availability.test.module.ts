import { Module } from '@nestjs/common';
import { ReservationsAvailabilityTestController } from './availability.test.controller';

@Module({
  controllers: [ReservationsAvailabilityTestController],
})
export class ReservationsAvailabilityTestModule {}
