/**
 * PlannedFeatureBanner - Phase H5 Component
 * 
 * Displays a prominent banner for routes that are:
 * - PLANNED: Feature is in development/coming soon
 * - LEGACY_HIDDEN: Feature exists but is deprecated
 * 
 * Use this component at the top of any page that should not be
 * accessible via normal navigation but exists in the route structure.
 * 
 * @example
 * ```tsx
 * <PlannedFeatureBanner
 *   featureName="Developer Portal"
 *   status="planned"
 *   estimatedRelease="Q2 2025"
 *   description="API documentation and developer tools"
 * />
 * ```
 */

import React from 'react';
import { Construction, Archive, Info, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeatureStatus = 'planned' | 'coming-soon' | 'deprecated' | 'beta';

interface PlannedFeatureBannerProps {
  /** Name of the feature */
  featureName: string;
  /** Current status of the feature */
  status: FeatureStatus;
  /** Optional estimated release date/quarter */
  estimatedRelease?: string;
  /** Brief description of what the feature will do */
  description?: string;
  /** Optional link to documentation or roadmap */
  learnMoreUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

const statusConfig: Record<FeatureStatus, {
  icon: React.ElementType;
  title: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}> = {
  planned: {
    icon: Construction,
    title: 'Coming Soon',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-900 dark:text-amber-100',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
  'coming-soon': {
    icon: Construction,
    title: 'Coming Soon',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  deprecated: {
    icon: Archive,
    title: 'Deprecated',
    bgColor: 'bg-gray-50 dark:bg-gray-900/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-700 dark:text-gray-300',
    iconColor: 'text-gray-400 dark:text-gray-500',
  },
  beta: {
    icon: Info,
    title: 'Beta',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-900 dark:text-purple-100',
    iconColor: 'text-purple-500 dark:text-purple-400',
  },
};

export function PlannedFeatureBanner({
  featureName,
  status,
  estimatedRelease,
  description,
  learnMoreUrl,
  className,
}: PlannedFeatureBannerProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 mb-6',
        config.bgColor,
        config.borderColor,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', config.iconColor)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn('font-semibold text-sm', config.textColor)}>
              {config.title}: {featureName}
            </h3>
            {estimatedRelease && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                config.bgColor,
                'border',
                config.borderColor,
                config.textColor
              )}>
                {estimatedRelease}
              </span>
            )}
          </div>
          
          {description && (
            <p className={cn('mt-1 text-sm opacity-80', config.textColor)}>
              {description}
            </p>
          )}
          
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 mt-2 text-sm font-medium',
                'hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded',
                config.textColor
              )}
            >
              Learn more
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlannedFeatureBanner;
