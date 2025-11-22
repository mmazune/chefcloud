/**
 * M22: Promotion Insights DTOs
 * 
 * Data Transfer Objects for promotion suggestion endpoints
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { AwardPeriodType } from './staff-insights.dto';

export enum SuggestionCategory {
  PROMOTION = 'PROMOTION',
  ROLE_CHANGE = 'ROLE_CHANGE',
  TRAINING = 'TRAINING',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IGNORED = 'IGNORED',
}

export interface SuggestionConfig {
  minScoreThreshold?: number;
  minTenureMonths?: number;
  maxAbsenceRate?: number;
  excludeRiskLevels?: string[];
  categories?: SuggestionCategory[];
}

export interface PromotionSuggestionDTO {
  employeeId: string;
  displayName: string;
  category: SuggestionCategory;
  scoreAtSuggestion: number;
  reason: string;
  metrics?: any;
}

export interface PromotionSuggestionWithEmployee {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    employeeCode: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  periodType: AwardPeriodType;
  periodStart: Date;
  periodEnd: Date;
  category: SuggestionCategory;
  scoreAtSuggestion: string;
  insightsSnapshot: any;
  reason: string;
  status: SuggestionStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedById: string | null;
  decisionNotes: string | null;
  createdAt: Date;
  createdById: string | null;
}

export interface SuggestionSummary {
  totalSuggestions: number;
  byCategory: Record<SuggestionCategory, number>;
  byStatus: Record<SuggestionStatus, number>;
  topSuggestions: Array<{
    employeeId: string;
    displayName: string;
    category: SuggestionCategory;
    score: number;
    reason: string;
    status: SuggestionStatus;
  }>;
}

// ===== REQUEST DTOs =====

export class PreviewSuggestionsQueryDto {
  @ApiProperty({ enum: AwardPeriodType, description: 'Period type for analysis' })
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter to specific branch' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, description: 'Minimum composite score (default 0.70)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @ApiPropertyOptional({ description: 'Comma-separated categories (PROMOTION,TRAINING,...)' })
  @IsOptional()
  @IsString()
  categories?: string;
}

export class GenerateSuggestionsDto {
  @ApiProperty({ enum: AwardPeriodType, description: 'Period type for suggestions' })
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter to specific branch' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Override default thresholds',
    example: { minScore: 0.75, categories: ['PROMOTION', 'TRAINING'] },
  })
  @IsOptional()
  config?: {
    minScore?: number;
    minTenureMonths?: number;
    categories?: SuggestionCategory[];
  };
}

export class ListSuggestionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter to branch' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filter to employee' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: AwardPeriodType, description: 'Filter by period type' })
  @IsOptional()
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @ApiPropertyOptional({ enum: SuggestionCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(SuggestionCategory)
  category?: SuggestionCategory;

  @ApiPropertyOptional({ enum: SuggestionStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;

  @ApiPropertyOptional({ description: 'From date (ISO 8601)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'To date (ISO 8601)' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200, description: 'Page size' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'Offset for pagination' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class UpdateSuggestionStatusDto {
  @ApiProperty({ enum: SuggestionStatus, description: 'New status' })
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;

  @ApiPropertyOptional({ description: 'Decision notes (why accepted/rejected)' })
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
