/**
 * M9.4: Public Booking Service
 * 
 * Handles public-facing reservation operations:
 * - Availability queries
 * - Public reservation creation
 * - Token-based cancel/reschedule
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AccessTokenService } from './access-token.service';
import { AutomationService } from './automation.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { NotificationService } from './notification.service';

interface TimeSlot {
  startAt: string;
  endAt: string;
  available: boolean;
  remainingCapacity: number;
}

interface PublicReservationDto {
  branchSlug: string;
  date: string; // ISO date string YYYY-MM-DD
  startAt: string; // ISO datetime
  name: string;
  phone?: string;
  partySize: number;
  notes?: string;
}

interface PublicRescheduleDto {
  newStartAt: string;
}

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokenService: AccessTokenService,
    private readonly automationService: AutomationService,
    private readonly depositService: DepositAccountingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Get branch by public booking slug
   */
  async getBranchBySlug(slug: string): Promise<{
    id: string;
    orgId: string;
    name: string;
    address: string | null;
    org: { id: string; name: string };
    reservationPolicy: Record<string, unknown> | null;
  }> {
    const branch = await this.prisma.client.branch.findFirst({
      where: {
        publicBookingSlug: slug,
        publicBookingEnabled: true,
      },
      include: {
        org: { select: { id: true, name: true } },
        reservationPolicy: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or public booking not enabled');
    }

    return branch as {
      id: string;
      orgId: string;
      name: string;
      address: string | null;
      org: { id: string; name: string };
      reservationPolicy: Record<string, unknown> | null;
    };
  }

  /**
   * Get available time slots for a branch on a specific date
   */
  async getAvailability(
    branchSlug: string,
    date: string,
    partySize: number,
  ): Promise<{ slots: TimeSlot[]; policy: Record<string, unknown> }> {
    const branch = await this.getBranchBySlug(branchSlug);
    const policy = branch.reservationPolicy;

    if (!policy) {
      throw new BadRequestException('No reservation policy configured for this branch');
    }

    // Validate party size (minPartySize defaults to 1 if not in schema)
    const minParty = 1;
    const maxParty = (policy as Record<string, unknown>).maxPartySize as number || 20;
    if (partySize < minParty || partySize > maxParty) {
      throw new BadRequestException(
        `Party size must be between ${minParty} and ${maxParty}`,
      );
    }

    // Parse date and generate slots
    const dateObj = new Date(date);
    const slots: TimeSlot[] = [];
    
    // Default business hours (can be extended to use branch hours)
    const openHour = 11;
    const closeHour = 22;
    const slotInterval = 30; // Default 30 min slots
    const turnTime = 90; // Default 90 min turn time
    const maxCapacity = (policy as Record<string, unknown>).maxCapacityPerSlot as number || 50;

    // Check advance booking window
    const now = new Date();
    const leadTime = (policy as Record<string, unknown>).leadTimeMinutes as number || 60;
    const minAdvance = new Date(now.getTime() + leadTime * 60 * 1000);
    const maxAdvance = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    if (dateObj < new Date(now.toDateString()) || dateObj > maxAdvance) {
      return { slots: [], policy: this.sanitizePolicy(policy) };
    }

    // Generate time slots
    for (let hour = openHour; hour < closeHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotStart = new Date(dateObj);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart.getTime() + turnTime * 60 * 1000);

        // Skip if slot is in the past or too close
        if (slotStart < minAdvance) {
          continue;
        }

        // Skip if slot ends after closing
        if (slotEnd.getHours() > closeHour || (slotEnd.getHours() === closeHour && slotEnd.getMinutes() > 0)) {
          continue;
        }

        // Check capacity
        const capacityResult = await this.automationService.checkCapacity(
          branch.id,
          slotStart,
          slotEnd,
          partySize,
        );

        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
        available: capacityResult.allowed,
        remainingCapacity: capacityResult.max ? capacityResult.max - capacityResult.current : 999,
        });
      }
    }

    return { slots, policy: this.sanitizePolicy(policy) };
  }

  /**
   * Create a public reservation
   */
  async createReservation(dto: PublicReservationDto): Promise<{
    reservation: Record<string, unknown>;
    accessToken: string;
    manageUrl: string;
  }> {
    const branch = await this.getBranchBySlug(dto.branchSlug);
    const policy = branch.reservationPolicy as Record<string, unknown> | null;

    if (!policy) {
      throw new BadRequestException('No reservation policy configured');
    }

    // Validate party size
    const maxParty = policy.maxPartySize as number || 20;
    if (dto.partySize < 1 || dto.partySize > maxParty) {
      throw new BadRequestException('Invalid party size');
    }

    const startAt = new Date(dto.startAt);
    const turnTime = 90; // Default 90 min turn time
    const endAt = new Date(startAt.getTime() + turnTime * 60 * 1000);

    // Check capacity
    const capacityResult = await this.automationService.checkCapacity(
      branch.id,
      startAt,
      endAt,
      dto.partySize,
    );

    if (!capacityResult.allowed) {
      throw new BadRequestException('This time slot is no longer available');
    }

    // Determine initial status based on policy
    const depositRequired = policy.depositRequired as boolean;
    const initialStatus = depositRequired ? 'HELD' : 'HELD'; // Always HELD for public bookings

    // Calculate auto-cancel time for HELD reservations
    const holdExpires = policy.holdExpiresMinutes as number || 30;
    const autoCancelAt = initialStatus === 'HELD'
      ? new Date(Date.now() + holdExpires * 60 * 1000)
      : null;

    // Create reservation
    const reservation = await this.prisma.client.reservation.create({
      data: {
        orgId: branch.orgId,
        branchId: branch.id,
        name: dto.name,
        phone: dto.phone,
        partySize: dto.partySize,
        startAt,
        endAt,
        status: initialStatus,
        source: 'ONLINE',
        notes: dto.notes,
        autoCancelAt,
      },
    });

    // Generate access token
    const { token } = await this.accessTokenService.generateToken(reservation.id, 'ALL', 72);

    // If deposit required, create deposit record
    if (depositRequired) {
      // Use depositAmountDefault or depositPerGuest from policy
      const depositPerGuest = policy.depositPerGuest as number || 0;
      const depositDefault = policy.depositAmountDefault as number || 0;
      const depositAmount = depositPerGuest > 0
        ? depositPerGuest * dto.partySize
        : depositDefault;

      await this.depositService.requireDeposit({
        orgId: branch.orgId,
        reservationId: reservation.id,
        amount: depositAmount,
        createdById: null, // System-created
      });
    }

    // Send confirmation notification
    await this.notificationService.send({
      orgId: branch.orgId,
      reservationId: reservation.id,
      type: 'EMAIL',
      event: 'BOOKING_CREATED',
      payload: {
        name: dto.name,
        date: startAt.toISOString(),
        partySize: dto.partySize,
        manageToken: token,
      },
    });

    // Build manage URL
    const manageUrl = `/manage/${reservation.id}?token=${token}`;

    return {
      reservation: {
        id: reservation.id,
        name: reservation.name,
        partySize: reservation.partySize,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        status: reservation.status,
        depositRequired,
      },
      accessToken: token,
      manageUrl,
    };
  }

  /**
   * Get reservation by ID with token validation
   */
  async getReservation(reservationId: string, token: string): Promise<Record<string, unknown>> {
    await this.accessTokenService.validateToken(token, 'VIEW');

    const reservation = await this.prisma.client.reservation.findUnique({
      where: { id: reservationId },
      include: {
        branch: { select: { name: true, address: true } },
        table: { select: { label: true } },
        deposits: { select: { amount: true, status: true } },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return {
      id: reservation.id,
      name: reservation.name,
      phone: reservation.phone,
      partySize: reservation.partySize,
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      status: reservation.status,
      branch: reservation.branch,
      table: reservation.table,
      depositStatus: reservation.deposits[0]?.status || 'NONE',
      notes: reservation.notes,
    };
  }

  /**
   * Cancel a reservation with token
   */
  async cancelReservation(
    reservationId: string,
    token: string,
    reason?: string,
  ): Promise<{ success: boolean; refundStatus?: string }> {
    await this.accessTokenService.validateToken(token, 'CANCEL');

    const reservation = await this.prisma.client.reservation.findUnique({
      where: { id: reservationId },
      include: { deposits: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(reservation.status)) {
      throw new BadRequestException('Reservation cannot be cancelled');
    }

    // Check cancellation policy
    const policy = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId: reservation.branchId },
    });

    let refundStatus = 'NOT_APPLICABLE';

    // Handle deposit refund if exists
    const deposit = reservation.deposits[0];
    if (deposit && deposit.status === 'PAID') {
      const hoursUntilReservation = (reservation.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
      // Use cancelCutoffMinutes from policy (default 120 = 2 hours)
      const lateCancelHours = (policy?.cancelCutoffMinutes || 120) / 60;

      if (hoursUntilReservation < lateCancelHours) {
        // Late cancellation - forfeit deposit
        await this.depositService.forfeitDeposit(deposit.id, reservation.orgId);
        refundStatus = 'FORFEITED';
      } else {
        // Eligible for refund
        await this.depositService.refundDeposit({
          orgId: reservation.orgId,
          depositId: deposit.id,
          reason: reason || 'Customer cancelled',
          refundedById: null,
        });
        refundStatus = 'REFUNDED';
      }
    }

    // Update reservation status
    await this.prisma.client.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason || 'Cancelled by customer',
      },
    });

    // Mark token as used
    await this.accessTokenService.markUsed(token);

    // Send cancellation notification
    await this.notificationService.send({
      orgId: reservation.orgId,
      reservationId,
      type: 'EMAIL',
      event: 'BOOKING_CANCELLED',
      payload: { reason, refundStatus },
    });

    return { success: true, refundStatus };
  }

  /**
   * Reschedule a reservation with token
   */
  async rescheduleReservation(
    reservationId: string,
    token: string,
    dto: PublicRescheduleDto,
  ): Promise<{ success: boolean; newStartAt: Date; newEndAt: Date }> {
    await this.accessTokenService.validateToken(token, 'RESCHEDULE');

    const reservation = await this.prisma.client.reservation.findUnique({
      where: { id: reservationId },
      include: { branch: { include: { reservationPolicy: true } } },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (['CANCELLED', 'COMPLETED', 'NO_SHOW', 'SEATED'].includes(reservation.status)) {
      throw new BadRequestException('Reservation cannot be rescheduled');
    }

    const newStartAt = new Date(dto.newStartAt);
    const turnTime = 90; // Default 90 min turn time
    const newEndAt = new Date(newStartAt.getTime() + turnTime * 60 * 1000);

    // Check capacity for new time
    const capacityResult = await this.automationService.checkCapacity(
      reservation.branchId,
      newStartAt,
      newEndAt,
      reservation.partySize,
    );

    if (!capacityResult.allowed) {
      throw new BadRequestException('The new time slot is not available');
    }

    // Update reservation
    await this.prisma.client.reservation.update({
      where: { id: reservationId },
      data: {
        startAt: newStartAt,
        endAt: newEndAt,
      },
    });

    // Send reschedule notification
    await this.notificationService.send({
      orgId: reservation.orgId,
      reservationId,
      type: 'EMAIL',
      event: 'BOOKING_MODIFIED',
      payload: {
        oldStartAt: reservation.startAt,
        newStartAt,
      },
    });

    return { success: true, newStartAt, newEndAt };
  }

  /**
   * Sanitize policy for public consumption (remove internal fields)
   */
  private sanitizePolicy(policy: Record<string, unknown>): Record<string, unknown> {
    return {
      minPartySize: policy.minPartySize,
      maxPartySize: policy.maxPartySize,
      slotIntervalMinutes: policy.slotIntervalMinutes,
      defaultDurationMinutes: policy.defaultDurationMinutes,
      advanceBookingDays: policy.advanceBookingDays,
      depositRequired: policy.depositRequired,
      depositMinPartySize: policy.depositMinPartySize,
      depositAmount: policy.depositAmount,
      depositType: policy.depositType,
    };
  }
}
