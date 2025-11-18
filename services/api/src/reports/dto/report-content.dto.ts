/**
 * Canonical Shift-End Report Data Structure
 * 
 * This interface defines the complete data structure for a shift-end report,
 * ensuring consistency across PDF/CSV generation, API responses, and dashboards.
 */

export interface ShiftEndReport {
  // Meta information
  reportId: string;
  orgId: string;
  branchId: string;
  shiftId: string;
  period: {
    startedAt: Date;
    closedAt: Date;
    durationHours: number;
  };
  generatedAt: Date;

  // Sales Report
  sales: {
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      quantity: number;
      revenue: number;
      percentage: number;
    }>;
    byItem: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      revenue: number;
      cost?: number;
      margin?: number;
    }>;
    byPaymentMethod: Array<{
      method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'OTHER';
      count: number;
      amount: number;
      percentage: number;
    }>;
    totals: {
      orders: number;
      revenue: number;
      tax: number;
      discounts: number;
      tips: number;
      averageCheck: number;
    };
  };

  // Service Report (Per Waiter/Cashier)
  service: {
    byWaiter: Array<{
      userId: string;
      userName: string;
      orders: number;
      revenue: number;
      voidCount: number;
      voidAmount: number;
      discountCount: number;
      discountAmount: number;
      averageCheck: number;
      noDrinksCount: number;
      noDrinksRate: number;
    }>;
    totals: {
      totalVoids: number;
      totalVoidAmount: number;
      totalDiscounts: number;
      totalDiscountAmount: number;
    };
  };

  // Stock & Wastage Report
  stock: {
    usage: Array<{
      itemId: string;
      itemName: string;
      unitUsed: number;
      costUsed: number;
    }>;
    wastage: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      cost: number;
      reason: string;
    }>;
    reconciliation?: {
      itemsReconciled: number;
      itemsWithVariance: number;
      totalVarianceCost: number;
      outOfToleranceCount: number;
    };
    lowStock: Array<{
      itemId: string;
      itemName: string;
      currentQty: number;
      minQty: number;
      daysRemaining: number;
      alertLevel: 'LOW' | 'CRITICAL';
    }>;
    totals: {
      totalUsageCost: number;
      totalWastageCost: number;
      wastagePercentage: number;
    };
  };

  // Kitchen/Bar Performance
  kds: {
    byStation: Array<{
      station: string;
      ticketsCompleted: number;
      averageCompletionMinutes: number;
      slaBreaches: {
        green: number; // Within SLA
        orange: number; // Warning
        red: number; // Breach
      };
      slaPercentage: number;
    }>;
    totals: {
      totalTickets: number;
      averageCompletionMinutes: number;
      overallSlaPercentage: number;
    };
  };

  // Staff Performance Summary
  staffPerformance: {
    topPerformers: Array<{
      userId: string;
      userName: string;
      role: string;
      score: number;
      metrics: {
        sales?: number;
        voidRate?: number;
        slaPercentage?: number;
      };
    }>;
    riskStaff: Array<{
      userId: string;
      userName: string;
      role: string;
      reason: string;
      anomalyCount: number;
    }>;
  };

  // Anomalies & Alerts
  anomalies: {
    count: number;
    byType: Record<string, number>;
    recent: Array<{
      type: string;
      severity: 'INFO' | 'WARN' | 'ERROR';
      userId?: string;
      details: any;
      occurredAt: Date;
    }>;
  };
}

/**
 * Daily/Weekly/Monthly Digest Data Structure
 * Extends shift-end report with period aggregation
 */
export interface PeriodDigest {
  reportId: string;
  orgId: string;
  branchId?: string; // Optional for franchise-level
  period: {
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;

  // Aggregated metrics across all shifts in period
  summary: {
    shifts: number;
    revenue: number;
    orders: number;
    averageDailyRevenue: number;
    growth: {
      revenue: number; // % vs previous period
      orders: number;
    };
  };

  // Same structure as shift-end but aggregated
  sales: ShiftEndReport['sales'];
  service: ShiftEndReport['service'];
  stock: ShiftEndReport['stock'];
  kds: ShiftEndReport['kds'];
  staffPerformance: ShiftEndReport['staffPerformance'];
  anomalies: ShiftEndReport['anomalies'];

  // Trend data for sparklines
  trends: {
    dailyRevenue: number[];
    dailyOrders: number[];
  };
}

/**
 * Franchise-Level Digest Data Structure
 * Aggregates data across multiple branches
 */
export interface FranchiseDigest {
  reportId: string;
  orgId: string;
  period: {
    type: 'WEEKLY' | 'MONTHLY';
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;

  // Franchise-wide summary
  summary: {
    branches: number;
    totalRevenue: number;
    totalOrders: number;
    averageRevenuePerBranch: number;
  };

  // Per-branch performance
  byBranch: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    orders: number;
    wastePercentage: number;
    slaPercentage: number;
    ranking: number;
    budgetVsActual: {
      budget: number;
      actual: number;
      variance: number;
      variancePercentage: number;
    };
  }>;

  // Branch rankings
  rankings: {
    byRevenue: string[]; // Branch IDs in order
    byMargin: string[];
    bySLA: string[];
    byWaste: string[]; // Lowest waste first
  };

  // Aggregated metrics
  totals: {
    revenue: number;
    cost: number;
    grossMargin: number;
    wastage: number;
    anomalies: number;
  };

  // Procurement suggestions
  procurement?: {
    suggestions: Array<{
      itemId: string;
      itemName: string;
      recommendedQty: number;
      estimatedCost: number;
      branches: string[];
    }>;
  };
}
