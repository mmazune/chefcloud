/**
 * M8.6: Branch Filter Component
 * 
 * Dropdown for selecting branch scope in multi-branch orgs
 */
import React from 'react';
import { useActiveBranch } from '@/contexts/ActiveBranchContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface BranchFilterProps {
  value: string | null;
  onChange: (branchId: string | null) => void;
  showAllOption?: boolean;
  className?: string;
}

export function BranchFilter({ 
  value, 
  onChange, 
  showAllOption = true,
  className 
}: BranchFilterProps) {
  const { branches } = useActiveBranch();

  // Only show for multi-branch orgs
  if (!branches || branches.length <= 1) {
    return null;
  }

  return (
    <Select 
      value={value || 'all'} 
      onValueChange={(v) => onChange(v === 'all' ? null : v)}
    >
      <SelectTrigger className={className}>
        <Building2 className="w-4 h-4 mr-2" />
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="all">All Branches</SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
