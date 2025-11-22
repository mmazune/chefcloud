import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreatePublicFeedbackDto,
  CreateFeedbackDto,
  ListFeedbackQueryDto,
  NpsSummaryQueryDto,
  TopCommentsQueryDto,
  NpsSummary,
  ScoreBreakdown,
  EntityVerification,
} from './dto/feedback.dto';
import { FeedbackChannel, NpsCategory, Feedback } from '@prisma/client';

/**
 * M20: Customer Feedback & NPS Service
 *
 * Core service for customer feedback management:
 * - Create feedback (public and authenticated)
 * - List and filter feedback
 * - Calculate NPS scores
 * - Generate score breakdowns
 * - Provide top comments samples
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Classify NPS score into category
   * @param score 0-10 integer
   * @returns NpsCategory (DETRACTOR, PASSIVE, PROMOTER)
   */
  private classifyNps(score: number): NpsCategory {
    if (score >= 0 && score <= 6) return NpsCategory.DETRACTOR;
    if (score >= 7 && score <= 8) return NpsCategory.PASSIVE;
    if (score >= 9 && score <= 10) return NpsCategory.PROMOTER;
    throw new BadRequestException('Invalid NPS score. Must be between 0 and 10.');
  }

  /**
   * Verify entity link for public feedback
   * Validates that order/reservation/event exists and returns org/branch context
   */
  async verifyEntityLink(input: {
    orderNumber?: string;
    reservationId?: string;
    ticketCode?: string;
  }): Promise<EntityVerification> {
    // Check if exactly one identifier is provided
    const identifiers = [input.orderNumber, input.reservationId, input.ticketCode].filter(Boolean);
    if (identifiers.length === 0) {
      throw new BadRequestException('Must provide orderNumber, reservationId, or ticketCode');
    }
    if (identifiers.length > 1) {
      throw new BadRequestException('Provide only one of: orderNumber, reservationId, ticketCode');
    }

    // Verify order
    if (input.orderNumber) {
      const order = await this.prisma.order.findFirst({
        where: { orderNumber: input.orderNumber },
        select: {
          id: true,
          branchId: true,
          branch: { select: { orgId: true } },
          feedback: { select: { id: true } },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order ${input.orderNumber} not found`);
      }

      if (order.feedback) {
        throw new BadRequestException('Feedback already submitted for this order');
      }

      return {
        orgId: order.branch.orgId,
        branchId: order.branchId,
        entityId: order.id,
        entityType: 'order',
      };
    }

    // Verify reservation
    if (input.reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          id: true,
          orgId: true,
          branchId: true,
          feedback: { select: { id: true } },
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.feedback) {
        throw new BadRequestException('Feedback already submitted for this reservation');
      }

      return {
        orgId: reservation.orgId,
        branchId: reservation.branchId,
        entityId: reservation.id,
        entityType: 'reservation',
      };
    }

    // Verify event booking (ticket code)
    if (input.ticketCode) {
      const eventBooking = await this.prisma.eventBooking.findUnique({
        where: { ticketCode: input.ticketCode },
        select: {
          id: true,
          event: { select: { orgId: true, branchId: true } },
          feedback: { select: { id: true } },
        },
      });

      if (!eventBooking) {
        throw new NotFoundException('Event ticket not found');
      }

      if (eventBooking.feedback) {
        throw new BadRequestException('Feedback already submitted for this event booking');
      }

      return {
        orgId: eventBooking.event.orgId,
        branchId: eventBooking.event.branchId,
        entityId: eventBooking.id,
        entityType: 'eventBooking',
      };
    }

    throw new BadRequestException('Invalid entity reference');
  }

  /**
   * Create public feedback (anonymous, no auth)
   */
  async createPublicFeedback(dto: CreatePublicFeedbackDto): Promise<Feedback> {
    // Verify entity link
    const verification = await this.verifyEntityLink({
      orderNumber: dto.orderNumber,
      reservationId: dto.reservationId,
      ticketCode: dto.ticketCode,
    });

    // Derive NPS category from score
    const npsCategory = this.classifyNps(dto.score);

    // Create feedback record
    const feedback = await this.prisma.feedback.create({
      data: {
        orgId: verification.orgId,
        branchId: verification.branchId,
        orderId: verification.entityType === 'order' ? verification.entityId : undefined,
        reservationId: verification.entityType === 'reservation' ? verification.entityId : undefined,
        eventBookingId: verification.entityType === 'eventBooking' ? verification.entityId : undefined,
        channel: dto.channel,
        score: dto.score,
        npsCategory,
        comment: dto.comment,
        tags: dto.tags || [],
        createdById: null, // Anonymous
      },
      include: {
        org: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return feedback;
  }

  /**
   * Create authenticated feedback
   */
  async createFeedback(
    dto: CreateFeedbackDto,
    context: { userId: string; orgId: string; branchIds?: string[] },
  ): Promise<Feedback> {
    // Validate entity ownership
    const entityId = dto.orderId || dto.reservationId || dto.eventBookingId;
    if (!entityId) {
      throw new BadRequestException('Must provide orderId, reservationId, or eventBookingId');
    }

    let orgId: string;
    let branchId: string | undefined;

    // Verify order
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        select: {
          id: true,
          branchId: true,
          branch: { select: { orgId: true } },
          feedback: { select: { id: true } },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.branch.orgId !== context.orgId) {
        throw new ForbiddenException('Cannot submit feedback for orders in other organizations');
      }

      if (order.feedback) {
        throw new BadRequestException('Feedback already submitted for this order');
      }

      orgId = order.branch.orgId;
      branchId = order.branchId;
    } else if (dto.reservationId) {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: dto.reservationId },
        select: {
          id: true,
          orgId: true,
          branchId: true,
          feedback: { select: { id: true } },
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.orgId !== context.orgId) {
        throw new ForbiddenException('Cannot submit feedback for reservations in other organizations');
      }

      if (reservation.feedback) {
        throw new BadRequestException('Feedback already submitted for this reservation');
      }

      orgId = reservation.orgId;
      branchId = reservation.branchId;
    } else {
      // Event booking
      const eventBooking = await this.prisma.eventBooking.findUnique({
        where: { id: dto.eventBookingId },
        select: {
          id: true,
          event: { select: { orgId: true, branchId: true } },
          feedback: { select: { id: true } },
        },
      });

      if (!eventBooking) {
        throw new NotFoundException('Event booking not found');
      }

      if (eventBooking.event.orgId !== context.orgId) {
        throw new ForbiddenException('Cannot submit feedback for event bookings in other organizations');
      }

      if (eventBooking.feedback) {
        throw new BadRequestException('Feedback already submitted for this event booking');
      }

      orgId = eventBooking.event.orgId;
      branchId = eventBooking.event.branchId;
    }

    // Derive NPS category
    const npsCategory = this.classifyNps(dto.score);

    // Create feedback
    const feedback = await this.prisma.feedback.create({
      data: {
        orgId,
        branchId,
        orderId: dto.orderId,
        reservationId: dto.reservationId,
        eventBookingId: dto.eventBookingId,
        channel: dto.channel,
        score: dto.score,
        npsCategory,
        comment: dto.comment,
        tags: dto.tags || [],
        sentimentHint: dto.sentimentHint,
        createdById: context.userId,
      },
      include: {
        org: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return feedback;
  }

  /**
   * List feedback with filters and RBAC
   */
  async listFeedback(
    query: ListFeedbackQueryDto,
    context: { userId: string; orgId: string; branchIds?: string[]; isOrgLevel: boolean },
  ): Promise<{ items: Feedback[]; total: number; limit: number; offset: number }> {
    const where: any = {
      orgId: context.orgId,
    };

    // Branch scoping (L4 managers can only see their branches)
    if (!context.isOrgLevel && context.branchIds && context.branchIds.length > 0) {
      where.branchId = { in: context.branchIds };
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }

    // Date range
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    // Score range
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = {};
      if (query.minScore !== undefined) where.score.gte = query.minScore;
      if (query.maxScore !== undefined) where.score.lte = query.maxScore;
    }

    // Channel filter
    if (query.channel) {
      where.channel = query.channel;
    }

    // Has comment filter
    if (query.hasComment !== undefined) {
      where.comment = query.hasComment ? { not: null } : null;
    }

    // NPS category filter
    if (query.npsCategory) {
      where.npsCategory = query.npsCategory;
    }

    // Fetch feedback
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
          reservation: { select: { id: true, name: true, phone: true } },
          eventBooking: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      items,
      total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(
    id: string,
    context: { userId: string; orgId: string; branchIds?: string[]; isOrgLevel: boolean },
  ): Promise<Feedback> {
    const feedback = await this.prisma.feedback.findUnique({
      where: { id },
      include: {
        org: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        reservation: { select: { id: true, name: true, phone: true, startAt: true } },
        eventBooking: { select: { id: true, name: true, phone: true, ticketCode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // RBAC: Check org membership
    if (feedback.orgId !== context.orgId) {
      throw new ForbiddenException('Access denied');
    }

    // RBAC: Check branch access (L4 managers)
    if (!context.isOrgLevel && context.branchIds && context.branchIds.length > 0) {
      if (!feedback.branchId || !context.branchIds.includes(feedback.branchId)) {
        throw new ForbiddenException('Access denied to this branch feedback');
      }
    }

    // RBAC: Check creator (if L1-L3 staff viewing own feedback)
    // This would be handled by controller logic

    return feedback;
  }

  /**
   * Calculate NPS summary
   */
  async getNpsSummary(query: NpsSummaryQueryDto, context: { orgId: string; branchIds?: string[] }): Promise<NpsSummary> {
    const where: any = {
      orgId: context.orgId,
      createdAt: {
        gte: new Date(query.from),
        lte: new Date(query.to),
      },
    };

    // Branch filter
    if (query.branchId) {
      where.branchId = query.branchId;
    } else if (context.branchIds && context.branchIds.length > 0) {
      where.branchId = { in: context.branchIds };
    }

    // Channel filter
    if (query.channel) {
      where.channel = query.channel;
    }

    // Fetch feedback scores and categories
    const feedbackList = await this.prisma.feedback.findMany({
      where,
      select: { score: true, npsCategory: true },
    });

    return this.calculateNpsSummary(feedbackList, {
      from: new Date(query.from),
      to: new Date(query.to),
      branchId: query.branchId,
      channel: query.channel,
    });
  }

  /**
   * Calculate NPS from feedback list (helper method)
   */
  calculateNpsSummary(
    feedbackList: Array<{ score: number; npsCategory: NpsCategory }>,
    filters: { from: Date; to: Date; branchId?: string; channel?: FeedbackChannel },
  ): NpsSummary {
    const promoterCount = feedbackList.filter((f) => f.npsCategory === NpsCategory.PROMOTER).length;
    const passiveCount = feedbackList.filter((f) => f.npsCategory === NpsCategory.PASSIVE).length;
    const detractorCount = feedbackList.filter((f) => f.npsCategory === NpsCategory.DETRACTOR).length;
    const totalCount = feedbackList.length;

    const promoterPct = totalCount > 0 ? (promoterCount / totalCount) * 100 : 0;
    const detractorPct = totalCount > 0 ? (detractorCount / totalCount) * 100 : 0;
    const passivePct = totalCount > 0 ? (passiveCount / totalCount) * 100 : 0;

    const nps = promoterPct - detractorPct;

    const avgScore =
      totalCount > 0 ? feedbackList.reduce((sum, f) => sum + f.score, 0) / totalCount : 0;

    return {
      nps: Math.round(nps),
      promoterCount,
      passiveCount,
      detractorCount,
      totalCount,
      promoterPct: Math.round(promoterPct * 10) / 10,
      passivePct: Math.round(passivePct * 10) / 10,
      detractorPct: Math.round(detractorPct * 10) / 10,
      avgScore: Math.round(avgScore * 10) / 10,
      period: {
        from: filters.from,
        to: filters.to,
      },
      filters: {
        branchId: filters.branchId,
        channel: filters.channel,
      },
    };
  }

  /**
   * Get feedback breakdown by score
   */
  async getFeedbackBreakdown(
    query: NpsSummaryQueryDto,
    context: { orgId: string; branchIds?: string[] },
  ): Promise<ScoreBreakdown> {
    const where: any = {
      orgId: context.orgId,
      createdAt: {
        gte: new Date(query.from),
        lte: new Date(query.to),
      },
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    } else if (context.branchIds && context.branchIds.length > 0) {
      where.branchId = { in: context.branchIds };
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    // Group by score
    const result = await this.prisma.feedback.groupBy({
      by: ['score'],
      where,
      _count: { score: true },
    });

    const totalCount = result.reduce((sum, r) => sum + r._count.score, 0);

    // Create breakdown for all scores 0-10
    const breakdown = Array.from({ length: 11 }, (_, score) => {
      const entry = result.find((r) => r.score === score);
      const count = entry ? entry._count.score : 0;
      const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;

      return {
        score,
        count,
        percentage: Math.round(percentage * 10) / 10,
      };
    });

    return {
      breakdown,
      totalCount,
    };
  }

  /**
   * Get top comments (sample)
   */
  async getTopComments(
    query: TopCommentsQueryDto,
    context: { orgId: string; branchIds?: string[] },
  ): Promise<{ comments: Array<{ id: string; score: number; comment: string; createdAt: Date; channel: FeedbackChannel }>; total: number }> {
    const where: any = {
      orgId: context.orgId,
      createdAt: {
        gte: new Date(query.from),
        lte: new Date(query.to),
      },
      comment: { not: null },
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    } else if (context.branchIds && context.branchIds.length > 0) {
      where.branchId = { in: context.branchIds };
    }

    // Sentiment filter (basic heuristic)
    if (query.sentiment === 'positive') {
      where.score = { gte: 9 }; // Promoters
    } else if (query.sentiment === 'negative') {
      where.score = { lte: 6 }; // Detractors
    }

    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        select: {
          id: true,
          score: true,
          comment: true,
          createdAt: true,
          channel: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit || 10,
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      comments: items.map((item) => ({
        id: item.id,
        score: item.score,
        comment: item.comment!,
        createdAt: item.createdAt,
        channel: item.channel,
      })),
      total,
    };
  }
}
