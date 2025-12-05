import { Controller, HttpCode, Post } from '@nestjs/common';
import { CacheInvalidationService } from '../../src/common/cache-invalidation.service';

@Controller('franchise-test')
export class FranchiseInvalidationTestController {
  constructor(private readonly inv: CacheInvalidationService) {}

  /**
   * Test-only endpoint to trigger cache invalidation
   * Invalidates all known franchise cache key prefixes
   */
  @Post('invalidate')
  @HttpCode(200)
  async invalidate() {
    try {
      // Trigger invalidation methods for test org
      const testOrgId = 'org_1';
      
      await Promise.allSettled([
        this.inv.onPoReceived?.(testOrgId), // Invalidates overview, rankings
        this.inv.onBudgetUpdated?.(testOrgId), // Invalidates budgets
        this.inv.onTransferChanged?.(testOrgId), // Invalidates overview, rankings, forecast
      ]);
      
      return { ok: true, invalidated: ['overview', 'rankings', 'budgets', 'forecast'] };
    } catch (e) {
      return { ok: false, error: 'invalidation_failed', message: e.message };
    }
  }
}
