/**
 * Insight Callout Component - Highlight key insights/changes
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, Sparkles } from 'lucide-react';

type InsightType = 'positive' | 'negative' | 'neutral' | 'info';

interface InsightCalloutProps {
  type: InsightType;
  message: string;
  icon?: React.ReactNode;
  className?: string;
}

const typeStyles: Record<InsightType, { bg: string; text: string; icon: React.ReactNode }> = {
  positive: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  negative: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: <TrendingDown className="h-4 w-4" />,
  },
  neutral: {
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-700',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: <Sparkles className="h-4 w-4" />,
  },
};

export function InsightCallout({ type, message, icon, className }: InsightCalloutProps) {
  const style = typeStyles[type];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
        style.bg,
        style.text,
        className
      )}
    >
      {icon || style.icon}
      <span>{message}</span>
    </div>
  );
}

// Multiple insights in a compact list
interface InsightListProps {
  insights: Array<{ type: InsightType; message: string }>;
  className?: string;
  maxItems?: number;
}

export function InsightList({ insights, className, maxItems = 3 }: InsightListProps) {
  const displayed = insights.slice(0, maxItems);

  return (
    <div className={cn('space-y-2', className)}>
      {displayed.map((insight, index) => (
        <InsightCallout key={index} type={insight.type} message={insight.message} />
      ))}
    </div>
  );
}
