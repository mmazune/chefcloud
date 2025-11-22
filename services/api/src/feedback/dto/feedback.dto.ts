import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { FeedbackChannel, NpsCategory } from '@prisma/client';

/**
 * M20: Customer Feedback DTOs
 */

// ===== Create Feedback DTOs =====

/**
 * DTO for public feedback submission (no auth required)
 */
export class CreatePublicFeedbackDto {
  @ValidateIf((o) => !o.reservationId && !o.ticketCode)
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ValidateIf((o) => !o.orderNumber && !o.ticketCode)
  @IsString()
  @IsOptional()
  reservationId?: string;

  @ValidateIf((o) => !o.orderNumber && !o.reservationId)
  @IsString()
  @IsOptional()
  ticketCode?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @IsEnum(FeedbackChannel)
  channel!: FeedbackChannel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

/**
 * DTO for authenticated feedback submission
 */
export class CreateFeedbackDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  eventBookingId?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @IsEnum(FeedbackChannel)
  channel!: FeedbackChannel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sentimentHint?: string; // "positive", "negative", "neutral"
}

// ===== Query DTOs =====

/**
 * DTO for listing feedback with filters
 */
export class ListFeedbackQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  minScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  maxScore?: number;

  @IsOptional()
  @IsEnum(FeedbackChannel)
  channel?: FeedbackChannel;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasComment?: boolean;

  @IsOptional()
  @IsEnum(NpsCategory)
  npsCategory?: NpsCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  offset?: number = 0;
}

/**
 * DTO for NPS summary query
 */
export class NpsSummaryQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsEnum(FeedbackChannel)
  channel?: FeedbackChannel;
}

/**
 * DTO for top comments query
 */
export class TopCommentsQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  sentiment?: 'positive' | 'negative';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}

// ===== Response Interfaces =====

/**
 * NPS Summary response interface
 */
export interface NpsSummary {
  nps: number; // -100 to +100
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
  totalCount: number;
  promoterPct: number; // 0-100
  passivePct: number; // 0-100
  detractorPct: number; // 0-100
  avgScore: number; // 0-10 (mean)
  period: {
    from: Date;
    to: Date;
  };
  filters: {
    branchId?: string;
    channel?: FeedbackChannel;
  };
}

/**
 * Score breakdown response interface
 */
export interface ScoreBreakdown {
  breakdown: Array<{
    score: number; // 0-10
    count: number;
    percentage: number;
  }>;
  totalCount: number;
}

/**
 * Entity verification result (internal use)
 */
export interface EntityVerification {
  orgId: string;
  branchId?: string;
  entityId: string;
  entityType: 'order' | 'reservation' | 'eventBooking';
}
