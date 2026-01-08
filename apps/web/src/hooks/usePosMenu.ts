/**
 * M13.2: POS Menu Hook with Availability & Modifiers
 * 
 * Uses the /pos/menu endpoint which:
 * - Filters by availability rules (time-of-day, day-of-week)
 * - Returns items grouped by category
 * - Includes modifier groups with validation constraints
 */

import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch, API_BASE_URL } from '@/lib/api';

export interface PosModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface PosModifierGroupInfo {
  groupId: string;
  groupName: string;
  selectionType: 'SINGLE' | 'MULTI';
  min: number;
  max: number;
  required: boolean;
  options: PosModifierOption[];
}

export interface PosAvailableMenuItem {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  description?: string | null;
  modifiers: PosModifierGroupInfo[];
}

export interface PosMenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: PosAvailableMenuItem[];
}

export interface PosMenuResponse {
  categories: PosMenuCategory[];
  fetchedAt: string;
}

interface UsePosMenuOptions {
  /** Optional ISO datetime to check availability at specific time */
  at?: string;
}

async function fetchPosMenu(at?: string): Promise<PosMenuResponse> {
  const url = new URL(`${API_BASE_URL}/pos/menu`);
  if (at) {
    url.searchParams.set('at', at);
  }

  const resp = await authenticatedFetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to load POS menu: ${resp.status}`);
  }

  return resp.json();
}

/**
 * M13.2: Hook to fetch available menu items for POS ordering
 * 
 * Returns items grouped by category with modifier constraints.
 * Uses React Query for caching with 5-minute stale time.
 */
export function usePosMenu(options: UsePosMenuOptions = {}) {
  return useQuery({
    queryKey: ['pos-menu', options.at ?? 'now'],
    queryFn: () => fetchPosMenu(options.at),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * M13.2: Validate modifier selections against group constraints
 */
export function validateModifierSelections(
  selections: { groupId: string; optionId: string }[],
  groups: PosModifierGroupInfo[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Group selections by groupId
  const selectionsByGroup = new Map<string, string[]>();
  for (const sel of selections) {
    if (!selectionsByGroup.has(sel.groupId)) {
      selectionsByGroup.set(sel.groupId, []);
    }
    selectionsByGroup.get(sel.groupId)!.push(sel.optionId);
  }

  for (const group of groups) {
    const selected = selectionsByGroup.get(group.groupId) ?? [];
    const validOptionIds = new Set(group.options.map(o => o.id));

    // Check for invalid options
    for (const optId of selected) {
      if (!validOptionIds.has(optId)) {
        errors.push(`Invalid option selected for ${group.groupName}`);
      }
    }

    // Check required
    if (group.required && selected.length === 0) {
      errors.push(`${group.groupName} is required`);
    }

    // Check min (if required or has selections)
    if (selected.length > 0 && selected.length < group.min) {
      errors.push(`${group.groupName} requires at least ${group.min} selection(s)`);
    }

    // Check max (0 = unlimited)
    if (group.max > 0 && selected.length > group.max) {
      errors.push(`${group.groupName} allows at most ${group.max} selection(s)`);
    }

    // Check SINGLE type
    if (group.selectionType === 'SINGLE' && selected.length > 1) {
      errors.push(`${group.groupName} only allows one selection`);
    }
  }

  // Check for selections on unknown groups
  for (const groupId of selectionsByGroup.keys()) {
    if (!groups.find(g => g.groupId === groupId)) {
      errors.push(`Unknown modifier group: ${groupId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * M13.2: Calculate total price including selected modifiers
 */
export function calculateItemPrice(
  basePrice: number,
  quantity: number,
  selections: { groupId: string; optionId: string }[],
  groups: PosModifierGroupInfo[],
): { unitPrice: number; lineTotal: number } {
  let modifierTotal = 0;

  for (const sel of selections) {
    const group = groups.find(g => g.groupId === sel.groupId);
    if (!group) continue;

    const option = group.options.find(o => o.id === sel.optionId);
    if (!option) continue;

    modifierTotal += option.priceDelta;
  }

  const unitPrice = basePrice + modifierTotal;
  const lineTotal = unitPrice * quantity;

  return { unitPrice, lineTotal };
}
