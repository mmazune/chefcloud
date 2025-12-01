/**
 * M26-EXT3: POS Tabs Helper Tests
 */

import {
  isTabOrder,
  buildTabDisplayName,
  calculateTabAgeMinutes,
  formatTabAge,
  sortTabsByAge,
  filterTabsBySearch,
} from './posTabs';
import type { PosOrderTabInfo } from '../types/pos';

describe('posTabs helpers', () => {
  describe('isTabOrder', () => {
    it('returns true for DINE_IN', () => {
      expect(isTabOrder('DINE_IN')).toBe(true);
    });

    it('returns true for BAR', () => {
      expect(isTabOrder('BAR')).toBe(true);
    });

    it('returns false for TAKEOUT', () => {
      expect(isTabOrder('TAKEOUT')).toBe(false);
    });

    it('returns false for DELIVERY', () => {
      expect(isTabOrder('DELIVERY')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isTabOrder(null)).toBe(false);
      expect(isTabOrder(undefined)).toBe(false);
    });
  });

  describe('buildTabDisplayName', () => {
    it('prioritizes custom tabName over table label', () => {
      expect(buildTabDisplayName('John – Bar', 'Table 5')).toBe('John – Bar');
    });

    it('falls back to tableLabel if no tabName', () => {
      expect(buildTabDisplayName(null, 'Table 5')).toBe('Table 5');
      expect(buildTabDisplayName(undefined, 'Table 5')).toBe('Table 5');
    });

    it('returns "Unnamed Tab" if both are missing', () => {
      expect(buildTabDisplayName(null, null)).toBe('Unnamed Tab');
      expect(buildTabDisplayName(undefined, undefined)).toBe('Unnamed Tab');
    });
  });

  describe('calculateTabAgeMinutes', () => {
    it('calculates age correctly for valid timestamp', () => {
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
      
      const age = calculateTabAgeMinutes(tenMinutesAgo);
      
      expect(age).toBe(10);
    });

    it('returns 0 for future timestamp', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(calculateTabAgeMinutes(future)).toBe(0);
    });

    it('returns 0 for invalid timestamp', () => {
      expect(calculateTabAgeMinutes('invalid')).toBe(0);
    });

    it('floors fractional minutes', () => {
      const now = Date.now();
      const onePointFiveMinutesAgo = new Date(now - 90 * 1000).toISOString();
      
      expect(calculateTabAgeMinutes(onePointFiveMinutesAgo)).toBe(1);
    });
  });

  describe('formatTabAge', () => {
    it('formats minutes only for < 60 minutes', () => {
      expect(formatTabAge(0)).toBe('0m');
      expect(formatTabAge(5)).toBe('5m');
      expect(formatTabAge(59)).toBe('59m');
    });

    it('formats hours only for exact hours', () => {
      expect(formatTabAge(60)).toBe('1h');
      expect(formatTabAge(120)).toBe('2h');
      expect(formatTabAge(180)).toBe('3h');
    });

    it('formats hours and minutes for fractional hours', () => {
      expect(formatTabAge(65)).toBe('1h 5m');
      expect(formatTabAge(125)).toBe('2h 5m');
      expect(formatTabAge(195)).toBe('3h 15m');
    });
  });

  describe('sortTabsByAge', () => {
    it('sorts tabs oldest first', () => {
      const tabs: PosOrderTabInfo[] = [
        createMockTab('2', '2025-01-01T12:30:00Z'), // newest
        createMockTab('1', '2025-01-01T12:00:00Z'), // oldest
        createMockTab('3', '2025-01-01T12:15:00Z'), // middle
      ];

      const sorted = sortTabsByAge(tabs);

      expect(sorted[0].orderId).toBe('1');
      expect(sorted[1].orderId).toBe('3');
      expect(sorted[2].orderId).toBe('2');
    });

    it('does not mutate original array', () => {
      const tabs: PosOrderTabInfo[] = [
        createMockTab('2', '2025-01-01T12:30:00Z'),
        createMockTab('1', '2025-01-01T12:00:00Z'),
      ];
      const originalOrder = tabs.map(t => t.orderId);

      sortTabsByAge(tabs);

      expect(tabs.map(t => t.orderId)).toEqual(originalOrder);
    });
  });

  describe('filterTabsBySearch', () => {
    const tabs: PosOrderTabInfo[] = [
      { ...createMockTab('order-1', '2025-01-01T12:00:00Z'), tabName: 'John – Bar', tableLabel: 'Table 5' },
      { ...createMockTab('order-2', '2025-01-01T12:15:00Z'), tabName: null, tableLabel: 'Table 10' },
      { ...createMockTab('order-3', '2025-01-01T12:30:00Z'), tabName: 'Sarah – Patio', tableLabel: null },
    ];

    it('returns all tabs for empty query', () => {
      expect(filterTabsBySearch(tabs, '')).toEqual(tabs);
      expect(filterTabsBySearch(tabs, '   ')).toEqual(tabs);
    });

    it('filters by custom tabName (case-insensitive)', () => {
      const result = filterTabsBySearch(tabs, 'john');
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-1');
    });

    it('filters by tableLabel (case-insensitive)', () => {
      const result = filterTabsBySearch(tabs, 'table 10');
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-2');
    });

    it('filters by orderId (case-insensitive)', () => {
      const result = filterTabsBySearch(tabs, 'ORDER-3');
      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-3');
    });

    it('returns multiple matches', () => {
      const result = filterTabsBySearch(tabs, 'order');
      // All tabs have 'order' in their orderId
      expect(result).toHaveLength(3);
      expect(result.map(t => t.orderId).sort()).toEqual(['order-1', 'order-2', 'order-3']);
    });

    it('returns empty array for no matches', () => {
      const result = filterTabsBySearch(tabs, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });
});

// Helper to create mock tab for testing
function createMockTab(orderId: string, createdAt: string): PosOrderTabInfo {
  return {
    orderId,
    tabName: null,
    serviceType: 'DINE_IN',
    tableLabel: null,
    guestCount: null,
    createdAt,
    lastModifiedAt: createdAt,
    itemCount: 0,
    orderTotal: 0,
    status: 'OPEN',
  };
}
