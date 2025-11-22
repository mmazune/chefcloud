/**
 * E42-s2: Check-in Controller
 *
 * REST endpoints for QR code check-in and ticket PDF download.
 */

import { Controller, Post, Get, Body, Param, Res, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CheckinService } from './checkin.service';
import { BookingsService } from './bookings.service';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('events')
export class CheckinController {
  constructor(
    private readonly checkinService: CheckinService,
    private readonly bookingsService: BookingsService,
  ) {}

  /**
   * POST /events/checkin
   * Check in a guest using QR code ticketCode
   * L2+ (Cashier/Supervisor)
   */
  @Post('checkin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L2', 'L3', 'L4', 'L5')
  @UseInterceptors(IdempotencyInterceptor)
  async checkin(
    @Body() body: { ticketCode: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Request() req: any,
  ) {
    return this.checkinService.checkin(body.ticketCode, req.user.id);
  }

  /**
   * GET /events/booking/:id/ticket
   * Download PDF ticket with QR code
   * L2+ (or owner via secret token - not implemented here for simplicity)
   */
  @Get('booking/:id/ticket')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L2', 'L3', 'L4', 'L5')
  async downloadTicket(@Param('id') bookingId: string, @Res() res: Response) {
    // Verify booking exists
    await this.checkinService.getBookingForTicket(bookingId);

    // Generate PDF
    const pdfBuffer = await this.bookingsService.generateTicketPdf(bookingId);

    // Stream PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${bookingId}.pdf"`);
    res.send(pdfBuffer);
  }
}
