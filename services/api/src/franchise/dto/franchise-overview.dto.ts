// services/api/src/franchise/dto/franchise-overview.dto.ts
import { IsOptional, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FranchiseOverviewQueryDto {
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

export class FranchiseBranchKpiDto {
  @ApiProperty({ description: 'Branch ID' })
  branchId: string;

  @ApiProperty({ description: 'Branch name' })
  branchName: string;

  @ApiProperty({ description: 'Gross sales (before discounts)' })
  grossSales: number;

  @ApiProperty({ description: 'Net sales (after discounts)' })
  netSales: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Average check value' })
  avgCheck: number;

  @ApiProperty({ description: 'Total number of guests served' })
  totalGuests: number;

  @ApiProperty({ description: 'Margin amount (gross - costs)' })
  marginAmount: number;

  @ApiProperty({ description: 'Margin percentage (0-100)' })
  marginPercent: number;

  @ApiProperty({ description: 'Number of cancelled orders' })
  cancelledOrders: number;

  @ApiProperty({ description: 'Number of voided orders' })
  voidedOrders: number;

  // E22-S2: Advanced ranking metrics
  @ApiProperty({ description: 'Total waste value in base currency cents' })
  wasteValue: number;

  @ApiProperty({ description: 'Total shrinkage value in base currency cents' })
  shrinkValue: number;

  @ApiProperty({ description: 'Waste as percentage of net sales (0-100)' })
  wastePercent: number;

  @ApiProperty({ description: 'Shrinkage as percentage of net sales (0-100)' })
  shrinkagePercent: number;

  @ApiProperty({ description: 'Average staff KPI composite score (0-100)' })
  staffKpiScore: number;
}

export class FranchiseTotalsDto {
  @ApiProperty({ description: 'Total gross sales across all branches' })
  grossSales: number;

  @ApiProperty({ description: 'Total net sales across all branches' })
  netSales: number;

  @ApiProperty({ description: 'Total number of orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Total number of guests' })
  totalGuests: number;

  @ApiProperty({ description: 'Total margin amount' })
  marginAmount: number;

  @ApiProperty({ description: 'Overall margin percentage' })
  marginPercent: number;
}

export class FranchiseOverviewResponseDto {
  @ApiProperty({ description: 'Start date of the reporting period (ISO format)' })
  fromDate: string;

  @ApiProperty({ description: 'End date of the reporting period (ISO format)' })
  toDate: string;

  @ApiProperty({
    description: 'Per-branch KPI metrics',
    type: [FranchiseBranchKpiDto],
  })
  branches: FranchiseBranchKpiDto[];

  @ApiProperty({
    description: 'Aggregated totals across all branches',
    type: FranchiseTotalsDto,
  })
  totals: FranchiseTotalsDto;
}
