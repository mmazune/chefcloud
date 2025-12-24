/**
 * Branch Selector Component - For multi-branch organizations
 * Milestone 6: ChefCloud V2 UX Upgrade
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Building2, ChevronDown } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  isActive?: boolean;
}

interface BranchSelectorProps {
  branches: Branch[];
  selectedBranchId?: string | null;
  onBranchChange: (branchId: string | null) => void;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
  compact?: boolean;
}

export function BranchSelector({
  branches,
  selectedBranchId,
  onBranchChange,
  allowAll = true,
  allLabel = 'All Branches',
  className,
  compact = false,
}: BranchSelectorProps) {
  if (branches.length === 0) {
    return null;
  }

  if (branches.length === 1 && !allowAll) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Building2 className="h-4 w-4" />
        <span>{branches[0].name}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <select
        value={selectedBranchId || 'all'}
        onChange={(e) => onBranchChange(e.target.value === 'all' ? null : e.target.value)}
        className={cn(
          'appearance-none rounded-md border border-input bg-background pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-chefcloud-blue/20',
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
          'cursor-pointer'
        )}
      >
        {allowAll && <option value="all">{allLabel}</option>}
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// Multi-select variant for comparing branches
interface BranchMultiSelectorProps {
  branches: Branch[];
  selectedBranchIds: string[];
  onBranchChange: (branchIds: string[]) => void;
  maxSelections?: number;
  className?: string;
}

export function BranchMultiSelector({
  branches,
  selectedBranchIds,
  onBranchChange,
  maxSelections = 3,
  className,
}: BranchMultiSelectorProps) {
  const toggleBranch = (branchId: string) => {
    if (selectedBranchIds.includes(branchId)) {
      onBranchChange(selectedBranchIds.filter((id) => id !== branchId));
    } else if (selectedBranchIds.length < maxSelections) {
      onBranchChange([...selectedBranchIds, branchId]);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {branches.map((branch) => {
        const isSelected = selectedBranchIds.includes(branch.id);
        const isDisabled = !isSelected && selectedBranchIds.length >= maxSelections;

        return (
          <button
            key={branch.id}
            onClick={() => !isDisabled && toggleBranch(branch.id)}
            disabled={isDisabled}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-full border transition-all',
              isSelected
                ? 'bg-chefcloud-blue text-white border-chefcloud-blue'
                : 'bg-background text-muted-foreground border-input hover:border-chefcloud-blue/50',
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {branch.name}
          </button>
        );
      })}
      <span className="text-xs text-muted-foreground self-center">
        {selectedBranchIds.length}/{maxSelections} selected
      </span>
    </div>
  );
}
