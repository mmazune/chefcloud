/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { ReservationsService } from '../reservations/reservations.service';
import { BookingsService } from '../bookings/bookings.service';
import { CreateReservationDto } from '../reservations/reservations.dto';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

// M15: Public booking portal (no authentication required)
// Rate limiting should be applied at nginx/API gateway level
@Controller('public')
export class PublicBookingController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * GET /public/availability
   * Check table availability for given date/time/partySize
   */
  @Get('availability')
  async checkAvailability(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Query('time') time: string,
    @Query('partySize') partySize: string,
  ): Promise<any> {
    if (!branchId || !date || !time || !partySize) {
      throw new BadRequestException('Missing required parameters: branchId, date, time, partySize');
    }

    const dateTime = new Date(`${date}T${time}`);
    if (isNaN(dateTime.getTime())) {
      throw new BadRequestException('Invalid date/time format');
    }

    // TODO: Implement availability check via floor service
    return {
      available: true,
      message: 'Availability check not yet implemented',
      branchId,
      dateTime,
      partySize: parseInt(partySize, 10),
    };
  }

  /**
   * POST /public/reservations
   * Create reservation request from booking portal (HELD status)
   */
  @Post('reservations')
  @UseInterceptors(IdempotencyInterceptor)
  async createReservation(@Body() dto: CreateReservationDto): Promise<any> {
    // Force source to WEB for public bookings
    const publicDto = {
      ...dto,
      source: 'WEB' as any,
    };

    // Get orgId from branchId (public API doesn't have orgId in token)
    const branch = await this.reservationsService['prisma'].branch.findUnique({
      where: { id: dto.branchId },
      select: { orgId: true },
    });

    if (!branch) {
      throw new BadRequestException('Invalid branchId');
    }

    return this.reservationsService.create(branch.orgId, publicDto);
  }

  /**
   * GET /public/events
   * List published events
   */
  @Get('events')
  async listPublishedEvents(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any> {
    // TODO: Implement event listing
    return {
      events: [],
      message: 'Event listing not yet implemented',
      filters: { branchId, from, to },
    };
  }

  /**
   * GET /public/events/:slug
   * Get event details with availability
   */
  @Get('events/:slug')
  async getPublicEvent(@Param('slug') slug: string): Promise<any> {
    if (!slug) {
      throw new BadRequestException('Missing slug parameter');
    }

    // Delegate to bookings service for event lookup
    return this.bookingsService.getPublicEvent(slug);
  }
}
