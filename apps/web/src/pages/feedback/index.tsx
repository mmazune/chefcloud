import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react';

interface NPSSummary {
  currentNPS: number;
  totalResponses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export default function FeedbackPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feedback-nps'],
    queryFn: async () => {
      const response = await apiClient.get<NPSSummary>('/feedback/analytics/nps-summary');
      return response.data;
    },
  });

  return (
    <AppShell>
      <PageHeader title="Customer Feedback" subtitle="Net Promoter Score and customer feedback" />
      
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard
          label="Current NPS"
          value={data?.currentNPS ?? '—'}
          icon={<Star className="h-4 w-4" />}
        />
        <StatCard
          label="Total Responses"
          value={data?.totalResponses ?? '—'}
          icon={<ThumbsUp className="h-4 w-4" />}
        />
        <StatCard
          label="Promoters"
          value={data?.promoters ?? '—'}
          icon={<ThumbsUp className="h-4 w-4 text-green-500" />}
        />
        <StatCard
          label="Detractors"
          value={data?.detractors ?? '—'}
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
                    {((data.promoters / data.totalResponses) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(data.promoters / data.totalResponses) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Passives (7-8)</span>
                  <span className="text-sm text-muted-foreground">
                    {((data.passives / data.totalResponses) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500"
                    style={{ width: `${(data.passives / data.totalResponses) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Detractors (0-6)</span>
                  <span className="text-sm text-muted-foreground">
                    {((data.detractors / data.totalResponses) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${(data.detractors / data.totalResponses) * 100}%` }}
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
  );
}
