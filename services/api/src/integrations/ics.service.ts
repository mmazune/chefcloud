/**
 * M9.5: ICS Calendar Service
 *
 * Generates ICS calendar feeds for confirmed reservations.
 * Tokenized access with CALENDAR_READ scope.
 */
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

export interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: Date;
  dtend: Date;
  created: Date;
}

@Injectable()
export class IcsService {
  private readonly logger = new Logger(IcsService.name);

  constructor(private prisma: PrismaService) { }

  /**
   * Generate a calendar feed token for a branch
   */
  async generateFeedToken(branchId: string, expiresInDays?: number) {
    // Verify branch exists
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const feedToken = await this.prisma.client.calendarFeedToken.create({
      data: {
        branchId,
        token,
        scope: 'CALENDAR_READ',
        expiresAt,
      },
    });

    this.logger.log(`Generated calendar feed token for branch ${branchId}`);
    return feedToken;
  }

  /**
   * Validate a feed token and return the branch
   */
  async validateFeedToken(token: string) {
    const feedToken = await this.prisma.client.calendarFeedToken.findUnique({
      where: { token },
      include: { branch: true },
    });

    if (!feedToken) {
      throw new UnauthorizedException('Invalid calendar token');
    }

    if (feedToken.expiresAt && feedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Calendar token expired');
    }

    if (feedToken.scope !== 'CALENDAR_READ') {
      throw new UnauthorizedException('Invalid token scope');
    }

    return feedToken.branch;
  }

  /**
   * Get confirmed reservations for a branch as ICS events
   */
  async getReservationsAsICS(branchId: string, from: Date, to: Date): Promise<ICSEvent[]> {
    // First get branch info
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
    });

    const reservations = await this.prisma.client.reservation.findMany({
      where: {
        branchId,
        status: { in: ['CONFIRMED', 'SEATED'] },
        startAt: { gte: from, lte: to },
      },
      include: {
        deposits: true,
      },
      orderBy: { startAt: 'asc' },
    });

    return reservations.map((r) => ({
      uid: `reservation-${r.id}@nimbus.pos`,
      summary: `${r.partySize} guests - ${r.name}`,
      description: this.buildDescription({
        ...r,
        deposit: r.deposits?.[0] || null,
      }),
      location: branch?.address || branch?.name || 'Unknown location',
      dtstart: r.startAt,
      dtend: r.endAt,
      created: r.createdAt,
    }));
  }

  /**
   * Build ICS description with reservation details
   */
  private buildDescription(reservation: {
    name: string;
    phone: string | null;
    notes: string | null;
    source: string;
    status: string;
    deposit?: { status: string } | null;
  }): string {
    const lines = [
      `Guest: ${reservation.name}`,
      reservation.phone ? `Phone: ${reservation.phone}` : null,
      `Source: ${reservation.source}`,
      `Status: ${reservation.status}`,
      reservation.deposit ? `Deposit: ${reservation.deposit.status}` : null,
      reservation.notes ? `Notes: ${reservation.notes}` : null,
    ];

    return lines.filter(Boolean).join('\\n');
  }

  /**
   * Generate ICS file content
   */
  generateICSContent(events: ICSEvent[], branchName: string): string {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NimbusPOS//ChefCloud//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeICS(branchName)} Reservations`,
    ];

    for (const event of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${event.uid}`,
        `DTSTAMP:${this.formatICSDate(new Date())}`,
        `DTSTART:${this.formatICSDate(event.dtstart)}`,
        `DTEND:${this.formatICSDate(event.dtend)}`,
        `CREATED:${this.formatICSDate(event.created)}`,
        `SUMMARY:${this.escapeICS(event.summary)}`,
        `DESCRIPTION:${this.escapeICS(event.description)}`,
        `LOCATION:${this.escapeICS(event.location)}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Format date for ICS (UTC)
   */
  private formatICSDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for ICS
   */
  private escapeICS(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * List tokens for a branch
   */
  async listFeedTokens(branchId: string) {
    return this.prisma.client.calendarFeedToken.findMany({
      where: { branchId },
      select: {
        id: true,
        scope: true,
        expiresAt: true,
        createdAt: true,
        // Note: token not returned in list
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a feed token
   */
  async revokeFeedToken(tokenId: string, branchId: string) {
    const token = await this.prisma.client.calendarFeedToken.findFirst({
      where: { id: tokenId, branchId },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    await this.prisma.client.calendarFeedToken.delete({
      where: { id: tokenId },
    });

    this.logger.log(`Revoked calendar feed token ${tokenId}`);
    return { deleted: true };
  }
}
