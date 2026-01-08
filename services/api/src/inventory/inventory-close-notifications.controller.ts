/**
 * M12.6 Inventory Close Notifications Controller
 *
 * REST endpoints for close workflow notifications:
 * - GET /inventory/notifications - List notifications for org
 * - POST /inventory/notifications/:id/ack - Acknowledge notification
 * - GET /inventory/notifications/export - Export as CSV
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryCloseNotificationsService,
  CloseNotificationRecord,
} from './inventory-close-notifications.service';

// ============================================
// Controller
// ============================================

@ApiTags('Inventory Notifications')
@ApiBearerAuth()
@Controller('inventory/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryCloseNotificationsController {
  constructor(
    private readonly notificationsService: InventoryCloseNotificationsService,
  ) {}

  // ============================================
  // List Notifications
  // ============================================

  @Get()
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'List inventory close notifications for org' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'SENT', 'ACKED'] })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listNotifications(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: 'PENDING' | 'SENT' | 'ACKED',
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ notifications: CloseNotificationRecord[]; total: number }> {
    const { orgId } = req.user;

    return this.notificationsService.listNotifications(orgId, {
      branchId,
      status,
      eventType,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ============================================
  // Acknowledge Notification (Idempotent - H9)
  // ============================================

  @Post(':id/ack')
  @Roles('L3', 'L4', 'L5')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a notification (idempotent)' })
  async ackNotification(
    @Request() req: any,
    @Param('id') notificationId: string,
  ): Promise<CloseNotificationRecord> {
    const { orgId, userId } = req.user;

    return this.notificationsService.ackNotification(orgId, notificationId, userId);
  }

  // ============================================
  // Export Notifications as CSV
  // ============================================

  @Get('export')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Export notifications as CSV' })
  @ApiQuery({ name: 'branchId', required: false })
  async exportNotifications(
    @Request() req: any,
    @Res() res: any,
    @Query('branchId') branchId?: string,
  ): Promise<void> {
    const { orgId } = req.user;

    const { content, hash } = await this.notificationsService.exportNotificationsCsv(
      orgId,
      { branchId },
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notifications-export.csv"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(content);
  }
}
