/**
 * Chart Skeleton Component - Loading placeholder for charts
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface ChartSkeletonProps {
  height?: number | string;
  type?: 'line' | 'bar' | 'pie' | 'table';
  className?: string;
}

export function ChartSkeleton({ height = 300, type = 'line', className }: ChartSkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-muted rounded-lg relative overflow-hidden', className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {type === 'line' && (
        <div className="absolute inset-4">
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 w-8 bg-gray-200 rounded" />
            ))}
          </div>
          {/* Grid lines */}
          <div className="absolute left-14 right-0 top-0 bottom-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-px bg-gray-200"
                style={{ top: `${(i - 1) * 25}%` }}
              />
            ))}
          </div>
          {/* Fake line chart path */}
          <svg
            className="absolute left-14 right-0 top-0 bottom-8"
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 45 Q 15 30 25 35 T 50 25 T 75 30 T 100 20"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
          </svg>
          {/* X-axis */}
          <div className="absolute left-14 right-0 bottom-0 h-6 flex justify-between">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-3 w-8 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      )}
      {type === 'bar' && (
        <div className="absolute inset-4 flex items-end justify-around gap-2">
          {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65].map((h, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-t flex-1"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {type === 'pie' && (
        <div className="absolute inset-8 flex items-center justify-center">
          <div className="w-full max-w-[200px] aspect-square rounded-full border-8 border-gray-200 bg-gray-100" />
        </div>
      )}
      {type === 'table' && (
        <div className="absolute inset-4 space-y-2">
          <div className="h-10 bg-gray-200 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      )}
    </div>
  );
}
