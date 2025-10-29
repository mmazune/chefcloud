/**
 * E42-s1: Bookings Service
 * 
 * Handles events, event bookings, and prepaid credit management for public bookings portal.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingsService {
  constructor(public readonly prisma: PrismaService) {}

  /**
   * Get published event by slug (public API)
   */
  async getPublicEvent(slug: string): Promise<any> {
    const event = await this.prisma.client.event.findUnique({
      where: { slug },
      include: {
        tables: {
          where: { isActive: true },
          select: {
            id: true,
            label: true,
            capacity: true,
            price: true,
            minSpend: true,
            deposit: true,
            allowPartial: true,
          },
        },
      },
    });

    if (!event || !event.isPublished) {
      throw new NotFoundException(`Event ${slug} not found or not published`);
    }

    return event;
  }

  /**
   * Create a HELD booking (public API)
   */
  async createBooking(data: {
    eventTableId: string;
    name: string;
    phone: string;
    email?: string;
  }): Promise<any> {
    // Verify table exists and event is published
    const eventTable = await this.prisma.client.eventTable.findUnique({
      where: { id: data.eventTableId },
      include: {
        event: true,
      },
    });

    if (!eventTable || !eventTable.isActive) {
      throw new NotFoundException('Event table not found or inactive');
    }

    if (!eventTable.event.isPublished) {
      throw new BadRequestException('Event is not published');
    }

    // Calculate credit total based on policy
    const creditTotal = this.calculateCreditTotal(
      Number(eventTable.price),
      Number(eventTable.minSpend),
      Number(eventTable.deposit),
    );

    // Create booking in HELD status
    const booking = await this.prisma.client.eventBooking.create({
      data: {
        eventId: eventTable.eventId,
        eventTableId: data.eventTableId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        status: 'HELD',
        creditTotal,
      },
      include: {
        event: true,
        eventTable: true,
      },
    });

    return booking;
  }

  /**
   * Calculate credit total for a booking
   * Formula: if minSpend > 0, credit = minSpend - deposit, else credit = price - deposit
   */
  calculateCreditTotal(price: number, minSpend: number, deposit: number): number {
    if (minSpend > 0) {
      return Math.max(0, minSpend - deposit);
    }
    return Math.max(0, price - deposit);
  }

  /**
   * Get booking status (public API, limited fields)
   */
  async getBookingStatus(id: string): Promise<any> {
    const booking = await this.prisma.client.eventBooking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        depositCaptured: true,
        creditTotal: true,
        createdAt: true,
        updatedAt: true,
        // Masked PII
        name: true,
        phone: true,
        email: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Mask PII
    return {
      id: booking.id,
      status: booking.status,
      depositCaptured: booking.depositCaptured,
      creditTotal: booking.creditTotal,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      name: this.maskName(booking.name),
      phone: this.maskPhone(booking.phone),
      email: booking.email ? this.maskEmail(booking.email) : null,
    };
  }

  /**
   * Mask name (show initials only)
   */
  private maskName(name: string): string {
    const parts = name.split(' ');
    return parts.map(p => p.charAt(0).toUpperCase() + '.').join(' ');
  }

  /**
   * Mask phone (show last 4 digits only)
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 4) return phone;
    return '***' + phone.slice(-4);
  }

  /**
   * Mask email
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return local.charAt(0) + '***@' + domain;
  }

  /**
   * Manually confirm booking (L2+)
   */
  async confirmBooking(id: string, _userId: string): Promise<any> {
    const booking = await this.prisma.client.eventBooking.findUnique({
      where: { id },
      include: {
        event: true,
        eventTable: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CONFIRMED') {
      throw new BadRequestException('Booking already confirmed');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is cancelled');
    }

    // Get booking policies for credit expiry
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: booking.event.orgId },
      select: { bookingPolicies: true },
    });

    const policies = (settings?.bookingPolicies as any) || { creditExpiryHours: 12 };
    const expiryHours = policies.creditExpiryHours || 12;

    // Calculate expiry: event end time + creditExpiryHours
    const expiresAt = new Date(booking.event.endsAt);
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Update booking status and create prepaid credit
    const [updatedBooking, credit] = await this.prisma.client.$transaction([
      this.prisma.client.eventBooking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          depositCaptured: true,
        },
      }),
      this.prisma.client.prepaidCredit.create({
        data: {
          orgId: booking.event.orgId,
          branchId: booking.event.branchId,
          eventBookingId: id,
          amount: booking.creditTotal,
          consumed: 0,
          expiresAt,
        },
      }),
    ]);

    return { booking: updatedBooking, credit };
  }

  /**
   * Cancel booking (L2+/L4+ admin)
   */
  async cancelBooking(id: string): Promise<any> {
    const booking = await this.prisma.client.eventBooking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking already cancelled');
    }

    // Update status to CANCELLED
    // Note: Refund handling would be done separately via PaymentsService
    return this.prisma.client.eventBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Create or update event (L4+ admin)
   */
  async upsertEvent(data: {
    id?: string;
    orgId: string;
    branchId: string;
    slug: string;
    title: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    tables?: Array<{
      id?: string;
      label: string;
      capacity: number;
      price: number;
      minSpend: number;
      deposit: number;
      allowPartial?: boolean;
    }>;
  }): Promise<any> {
    if (data.id) {
      // Update existing event
      const event = await this.prisma.client.event.update({
        where: { id: data.id },
        data: {
          slug: data.slug,
          title: data.title,
          description: data.description,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
        },
        include: { tables: true },
      });

      // Update tables if provided
      if (data.tables) {
        for (const table of data.tables) {
          if (table.id) {
            await this.prisma.client.eventTable.update({
              where: { id: table.id },
              data: {
                label: table.label,
                capacity: table.capacity,
                price: table.price,
                minSpend: table.minSpend,
                deposit: table.deposit,
                allowPartial: table.allowPartial ?? true,
              },
            });
          } else {
            await this.prisma.client.eventTable.create({
              data: {
                eventId: event.id,
                label: table.label,
                capacity: table.capacity,
                price: table.price,
                minSpend: table.minSpend,
                deposit: table.deposit,
                allowPartial: table.allowPartial ?? true,
              },
            });
          }
        }
      }

      return event;
    } else {
      // Create new event with tables
      return this.prisma.client.event.create({
        data: {
          orgId: data.orgId,
          branchId: data.branchId,
          slug: data.slug,
          title: data.title,
          description: data.description,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          tables: data.tables
            ? {
                create: data.tables.map((t) => ({
                  label: t.label,
                  capacity: t.capacity,
                  price: t.price,
                  minSpend: t.minSpend,
                  deposit: t.deposit,
                  allowPartial: t.allowPartial ?? true,
                })),
              }
            : undefined,
        },
        include: { tables: true },
      });
    }
  }

  /**
   * Publish event (L4+ admin)
   */
  async publishEvent(id: string): Promise<any> {
    return this.prisma.client.event.update({
      where: { id },
      data: { isPublished: true },
    });
  }

  /**
   * Unpublish event (L4+ admin)
   */
  async unpublishEvent(id: string): Promise<any> {
    return this.prisma.client.event.update({
      where: { id },
      data: { isPublished: false },
    });
  }
}
