/**
 * ErrorState - Phase H5 Component
 * 
 * Lightweight inline error state for when an API call fails.
 * Unlike AppErrorBoundary (which catches React errors), this is used
 * when data fetching returns an error but the page can still render.
 * 
 * @example
 * ```tsx
 * if (error) {
 *   return (
 *     <ErrorState
 *       title="Failed to load orders"
 *       message={error.message}
 *       onRetry={() => refetch()}
 *     />
 *   );
 * }
 * ```
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** Primary error title */
  title?: string;
  /** Error message or description */
  message?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Show home link */
  showHomeLink?: boolean;
  /** Home link href (defaults to '/dashboard') */
  homeHref?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  variant?: 'default' | 'compact';
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  showHomeLink = false,
  homeHref = '/dashboard',
  className,
  variant = 'default',
}: ErrorStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          'rounded-full bg-red-100 dark:bg-red-900/30 p-3',
          isCompact && 'p-2'
        )}
      >
        <AlertTriangle
          className={cn(
            'text-red-600 dark:text-red-400',
            isCompact ? 'h-5 w-5' : 'h-8 w-8'
          )}
          aria-hidden="true"
        />
      </div>

      <h3
        className={cn(
          'mt-4 font-semibold text-gray-900 dark:text-gray-100',
          isCompact ? 'text-base mt-3' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {message && (
        <p
          className={cn(
            'mt-2 text-gray-600 dark:text-gray-400 max-w-md',
            isCompact ? 'text-sm' : 'text-base'
          )}
        >
          {message}
        </p>
      )}

      <div className={cn('flex items-center gap-3', isCompact ? 'mt-4' : 'mt-6')}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'inline-flex items-center gap-2 rounded-md font-medium',
              'bg-red-600 text-white hover:bg-red-700',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              'transition-colors',
              isCompact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'
            )}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        )}

        {showHomeLink && (
          <a
            href={homeHref}
            className={cn(
              'inline-flex items-center gap-2 rounded-md font-medium',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
              'transition-colors',
              isCompact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'
            )}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Go to Dashboard
          </a>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
