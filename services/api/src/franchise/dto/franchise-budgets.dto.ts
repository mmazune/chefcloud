// E22-S3: Franchise budgets DTOs
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export const FRANCHISE_BUDGET_CATEGORY_NET_SALES = 'NET_SALES' as const;
export type FranchiseBudgetCategory = typeof FRANCHISE_BUDGET_CATEGORY_NET_SALES;

export class FranchiseBudgetFilterDto {
  @ApiProperty({ required: false, description: 'Filter by year', example: 2025 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(9999)
  year?: number;

  @ApiProperty({ required: false, description: 'Filter by month (1-12)', example: 5 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ required: false, description: 'Filter by branch IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}

export class FranchiseBudgetUpsertItemDto {
  @ApiProperty({ description: 'Branch ID', example: 'branch-123' })
  @IsString()
  branchId: string;

  @ApiProperty({ description: 'Budget year', example: 2025 })
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(9999)
  year: number;

  @ApiProperty({ description: 'Budget month (1-12)', example: 5 })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Budget category', enum: ['NET_SALES'], example: 'NET_SALES' })
  @IsString()
  @IsIn([FRANCHISE_BUDGET_CATEGORY_NET_SALES])
  category: FranchiseBudgetCategory;

  @ApiProperty({ description: 'Budget amount in cents', example: 5000000 })
  @IsInt()
  @Type(() => Number)
  amountCents: number;

  @ApiProperty({ description: 'Currency code', example: 'UGX' })
  @IsString()
  currencyCode: string;
}

export class FranchiseBudgetUpsertDto {
  @ApiProperty({ description: 'Array of budget items to upsert', type: [FranchiseBudgetUpsertItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FranchiseBudgetUpsertItemDto)
  items: FranchiseBudgetUpsertItemDto[];
}

export class FranchiseBudgetDto {
  @ApiProperty({ description: 'Budget ID' })
  id: string;

  @ApiProperty({ description: 'Branch ID' })
  branchId: string;

  @ApiProperty({ description: 'Branch name' })
  branchName: string;

  @ApiProperty({ description: 'Budget year', example: 2025 })
  year: number;

  @ApiProperty({ description: 'Budget month (1-12)', example: 5 })
  month: number;

  @ApiProperty({ description: 'Budget category', enum: ['NET_SALES'] })
  category: FranchiseBudgetCategory;

  @ApiProperty({ description: 'Budget amount in cents', example: 5000000 })
  amountCents: number;

  @ApiProperty({ description: 'Currency code', example: 'UGX' })
  currencyCode: string;
}
