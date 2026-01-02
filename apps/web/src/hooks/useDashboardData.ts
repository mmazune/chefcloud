/**
 * Dashboard Data Hooks
 * Milestone 6: ChefCloud V2 UX Upgrade
 * 
 * M7.1 UPDATE: Demo fallbacks are now gated behind NEXT_PUBLIC_ALLOW_DEMO_FALLBACK env var.
 * Set to 'true' only in demo environments. Default is OFF (errors surface properly).
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// M7.1: Gate demo fallbacks behind env var - default OFF
const ALLOW_DEMO_FALLBACK = process.env.NEXT_PUBLIC_ALLOW_DEMO_FALLBACK === 'true';

// M7.1: Wrapper to conditionally return fallback data or throw
function handleFallback<T>(error: unknown, fallbackData: T, hookName: string): T {
  if (ALLOW_DEMO_FALLBACK) {
    console.warn(`[${hookName}] API failed, using DEMO FALLBACK:`, error);
    return fallbackData;
  }
  console.error(`[${hookName}] API failed, no fallback (NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false):`, error);
  throw error; // Let React Query handle the error state properly
}

// Types
export interface DashboardKPIs {
  revenue: { today: number; week: number; month: number };
  orders: { today: number; week: number; month: number };
  aov: { today: number; week: number; month: number };
  cogs: { week: number; month: number };
  grossMarginPct: { week: number; month: number };
  lowStockCount: number;
  wastageValue: { week: number; month: number };
  payablesDue: { week: number; month: number };
  previousPeriod?: {
    revenue: number;
    orders: number;
    cogs: number;
    grossMarginPct: number;
  };
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopItem {
  id: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  category?: string;
  marginPct?: number;
}

export interface CategoryMix {
  name: string;
  value: number;
  count: number;
  [key: string]: string | number | undefined;
}

export interface PaymentMix {
  method: string;
  amount: number;
  count: number;
}

export interface HourlyData {
  hour: number;
  orders: number;
  revenue: number;
}

export interface BranchRanking {
  branchId: string;
  branchName: string;
  rank: number;
  revenue: number;
  orders: number;
  growthPercent: number;
  marginPercent: number;
  nps?: number | null;
  lowStockCount?: number;
}

export interface DashboardAlert {
  id: string;
  type: 'low-stock' | 'overdue-bill' | 'high-wastage' | 'reservation-spike' | 'margin-drop' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  count?: number;
  link?: string;
}

interface UseDashboardDataParams {
  from: string;
  to: string;
  branchId?: string | null;
}

// Helper to get date in YYYY-MM-DD format
const formatDateForAPI = (date: Date): string => date.toISOString().split('T')[0];

// Fetch daily summary from backend
export function useDashboardKPIs(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['dashboard-kpis', params.from, params.to, params.branchId],
    queryFn: async (): Promise<DashboardKPIs> => {
      // Try the analytics/daily endpoint first
      try {
        const res = await apiClient.get('/analytics/daily', {
          params: {
            date: params.to,
            branchId: params.branchId,
          },
        });
        
        const dailyData = res.data;
        
        // Also fetch financial summary for COGS and payables
        let financialData: any = null;
        try {
          const finRes = await apiClient.get('/analytics/financial-summary', {
            params: {
              from: new Date(params.from).toISOString(),
              to: new Date(params.to).toISOString(),
              branchId: params.branchId,
            },
          });
          financialData = finRes.data;
        } catch (finErr) {
          // Financial data not available - continue with defaults
        }
        
        return {
          revenue: { 
            today: dailyData.summary?.totalRevenue || 0, 
            week: dailyData.summary?.totalRevenue * 7 || 0, 
            month: dailyData.summary?.totalRevenue * 30 || 0 
          },
          orders: { 
            today: dailyData.summary?.totalOrders || 0, 
            week: dailyData.summary?.totalOrders * 7 || 0, 
            month: dailyData.summary?.totalOrders * 30 || 0 
          },
          aov: { 
            today: dailyData.summary?.avgOrderValue || 0, 
            week: dailyData.summary?.avgOrderValue || 0, 
            month: dailyData.summary?.avgOrderValue || 0 
          },
          cogs: { 
            week: financialData?.pnl?.cogs || 0, 
            month: financialData?.pnl?.cogs || 0 
          },
          grossMarginPct: { 
            week: financialData?.pnl?.grossMarginPct || 65, 
            month: financialData?.pnl?.grossMarginPct || 65 
          },
          lowStockCount: 0,
          wastageValue: { week: 0, month: 0 },
          payablesDue: { week: 0, month: 0 },
        };
      } catch (err) {
        // M7.1: Gated fallback - only returns demo data if env var is set
        return handleFallback(err, {
          revenue: { today: 4250000, week: 28750000, month: 112500000 },
          orders: { today: 67, week: 412, month: 1650 },
          aov: { today: 63432, week: 69780, month: 68181 },
          cogs: { week: 8625000, month: 33750000 },
          grossMarginPct: { week: 70, month: 70 },
          lowStockCount: 5,
          wastageValue: { week: 450000, month: 1800000 },
          payablesDue: { week: 2500000, month: 8750000 },
          previousPeriod: {
            revenue: 25500000,
            orders: 385,
            cogs: 7650000,
            grossMarginPct: 68,
          },
        }, 'useDashboardKPIs');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch revenue timeseries
export function useRevenueTimeseries(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['revenue-timeseries', params.from, params.to, params.branchId],
    queryFn: async (): Promise<RevenueDataPoint[]> => {
      try {
        const res = await apiClient.get('/analytics/daily-metrics', {
          params: {
            from: new Date(params.from).toISOString(),
            to: new Date(params.to).toISOString(),
            branchId: params.branchId,
          },
        });
        return res.data.map((d: any) => ({
          date: d.date,
          revenue: d.totalSales || 0,
          orders: d.ordersCount || 0,
        }));
      } catch (err) {
        // M7.1: Gated fallback
        const days = Math.ceil((new Date(params.to).getTime() - new Date(params.from).getTime()) / (1000 * 60 * 60 * 24));
        const fallbackData = Array.from({ length: days }, (_, i) => {
          const date = new Date(params.from);
          date.setDate(date.getDate() + i);
          const baseRevenue = 3500000 + Math.random() * 2000000;
          return {
            date: formatDateForAPI(date),
            revenue: Math.round(baseRevenue * (0.7 + Math.random() * 0.6)),
            orders: Math.round(50 + Math.random() * 30),
          };
        });
        return handleFallback(err, fallbackData, 'useRevenueTimeseries');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch top items
export function useTopItems(params: UseDashboardDataParams & { limit?: number }) {
  return useQuery({
    queryKey: ['top-items', params.from, params.to, params.branchId, params.limit],
    queryFn: async (): Promise<TopItem[]> => {
      try {
        const res = await apiClient.get('/analytics/top-items', {
          params: {
            limit: params.limit || 10,
            from: params.from,
            to: params.to,
            branchId: params.branchId,
          },
        });
        return res.data;
      } catch (err) {
        // M7.1: Gated fallback
        return handleFallback(err, [
          { id: '1', name: 'Patatas Bravas', totalQuantity: 234, totalRevenue: 4680000, category: 'Tapas' },
          { id: '2', name: 'Gambas al Ajillo', totalQuantity: 189, totalRevenue: 5670000, category: 'Seafood' },
          { id: '3', name: 'Sangria Pitcher', totalQuantity: 167, totalRevenue: 5010000, category: 'Drinks' },
          { id: '4', name: 'Croquetas de Jamón', totalQuantity: 156, totalRevenue: 3120000, category: 'Tapas' },
          { id: '5', name: 'Tortilla Española', totalQuantity: 143, totalRevenue: 2860000, category: 'Tapas' },
          { id: '6', name: 'Paella Valenciana', totalQuantity: 98, totalRevenue: 4900000, category: 'Mains' },
          { id: '7', name: 'Churros con Chocolate', totalQuantity: 87, totalRevenue: 1740000, category: 'Desserts' },
          { id: '8', name: 'Jamón Ibérico', totalQuantity: 76, totalRevenue: 3800000, category: 'Charcuterie' },
          { id: '9', name: 'Gazpacho', totalQuantity: 65, totalRevenue: 975000, category: 'Starters' },
          { id: '10', name: 'Cerveza Local', totalQuantity: 312, totalRevenue: 2184000, category: 'Drinks' },
        ], 'useTopItems');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch category mix
export function useCategoryMix(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['category-mix', params.from, params.to, params.branchId],
    queryFn: async (): Promise<CategoryMix[]> => {
      // This endpoint may not exist, use fallback
      try {
        const res = await apiClient.get('/analytics/category-mix', {
          params: {
            from: params.from,
            to: params.to,
            branchId: params.branchId,
          },
        });
        return res.data;
      } catch (err) {
        // M7.1: Gated fallback
        return handleFallback(err, [
          { name: 'Tapas', value: 14500000, count: 567 },
          { name: 'Drinks', value: 8200000, count: 423 },
          { name: 'Mains', value: 6800000, count: 156 },
          { name: 'Desserts', value: 2400000, count: 189 },
          { name: 'Starters', value: 1800000, count: 134 },
        ], 'useCategoryMix');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch payment method mix
export function usePaymentMix(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['payment-mix', params.from, params.to, params.branchId],
    queryFn: async (): Promise<PaymentMix[]> => {
      try {
        const res = await apiClient.get('/analytics/payment-mix', {
          params: {
            from: params.from,
            to: params.to,
            branchId: params.branchId,
          },
        });
        return res.data;
      } catch (err) {
        // M7.1: Gated fallback
        return handleFallback(err, [
          { method: 'CASH', amount: 12500000, count: 234 },
          { method: 'CARD', amount: 8750000, count: 156 },
          { method: 'MOBILE_MONEY', amount: 6250000, count: 189 },
        ], 'usePaymentMix');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch peak hours data
export function usePeakHours(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['peak-hours', params.from, params.to, params.branchId],
    queryFn: async (): Promise<HourlyData[]> => {
      try {
        const res = await apiClient.get('/analytics/peak-hours', {
          params: {
            from: params.from,
            to: params.to,
            branchId: params.branchId,
          },
        });
        return res.data;
      } catch (err) {
        // M7.1: Gated fallback - typical restaurant pattern
        const fallbackData = Array.from({ length: 24 }, (_, hour) => {
          let baseOrders = 0;
          if (hour >= 11 && hour <= 14) baseOrders = 15 + Math.random() * 10; // Lunch
          else if (hour >= 18 && hour <= 22) baseOrders = 20 + Math.random() * 15; // Dinner
          else if (hour >= 9 && hour <= 11) baseOrders = 5 + Math.random() * 5; // Breakfast
          else baseOrders = Math.random() * 3;

          return {
            hour,
            orders: Math.round(baseOrders),
            revenue: Math.round(baseOrders * 65000 + Math.random() * 20000),
          };
        });
        return handleFallback(err, fallbackData, 'usePeakHours');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch branch rankings (for multi-branch)
export function useBranchRankings(params: UseDashboardDataParams) {
  return useQuery({
    queryKey: ['branch-rankings', params.from, params.to],
    queryFn: async (): Promise<BranchRanking[]> => {
      try {
        const period = new Date(params.to).toISOString().slice(0, 7); // YYYY-MM
        const res = await apiClient.get('/franchise/rankings', {
          params: { period },
        });
        const data = res.data.data || res.data;
        return (data || []).map((b: any, idx: number) => ({
          branchId: b.branchId,
          branchName: b.branchName,
          rank: idx + 1,
          revenue: b.totalSales || b.netSales || 0,
          orders: b.orderCount || 0,
          growthPercent: b.growthPercent || 0,
          marginPercent: b.marginPercent || 0,
          nps: b.nps || null,
          lowStockCount: b.lowStockCount || 0,
        }));
      } catch (err) {
        // M7.1: Gated fallback for Cafesserie multi-branch
        return handleFallback(err, [
          { branchId: '1', branchName: 'Village Mall', rank: 1, revenue: 32500000, orders: 489, growthPercent: 12.5, marginPercent: 68, nps: 72, lowStockCount: 2 },
          { branchId: '2', branchName: 'Acacia Mall', rank: 2, revenue: 28750000, orders: 412, growthPercent: 8.2, marginPercent: 65, nps: 68, lowStockCount: 0 },
          { branchId: '3', branchName: 'Arena Mall', rank: 3, revenue: 24500000, orders: 356, growthPercent: 5.1, marginPercent: 62, nps: 65, lowStockCount: 4 },
          { branchId: '4', branchName: 'Mombasa', rank: 4, revenue: 21250000, orders: 298, growthPercent: -2.3, marginPercent: 59, nps: 61, lowStockCount: 1 },
        ], 'useBranchRankings');
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Fetch alerts
export function useDashboardAlerts(branchId?: string | null) {
  return useQuery({
    queryKey: ['dashboard-alerts', branchId],
    queryFn: async (): Promise<DashboardAlert[]> => {
      const alerts: DashboardAlert[] = [];

      // Fetch low stock alerts
      try {
        const res = await apiClient.get('/inventory/low-stock/alerts', {
          params: { branchId },
        });
        const lowStock = res.data || [];
        if (lowStock.length > 0) {
          const critical = lowStock.filter((a: any) => a.alertLevel === 'CRITICAL');
          alerts.push({
            id: 'low-stock',
            type: 'low-stock',
            severity: critical.length > 0 ? 'high' : 'medium',
            title: 'Low Stock Items',
            message: `${lowStock.length} items below reorder level`,
            count: lowStock.length,
            link: '/inventory?filter=low-stock',
          });
        }
      } catch (err) {
        // M7.1: Gated fallback
        if (ALLOW_DEMO_FALLBACK) {
          console.warn('[useDashboardAlerts] API failed, using DEMO FALLBACK:', err);
          alerts.push({
            id: 'low-stock-demo',
            type: 'low-stock',
            severity: 'medium',
            title: 'Low Stock Items',
            message: '5 items below reorder level',
            count: 5,
            link: '/inventory?filter=low-stock',
          });
        } else {
          console.error('[useDashboardAlerts] API failed, no fallback (NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false):', err);
          // Continue without adding demo alert - return empty alerts array
        }
      }

      // Could add more alert sources: overdue bills, wastage, etc.
      
      return alerts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for alerts
  });
}

// Combined hook for branch timeseries data (for comparison chart)
export function useBranchTimeseries(params: UseDashboardDataParams & { branchIds: string[] }) {
  return useQuery({
    queryKey: ['branch-timeseries', params.from, params.to, params.branchIds],
    queryFn: async () => {
      const results = await Promise.all(
        params.branchIds.map(async (branchId) => {
          try {
            const res = await apiClient.get('/analytics/daily-metrics', {
              params: {
                from: new Date(params.from).toISOString(),
                to: new Date(params.to).toISOString(),
                branchId,
              },
            });
            return {
              id: branchId,
              name: `Branch ${branchId}`, // Would need to fetch branch name separately
              data: (res.data || []).map((d: any) => ({
                date: d.date,
                revenue: d.totalSales || 0,
              })),
            };
          } catch (err) {
            // M7.1: Gated fallback per branch
            const days = Math.ceil((new Date(params.to).getTime() - new Date(params.from).getTime()) / (1000 * 60 * 60 * 24));
            const fallbackData = {
              id: branchId,
              name: branchId,
              data: Array.from({ length: days }, (_, i) => {
                const date = new Date(params.from);
                date.setDate(date.getDate() + i);
                return {
                  date: formatDateForAPI(date),
                  revenue: Math.round(3000000 + Math.random() * 2000000),
                };
              }),
            };
            return handleFallback(err, fallbackData, `useBranchTimeseries[${branchId}]`);
          }
        })
      );
      return results;
    },
    enabled: params.branchIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
