import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Cache Invalidation Service for E22 Franchise Performance
 * 
 * Event-driven cache invalidation based on business operations:
 * - PO receive → bust overview, rankings
 * - Transfer create/approve → bust overview, rankings, forecast
 * - Budget update → bust budgets
 * - Inventory adjust/waste → bust overview, rankings, forecast
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Invalidate caches when PO is received
   * Affects: overview, rankings (revenue/costs change)
   */
  async onPoReceived(orgId: string): Promise<void> {
    this.logger.log(`PO received for org ${orgId} - invalidating overview, rankings`);
    
    await Promise.all([
      this.cache.bustPrefix('overview', orgId),
      this.cache.bustPrefix('rankings', orgId),
    ]);
  }

  /**
   * Invalidate caches when transfer is created or approved
   * Affects: overview, rankings, forecast (inventory movement)
   */
  async onTransferChanged(orgId: string): Promise<void> {
    this.logger.log(`Transfer changed for org ${orgId} - invalidating overview, rankings, forecast`);
    
    await Promise.all([
      this.cache.bustPrefix('overview', orgId),
      this.cache.bustPrefix('rankings', orgId),
      this.cache.bustPrefix('forecast', orgId),
    ]);
  }

  /**
   * Invalidate caches when budget is updated
   * Affects: budgets
   */
  async onBudgetUpdated(orgId: string): Promise<void> {
    this.logger.log(`Budget updated for org ${orgId} - invalidating budgets`);
    
    await this.cache.bustPrefix('budgets', orgId);
  }

  /**
   * Invalidate caches when inventory is adjusted or waste is recorded
   * Affects: overview, rankings, forecast (inventory levels change)
   */
  async onInventoryAdjusted(orgId: string): Promise<void> {
    this.logger.log(`Inventory adjusted for org ${orgId} - invalidating overview, rankings, forecast`);
    
    await Promise.all([
      this.cache.bustPrefix('overview', orgId),
      this.cache.bustPrefix('rankings', orgId),
      this.cache.bustPrefix('forecast', orgId),
    ]);
  }

  /**
   * Manual cache bust for specific prefix (admin/debugging)
   */
  async bustManual(prefix: string, orgId: string): Promise<number> {
    this.logger.log(`Manual cache bust: ${prefix} for org ${orgId}`);
    return this.cache.bustPrefix(prefix, orgId);
  }

  /**
   * Bust all caches for an organization (nuclear option)
   */
  async bustAllForOrg(orgId: string): Promise<void> {
    this.logger.warn(`Busting ALL caches for org ${orgId}`);
    
    await Promise.all([
      this.cache.bustPrefix('overview', orgId),
      this.cache.bustPrefix('rankings', orgId),
      this.cache.bustPrefix('budgets', orgId),
      this.cache.bustPrefix('forecast', orgId),
    ]);
  }
}
