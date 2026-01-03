/**
 * M9.4: Public Booking Controller
 * 
 * Anonymous endpoints for public reservation booking
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';
import { RateLimitGuard } from '../common/rate-limit.guard';

class PublicCreateReservationDto {
  branchSlug: string;
  date: string;
  startAt: string;
  name: string;
  phone?: string;
  partySize: number;
  notes?: string;
}

class PublicRescheduleDto {
  newStartAt: string;
}

class PublicCancelDto {
  reason?: string;
}

@Controller('public/reservations')
@UseGuards(new RateLimitGuard(10, 60000)) // 10 req/min for public endpoints
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  /**
   * Get available time slots for a branch
   * AC-01: Public availability returns slots respecting policy
   */
  @Get('availability')
  async getAvailability(
    @Query('branchSlug') branchSlug: string,
    @Query('date') date: string,
    @Query('partySize') partySize: string,
  ): Promise<{ slots: unknown[]; policy: unknown }> {
    if (!branchSlug || !date || !partySize) {
      throw new BadRequestException('branchSlug, date, and partySize are required');
    }

    return this.publicBookingService.getAvailability(
      branchSlug,
      date,
      parseInt(partySize, 10),
    );
  }

  /**
   * Create a public reservation
   * AC-02: Public create works (HELD if deposit required, CONFIRMED otherwise)
   * AC-03: Access tokens generated on reservation create
   */
  @Post()
  async createReservation(
    @Body() dto: PublicCreateReservationDto,
  ): Promise<{
    reservation: unknown;
    accessToken: string;
    manageUrl: string;
  }> {
    if (!dto.branchSlug || !dto.startAt || !dto.name || !dto.partySize) {
      throw new BadRequestException('branchSlug, startAt, name, and partySize are required');
    }

    return this.publicBookingService.createReservation(dto);
  }

  /**
   * Get reservation by ID (requires token)
   */
  @Get(':id')
  async getReservation(
    @Param('id') id: string,
    @Headers('x-access-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ): Promise<unknown> {
    const token = headerToken || queryToken;
    if (!token) {
      throw new BadRequestException('Access token required (header x-access-token or query param token)');
    }

    return this.publicBookingService.getReservation(id, token);
  }

  /**
   * Cancel a reservation (requires token)
   * AC-04: Cancel/reschedule require valid, unexpired token
   */
  @Post(':id/cancel')
  async cancelReservation(
    @Param('id') id: string,
    @Body() dto: PublicCancelDto,
    @Headers('x-access-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ): Promise<{ success: boolean; refundStatus?: string }> {
    const token = headerToken || queryToken;
    if (!token) {
      throw new BadRequestException('Access token required');
    }

    return this.publicBookingService.cancelReservation(id, token, dto.reason);
  }

  /**
   * Reschedule a reservation (requires token)
   * AC-04: Cancel/reschedule require valid, unexpired token
   */
  @Post(':id/reschedule')
  async rescheduleReservation(
    @Param('id') id: string,
    @Body() dto: PublicRescheduleDto,
    @Headers('x-access-token') headerToken?: string,
    @Query('token') queryToken?: string,
  ): Promise<{ success: boolean; newStartAt: Date; newEndAt: Date }> {
    const token = headerToken || queryToken;
    if (!token) {
      throw new BadRequestException('Access token required');
    }

    if (!dto.newStartAt) {
      throw new BadRequestException('newStartAt is required');
    }

    return this.publicBookingService.rescheduleReservation(id, token, dto);
  }

  /**
   * Get branch info for public booking page
   */
  @Get('branch/:slug')
  async getBranchInfo(@Param('slug') slug: string): Promise<unknown> {
    const branch = await this.publicBookingService.getBranchBySlug(slug);
    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      orgName: branch.org.name,
      policy: branch.reservationPolicy
        ? {
            minPartySize: branch.reservationPolicy.minPartySize,
            maxPartySize: branch.reservationPolicy.maxPartySize,
            advanceBookingDays: branch.reservationPolicy.advanceBookingDays,
            depositRequired: branch.reservationPolicy.depositRequired,
            depositMinPartySize: branch.reservationPolicy.depositMinPartySize,
          }
        : null,
    };
  }
}
