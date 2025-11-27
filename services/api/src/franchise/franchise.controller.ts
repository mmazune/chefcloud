import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CacheService } from '../common/cache.service';
import {
  FranchiseService,
  BranchOverview,
  BranchRanking,
  ForecastItemData,
  ProcurementSuggestion,
} from './franchise.service';
import { FranchiseOverviewService } from './franchise-overview.service';

interface RequestWithUser {
  user: {
    id: string;
    orgId: string;
    branchId: string;
  };
}

@ApiTags('Franchise')
@ApiBearerAuth('bearer')
@Controller('franchise')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FranchiseController {
  // E22.A: Read-through cache TTL for /franchise/overview (default 15s, env-configurable)
  private readonly overviewTTL = Number(process.env.E22_OVERVIEW_TTL ?? 15);

  // E22.B: Read-through cache TTL for /franchise/rankings (default 30s, env-configurable)
  private readonly rankingsTTL = Number(process.env.E22_RANKINGS_TTL ?? 30);

  // E22.C: Read-through cache TTL for /franchise/budgets (default 60s, env-configurable)
  private readonly budgetsTTL = Number(process.env.E22_BUDGETS_TTL ?? 60);

  constructor(
    private franchiseService: FranchiseService,
    private franchiseOverviewService: FranchiseOverviewService,
    private cacheService: CacheService,
  ) {}

  @ApiOperation({
    summary: 'Franchise overview',
    description: 'KPIs and aggregates for a given org/period',
  })
  @ApiQuery({ name: 'period', required: true, type: String })
  @Get('overview')
  @Roles('L5')
  async getOverview(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
  ): Promise<{ data: BranchOverview[]; cached: boolean } | { error: string }> {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }

    // E22.A: Read-through caching with deterministic key
    const startTime = Date.now();
    const cacheKey = this.cacheService.makeKey('fr:overview', req.user.orgId, { period });
    const indexKey = this.cacheService.makeIndexKey('overview', req.user.orgId);

    const result = await this.cacheService.readThroughWithFlag<BranchOverview[]>(
      cacheKey,
      this.overviewTTL,
      async () => {
        return this.franchiseService.getOverview(req.user.orgId, period);
      },
      indexKey,
      'franchise_overview',
    );

    const elapsed = Date.now() - startTime;

    // E22.A: Emit metrics (structured console logs)
    const metricType = result.cached ? 'cache_hits' : 'cache_misses';
    console.log(
      `[METRIC] ${metricType} endpoint=franchise_overview count=1 orgId=${req.user.orgId} period=${period}`,
    );
    console.log(
      `[METRIC] db_query_ms endpoint=franchise_overview value=${elapsed} cached=${result.cached} orgId=${req.user.orgId}`,
    );

    // Return data with cached flag
    return result;
  }

  @ApiOperation({
    summary: 'Branch/item rankings',
    description: 'Rank performance by configured dimensions',
  })
  @ApiQuery({ name: 'period', required: true, type: String })
  @Get('rankings')
  @Roles('L5')
  async getRankings(
    @Request() req: RequestWithUser,
    @Query('period') period: string,
  ): Promise<{ data: BranchRanking[]; cached: boolean } | { error: string }> {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }

    // E22.B: Read-through caching with deterministic key
    const startTime = Date.now();
    const cacheKey = this.cacheService.makeKey('fr:rankings', req.user.orgId, { period });
    const indexKey = this.cacheService.makeIndexKey('rankings', req.user.orgId);

    const result = await this.cacheService.readThroughWithFlag<BranchRanking[]>(
      cacheKey,
      this.rankingsTTL,
      async () => {
        return this.franchiseService.getRankings(req.user.orgId, period);
      },
      indexKey,
      'franchise_rankings',
    );

    const elapsed = Date.now() - startTime;

    // E22.B: Emit metrics (structured console logs)
    const metricType = result.cached ? 'cache_hits' : 'cache_misses';
    console.log(
      `[METRIC] ${metricType} endpoint=franchise_rankings count=1 orgId=${req.user.orgId} period=${period}`,
    );
    console.log(
      `[METRIC] db_query_ms endpoint=franchise_rankings value=${elapsed} cached=${result.cached} orgId=${req.user.orgId}`,
    );

    // Return data with cached flag
    return result;
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
    return this.franchiseService.upsertBudget(req.user.orgId, body.branchId, body.period, {
      revenueTarget: body.revenueTarget,
      cogsTarget: body.cogsTarget,
      expenseTarget: body.expenseTarget,
      notes: body.notes,
    });
  }

  @ApiOperation({
    summary: 'Budget vs actuals',
    description: 'Budget tracking and variance reporting',
  })
  @ApiQuery({ name: 'period', required: true, type: String })
  @Get('budgets')
  @Roles('L5')
  async getBudgets(@Request() req: RequestWithUser, @Query('period') period: string) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return { error: 'Invalid period format. Use YYYY-MM' };
    }

    // E22.C: Read-through caching with deterministic key
    const startTime = Date.now();
    const cacheKey = this.cacheService.makeKey('fr:budgets', req.user.orgId, { period });
    const indexKey = this.cacheService.makeIndexKey('budgets', req.user.orgId);

    const result = await this.cacheService.readThroughWithFlag(
      cacheKey,
      this.budgetsTTL,
      async () => {
        return this.franchiseService.getBudgets(req.user.orgId, period);
      },
      indexKey,
      'franchise_budgets',
    );

    const elapsed = Date.now() - startTime;

    // E22.C: Emit metrics (structured console logs)
    const metricType = result.cached ? 'cache_hits' : 'cache_misses';
    console.log(
      `[METRIC] ${metricType} endpoint=franchise_budgets count=1 orgId=${req.user.orgId} period=${period}`,
    );
    console.log(
      `[METRIC] db_query_ms endpoint=franchise_budgets value=${elapsed} cached=${result.cached} orgId=${req.user.orgId}`,
    );

    // Return data with cached flag
    return result;
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
    // E22: Cached with 300s (5min) TTL
    return this.franchiseService.getForecastItems(req.user.orgId, period, method || 'MA14');
  }

  @Get('procurement/suggest')
  @Roles('L4', 'L5')
  async getProcurementSuggestions(
    @Request() req: RequestWithUser,
    @Query('branchId') branchId?: string,
  ): Promise<ProcurementSuggestion[]> {
    return this.franchiseService.getProcurementSuggestions(req.user.orgId, branchId);
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
  async approvePOs(@Request() req: RequestWithUser, @Body() body: { poIds: string[] }) {
    return this.franchiseService.approvePOs(req.user.orgId, body.poIds);
  }

  @ApiOperation({
    summary: 'Branch metrics for analytics',
    description: 'Get per-branch KPIs for analytics dashboard (M25-S2)',
  })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  @Get('branch-metrics')
  @Roles('L4', 'L5', 'ACCOUNTANT')
  async getBranchMetrics(
    @Request() req: RequestWithUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      return { error: 'Missing from/to date parameters' };
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { error: 'Invalid date format' };
    }

    const summary = await this.franchiseOverviewService.getFranchiseSummary(
      req.user.orgId,
      fromDate,
      toDate,
    );
    return summary.branches;
  }
}
