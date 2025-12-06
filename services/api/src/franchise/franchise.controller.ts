import { Controller, Get, Put, Post, Body, Query, UseGuards, Request, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Response } from 'express';
import { CacheService } from '../common/cache.service';
import {
  FranchiseService,
  BranchOverview,
  BranchRanking,
  ForecastItemData,
  ProcurementSuggestion,
} from './franchise.service';
import { FranchiseOverviewService } from './franchise-overview.service';
import { FranchiseAnalyticsService } from './franchise-analytics.service';
import { FranchiseOverviewQueryDto, FranchiseOverviewResponseDto } from './dto/franchise-overview.dto';
import { FranchiseRankingsQueryDto, FranchiseRankingsResponseDto, FranchiseRankingMetric } from './dto/franchise-rankings.dto';
import {
  FranchiseBudgetFilterDto,
  FranchiseBudgetUpsertDto,
  FranchiseBudgetDto,
} from './dto/franchise-budgets.dto';
import {
  FranchiseBudgetVarianceQueryDto,
  FranchiseBudgetVarianceResponseDto,
} from './dto/franchise-budgets-variance.dto';
import {
  FranchiseForecastQueryDto,
  FranchiseForecastResponseDto,
} from './dto/franchise-forecast.dto';

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
    private franchiseAnalyticsService: FranchiseAnalyticsService,
    private cacheService: CacheService,
  ) {}

  // E22-S1: New franchise analytics endpoints (date range-based)
  @ApiOperation({
    summary: 'Franchise overview with date range',
    description: 'Per-branch KPIs and totals for specified date range (E22-S1)',
  })
  @Get('analytics/overview')
  @Roles('L4', 'L5')  // Manager and Owner
  async getAnalyticsOverview(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseOverviewQueryDto,
  ): Promise<FranchiseOverviewResponseDto> {
    return this.franchiseAnalyticsService.getOverviewForOrg(req.user.orgId, query);
  }

  @ApiOperation({
    summary: 'Franchise branch rankings',
    description: 'Ranked branches by selected metric for specified date range (E22-S1)',
  })
  @Get('analytics/rankings')
  @Roles('L4', 'L5')  // Manager and Owner
  async getAnalyticsRankings(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseRankingsQueryDto,
  ): Promise<FranchiseRankingsResponseDto> {
    // Validate supported metrics (E22-S1: sales/margin; E22-S2: waste/shrinkage/staff)
    const supportedMetrics: FranchiseRankingMetric[] = [
      FranchiseRankingMetric.NET_SALES,
      FranchiseRankingMetric.MARGIN_PERCENT,
      FranchiseRankingMetric.WASTE_PERCENT,
      FranchiseRankingMetric.SHRINKAGE_PERCENT,
      FranchiseRankingMetric.STAFF_KPI_SCORE,
    ];

    if (!supportedMetrics.includes(query.metric)) {
      throw new BadRequestException(
        `Unsupported ranking metric: ${query.metric}. Supported metrics: ${supportedMetrics.join(', ')}`,
      );
    }

    return this.franchiseAnalyticsService.getRankingsForOrg(req.user.orgId, query);
  }

  // Legacy endpoints (period-based) - kept for backward compatibility
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
  async getBudgetsLegacy(@Request() req: RequestWithUser, @Query('period') period: string) {
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

  // E22-S3: Franchise budgets endpoints

  @ApiOperation({
    summary: 'Get franchise budgets',
    description: 'Retrieve branch budgets with optional filters by year, month, and branch IDs',
  })
  @Get('budgets')
  @Roles('L4', 'L5', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async getBudgets(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseBudgetFilterDto,
  ): Promise<FranchiseBudgetDto[]> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }
    return this.franchiseAnalyticsService.getBudgetsForOrg(orgId, query);
  }

  @ApiOperation({
    summary: 'Bulk upsert franchise budgets',
    description: 'Create or update multiple branch budgets in a single request (idempotent)',
  })
  @Put('budgets')
  @Roles('L5', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async upsertBudgets(
    @Request() req: RequestWithUser,
    @Body() body: FranchiseBudgetUpsertDto,
  ): Promise<{ updated: number }> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }

    await this.franchiseAnalyticsService.upsertBudgetsForOrg(orgId, body);
    return { updated: body.items.length };
  }

  @ApiOperation({
    summary: 'Get budget vs actual variance',
    description: 'Compare budgeted vs actual net sales for a specific month',
  })
  @Get('budgets/variance')
  @Roles('L4', 'L5', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async getBudgetVariance(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseBudgetVarianceQueryDto,
  ): Promise<FranchiseBudgetVarianceResponseDto> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }
    return this.franchiseAnalyticsService.getBudgetVarianceForOrg(orgId, query);
  }

  @ApiOperation({
    summary: 'Get franchise sales forecast',
    description: 'Predict net sales per branch for a target month based on historical weekday averages',
  })
  @Get('forecast')
  @Roles('L4', 'L5', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async getForecast(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseForecastQueryDto,
  ): Promise<FranchiseForecastResponseDto> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }
    return this.franchiseAnalyticsService.getForecastForOrg(orgId, query);
  }

  // E22-S6: CSV Export Endpoints

  @ApiOperation({
    summary: 'Export franchise overview as CSV',
    description: 'Download franchise overview KPIs in CSV format for Excel/Sheets',
  })
  @Get('export/overview.csv')
  @Roles('OWNER', 'MANAGER', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async exportOverviewCsv(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseOverviewQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }

    const csv = await this.franchiseAnalyticsService.getOverviewCsvForOrg(
      orgId,
      query,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="franchise-overview.csv"',
    );
    res.send(csv);
  }

  @ApiOperation({
    summary: 'Export franchise rankings as CSV',
    description: 'Download franchise rankings by metric in CSV format',
  })
  @Get('export/rankings.csv')
  @Roles('OWNER', 'MANAGER', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async exportRankingsCsv(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseRankingsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }

    const csv = await this.franchiseAnalyticsService.getRankingsCsvForOrg(
      orgId,
      query,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="franchise-rankings.csv"',
    );
    res.send(csv);
  }

  @ApiOperation({
    summary: 'Export franchise budgets as CSV',
    description: 'Download franchise budgets in CSV format',
  })
  @Get('export/budgets.csv')
  @Roles('OWNER', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async exportBudgetsCsv(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseBudgetFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }

    const csv = await this.franchiseAnalyticsService.getBudgetsCsvForOrg(
      orgId,
      query,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="franchise-budgets.csv"',
    );
    res.send(csv);
  }

  @ApiOperation({
    summary: 'Export franchise budget variance as CSV',
    description: 'Download franchise budget vs actual variance analysis in CSV format',
  })
  @Get('export/budgets-variance.csv')
  @Roles('OWNER', 'MANAGER', 'ACCOUNTANT', 'FRANCHISE_OWNER')
  async exportBudgetVarianceCsv(
    @Request() req: RequestWithUser,
    @Query() query: FranchiseBudgetVarianceQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new BadRequestException('Missing org context');
    }

    const csv =
      await this.franchiseAnalyticsService.getBudgetVarianceCsvForOrg(
        orgId,
        query,
      );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="franchise-budgets-variance.csv"',
    );
    res.send(csv);
  }
}
