// E22-S3: Franchise budget variance DTOs
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsArray, IsString, Min, Max } from 'class-validator';

export class FranchiseBudgetVarianceQueryDto {
  @ApiProperty({ description: 'Year for variance comparison', example: 2025 })
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiProperty({ description: 'Month for variance comparison (1-12)', example: 5 })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ required: false, description: 'Filter by branch IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}

export class FranchiseBudgetVarianceBranchDto {
  @ApiProperty({ description: 'Branch ID' })
  branchId: string;

  @ApiProperty({ description: 'Branch name' })
  branchName: string;

  @ApiProperty({ description: 'Budgeted amount in cents', example: 5000000 })
  budgetAmountCents: number;

  @ApiProperty({ description: 'Actual net sales in cents', example: 5500000 })
  actualNetSalesCents: number;

  @ApiProperty({ 
    description: 'Variance amount in cents (actual - budget, positive = over-performance)', 
    example: 500000 
  })
  varianceAmountCents: number;

  @ApiProperty({ 
    description: 'Variance as percentage of budget (variance/budget * 100)', 
    example: 10 
  })
  variancePercent: number;
}

export class FranchiseBudgetVarianceResponseDto {
  @ApiProperty({ description: 'Year of variance report', example: 2025 })
  year: number;

  @ApiProperty({ description: 'Month of variance report', example: 5 })
  month: number;

  @ApiProperty({ description: 'Per-branch variance data', type: [FranchiseBudgetVarianceBranchDto] })
  branches: FranchiseBudgetVarianceBranchDto[];
}
