// services/api/src/franchise/dto/franchise-rankings.dto.ts
import { IsEnum, IsOptional, IsNumber, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum FranchiseRankingMetric {
  NET_SALES = 'NET_SALES',
  MARGIN_PERCENT = 'MARGIN_PERCENT',
  WASTE_PERCENT = 'WASTE_PERCENT',
  SHRINKAGE_PERCENT = 'SHRINKAGE_PERCENT',
  STAFF_KPI_SCORE = 'STAFF_KPI_SCORE',
}

export class FranchiseRankingsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in ISO format (YYYY-MM-DD). Defaults to today if omitted.',
    example: '2025-12-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO format (YYYY-MM-DD). Defaults to today if omitted.',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({
    description: 'Ranking metric to sort by',
    enum: FranchiseRankingMetric,
    example: FranchiseRankingMetric.NET_SALES,
  })
  @IsEnum(FranchiseRankingMetric)
  metric: FranchiseRankingMetric;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return (default: 50)',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Optional array of branch IDs to filter results',
    example: ['branch-1', 'branch-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}

export class FranchiseRankingEntryDto {
  @ApiProperty({ description: 'Branch ID' })
  branchId: string;

  @ApiProperty({ description: 'Branch name' })
  branchName: string;

  @ApiProperty({ description: 'Value of the ranking metric' })
  value: number;

  @ApiProperty({ description: 'Rank (1 = best)' })
  rank: number;
}

export class FranchiseRankingsResponseDto {
  @ApiProperty({ description: 'Start date of the reporting period (ISO format)' })
  fromDate: string;

  @ApiProperty({ description: 'End date of the reporting period (ISO format)' })
  toDate: string;

  @ApiProperty({
    description: 'The metric used for ranking',
    enum: FranchiseRankingMetric,
  })
  metric: FranchiseRankingMetric;

  @ApiProperty({
    description: 'Ranked entries (sorted by metric value)',
    type: [FranchiseRankingEntryDto],
  })
  entries: FranchiseRankingEntryDto[];
}
