/**
 * M4: Report Types for Worker
 * 
 * These types match the DTOs from the API service to ensure consistency.
 */

export interface ShiftEndReport {
  shiftId: string;
  branchName: string;
  openedAt: Date;
  closedAt: Date;
  openedBy: string;
  closedBy: string | null;

  sales: {
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
    tips: number;
    byCategory: Array<{ name: string; quantity: number; revenue: number }>;
    byItem: Array<{ name: string; quantity: number; revenue: number }>;
    byPaymentMethod: Array<{ method: string; count: number; amount: number }>;
  };

  service: {
    waiters: Array<{
      waiterId: string;
      waiterName: string;
      ordersServed: number;
      totalSales: number;
      avgOrderValue: number;
      voidCount: number;
      voidValue: number;
      discountCount: number;
      discountValue: number;
      noDrinksCount: number;
    }>;
  };

  stock: {
    totalUsageValue: number;
    totalVarianceValue: number;
    totalWastageValue: number;
    lowStockItems: Array<{
      itemName: string;
      currentStock: number;
      reorderLevel: number;
    }>;
  };

  kdsMetrics: {
    totalTickets: number;
    slaMetrics: {
      greenPct: number;
      orangePct: number;
      redPct: number;
    };
    byStation: Array<{
      station: string;
      green: number;
      orange: number;
      red: number;
    }>;
  };

  staff: {
    topPerformers: Array<{
      userId: string;
      userName: string;
      metric: string;
      value: number;
    }>;
    needsImprovement: Array<{
      userId: string;
      userName: string;
      issue: string;
      count: number;
    }>;
  };

  anomalies: Array<{
    orderId: string;
    type: string;
    description: string;
    severity: string;
    userId: string;
    timestamp: Date;
  }>;
}
