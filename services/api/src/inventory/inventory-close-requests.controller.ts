/**
 * M12.4 Inventory Close Requests Controller
 *
 * REST endpoints for period close request workflow:
 * - POST /inventory/periods/:periodId/close-requests - Create request
 * - POST /inventory/periods/close-requests/:id/submit - Submit for approval
 * - POST /inventory/periods/close-requests/:id/approve - Approve (L5+)
 * - POST /inventory/periods/close-requests/:id/reject - Reject (L5+)
 * - GET /inventory/periods/close-requests - List with filters
 * - GET /inventory/periods/:periodId/close-request - Get for period
 */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryCloseRequestsService,
  CloseRequestItem,
  CloseRequestListFilters,
} from './inventory-close-requests.service';
import { InventoryPeriodCloseRequestStatus, RoleLevel } from '@chefcloud/db';
import { IsString, IsOptional, MinLength } from 'class-validator';

// ============================================
// DTOs
// ============================================

class ApproveRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

class RejectRequestDto {
  @IsString()
  @MinLength(10)
  reason: string;
}

// ============================================
// Controller
// ============================================

@ApiTags('Inventory Close Requests')
@ApiBearerAuth()
@Controller('inventory/periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryCloseRequestsController {
  constructor(private readonly closeRequestsService: InventoryCloseRequestsService) {}

  // ============================================
  // Create Close Request
  // ============================================

  @Post(':periodId/close-requests')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Create a close request for a period' })
  async createCloseRequest(
    @Request() req: any,
    @Param('periodId') periodId: string,
  ): Promise<CloseRequestItem> {
    const { orgId, branchId, userId } = req.user;

    return this.closeRequestsService.createCloseRequest(orgId, branchId, userId, {
      periodId,
    });
  }

  // ============================================
  // Submit Close Request
  // ============================================

  @Post('close-requests/:id/submit')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a close request for approval' })
  async submitCloseRequest(
    @Request() req: any,
    @Param('id') requestId: string,
  ): Promise<CloseRequestItem> {
    const { orgId, userId } = req.user;

    return this.closeRequestsService.submitCloseRequest(orgId, userId, {
      requestId,
    });
  }

  // ============================================
  // Approve Close Request
  // ============================================

  @Post('close-requests/:id/approve')
  @Roles('L5')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a close request (L5+)' })
  async approveCloseRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() dto: ApproveRequestDto,
  ): Promise<CloseRequestItem> {
    const { orgId, userId, roleLevel } = req.user;

    return this.closeRequestsService.approveCloseRequest(
      orgId,
      userId,
      roleLevel as RoleLevel,
      { requestId, notes: dto.notes },
    );
  }

  // ============================================
  // Reject Close Request
  // ============================================

  @Post('close-requests/:id/reject')
  @Roles('L5')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a close request (L5+)' })
  async rejectCloseRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() dto: RejectRequestDto,
  ): Promise<CloseRequestItem> {
    const { orgId, userId, roleLevel } = req.user;

    return this.closeRequestsService.rejectCloseRequest(
      orgId,
      userId,
      roleLevel as RoleLevel,
      { requestId, reason: dto.reason },
    );
  }

  // ============================================
  // List Close Requests
  // ============================================

  @Get('close-requests')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'List close requests for org' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: InventoryPeriodCloseRequestStatus })
  async listCloseRequests(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: InventoryPeriodCloseRequestStatus,
  ): Promise<CloseRequestItem[]> {
    const { orgId } = req.user;

    const filters: CloseRequestListFilters = {};
    if (branchId) filters.branchId = branchId;
    if (status) filters.status = status;

    return this.closeRequestsService.listCloseRequests(orgId, filters);
  }

  // ============================================
  // Get Close Request For Period
  // ============================================

  @Get(':periodId/close-request')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Get close request for a period' })
  async getCloseRequestForPeriod(
    @Request() req: any,
    @Param('periodId') periodId: string,
  ): Promise<CloseRequestItem | null> {
    const { orgId } = req.user;

    return this.closeRequestsService.getCloseRequestForPeriod(orgId, periodId);
  }
}
