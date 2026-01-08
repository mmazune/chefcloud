/**
 * Tooltip Component
 * 
 * Simple tooltip wrapper using native HTML title attribute for basic tooltips.
 * Can be extended with Radix UI Tooltip for more advanced features.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: React.ReactNode;
  content?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Simple Tooltip component using CSS :hover pseudo-class
 * For production, consider using @radix-ui/react-tooltip
 */
export function Tooltip({ children, content, side = 'top', className }: TooltipProps) {
  if (!content) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={cn('relative inline-flex group', className)}>
      {children}
      <span
        className={cn(
          'absolute z-50 hidden group-hover:block px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap',
          positionClasses[side]
        )}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}

// Provider and Trigger for API compatibility
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const TooltipTrigger = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ children, ...props }, ref) => <span ref={ref} {...props}>{children}</span>
);
TooltipTrigger.displayName = 'TooltipTrigger';
export const TooltipContent: React.FC<{ children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }> = ({ children }) => <>{children}</>;
