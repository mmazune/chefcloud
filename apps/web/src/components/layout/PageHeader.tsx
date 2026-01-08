import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, description, icon: Icon, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8 flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
        <div>
          {typeof title === 'string' ? (
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          ) : (
            title
          )}
          {(subtitle || description) && (
            <p className="mt-2 text-muted-foreground">{subtitle || description}</p>
          )}
        </div>
      </div>
      {(actions || children) && <div className="flex items-center space-x-2">{actions || children}</div>}
    </div>
  );
}
