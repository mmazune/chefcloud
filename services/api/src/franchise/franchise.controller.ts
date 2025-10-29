import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  FranchiseService,
  BranchOverview,
  BranchRanking,
  ForecastItemData,
  ProcurementSuggestion,
} from './franchise.service';

interface RequestWithUser {
  user: {
    id: string;
    orgId: string;
    branchId: string;
  };
}

@Controller('franchise')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FranchiseController {
  constructor(private franchiseService: FranchiseService) {}

  @Get('overview')
  @Roles('L5')
  async getOverview(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
  ): Promise<BranchOverview[] | { error: string }> {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }
    return this.franchiseService.getOverview(req.user.orgId, period);
  }

  @Get('rankings')
  @Roles('L5')
  async getRankings(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
  ): Promise<BranchRanking[] | { error: string }> {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }
    return this.franchiseService.getRankings(req.user.orgId, period);
  }

  @Post('budgets')
  @Roles('L5')
  async upsertBudget(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      branchId: string;
      period: string;
      revenueTarget: number;
      cogsTarget: number;
      expenseTarget: number;
      notes?: string;
    },
  ) {
    return this.franchiseService.upsertBudget(
      req.user.orgId,
      body.branchId,
      body.period,
      {
        revenueTarget: body.revenueTarget,
        cogsTarget: body.cogsTarget,
        expenseTarget: body.expenseTarget,
        notes: body.notes,
      },
    );
  }

  @Get('budgets')
  @Roles('L5')
  async getBudgets(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
  ) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }
    return this.franchiseService.getBudgets(req.user.orgId, period);
  }

  @Get('forecast/items')
  @Roles('L4', 'L5')
  async getForecastItems(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
    @Query('method') method: string,
  ): Promise<ForecastItemData[] | { error: string }> {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }
    return this.franchiseService.getForecastItems(
      req.user.orgId,
      period,
      method || 'MA14',
    );
  }

  @Get('procurement/suggest')
  @Roles('L4', 'L5')
  async getProcurementSuggestions(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ): Promise<ProcurementSuggestion[]> {
    return this.franchiseService.getProcurementSuggestions(
      req.user.orgId,
      branchId,
    );
  }

  @Post('procurement/generate-drafts')
  @Roles('L4', 'L5')
  async generateDraftPOs(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      strategy: 'SAFETY_STOCK' | 'FORECAST';
      branchIds?: string[];
    },
  ) {
    return this.franchiseService.generateDraftPOs(
      req.user.orgId,
      req.user.id,
      body.strategy,
      body.branchIds,
    );
  }

  @Get('procurement/drafts')
  @Roles('L4', 'L5')
  async getDraftPOs(@Request() req: RequestWithUser) {
    return this.franchiseService.getDraftPOs(req.user.orgId);
  }

  @Post('procurement/approve')
  @Roles('L5')
  async approvePOs(
    @Request() req: RequestWithUser,
    @Body() body: { poIds: string[] },
  ) {
    return this.franchiseService.approvePOs(req.user.orgId, body.poIds);
  }
}
