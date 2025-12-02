/**
 * Franchise analytics types for E22-FRANCHISE-FE-S1
 * Types mirror backend DTOs for budgets, variance, and forecast
 */

export interface FranchiseBudgetDto {
  branchId: string;
  branchName: string;
  year: number;
  month: number;
  category: string; // "NET_SALES"
  amountCents: number;
  currencyCode: string;
}

export interface FranchiseBudgetVarianceBranchDto {
  branchId: string;
  branchName: string;
  budgetAmountCents: number;
  actualNetSalesCents: number;
  varianceAmountCents: number;
  variancePercent: number;
}

export interface FranchiseBudgetVarianceResponseDto {
  year: number;
  month: number;
  branches: FranchiseBudgetVarianceBranchDto[];
}

export interface FranchiseForecastBranchDto {
  branchId: string;
  branchName: string;
  year: number;
  month: number;
  forecastNetSalesCents: number;
  historicalNetSalesCents: number;
  avgDailyNetSalesCents: number;
  coverageDays: number;
}

export interface FranchiseForecastResponseDto {
  year: number;
  month: number;
  lookbackMonths: number;
  branches: FranchiseForecastBranchDto[];
}

export interface FranchiseMonthlyAggregatePoint {
  year: number;
  month: number;
  label: string; // e.g. "Jan 2025"
  budgetNetSalesCents: number;
  actualNetSalesCents: number;
  forecastNetSalesCents: number;
}

/**
 * E22-FRANCHISE-FE-S3: Branch-level overview KPI
 */
export interface FranchiseOverviewBranchKpi {
  branchId: string;
  branchName: string;
  grossSalesCents: number;
  netSalesCents: number;
  totalOrders: number;
  avgCheckCents: number;
  totalGuests: number;
  marginAmountCents: number;
  marginPercent: number;
  wasteValueCents?: number;
  shrinkValueCents?: number;
  wastePercent?: number;
  shrinkagePercent?: number;
  staffKpiScore?: number;
}

export interface FranchiseOverviewResponseDto {
  branches: FranchiseOverviewBranchKpi[];
}

/**
 * E22-FRANCHISE-FE-S3: Per-branch multi-month time series
 */
export interface FranchiseBranchMonthlyPoint {
  year: number;
  month: number;
  label: string; // "Jan 2025"
  budgetNetSalesCents: number;
  actualNetSalesCents: number;
  forecastNetSalesCents: number;
}
