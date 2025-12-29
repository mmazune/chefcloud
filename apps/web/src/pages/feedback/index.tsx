import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';

interface NPSSummary {
  nps: number;
  totalCount: number;
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
  promoterPct: number;
  passivePct: number;
  detractorPct: number;
}

// Helper to get date range (last 30 days)
function getDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function FeedbackPage() {
  const dateRange = getDateRange();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['feedback-nps', dateRange],
    queryFn: async () => {
      const response = await apiClient.get<NPSSummary>('/feedback/analytics/nps-summary', {
        params: { from: dateRange.from, to: dateRange.to },
      });
      return response.data;
    },
  });

  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader title="Customer Feedback" subtitle="Net Promoter Score and customer feedback" />
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">Failed to load feedback data. Make sure you are logged in as a manager (L4+).</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard
          label="Current NPS"
          value={data?.nps !== undefined ? Math.round(data.nps) : '—'}
          icon={<Star className="h-4 w-4" />}
        />
        <StatCard
          label="Total Responses"
          value={data?.totalCount ?? '—'}
          icon={<ThumbsUp className="h-4 w-4" />}
        />
        <StatCard
          label="Promoters"
          value={data?.promoterCount ?? '—'}
          icon={<ThumbsUp className="h-4 w-4 text-green-500" />}
        />
        <StatCard
          label="Detractors"
          value={data?.detractorCount ?? '—'}
          icon={<ThumbsDown className="h-4 w-4 text-red-500" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feedback Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading feedback data...</p>}
          {!isLoading && data && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Promoters (9-10)</span>
                  <span className="text-sm text-muted-foreground">
                    {data.promoterPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${data.promoterPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Passives (7-8)</span>
                  <span className="text-sm text-muted-foreground">
                    {data.passivePct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500"
                    style={{ width: `${data.passivePct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Detractors (0-6)</span>
                  <span className="text-sm text-muted-foreground">
                    {data.detractorPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${data.detractorPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-sm text-muted-foreground">
        ✓ Connected to backend endpoint: GET /feedback/analytics/nps-summary
      </div>
      </AppShell>
    </RequireRole>
  );
}
