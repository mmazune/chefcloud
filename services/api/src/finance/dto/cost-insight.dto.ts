import { CostInsightSeverity, BudgetCategory } from '@chefcloud/db';

export interface CostInsightResponse {
  id: string;
  branchId: string;
  branchName: string;
  category: BudgetCategory;
  severity: CostInsightSeverity;
  reason: string;
  suggestion: string;
  supportingMetrics: {
    budgetAmount?: number;
    actualAmount?: number;
    variance?: number;
    variancePercent?: number;
    monthsOverBudget?: number;
    [key: string]: any;
  };
  createdAt: Date;
}

export interface FranchiseCostInsightsResponse {
  period: string;
  totalPotentialSavings: number;
  insights: CostInsightResponse[];
  byBranch: {
    branchId: string;
    branchName: string;
    insightCount: number;
    potentialSavings: number;
  }[];
}
