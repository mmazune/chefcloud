/**
 * M27-S9: Tests for posIndexedDb staleness helpers
 * 
 * Validates TTL-based staleness detection logic:
 * - isSnapshotStale respects 24h TTL window
 * - getSnapshotAgeMs calculates age correctly
 * - Handles invalid/missing dates gracefully
 */

import { isSnapshotStale, getSnapshotAgeMs } from './posIndexedDb';

describe('posIndexedDb staleness helpers', () => {
  describe('isSnapshotStale', () => {
    test('returns true for missing or invalid dates', () => {
      expect(isSnapshotStale(undefined as any)).toBe(true);
      expect(isSnapshotStale(null as any)).toBe(true);
      expect(isSnapshotStale('invalid-date')).toBe(true);
      expect(isSnapshotStale('')).toBe(true);
    });

    test('returns false for fresh snapshots within TTL', () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
      const twentyHoursAgo = new Date(now - 20 * 60 * 60 * 1000).toISOString();

      expect(isSnapshotStale(fiveMinutesAgo)).toBe(false);
      expect(isSnapshotStale(oneHourAgo)).toBe(false);
      expect(isSnapshotStale(twentyHoursAgo)).toBe(false);
    });

    test('returns true for snapshots older than 24h TTL', () => {
      const now = Date.now();
      const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000).toISOString();
      const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

      expect(isSnapshotStale(twentyFiveHoursAgo)).toBe(true);
      expect(isSnapshotStale(fortyEightHoursAgo)).toBe(true);
      expect(isSnapshotStale(oneWeekAgo)).toBe(true);
    });

    test('boundary case: exactly at TTL threshold', () => {
      const now = Date.now();
      // Slightly more than 24h to account for test execution time
      const justOverTwentyFourHours = new Date(now - (24 * 60 * 60 * 1000 + 100)).toISOString();
      
      // Should be stale if > 24h
      expect(isSnapshotStale(justOverTwentyFourHours)).toBe(true);
    });

    test('handles future dates gracefully', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      // Future dates are not stale
      expect(isSnapshotStale(future)).toBe(false);
    });
  });

  describe('getSnapshotAgeMs', () => {
    test('returns null for missing or invalid dates', () => {
      expect(getSnapshotAgeMs(undefined as any)).toBeNull();
      expect(getSnapshotAgeMs(null as any)).toBeNull();
      expect(getSnapshotAgeMs('invalid-date')).toBeNull();
      expect(getSnapshotAgeMs('')).toBeNull();
    });

    test('returns age in milliseconds for valid dates', () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

      const age = getSnapshotAgeMs(fiveMinutesAgo);
      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(5 * 60 * 1000 - 100); // Allow 100ms tolerance
      expect(age).toBeLessThan(6 * 60 * 1000); // Should be less than 6 minutes
    });

    test('returns zero or near-zero for very recent dates', () => {
      const justNow = new Date().toISOString();
      const age = getSnapshotAgeMs(justNow);
      
      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(100); // Should be very small
    });

    test('calculates age correctly for older snapshots', () => {
      const now = Date.now();
      const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      const age = getSnapshotAgeMs(twentyFourHoursAgo);
      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 100);
      expect(age).toBeLessThan(25 * 60 * 60 * 1000);
    });

    test('handles future dates', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const age = getSnapshotAgeMs(future);
      
      // Age should be negative for future dates
      expect(age).not.toBeNull();
      expect(age).toBeLessThan(0);
    });
  });
});
