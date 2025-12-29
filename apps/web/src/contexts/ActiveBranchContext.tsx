/**
 * ActiveBranchContext - V2.1.1 Patch
 * Single source of truth for active branch selection.
 * 
 * Features:
 * - Persisted to localStorage
 * - Auto-selects user's default branch for single-branch orgs
 * - Used by all pages that need branch scope
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '@/lib/api';

const ACTIVE_BRANCH_KEY = 'chefcloud_activeBranchId';

export interface Branch {
  id: string;
  name: string;
}

interface ActiveBranchContextType {
  activeBranchId: string | null;
  activeBranch: Branch | null;
  branches: Branch[];
  isMultiBranch: boolean;
  isLoading: boolean;
  setActiveBranchId: (branchId: string | null) => void;
}

const ActiveBranchContext = createContext<ActiveBranchContextType | undefined>(undefined);

export function ActiveBranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch branches for the user's org
  useEffect(() => {
    if (!user?.org?.id) {
      setBranches([]);
      setIsLoading(false);
      return;
    }

    const fetchBranches = async () => {
      try {
        const res = await apiClient.get('/branches');
        const branchList: Branch[] = res.data || [];
        setBranches(branchList);

        // If user has a default branch, use it; otherwise use first branch
        const storedBranchId = typeof window !== 'undefined' 
          ? localStorage.getItem(ACTIVE_BRANCH_KEY) 
          : null;
        
        // Validate stored branch belongs to user's org
        const validStoredBranch = branchList.find((b: Branch) => b.id === storedBranchId);
        
        if (validStoredBranch) {
          setActiveBranchIdState(storedBranchId);
        } else if (user.branch?.id) {
          // Use user's assigned branch
          setActiveBranchIdState(user.branch.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_BRANCH_KEY, user.branch.id);
          }
        } else if (branchList.length > 0) {
          // Use first branch as fallback
          setActiveBranchIdState(branchList[0].id);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_BRANCH_KEY, branchList[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch branches:', err);
        // Fall back to user's branch
        if (user.branch?.id) {
          setActiveBranchIdState(user.branch.id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, [user?.org?.id, user?.branch?.id]);

  const setActiveBranchId = useCallback((branchId: string | null) => {
    setActiveBranchIdState(branchId);
    if (typeof window !== 'undefined') {
      if (branchId) {
        localStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
      } else {
        localStorage.removeItem(ACTIVE_BRANCH_KEY);
      }
    }
  }, []);

  const activeBranch = branches.find(b => b.id === activeBranchId) || null;
  const isMultiBranch = branches.length > 1;

  return (
    <ActiveBranchContext.Provider
      value={{
        activeBranchId,
        activeBranch,
        branches,
        isMultiBranch,
        isLoading,
        setActiveBranchId,
      }}
    >
      {children}
    </ActiveBranchContext.Provider>
  );
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext);
  if (context === undefined) {
    throw new Error('useActiveBranch must be used within an ActiveBranchProvider');
  }
  return context;
}
