/**
 * Inventory Alerts Controller - M11.12
 * 
 * Provides endpoints for alert management: list, evaluate, acknowledge, resolve.
 * RBAC: L2+ read, L4+ actions (acknowledge/resolve), L4+ evaluate.
 * H7: RBAC guards prevent L2 from acknowledging alerts.
 */

import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Query, 
  Body,
  Req, 
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { 
  InventoryAlertsService,
  AlertFilters,
  AlertListResult,
  AlertItem,
  EvaluateResult,
} from './inventory-alerts.service';
import { InventoryAlertType, InventoryAlertSeverity, InventoryAlertStatus } from '@chefcloud/db';

// ============================================
// Query DTOs
// ============================================

class AlertQueryDto {
  branchId?: string;
  type?: string;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

class EvaluateDto {
  branchId?: string;
  deadStockDays?: number;
  expiryThresholdDays?: number;
}

class ResolveDto {
  resolutionNote?: string;
}

// ============================================
// Controller
// ============================================

@Controller('inventory/alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class InventoryAlertsController {
  constructor(private readonly alertsService: InventoryAlertsService) {}

  // ============================================
  // List Alerts
  // ============================================

  @Get()
  @Roles('L2')
  async listAlerts(
    @Req() req: any,
    @Query() query: AlertQueryDto,
  ): Promise<AlertListResult> {
    const filters = this.parseFilters(query);
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;
    return this.alertsService.listAlerts(req.user.orgId, filters, page, pageSize);
  }

  // ============================================
  // Get Single Alert
  // ============================================

  @Get(':id')
  @Roles('L2')
  async getAlert(
    @Req() req: any,
    @Param('id') alertId: string,
  ): Promise<AlertItem> {
    return this.alertsService.getAlert(req.user.orgId, alertId);
  }

  // ============================================
  // Evaluate Alerts (Manual Trigger)
  // ============================================

  @Post('evaluate')
  @Roles('L4')
  async evaluateAlerts(
    @Req() req: any,
    @Body() dto: EvaluateDto,
  ): Promise<EvaluateResult> {
    return this.alertsService.evaluateAlerts(req.user.orgId, dto.branchId, {
      deadStockDays: dto.deadStockDays,
      expiryThresholdDays: dto.expiryThresholdDays,
    });
  }

  // ============================================
  // Acknowledge Alert (H7: L4+ only)
  // ============================================

  @Post(':id/acknowledge')
  @Roles('L4')
  async acknowledgeAlert(
    @Req() req: any,
    @Param('id') alertId: string,
  ): Promise<AlertItem> {
    return this.alertsService.acknowledgeAlert(
      req.user.orgId,
      alertId,
      req.user.id,
    );
  }

  // ============================================
  // Resolve Alert (H7: L4+ only)
  // ============================================

  @Post(':id/resolve')
  @Roles('L4')
  async resolveAlert(
    @Req() req: any,
    @Param('id') alertId: string,
    @Body() dto: ResolveDto,
  ): Promise<AlertItem> {
    return this.alertsService.resolveAlert(
      req.user.orgId,
      alertId,
      req.user.id,
      dto.resolutionNote,
    );
  }

  // ============================================
  // Helpers
  // ============================================

  private parseFilters(query: AlertQueryDto): AlertFilters {
    return {
      branchId: query.branchId,
      type: query.type as InventoryAlertType | undefined,
      severity: query.severity as InventoryAlertSeverity | undefined,
      status: query.status as InventoryAlertStatus | undefined,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }
}
