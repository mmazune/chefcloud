/**
 * E42-s1: Public Bookings Controller
 *
 * Public endpoints for event browsing and booking creation.
 * Rate-limited, no authentication required.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PaymentsService } from '../payments/payments.service';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * GET /public/bookings/events/:slug
   * Get published event details with available tables
   */
  @Get('events/:slug')
  async getEvent(@Param('slug') slug: string): Promise<any> {
    return this.bookingsService.getPublicEvent(slug);
  }

  /**
   * POST /public/bookings
   * Create a booking in HELD status
   */
  @Post()
  async createBooking(
    @Body()
    body: {
      eventTableId: string;
      name: string;
      phone: string;
      email?: string;
    },
  ): Promise<any> {
    const booking = await this.bookingsService.createBooking(body);

    // Create payment intent for deposit
    const deposit = Number(booking.eventTable.deposit);
    if (deposit > 0) {
      const intentResponse = await this.paymentsService.createIntent(
        {
          amount: deposit,
          provider: 'MTN', // Default to MTN, could be user-selected
          orderId: `BOOKING-${booking.id}`, // Virtual order ID for booking deposit
        },
        booking.event.orgId,
        booking.event.branchId,
      );

      // Link payment intent to booking
      await this.bookingsService.prisma.client.eventBooking.update({
        where: { id: booking.id },
        data: { depositIntentId: intentResponse.intentId },
      });

      return {
        ...booking,
        depositIntent: intentResponse,
      };
    }

    return booking;
  }

  /**
   * POST /public/bookings/:id/pay
   * Create or retrieve payment intent for deposit
   */
  @Post(':id/pay')
  async payBooking(@Param('id') id: string): Promise<any> {
    const booking = await this.bookingsService.prisma.client.eventBooking.findUnique({
      where: { id },
      include: {
        event: true,
        eventTable: true,
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.depositCaptured) {
      return { status: 'already_paid' };
    }

    // If intent already exists, return it
    if (booking.depositIntentId) {
      const intent = await this.paymentsService.prisma.client.paymentIntent.findUnique({
        where: { id: booking.depositIntentId },
      });

      if (intent) {
        return { depositIntent: intent };
      }
    }

    // Create new payment intent
    const deposit = Number(booking.eventTable.deposit);
    const intentResponse = await this.paymentsService.createIntent(
      {
        amount: deposit,
        provider: 'MTN', // Default to MTN, could be user-selected
        orderId: `BOOKING-${booking.id}`,
      },
      booking.event.orgId,
      booking.event.branchId,
    );

    // Link intent to booking
    await this.bookingsService.prisma.client.eventBooking.update({
      where: { id },
      data: { depositIntentId: intentResponse.intentId },
    });

    return { depositIntent: intentResponse };
  }

  /**
   * GET /public/bookings/:id/status
   * Get booking status (limited fields, masked PII)
   */
  @Get(':id/status')
  async getBookingStatus(@Param('id') id: string): Promise<any> {
    return this.bookingsService.getBookingStatus(id);
  }
}
