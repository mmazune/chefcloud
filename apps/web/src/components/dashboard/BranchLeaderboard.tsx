/**
 * Branch Leaderboard Component - For multi-branch organizations
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from './ChartSkeleton';
import { cn, formatCurrency, formatPercentage } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Star, ChevronRight } from 'lucide-react';

interface BranchRanking {
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

interface BranchLeaderboardProps {
  branches: BranchRanking[];
  loading?: boolean;
  title?: string;
  onBranchClick?: (branchId: string) => void;
  className?: string;
}

const getRankBadge = (rank: number) => {
  switch (rank) {
    case 1:
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100">
          <Trophy className="h-4 w-4 text-yellow-600" />
        </div>
      );
    case 2:
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200">
          <span className="text-sm font-bold text-gray-600">2</span>
        </div>
      );
    case 3:
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-100">
          <span className="text-sm font-bold text-orange-600">3</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100">
          <span className="text-sm font-medium text-gray-500">{rank}</span>
        </div>
      );
  }
};

export function BranchLeaderboard({
  branches,
  loading,
  title = 'Branch Rankings',
  onBranchClick,
  className,
}: BranchLeaderboardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={350} type="table" />
        </CardContent>
      </Card>
    );
  }

  if (branches.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-chefcloud-blue" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No branch data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-chefcloud-blue" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-3 px-4 text-left font-medium text-muted-foreground w-12">#</th>
                <th className="py-3 px-4 text-left font-medium text-muted-foreground">Branch</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Orders</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Growth</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Margin</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">NPS</th>
                <th className="py-3 px-4 text-right font-medium text-muted-foreground">Low Stock</th>
                <th className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, index) => (
                <tr
                  key={branch.branchId}
                  className={cn(
                    'border-b transition-colors',
                    onBranchClick && 'cursor-pointer hover:bg-muted/50',
                    index === 0 && 'bg-yellow-50/50'
                  )}
                  onClick={() => onBranchClick?.(branch.branchId)}
                >
                  <td className="py-3 px-4">{getRankBadge(branch.rank)}</td>
                  <td className="py-3 px-4">
                    <span className="font-medium">{branch.branchName}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(branch.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">
                    {branch.orders.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        'flex items-center justify-end gap-1',
                        branch.growthPercent > 0 ? 'text-green-600' : 
                        branch.growthPercent < 0 ? 'text-red-600' : 'text-gray-500'
                      )}
                    >
                      {branch.growthPercent > 0 && <TrendingUp className="h-3 w-3" />}
                      {branch.growthPercent < 0 && <TrendingDown className="h-3 w-3" />}
                      {branch.growthPercent > 0 ? '+' : ''}
                      {formatPercentage(branch.growthPercent)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={cn(
                        branch.marginPercent >= 30 ? 'text-green-600' :
                        branch.marginPercent >= 20 ? 'text-amber-600' : 'text-red-600'
                      )}
                    >
                      {formatPercentage(branch.marginPercent)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {branch.nps !== null && branch.nps !== undefined ? (
                      <span className="flex items-center justify-end gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {branch.nps}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {branch.lowStockCount !== undefined && branch.lowStockCount > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {branch.lowStockCount}
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs">OK</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {onBranchClick && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
