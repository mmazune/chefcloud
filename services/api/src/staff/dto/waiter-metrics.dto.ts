/**
 * M5: Canonical Waiter Metrics DTOs
 * 
 * Single source of truth for waiter/staff performance metrics used across:
 * - Anti-theft dashboards
 * - Owner digests
 * - Staff rankings
 * - Employee-of-the-month suggestions (future)
 */

export interface WaiterMetrics {
  userId: string;
  displayName: string;
  
  // Sales metrics
  totalSales: number;
  orderCount: number;
  avgCheckSize: number;
  
  // Risk metrics
  voidCount: number;
  voidValue: number;
  discountCount: number;
  discountValue: number;
  noDrinksRate: number; // 0-1 (proportion)
  
  // Operational metrics
  wastageCostAttributed?: number; // If wastage attribution available
  anomalyCount: number;
  anomalyScore?: number; // Weighted severity score
  
  // Period context
  periodStart: Date;
  periodEnd: Date;
}

export interface RankedWaiter extends WaiterMetrics {
  rank: number;
  score: number;
  scoreComponents?: {
    salesScore: number;
    avgCheckScore: number;
    voidPenalty: number;
    discountPenalty: number;
    noDrinksPenalty: number;
    anomalyPenalty: number;
  };
}

export interface WaiterMetricsQuery {
  orgId: string;
  branchId?: string;
  
  // Period specification (use shiftId OR date range)
  shiftId?: string;
  from?: Date;
  to?: Date;
}

export interface WaiterScoringConfig {
  // Positive weight factors (0-1)
  salesWeight: number;
  avgCheckWeight: number;
  
  // Penalty factors (0-1)
  voidPenalty: number;
  discountPenalty: number;
  noDrinksPenalty: number;
  anomalyPenalty: number;
}

export const DEFAULT_SCORING_CONFIG: WaiterScoringConfig = {
  salesWeight: 0.4,
  avgCheckWeight: 0.2,
  voidPenalty: 0.15,
  discountPenalty: 0.15,
  noDrinksPenalty: 0.05,
  anomalyPenalty: 0.05,
};
