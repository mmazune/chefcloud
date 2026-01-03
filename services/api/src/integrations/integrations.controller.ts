/**
 * M9.5: Integrations Controller
 *
 * Manages webhooks, notification templates, and calendar feeds.
 * All endpoints require L4+ RBAC.
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WebhookService, WebhookEndpointDto } from './webhook.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookHardeningService } from './webhook-hardening.service';
import { IcsService } from './ics.service';
import { TemplateRenderService, TemplateDto } from './template-render.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationHardeningService } from './notification-hardening.service';

interface AuthenticatedRequest {
  user: {
    orgId: string;
    branchIds: string[];
    roleLevel: string;
  };
}

@ApiTags('Integrations')
@Controller('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private webhookService: WebhookService,
    private webhookDispatcher: WebhookDispatcherService,
    private webhookHardening: WebhookHardeningService,
    private icsService: IcsService,
    private templateService: TemplateRenderService,
    private notificationDispatcher: NotificationDispatcherService,
    private notificationHardening: NotificationHardeningService,
  ) {}

  // ==================== WEBHOOKS ====================

  @Post('webhooks')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Create webhook endpoint' })
  async createWebhook(@Req() req: AuthenticatedRequest, @Body() dto: WebhookEndpointDto) {
    return this.webhookService.createEndpoint(req.user.orgId, dto);
  }

  @Get('webhooks')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'List webhook endpoints' })
  async listWebhooks(@Req() req: AuthenticatedRequest, @Query('branchId') branchId?: string) {
    return this.webhookService.listEndpoints(req.user.orgId, branchId);
  }

  @Get('webhooks/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get webhook endpoint' })
  async getWebhook(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.webhookService.getEndpoint(req.user.orgId, id);
  }

  @Put('webhooks/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  async updateWebhook(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<WebhookEndpointDto>,
  ) {
    return this.webhookService.updateEndpoint(req.user.orgId, id, dto);
  }

  @Delete('webhooks/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  async deleteWebhook(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.webhookService.deleteEndpoint(req.user.orgId, id);
  }

  @Post('webhooks/:id/rotate-secret')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Rotate webhook secret' })
  async rotateWebhookSecret(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.webhookService.rotateSecret(req.user.orgId, id);
  }

  @Get('webhooks/stats')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get webhook delivery statistics' })
  async getWebhookStats(
    @Req() req: AuthenticatedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.webhookDispatcher.getDeliveryStats(
      req.user.orgId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('webhooks/export')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Export webhook deliveries as CSV' })
  async exportWebhooks(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const deliveries = await this.webhookDispatcher.getDeliveriesForExport(
      req.user.orgId,
      new Date(from),
      new Date(to),
    );

    // Build CSV
    const headers = [
      'Delivery ID',
      'Event Type',
      'Event ID',
      'URL',
      'Status',
      'Attempts',
      'Response Code',
      'Created At',
    ];

    const rows = deliveries.map((d) => [
      d.id,
      d.eventType,
      d.eventId,
      d.endpoint?.url || '',
      d.status,
      d.attempts.toString(),
      d.responseCode?.toString() || '',
      d.createdAt.toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map(this.escapeCSV).join(','))].join(
      '\n',
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="webhooks_${from}_to_${to}.csv"`,
    );
    res.send(csv);
  }

  // ==================== NOTIFICATION TEMPLATES ====================

  @Post('notifications/templates')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Create notification template' })
  async createTemplate(@Req() req: AuthenticatedRequest, @Body() dto: TemplateDto) {
    return this.templateService.createTemplate(req.user.orgId, dto);
  }

  @Get('notifications/templates')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'List notification templates' })
  async listTemplates(
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.templateService.listTemplates(req.user.orgId, branchId);
  }

  @Get('notifications/templates/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get notification template' })
  async getTemplate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.templateService.getTemplate(req.user.orgId, id);
  }

  @Put('notifications/templates/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Update notification template' })
  async updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<TemplateDto>,
  ) {
    return this.templateService.updateTemplate(req.user.orgId, id, dto);
  }

  @Delete('notifications/templates/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Delete notification template' })
  async deleteTemplate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.templateService.deleteTemplate(req.user.orgId, id);
  }

  @Get('notifications/templates/:id/preview')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Preview template with sample data' })
  async previewTemplate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.templateService.previewTemplate(req.user.orgId, id);
  }

  @Get('notifications/variables')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get available template variables' })
  async getTemplateVariables() {
    return this.templateService.getAvailableVariables();
  }

  @Get('notifications/stats')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get notification statistics' })
  async getNotificationStats(
    @Req() req: AuthenticatedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.notificationDispatcher.getNotificationStats(
      req.user.orgId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('notifications/export')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Export notifications as CSV' })
  async exportNotifications(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const notifications = await this.notificationDispatcher.getNotificationsForExport(
      req.user.orgId,
      new Date(from),
      new Date(to),
    );

    const headers = [
      'Notification ID',
      'Type',
      'Event',
      'Status',
      'Attempts',
      'Created At',
    ];

    const rows = notifications.map((n) => [
      n.id,
      n.type,
      n.event,
      n.status,
      n.attempts.toString(),
      n.createdAt.toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map(this.escapeCSV).join(','))].join(
      '\n',
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="notifications_${from}_to_${to}.csv"`,
    );
    res.send(csv);
  }

  // ==================== CALENDAR FEEDS ====================

  @Post('calendar/tokens')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Generate calendar feed token' })
  async createCalendarToken(
    @Body() body: { branchId: string; expiresInDays?: number },
  ) {
    return this.icsService.generateFeedToken(body.branchId, body.expiresInDays);
  }

  @Get('calendar/tokens')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'List calendar feed tokens for branch' })
  async listCalendarTokens(@Query('branchId') branchId: string) {
    return this.icsService.listFeedTokens(branchId);
  }

  @Delete('calendar/tokens/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Revoke calendar feed token' })
  async revokeCalendarToken(
    @Param('id') id: string,
    @Query('branchId') branchId: string,
  ) {
    return this.icsService.revokeFeedToken(id, branchId);
  }

  // ==================== M9.6: CIRCUIT BREAKER & REPLAY ====================

  @Get('webhooks/circuit-status')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get circuit breaker status for all endpoints' })
  async getCircuitBreakerStatus(@Req() req: AuthenticatedRequest) {
    return this.webhookHardening.getCircuitBreakerStatus(req.user.orgId);
  }

  @Post('webhooks/:id/reset-circuit')
  @Roles('L5')
  @ApiOperation({ summary: 'Reset circuit breaker for endpoint (L5 only)' })
  async resetCircuitBreaker(
    @Req() req: AuthenticatedRequest,
    @Param('id') endpointId: string,
  ) {
    await this.webhookHardening.resetCircuitBreaker(req.user.orgId, endpointId);
    return { success: true };
  }

  @Get('webhooks/dead-letter')
  @Roles('L5')
  @ApiOperation({ summary: 'Get dead letter deliveries (L5 only)' })
  async getDeadLetterDeliveries(
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ): Promise<object[]> {
    return this.webhookHardening.getDeadLetterDeliveries(req.user.orgId, branchId);
  }

  @Post('webhooks/replay/:deliveryId')
  @Roles('L5')
  @ApiOperation({ summary: 'Replay a dead letter webhook delivery (L5 only)' })
  async replayWebhookDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhookHardening.replayDeadLetter(
      req.user.orgId,
      deliveryId,
      req.user.orgId, // userId would come from req.user.userId in real impl
    );
  }

  @Get('notifications/failed')
  @Roles('L5')
  @ApiOperation({ summary: 'Get failed notifications (L5 only)' })
  async getFailedNotifications(@Req() req: AuthenticatedRequest): Promise<object[]> {
    return this.notificationHardening.getFailedNotifications(req.user.orgId);
  }

  @Post('notifications/replay/:notificationId')
  @Roles('L5')
  @ApiOperation({ summary: 'Replay a failed notification (L5 only)' })
  async replayNotification(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationHardening.replayNotification(
      req.user.orgId,
      notificationId,
      req.user.orgId,
    );
  }

  // ==================== HELPERS ====================

  private escapeCSV(value: string): string {
    if (!value) return '';
    // Escape quotes and wrap in quotes if contains special chars
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    // Prevent formula injection
    if (/^[=+\-@]/.test(value)) {
      return `'${value}`;
    }
    return value;
  }
}
