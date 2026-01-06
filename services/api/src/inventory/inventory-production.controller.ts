/**
 * M11.9 Inventory Production Controller
 *
 * API endpoints for production/manufacturing batches.
 * RBAC: L2+ read, L3+ create/post, L4+ void/export
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    orgId: string;
    branchId: string;
    userId: string;
    role: string;
  };
}
import {
  InventoryProductionService,
  CreateProductionBatchDto,
  AddProductionLineDto,
  PostProductionBatchDto,
  VoidProductionBatchDto,
  ListProductionBatchesDto,
} from './inventory-production.service';
import { ProductionBatchStatus } from '@chefcloud/db';

@Controller('inventory/production')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryProductionController {
  constructor(private readonly productionService: InventoryProductionService) {}

  // ==========================================================================
  // CREATE Draft Batch
  // ==========================================================================

  @Post()
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  async createBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductionBatchDto,
  ) {
    const { orgId, branchId, userId } = req.user;
    return this.productionService.createBatch(orgId, branchId, userId, dto);
  }

  // ==========================================================================
  // LIST Batches
  // ==========================================================================

  @Get()
  @Roles('L2_SHIFT_LEAD', 'L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  async listBatches(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { orgId, branchId } = req.user;

    const dto: ListProductionBatchesDto = {};
    
    if (status) {
      dto.status = status as ProductionBatchStatus;
    }
    if (fromDate) {
      dto.fromDate = new Date(fromDate);
    }
    if (toDate) {
      dto.toDate = new Date(toDate);
    }
    if (limit) {
      dto.limit = parseInt(limit, 10);
    }
    if (offset) {
      dto.offset = parseInt(offset, 10);
    }

    return this.productionService.listBatches(orgId, branchId, dto);
  }

  // ==========================================================================
  // GET Batch by ID
  // ==========================================================================

  @Get(':id')
  @Roles('L2_SHIFT_LEAD', 'L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  async getBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const { orgId, branchId } = req.user;
    return this.productionService.getBatch(orgId, branchId, id);
  }

  // ==========================================================================
  // ADD Line to Draft Batch
  // ==========================================================================

  @Post(':id/lines')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  async addLine(
    @Req() req: AuthenticatedRequest,
    @Param('id') batchId: string,
    @Body() dto: AddProductionLineDto,
  ) {
    const { orgId, branchId, userId } = req.user;
    return this.productionService.addLine(orgId, branchId, userId, batchId, dto);
  }

  // ==========================================================================
  // REMOVE Line from Draft Batch
  // ==========================================================================

  @Delete(':id/lines/:lineId')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLine(
    @Req() req: AuthenticatedRequest,
    @Param('id') batchId: string,
    @Param('lineId') lineId: string,
  ) {
    const { orgId, branchId } = req.user;
    await this.productionService.removeLine(orgId, branchId, batchId, lineId);
  }

  // ==========================================================================
  // POST Batch (Finalize)
  // ==========================================================================

  @Patch(':id/post')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  async postBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto?: PostProductionBatchDto,
  ) {
    const { orgId, branchId, userId } = req.user;
    return this.productionService.postBatch(orgId, branchId, userId, id, dto);
  }

  // ==========================================================================
  // VOID Batch
  // ==========================================================================

  @Patch(':id/void')
  @Roles('L4_ADMIN', 'L5_OWNER')
  async voidBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: VoidProductionBatchDto,
  ) {
    const { orgId, branchId, userId } = req.user;
    return this.productionService.voidBatch(orgId, branchId, userId, id, dto);
  }

  // ==========================================================================
  // DELETE Draft Batch
  // ==========================================================================

  @Delete(':id')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const { orgId, branchId, userId } = req.user;
    await this.productionService.deleteBatch(orgId, branchId, userId, id);
  }

  // ==========================================================================
  // EXPORT Batches
  // ==========================================================================

  @Get('export')
  @Roles('L4_ADMIN', 'L5_OWNER')
  async exportBatches(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const { orgId, branchId } = req.user;

    const dto: ListProductionBatchesDto = {};
    
    if (status) {
      dto.status = status as ProductionBatchStatus;
    }
    if (fromDate) {
      dto.fromDate = new Date(fromDate);
    }
    if (toDate) {
      dto.toDate = new Date(toDate);
    }

    return this.productionService.exportBatches(orgId, branchId, dto);
  }
}
