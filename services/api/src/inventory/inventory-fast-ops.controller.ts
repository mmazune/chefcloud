import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryFastOpsService,
  FastReceiveDto,
  FastStocktakeScanDto,
  FastWasteDto,
  FastTransferDto,
} from './inventory-fast-ops.service';

interface AuthenticatedRequest {
  user: {
    sub: string;
    orgId: string;
    branchId: string;
  };
}

// ============================================
// Request DTOs for Swagger
// ============================================

class FastReceiveRequest {
  branchId: string;
  locationId: string;
  barcodeValue: string;
  qty: number;
  uomId?: string;
  unitCost?: number;
  lotNumber?: string;
  expiryDate?: Date;
  notes?: string;
  idempotencyKey?: string;
}

class FastStocktakeScanRequest {
  barcodeValue: string;
  locationId?: string;
  countedQty: number;
}

class FastWasteRequest {
  branchId: string;
  locationId: string;
  barcodeValue: string;
  qty: number;
  reason?: string;
  notes?: string;
}

class FastTransferRequest {
  fromLocationId: string;
  toLocationId: string;
  barcodeValue: string;
  qty: number;
  notes?: string;
}

// ============================================
// Controller
// ============================================

@ApiTags('Inventory - Fast Ops')
@ApiBearerAuth()
@Controller('inventory/ops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryFastOpsController {
  private readonly logger = new Logger(InventoryFastOpsController.name);

  constructor(private readonly fastOpsService: InventoryFastOpsService) {}

  // ============================================
  // POST /inventory/ops/receive
  // ============================================

  @Post('receive')
  @Roles('L4_MANAGER', 'L5_ADMIN', 'L6_SUPER_ADMIN')
  @ApiOperation({
    summary: 'Fast receive inventory by barcode',
    description: 'Scan barcode → resolve → post RECEIVE ledger entry. Supports idempotency.',
  })
  @ApiResponse({ status: 201, description: 'Receive recorded' })
  @ApiResponse({ status: 404, description: 'Barcode not found' })
  async fastReceive(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FastReceiveRequest,
  ) {
    const { orgId, sub: userId } = req.user;
    this.logger.log(`POST /inventory/ops/receive by user ${userId}`);
    return this.fastOpsService.fastReceive(orgId, userId, dto);
  }

  // ============================================
  // POST /inventory/ops/stocktake/:sessionId/scan
  // ============================================

  @Post('stocktake/:sessionId/scan')
  @Roles('L2_TEAM_MEMBER', 'L3_SUPERVISOR', 'L4_MANAGER', 'L5_ADMIN', 'L6_SUPER_ADMIN')
  @ApiOperation({
    summary: 'Scan barcode during stocktake',
    description: 'Upserts stocktake line. Creates line if item not in original snapshot.',
  })
  @ApiResponse({ status: 201, description: 'Line upserted' })
  @ApiResponse({ status: 400, description: 'Session not IN_PROGRESS' })
  @ApiResponse({ status: 404, description: 'Barcode or session not found' })
  async fastStocktakeScan(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() dto: FastStocktakeScanRequest,
  ) {
    const { orgId, branchId, sub: userId } = req.user;
    this.logger.log(`POST /inventory/ops/stocktake/${sessionId}/scan by user ${userId}`);
    return this.fastOpsService.fastStocktakeScan(orgId, branchId, sessionId, userId, dto);
  }

  // ============================================
  // POST /inventory/ops/waste
  // ============================================

  @Post('waste')
  @Roles('L3_SUPERVISOR', 'L4_MANAGER', 'L5_ADMIN', 'L6_SUPER_ADMIN')
  @ApiOperation({
    summary: 'Fast waste inventory by barcode',
    description: 'Scan barcode → resolve → post WASTE ledger entry. Checks lot status.',
  })
  @ApiResponse({ status: 201, description: 'Waste recorded' })
  @ApiResponse({ status: 400, description: 'Lot blocked (quarantine/expired)' })
  @ApiResponse({ status: 404, description: 'Barcode not found' })
  async fastWaste(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FastWasteRequest,
  ) {
    const { orgId, sub: userId } = req.user;
    this.logger.log(`POST /inventory/ops/waste by user ${userId}`);
    return this.fastOpsService.fastWaste(orgId, userId, dto);
  }

  // ============================================
  // POST /inventory/ops/transfer
  // ============================================

  @Post('transfer')
  @Roles('L3_SUPERVISOR', 'L4_MANAGER', 'L5_ADMIN', 'L6_SUPER_ADMIN')
  @ApiOperation({
    summary: 'Fast transfer inventory by barcode',
    description: 'Scan barcode → resolve → transfer between locations in single branch.',
  })
  @ApiResponse({ status: 201, description: 'Transfer completed' })
  @ApiResponse({ status: 400, description: 'Lot blocked or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Barcode not found' })
  async fastTransfer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FastTransferRequest,
  ) {
    const { orgId, branchId, sub: userId } = req.user;
    this.logger.log(`POST /inventory/ops/transfer by user ${userId}`);
    return this.fastOpsService.fastTransfer(orgId, branchId, userId, dto);
  }
}
