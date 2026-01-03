/**
 * M8.6: Status Badge Component
 * 
 * Colored badge for document status display
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DocumentStatus = 
  | 'DRAFT' 
  | 'OPEN' 
  | 'PARTIALLY_PAID' 
  | 'PAID' 
  | 'VOID' 
  | 'CLOSED' 
  | 'LOCKED';

const STATUS_STYLES: Record<DocumentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
  OPEN: 'bg-blue-100 text-blue-800 border-blue-300',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PAID: 'bg-green-100 text-green-800 border-green-300',
  VOID: 'bg-red-100 text-red-800 border-red-300',
  CLOSED: 'bg-purple-100 text-purple-800 border-purple-300',
  LOCKED: 'bg-slate-100 text-slate-800 border-slate-300',
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  PARTIALLY_PAID: 'Partial',
  PAID: 'Paid',
  VOID: 'Void',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
};

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(STATUS_STYLES[status], 'font-medium', className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
