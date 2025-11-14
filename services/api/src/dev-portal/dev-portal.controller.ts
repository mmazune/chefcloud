import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  Param,
  Headers,
  HttpStatus,
} from '@nestjs/common';
import { DevPortalService } from './dev-portal.service';
import { DevAdminGuard } from './guards/dev-admin.guard';
import { SuperDevGuard } from './guards/super-dev.guard';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';

/**
 * Developer Portal Controller
 * 
 * Manages organizations, subscriptions, plans, API keys, and webhooks for internal dev/admin use.
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
   * List all API keys
   */
  @Get('keys')
  async listKeys() {
    return this.devPortalService.listKeys();
  }

  /**
   * Create new API key
   * Protected by plan-aware rate limiting
   */
  @Post('keys')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanRateLimiterGuard)
  async createKey(@Body() body: any) {
    if (!body?.label) {
      return { statusCode: 400, message: 'label is required' };
    }
    return this.devPortalService.createKey(body.label, body.plan ?? 'free');
  }

  /**
   * Revoke API key (soft delete)
   */
  @Post('keys/:id/revoke')
  async revokeKey(@Param('id') id: string) {
    return this.devPortalService.revokeKey(id);
  }

  /**
   * Webhook event validation
   * Verifies HMAC signature
   * Public endpoint (no DevAdmin guard required)
   */
  @Post('webhook/events')
  @HttpCode(200)
  async webhook(@Body() body: any, @Headers('x-signature') sig?: string) {
    return this.devPortalService.handleWebhook(body, sig);
  }
}
