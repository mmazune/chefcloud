/**
 * M19: Staff Insights & Employee-of-the-Month DTOs
 * 
 * Combines performance metrics (M5) with reliability metrics (M9)
 * to provide comprehensive staff insights and award recommendations.
 */

import { IsString, IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WaiterMetrics } from './waiter-metrics.dto';

// ===== Enums (match Prisma schema) =====

export enum AwardPeriodType {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export enum AwardCategory {
  TOP_PERFORMER = 'TOP_PERFORMER',
  HIGHEST_SALES = 'HIGHEST_SALES',
  BEST_SERVICE = 'BEST_SERVICE',
  MOST_RELIABLE = 'MOST_RELIABLE',
  MOST_IMPROVED = 'MOST_IMPROVED',
}

// ===== Core Interfaces =====

export interface ReliabilityMetrics {
  employeeId: string;
  userId: string | null;
  displayName: string;
  
  // Attendance data
  shiftsScheduled: number;
  shiftsWorked: number;
  shiftsAbsent: number;
  lateCount: number;
  leftEarlyCount: number;
  coverShiftsCount: number;
  
  // Computed scores
  attendanceRate: number; // 0-1
  reliabilityScore: number; // 0-1 (weighted)
}

export interface CombinedStaffMetrics {
  userId: string;
  employeeId: string;
  displayName: string;
  
  // Composite scoring
  performanceScore: number; // 0-1 from M5
  reliabilityScore: number; // 0-1 from M9
  compositeScore: number; // 0-1 (70% performance + 30% reliability)
  rank?: number; // Assigned after ranking
  
  // Source metrics
  performanceMetrics: WaiterMetrics;
  reliabilityMetrics: ReliabilityMetrics;
  
  // Risk flags
  riskFlags: any[]; // From AntiTheftService
  isCriticalRisk: boolean;
  
  // Eligibility
  isEligible?: boolean;
  eligibilityReason?: string;
}

export interface Period {
  type: AwardPeriodType;
  start: Date;
  end: Date;
  label: string; // e.g., "Week 47, 2025" or "November 2025"
}

export interface EligibilityRules {
  minShifts: number;
  maxAbsenceRate: number | null;
  requireActiveStatus: boolean;
  excludeCriticalRisk: boolean;
}

export interface StaffInsights {
  rankings: CombinedStaffMetrics[];
  period: Period;
  eligibilityRules: EligibilityRules;
  summary: {
    totalStaff: number;
    eligibleStaff: number;
    averageScore: number;
  };
}

export interface AwardRecommendation {
  employeeId: string;
  userId: string | null;
  displayName: string;
  category: AwardCategory;
  score: number;
  rank: number;
  
  performanceScore: number;
  reliabilityScore: number;
  
  metrics: {
    performance: WaiterMetrics;
    reliability: ReliabilityMetrics;
  };
  
  reason: string;
  periodLabel: string;
  eligibilityPassed: boolean;
}

// ===== Request DTOs =====

export class StaffInsightsQueryDto {
  @IsEnum(AwardPeriodType)
  periodType!: AwardPeriodType;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class GetEmployeeOfPeriodDto {
  @IsOptional()
  @IsDateString()
  referenceDate?: string; // Defaults to today

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(AwardCategory)
  category?: AwardCategory;
}

export class CreateAwardDto {
  @IsEnum(AwardPeriodType)
  periodType!: AwardPeriodType;

  @IsDateString()
  referenceDate!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(AwardCategory)
  category?: AwardCategory;
}

export class ListAwardsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @IsOptional()
  @IsEnum(AwardCategory)
  category?: AwardCategory;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
