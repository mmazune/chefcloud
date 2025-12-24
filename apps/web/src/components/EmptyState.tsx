import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * M7.5: Empty state component for when API returns no data
 * 
 * Use this when:
 * - API call succeeds but returns empty array
 * - Filters/date range exclude all results
 * - Org legitimately has no data for this view
 * 
 * Do NOT use this for:
 * - API errors (use error boundaries)
 * - Loading states (use skeletons)
 * - Permission denied (use PermissionDenied component)
 * 
 * Usage:
 * ```tsx
 * {orders.length === 0 ? (
 *   <EmptyState
 *     icon={ShoppingCart}
 *     title="No orders found"
 *     description="There are no open orders at this time. Orders will appear here when created."
 *     action={{ label: "Create Order", onClick: () => router.push('/pos/new') }}
 *   />
 * ) : (
 *   <OrderTable data={orders} />
 * )}
 * ```
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {/* Icon */}
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>

      {/* Description */}
      <p className="mb-6 max-w-md text-sm text-muted-foreground">{description}</p>

      {/* Action Button (optional) */}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
