/**
 * E42-s2: Check-in Service
 * 
 * Handles QR code check-in for event bookings and prepaid credit management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CheckinService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * E42-s2: Check in a guest using ticketCode
   * - Validates event window (must be active)
   * - Marks checkedInAt/checkedInById
   * - Creates or ensures PrepaidCredit exists
   * - Returns remaining credit
   */
  async checkin(ticketCode: string, userId: string): Promise<any> {
    // Find booking by ticket code
    const booking = await this.prisma.client.eventBooking.findUnique({
      where: { ticketCode },
      include: {
        event: true,
        eventTable: true,
        credits: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Invalid ticket code');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(`Booking status is ${booking.status}, must be CONFIRMED`);
    }

    if (booking.checkedInAt) {
      throw new BadRequestException('Booking already checked in');
    }

    // Validate event window
    const now = new Date();
    if (now < booking.event.startsAt) {
      throw new BadRequestException('Event has not started yet');
    }

    if (now > booking.event.endsAt) {
      throw new BadRequestException('Event has already ended');
    }

    // Mark as checked in
    const updatedBooking = await this.prisma.client.eventBooking.update({
      where: { id: booking.id },
      data: {
        checkedInAt: now,
        checkedInById: userId,
      },
    });

    // Ensure PrepaidCredit exists (should have been created on confirmation, but idempotent)
    let credit = booking.credits[0];

    if (!credit) {
      // Create credit if missing (edge case)
      const settings = await this.prisma.client.orgSettings.findUnique({
        where: { orgId: booking.event.orgId },
        select: { bookingPolicies: true },
      });

      const policies = (settings?.bookingPolicies as any) || { creditExpiryHours: 12 };
      const expiryHours = policies.creditExpiryHours || 12;

      const expiresAt = new Date(booking.event.endsAt);
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      credit = await this.prisma.client.prepaidCredit.create({
        data: {
          orgId: booking.event.orgId,
          branchId: booking.event.branchId,
          eventBookingId: booking.id,
          amount: booking.creditTotal,
          consumed: 0,
          expiresAt,
        },
      });
    }

    const remaining = Number(credit.amount) - Number(credit.consumed);

    return {
      booking: updatedBooking,
      credit: {
        id: credit.id,
        amount: credit.amount,
        consumed: credit.consumed,
        remaining,
        expiresAt: credit.expiresAt,
      },
    };
  }

  /**
   * E42-s2: Get booking details for ticket download (L2+ or owner via secret)
   */
  async getBookingForTicket(bookingId: string): Promise<any> {
    const booking = await this.prisma.client.eventBooking.findUnique({
      where: { id: bookingId },
      include: {
        event: true,
        eventTable: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }
}
