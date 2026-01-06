import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  InventoryStocktakeService,
  CreateStocktakeDto,
  StocktakeCountLineDto,
  StocktakeListFilters,
} from './inventory-stocktake.service';
import { StocktakeStatus } from '@chefcloud/db';

interface AuthenticatedRequest {
  user: {
    sub: string;
    orgId: string;
    branchId: string;
  };
  headers: Record<string, string>;
}

@Controller('inventory/stocktakes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryStocktakeController {
  constructor(private readonly stocktakeService: InventoryStocktakeService) {}

  // ============================================
  // Create Stocktake Session (DRAFT)
  // L3+ can create
  // ============================================
  @Post()
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async createSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStocktakeDto,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.createSession(orgId, branchId, userId, dto);
  }

  // ============================================
  // List Sessions
  // L3+ can view
  // ============================================
  @Get()
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async listSessions(
    @Req() req: AuthenticatedRequest,
    @Query() query: any,
  ): Promise<any> {
    const { orgId, branchId } = this.extractContext(req);

    const filters: StocktakeListFilters = {
      status: query.status
        ? (Array.isArray(query.status) ? query.status : [query.status])
        : undefined,
      locationId: query.locationId,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    return this.stocktakeService.listSessions(orgId, branchId, filters);
  }

  // ============================================
  // Get Session Detail
  // L3+ can view
  // ============================================
  @Get(':id')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async getSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Query('includeLines') includeLines?: string,
  ): Promise<any> {
    const { orgId, branchId } = this.extractContext(req);
    return this.stocktakeService.getSession(
      orgId,
      branchId,
      sessionId,
      includeLines !== 'false',
    );
  }

  // ============================================
  // Get Session Lines
  // L3+ can view
  // ============================================
  @Get(':id/lines')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async getSessionLines(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Query('counted') counted?: string,
    @Query('withVariance') withVariance?: string,
  ): Promise<any> {
    const { orgId, branchId } = this.extractContext(req);
    return this.stocktakeService.getSessionLines(orgId, branchId, sessionId, {
      counted: counted === 'true' ? true : counted === 'false' ? false : undefined,
      withVariance: withVariance === 'true',
    });
  }

  // ============================================
  // Start Session (DRAFT → IN_PROGRESS)
  // L3+ can start
  // ============================================
  @Post(':id/start')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async startSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.startSession(orgId, branchId, sessionId, userId);
  }

  // ============================================
  // Record Count Line
  // L3+ can count
  // ============================================
  @Post(':id/counts')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async recordCount(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() dto: StocktakeCountLineDto,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.recordCount(orgId, branchId, sessionId, userId, dto);
  }

  // ============================================
  // Submit Session (IN_PROGRESS → SUBMITTED)
  // L3+ can submit
  // ============================================
  @Post(':id/submit')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async submitSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.submitSession(orgId, branchId, sessionId, userId);
  }

  // ============================================
  // Approve Session (SUBMITTED → APPROVED)
  // L4+ (Manager) can approve
  // ============================================
  @Post(':id/approve')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async approveSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.approveSession(orgId, branchId, sessionId, userId);
  }

  // ============================================
  // Post Session (APPROVED → POSTED)
  // L4+ (Manager) can post
  // ============================================
  @Post(':id/post')
  @Roles('L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async postSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.postSession(orgId, branchId, sessionId, userId);
  }

  // ============================================
  // Void Session (POSTED → VOID)
  // L5+ (Admin) can void posted sessions
  // ============================================
  @Post(':id/void')
  @Roles('L5_OWNER', 'L0_SUPER')
  async voidSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: { reason: string },
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.voidSession(
      orgId,
      branchId,
      sessionId,
      userId,
      body.reason,
    );
  }

  // ============================================
  // Cancel Session (DRAFT/IN_PROGRESS → VOID)
  // L3+ can cancel their own sessions
  // ============================================
  @Post(':id/cancel')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async cancelSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') sessionId: string,
    @Body() body: { reason?: string },
  ): Promise<any> {
    const { orgId, branchId, userId } = this.extractContext(req);
    return this.stocktakeService.cancelSession(
      orgId,
      branchId,
      sessionId,
      userId,
      body.reason,
    );
  }

  // ============================================
  // Export CSV
  // L3+ can export
  // ============================================
  @Get(':id/export')
  @Roles('L3_MANAGER', 'L4_ADMIN', 'L5_OWNER', 'L0_SUPER')
  async exportCsv(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') sessionId: string,
  ): Promise<void> {
    const { orgId, branchId } = this.extractContext(req);
    const { csv, hash, filename } = await this.stocktakeService.exportCsv(
      orgId,
      branchId,
      sessionId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.status(HttpStatus.OK).send(csv);
  }

  // ============================================
  // Helper: Extract Context
  // ============================================
  private extractContext(req: AuthenticatedRequest) {
    const user = req.user;
    return {
      orgId: user.orgId,
      branchId: req.headers['x-branch-id'] || user.branchId,
      userId: user.sub,
    };
  }
}
