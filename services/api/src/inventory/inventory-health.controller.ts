/**
 * M11.15: Inventory Health Report Controller
 *
 * Endpoint: GET /inventory/health-report
 * RBAC: L4+ (Manager and above)
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { InventoryHealthService, InventoryHealthReport } from './inventory-health.service';

interface AuthUser {
  sub: string;
  orgId: string;
  role: string;
}

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryHealthController {
  constructor(private readonly healthService: InventoryHealthService) {}

  @Get('health-report')
  @Roles('OWNER', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Get inventory health report',
    description:
      'Returns health metrics for the inventory system including item counts, ' +
      'ledger statistics, and integrity checks. Requires L4+ (Manager) role.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Optional branch ID to scope the report',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Inventory health report',
    schema: {
      type: 'object',
      properties: {
        orgId: { type: 'string' },
        branchId: { type: 'string', nullable: true },
        generatedAt: { type: 'string', format: 'date-time' },
        metrics: {
          type: 'object',
          properties: {
            totalItems: { type: 'number' },
            activeItems: { type: 'number' },
            inactiveItems: { type: 'number' },
            totalLedgerEntries: { type: 'number' },
            totalCostLayers: { type: 'number' },
            totalLotAllocations: { type: 'number' },
            itemsWithNegativeStock: { type: 'number' },
            orphanedLedgerEntries: { type: 'number' },
          },
        },
        health: { type: 'string', enum: ['HEALTHY', 'WARNING', 'CRITICAL'] },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (requires L4+ role)',
  })
  async getHealthReport(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ): Promise<InventoryHealthReport> {
    return this.healthService.getHealthReport(user.orgId, branchId);
  }
}
