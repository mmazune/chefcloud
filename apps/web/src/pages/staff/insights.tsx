/**
 * M34-FE-PARITY-S2 (G2): Staff Insights & Awards Center
 * 
 * Staff/HR insights page summarizing KPIs, awards, and promotion suggestions.
 * Surfaces M19 Staff Insights backend data in a discoverable HR view.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Trophy, TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';

interface StaffKpi {
  employeeId: string;
  employeeName: string;
  position: string | null;
  branchName: string | null;
  kpiScore: number;
  attendanceScore: number;
  upsellScore: number;
  serviceScore: number;
}

interface StaffAward {
  id: string;
  employeeId: string;
  employeeName: string;
  awardType: string;
  month: string;
  year: number;
  reason: string | null;
}

interface PromotionSuggestion {
  employeeId: string;
  employeeName: string;
  currentPosition: string;
  suggestedPosition: string;
  reason: string;
  confidenceScore: number;
}

interface StaffInsightsData {
  topPerformers: StaffKpi[];
  recentAwards: StaffAward[];
  promotionSuggestions: PromotionSuggestion[];
  allStaffKpis: StaffKpi[];
}

export default function StaffInsightsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-insights'],
    queryFn: async () => {
      const response = await apiClient.get<StaffInsightsData>('/staff/insights');
      return response.data;
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Staff Insights"
          subtitle="KPIs, awards and promotion opportunities across your team."
        />

        {error && (
          <Card className="p-4 border-destructive/40 bg-destructive/10">
            <p className="text-sm text-destructive">
              Failed to load staff insights. Please try again.
            </p>
          </Card>
        )}

        {isLoading && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading staff insights...</p>
          </Card>
        )}

        {data && (
          <>
            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Employee of the Month */}
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Employee of the Month
                    </p>
                  </div>
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                {data.recentAwards.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      {data.recentAwards[0].employeeName}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {data.recentAwards[0].awardType}
                    </p>
                    {data.recentAwards[0].reason && (
                      <p className="text-xs text-muted-foreground italic">
                        &ldquo;{data.recentAwards[0].reason}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No awards yet this period</p>
                )}
              </Card>

              {/* Promotion Candidates */}
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Promotion Candidates
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                {data.promotionSuggestions.length > 0 ? (
                  <div className="space-y-2">
                    {data.promotionSuggestions.slice(0, 2).map((suggestion) => (
                      <div key={suggestion.employeeId}>
                        <p className="text-sm font-semibold">{suggestion.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.currentPosition} → {suggestion.suggestedPosition}
                        </p>
                      </div>
                    ))}
                    {data.promotionSuggestions.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{data.promotionSuggestions.length - 2} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No suggestions at this time</p>
                )}
              </Card>

              {/* How to Use */}
              <Card className="p-6 bg-muted/30">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      How to Use This
                    </p>
                  </div>
                  <Award className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Use KPIs, awards and promotion suggestions to guide performance reviews,
                  recognize top performers and plan role changes. For Tapas demo, this view
                  showcases Asha as Employee of the Month and highlights candidates like Ruth
                  for promotion.
                </p>
              </Card>
            </div>

            {/* Top Performers Table */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Top Performers</h2>
                <Link
                  href="/staff"
                  className="text-sm text-primary hover:underline"
                >
                  View all staff →
                </Link>
              </div>

              {data.topPerformers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Name</th>
                        <th className="px-4 py-2 text-left font-medium">Position</th>
                        <th className="px-4 py-2 text-left font-medium">Branch</th>
                        <th className="px-4 py-2 text-right font-medium">Overall KPI</th>
                        <th className="px-4 py-2 text-right font-medium">Attendance</th>
                        <th className="px-4 py-2 text-right font-medium">Upsell</th>
                        <th className="px-4 py-2 text-right font-medium">Service</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topPerformers.map((staff) => (
                        <tr key={staff.employeeId} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{staff.employeeName}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {staff.position || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {staff.branchName || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant={
                                staff.kpiScore >= 90
                                  ? 'default'
                                  : staff.kpiScore >= 70
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {staff.kpiScore}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {staff.attendanceScore}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {staff.upsellScore}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {staff.serviceScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No KPI data available for this period
                </p>
              )}
            </Card>

            {/* Promotion Suggestions Detail */}
            {data.promotionSuggestions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Promotion Recommendations</h2>
                <div className="space-y-4">
                  {data.promotionSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.employeeId}
                      className="p-4 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{suggestion.employeeName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.currentPosition} → {suggestion.suggestedPosition}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {Math.round(suggestion.confidenceScore * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
