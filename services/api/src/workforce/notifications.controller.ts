/**
 * M10.11: Workforce Notifications Controller
 * 
 * Endpoints for workforce notification management:
 * - Self-service: /workforce/self/notifications
 * - Manager view: /workforce/notifications
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkforceNotificationsService } from './workforce-notifications.service';
import type { WorkforceNotificationType } from '@chefcloud/db';

// ===== SELF-SERVICE CONTROLLER =====

@Controller('workforce/self/notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SelfNotificationsController {
  constructor(private readonly notificationsService: WorkforceNotificationsService) { }

  /**
   * GET /workforce/self/notifications
   * Get my notifications
   */
  @Get()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyNotifications(
    @Query('type') type?: WorkforceNotificationType,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req?: any,
  ): Promise<{ notifications: any[]; total: number; limit: number; offset: number }> {
    return this.notificationsService.getMyNotifications(req.user.userId, req.user.orgId, {
      type,
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /workforce/self/notifications/unread-count
   * Get my unread notification count
   */
  @Get('unread-count')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.userId, req.user.orgId);
  }

  /**
   * PUT /workforce/self/notifications/:id/read
   * Mark a notification as read
   */
  @Put(':id/read')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async markAsRead(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.notificationsService.markAsRead(id, req.user.userId, req.user.orgId);
  }

  /**
   * PUT /workforce/self/notifications/read-all
   * Mark all notifications as read
   */
  @Put('read-all')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId, req.user.orgId);
  }
}

// ===== MANAGER CONTROLLER =====

@Controller('workforce/notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: WorkforceNotificationsService) { }

  /**
   * GET /workforce/notifications
   * Get all notifications (manager view)
   */
  @Get()
  @Roles('L3', 'L4', 'L5')
  async getNotifications(
    @Query('targetUserId') targetUserId?: string,
    @Query('type') type?: WorkforceNotificationType,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req?: any,
  ): Promise<{ notifications: any[]; total: number; limit: number; offset: number }> {
    return this.notificationsService.getNotifications(req.user.orgId, {
      targetUserId,
      type,
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
