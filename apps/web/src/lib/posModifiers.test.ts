/**
 * M26-EXT2: Tests for POS Modifier Helpers
 */

import {
  calculateModifiersTotal,
  buildModifierSummary,
  validateModifierSelection,
  isModifierSelectionValid,
} from './posModifiers';
import { PosModifierGroup, PosOrderLineModifier } from '@/types/pos';

describe('posModifiers helpers', () => {
  describe('calculateModifiersTotal', () => {
    it('returns 0 for undefined modifiers', () => {
      expect(calculateModifiersTotal(undefined)).toBe(0);
    });

    it('returns 0 for empty modifiers array', () => {
      expect(calculateModifiersTotal([])).toBe(0);
    });

    it('calculates sum of positive and negative deltas', () => {
      const modifiers: PosOrderLineModifier[] = [
        {
          groupId: 'g1',
          groupName: 'Extras',
          optionId: 'o1',
          optionName: 'Extra cheese',
          priceDelta: 2000,
        },
        {
          groupId: 'g2',
          groupName: 'Removals',
          optionId: 'o2',
          optionName: 'No onions',
          priceDelta: -500,
        },
        {
          groupId: 'g3',
          groupName: 'Sides',
          optionId: 'o3',
          optionName: 'Side salad',
          priceDelta: 3000,
        },
      ];

      expect(calculateModifiersTotal(modifiers)).toBe(4500); // 2000 - 500 + 3000
    });
  });

  describe('buildModifierSummary', () => {
    it('returns "No modifiers" for undefined', () => {
      expect(buildModifierSummary(undefined)).toBe('No modifiers');
    });

    it('returns "No modifiers" for empty array', () => {
      expect(buildModifierSummary([])).toBe('No modifiers');
    });

    it('returns comma-separated option names', () => {
      const modifiers: PosOrderLineModifier[] = [
        {
          groupId: 'g1',
          groupName: 'Extras',
          optionId: 'o1',
          optionName: 'Extra cheese',
          priceDelta: 2000,
        },
        {
          groupId: 'g2',
          groupName: 'Removals',
          optionId: 'o2',
          optionName: 'No onions',
          priceDelta: 0,
        },
      ];

      expect(buildModifierSummary(modifiers)).toBe('Extra cheese, No onions');
    });
  });

  describe('validateModifierSelection', () => {
    it('returns empty array for undefined groups', () => {
      expect(validateModifierSelection(undefined, {})).toEqual([]);
    });

    it('returns empty array for empty groups', () => {
      expect(validateModifierSelection([], {})).toEqual([]);
    });

    it('validates required group (min=1, max=1) with 0 selections', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [],
        },
      ];

      const selected: Record<string, PosOrderLineModifier[]> = {};

      const results = validateModifierSelection(groups, selected);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(false);
      expect(results[0].message).toBe('Choose at least 1');
      expect(results[0].count).toBe(0);
    });

    it('validates required group (min=1, max=1) with 1 selection', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [],
        },
      ];

      const selected: Record<string, PosOrderLineModifier[]> = {
        g1: [
          {
            groupId: 'g1',
            groupName: 'Size',
            optionId: 'o1',
            optionName: 'Large',
            priceDelta: 0,
          },
        ],
      };

      const results = validateModifierSelection(groups, selected);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].message).toBeUndefined();
      expect(results[0].count).toBe(1);
    });

    it('validates required group (min=1, max=1) with 2 selections', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [],
        },
      ];

      const selected: Record<string, PosOrderLineModifier[]> = {
        g1: [
          {
            groupId: 'g1',
            groupName: 'Size',
            optionId: 'o1',
            optionName: 'Large',
            priceDelta: 0,
          },
          {
            groupId: 'g1',
            groupName: 'Size',
            optionId: 'o2',
            optionName: 'XL',
            priceDelta: 1000,
          },
        ],
      };

      const results = validateModifierSelection(groups, selected);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(false);
      expect(results[0].message).toBe('Choose at most 1');
      expect(results[0].count).toBe(2);
    });

    it('validates optional group (min=0, max=2)', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Extras',
          minSelections: 0,
          maxSelections: 2,
          isRequired: false,
          options: [],
        },
      ];

      // 0 selections - valid
      expect(validateModifierSelection(groups, {})[0].isValid).toBe(true);

      // 1 selection - valid
      expect(
        validateModifierSelection(groups, {
          g1: [
            {
              groupId: 'g1',
              groupName: 'Extras',
              optionId: 'o1',
              optionName: 'Extra cheese',
              priceDelta: 1000,
            },
          ],
        })[0].isValid
      ).toBe(true);

      // 3 selections - invalid
      expect(
        validateModifierSelection(groups, {
          g1: [
            {
              groupId: 'g1',
              groupName: 'Extras',
              optionId: 'o1',
              optionName: 'Extra cheese',
              priceDelta: 1000,
            },
            {
              groupId: 'g1',
              groupName: 'Extras',
              optionId: 'o2',
              optionName: 'Bacon',
              priceDelta: 2000,
            },
            {
              groupId: 'g1',
              groupName: 'Extras',
              optionId: 'o3',
              optionName: 'Avocado',
              priceDelta: 1500,
            },
          ],
        })[0].isValid
      ).toBe(false);
    });
  });

  describe('isModifierSelectionValid', () => {
    it('returns true for no groups', () => {
      expect(isModifierSelectionValid(undefined, {})).toBe(true);
      expect(isModifierSelectionValid([], {})).toBe(true);
    });

    it('returns false if any group is invalid', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [],
        },
        {
          id: 'g2',
          name: 'Extras',
          minSelections: 0,
          maxSelections: 2,
          isRequired: false,
          options: [],
        },
      ];

      const selected: Record<string, PosOrderLineModifier[]> = {
        g1: [], // Invalid - required but empty
        g2: [
          {
            groupId: 'g2',
            groupName: 'Extras',
            optionId: 'o1',
            optionName: 'Cheese',
            priceDelta: 1000,
          },
        ], // Valid
      };

      expect(isModifierSelectionValid(groups, selected)).toBe(false);
    });

    it('returns true if all groups are valid', () => {
      const groups: PosModifierGroup[] = [
        {
          id: 'g1',
          name: 'Size',
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          options: [],
        },
        {
          id: 'g2',
          name: 'Extras',
          minSelections: 0,
          maxSelections: 2,
          isRequired: false,
          options: [],
        },
      ];

      const selected: Record<string, PosOrderLineModifier[]> = {
        g1: [
          {
            groupId: 'g1',
            groupName: 'Size',
            optionId: 'o1',
            optionName: 'Large',
            priceDelta: 0,
          },
        ],
        g2: [
          {
            groupId: 'g2',
            groupName: 'Extras',
            optionId: 'o2',
            optionName: 'Cheese',
            priceDelta: 1000,
          },
        ],
      };

      expect(isModifierSelectionValid(groups, selected)).toBe(true);
    });
  });
});
