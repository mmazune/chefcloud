/**
 * M20: Customer Feedback Controller
 *
 * Endpoints for customer feedback submission and NPS analytics.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { FeedbackService } from './feedback.service';
import {
  CreatePublicFeedbackDto,
  CreateFeedbackDto,
  ListFeedbackQueryDto,
  NpsSummaryQueryDto,
  TopCommentsQueryDto,
} from './dto/feedback.dto';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * POST /public/feedback
   * Submit anonymous feedback (no auth required)
   *
   * Rate limited: 10 submissions per hour per IP
   * Access: Public
   */
  @Post('/public')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 per hour
  @HttpCode(HttpStatus.CREATED)
  async submitPublicFeedback(@Body() dto: CreatePublicFeedbackDto) {
    const feedback = await this.feedbackService.createPublicFeedback(dto);

    return {
      id: feedback.id,
      message: 'Thank you for your feedback!',
      npsCategory: feedback.npsCategory,
    };
  }

  /**
   * POST /feedback
   * Submit authenticated feedback
   *
   * Access: L1-L5, HR (all authenticated users)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L1', 'L2', 'L3', 'L4', 'L5', 'HR')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(@CurrentUser() user: any, @Body() dto: CreateFeedbackDto) {
    const feedback = await this.feedbackService.createFeedback(dto, {
      userId: user.id,
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
    });

    return {
      id: feedback.id,
      orgId: feedback.orgId,
      branchId: feedback.branchId,
      score: feedback.score,
      npsCategory: feedback.npsCategory,
      createdAt: feedback.createdAt,
    };
  }

  /**
   * GET /feedback
   * List feedback with filters
   *
   * Access: L4+ (Managers, Owners, HR)
   * Branch scoping: L4 managers see only their branches
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L4', 'L5', 'HR')
  async listFeedback(@CurrentUser() user: any, @Query() query: ListFeedbackQueryDto) {
    const isOrgLevel = user.roleLevel === 'L5' || user.roles?.includes('HR');

    return this.feedbackService.listFeedback(query, {
      userId: user.id,
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
      isOrgLevel,
    });
  }

  /**
   * GET /feedback/:id
   * View single feedback record
   *
   * Access: L4+ (Managers, Owners, HR) or creator
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L1', 'L2', 'L3', 'L4', 'L5', 'HR')
  async getFeedback(@CurrentUser() user: any, @Param('id') id: string) {
    const isOrgLevel = user.roleLevel === 'L5' || user.roles?.includes('HR');

    const feedback = await this.feedbackService.getFeedbackById(id, {
      userId: user.id,
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
      isOrgLevel,
    });

    // Additional RBAC: L1-L3 can only view own feedback
    if (!isOrgLevel && user.roleLevel !== 'L4') {
      if (feedback.createdById !== user.id) {
        throw new NotFoundException('Feedback not found');
      }
    }

    return feedback;
  }

  /**
   * GET /feedback/nps-summary
   * Get NPS metrics for a period
   *
   * Access: L4+ (Managers, Owners, HR, Accountants)
   */
  @Get('/analytics/nps-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L4', 'L5', 'HR', 'ACCOUNTANT')
  async getNpsSummary(@CurrentUser() user: any, @Query() query: NpsSummaryQueryDto) {
    return this.feedbackService.getNpsSummary(query, {
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
    });
  }

  /**
   * GET /feedback/breakdown
   * Get feedback score distribution
   *
   * Access: L4+ (Managers, Owners, HR)
   */
  @Get('/analytics/breakdown')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L4', 'L5', 'HR')
  async getBreakdown(@CurrentUser() user: any, @Query() query: NpsSummaryQueryDto) {
    return this.feedbackService.getFeedbackBreakdown(query, {
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
    });
  }

  /**
   * GET /feedback/top-comments
   * Get sample comments (positive/negative)
   *
   * Access: L4+ (Managers, Owners, HR)
   */
  @Get('/analytics/top-comments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('L4', 'L5', 'HR')
  async getTopComments(@CurrentUser() user: any, @Query() query: TopCommentsQueryDto) {
    return this.feedbackService.getTopComments(query, {
      orgId: user.orgId,
      branchIds: user.branches?.map((b: any) => b.id),
    });
  }
}
