import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { DevPortalService } from './dev-portal.service';
import { DevAdminGuard } from './guards/dev-admin.guard';
import { SuperDevGuard } from './guards/super-dev.guard';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';
import { DevUsageSummaryDto } from './dto/dev-usage.dto';

/**
 * Developer Portal Controller
 * 
 * Manages organizations, subscriptions, and plans for internal dev/admin use.
 * Mutation endpoints are protected by plan-aware rate limiting.
 */
@Controller('dev')
@UseGuards(DevAdminGuard)
export class DevPortalController {
  constructor(private devPortalService: DevPortalService) {}

  /**
   * Create new organization with subscription
   * Protected by plan-aware rate limiting
   */
  @Post('orgs')
  @HttpCode(201)
  @UseGuards(PlanRateLimiterGuard)
  async createOrg(
    @Body()
    body: {
      ownerEmail: string;
      orgName: string;
      planCode: string;
    },
  ) {
    return this.devPortalService.createOrg(body);
  }

  @Get('subscriptions')
  async listSubscriptions() {
    return this.devPortalService.listSubscriptions();
  }

  /**
   * Upsert subscription plan
   * Protected by plan-aware rate limiting
   */
  @Post('plans')
  @UseGuards(SuperDevGuard, PlanRateLimiterGuard)
  async upsertPlan(
    @Body()
    body: {
      code: string;
      name: string;
      priceUGX: number;
      features: any;
      isActive?: boolean;
    },
  ) {
    return this.devPortalService.upsertPlan(body);
  }

  @Post('superdevs')
  @UseGuards(SuperDevGuard)
  async manageDevAdmin(
    @Body() body: { action: 'add' | 'remove'; email: string; isSuper?: boolean },
  ) {
    return this.devPortalService.manageDevAdmin(
      body.action,
      body.email,
      body.isSuper,
    );
  }

  /**
   * Get API usage summary for developer account
   * 
   * NOTE: This endpoint is for developer portal analytics.
   * Auth: Currently uses DevAdminGuard with x-org-id header.
   * TODO: Replace with proper org session auth when full dev portal backend is implemented.
   * 
   * @param orgId - Organization ID from x-org-id header (temp auth mechanism)
   * @param range - Time range: '24h' or '7d'
   */
  @Get('usage')
  @ApiOkResponse({ type: DevUsageSummaryDto })
  @ApiQuery({ name: 'range', enum: ['24h', '7d'], required: false })
  async getUsage(
    @Query('range') range?: '24h' | '7d',
  ): Promise<DevUsageSummaryDto> {
    // TODO: Extract orgId from authenticated session/user context
    // For now, use a mock org ID or extract from request headers
    // When proper dev portal auth is implemented, use @CurrentOrg() decorator
    const orgId = 'demo-org-id'; // Placeholder - replace with actual org context
    
    return this.devPortalService.getUsageSummaryForOrg(orgId, range ?? '24h');
  }
}
