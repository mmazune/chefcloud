import { Controller, Get, Query } from '@nestjs/common';

@Controller('reservations-test')
export class ReservationsAvailabilityTestController {
  @Get('availability')
  getAvailability(
    @Query('date') date: string,
    @Query('party') party: string
  ) {
    // Simple mock rule: tables with seats >= party are "available"
    const size = Number(party ?? '2');
    const slots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
    return {
      ok: true,
      date,
      party: size,
      slots: size <= 4 ? slots : slots.filter((_, i) => i % 2 === 0),
    };
  }
}
