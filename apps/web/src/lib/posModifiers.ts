/**
 * M26-EXT2: POS Modifier Helpers
 * 
 * Shared utilities for calculating modifier totals, validation, and formatting.
 */

import { PosModifierGroup, PosOrderLineModifier } from '@/types/pos';

/**
 * Calculate the total price delta from modifiers
 */
export function calculateModifiersTotal(
  modifiers: PosOrderLineModifier[] | undefined,
): number {
  if (!modifiers || !modifiers.length) return 0;
  return modifiers.reduce((sum, m) => sum + (m.priceDelta || 0), 0);
}

/**
 * Build a human-readable summary of selected modifiers
 */
export function buildModifierSummary(
  modifiers: PosOrderLineModifier[] | undefined,
): string {
  if (!modifiers || modifiers.length === 0) return 'No modifiers';
  // Simple, human-readable summary: "Extra cheese, No onions, Side salad"
  return modifiers.map((m) => m.optionName).join(', ');
}

/**
 * Validation result for a single modifier group
 */
export interface ModifierGroupValidationResult {
  groupId: string;
  groupName: string;
  count: number;
  min: number;
  max: number;
  isValid: boolean;
  message?: string;
}

/**
 * Validate modifier selection against group rules
 */
export function validateModifierSelection(
  groups: PosModifierGroup[] | undefined,
  selected: Record<string, PosOrderLineModifier[]>,
): ModifierGroupValidationResult[] {
  if (!groups || groups.length === 0) return [];
  
  return groups.map((g) => {
    const list = selected[g.id] || [];
    const count = list.length;
    let isValid = true;
    let message: string | undefined;

    if (count < g.minSelections) {
      isValid = false;
      message = `Choose at least ${g.minSelections}`;
    } else if (count > g.maxSelections) {
      isValid = false;
      message = `Choose at most ${g.maxSelections}`;
    }

    return {
      groupId: g.id,
      groupName: g.name,
      count,
      min: g.minSelections,
      max: g.maxSelections,
      isValid,
      message,
    };
  });
}

/**
 * Check if all modifier groups have valid selections
 */
export function isModifierSelectionValid(
  groups: PosModifierGroup[] | undefined,
  selected: Record<string, PosOrderLineModifier[]>,
): boolean {
  return validateModifierSelection(groups, selected).every((r) => r.isValid);
}
