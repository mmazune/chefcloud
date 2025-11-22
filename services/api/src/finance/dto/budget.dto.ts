import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { BudgetCategory } from '@chefcloud/db';

export class CreateBudgetDto {
  @IsString()
  branchId!: string;

  @IsInt()
  @Min(2020)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsEnum(BudgetCategory)
  category!: BudgetCategory;

  @IsNumber()
  @Min(0)
  budgetAmount!: number;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsNumber()
  actualAmount?: number;
}

export interface BudgetResponse {
  id: string;
  branchId: string;
  branchName: string;
  year: number;
  month: number;
  category: BudgetCategory;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetSummaryResponse {
  branchId: string;
  branchName: string;
  period: string; // e.g., "2024-03"
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
  byCategory: {
    category: BudgetCategory;
    budgetAmount: number;
    actualAmount: number;
    variance: number;
    variancePercent: number;
  }[];
}

export interface FranchiseBudgetSummaryResponse {
  period: string;
  franchiseTotal: {
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
  };
  byBranch: {
    branchId: string;
    branchName: string;
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
    topOverspends: {
      category: BudgetCategory;
      variance: number;
      variancePercent: number;
    }[];
  }[];
}
