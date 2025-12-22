/**
 * Time Series Utilities
 * 
 * Helpers for generating realistic date/time patterns for demo transactions.
 * Supports weekday/weekend weights, hourly curves, seasonal patterns.
 */

import { SeededRandom } from './seededRng';

/**
 * Generate array of dates going back N days from today
 */
export function dateRangeLastNDays(days: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0); // Normalize to midnight
    dates.push(date);
  }
  
  return dates;
}

/**
 * Get day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Check if date is weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = getDayOfWeek(date);
  return day === 0 || day === 6;
}

/**
 * Get volume multiplier for day of week
 * Default pattern: weekends higher, mid-week moderate, Monday/Tuesday lower
 */
export function getDayVolumeMultiplier(date: Date, pattern: 'restaurant' | 'cafe' = 'restaurant'): number {
  const day = getDayOfWeek(date);
  
  if (pattern === 'restaurant') {
    // Bar/restaurant: Fri/Sat peak, Sun moderate, Mon/Tue slower
    const multipliers = [
      0.8,  // Sunday
      0.7,  // Monday
      0.75, // Tuesday
      0.9,  // Wednesday
      1.0,  // Thursday
      1.4,  // Friday
      1.5,  // Saturday
    ];
    return multipliers[day];
  } else {
    // Cafe: More consistent weekdays, weekends moderate
    const multipliers = [
      0.9,  // Sunday
      1.0,  // Monday
      1.05, // Tuesday
      1.1,  // Wednesday
      1.1,  // Thursday
      1.05, // Friday
      0.95, // Saturday
    ];
    return multipliers[day];
  }
}

/**
 * Hourly distribution curve for different business types
 * Returns probability weight for each hour (0-23)
 */
export function getHourlyDistribution(businessType: 'restaurant' | 'cafe'): number[] {
  if (businessType === 'restaurant') {
    // Restaurant/Bar: peaks at lunch (12-14) and dinner (19-21)
    return [
      0,   0,   0,   0,   0,   0,   // 00-05: Closed
      0,   0,   0.5, 1.0, 1.5, 2.5, // 06-11: Morning/Brunch build-up
      4.0, 4.5, 3.0, 2.0, 1.5, 1.0, // 12-17: Lunch peak then drop
      2.0, 4.5, 5.0, 4.0, 2.5, 1.0, // 18-23: Dinner peak
    ];
  } else {
    // Cafe: morning peak (7-10), lunch moderate (12-14), afternoon taper
    return [
      0,   0,   0,   0,   0,   0,   // 00-05: Closed
      0.5, 3.0, 4.5, 4.0, 3.0, 2.5, // 06-11: Morning rush
      3.5, 3.0, 2.5, 2.0, 1.5, 1.0, // 12-17: Lunch then decline
      0.5, 0.3, 0.2, 0,   0,   0,   // 18-23: Evening close
    ];
  }
}

/**
 * Pick random hour weighted by hourly distribution
 */
export function pickWeightedHour(rng: SeededRandom, businessType: 'restaurant' | 'cafe'): number {
  const distribution = getHourlyDistribution(businessType);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return rng.weightedPick(hours, distribution);
}

/**
 * Generate random datetime for a given date with business-appropriate hour
 */
export function randomDatetime(
  date: Date,
  rng: SeededRandom,
  businessType: 'restaurant' | 'cafe',
): Date {
  const hour = pickWeightedHour(rng, businessType);
  const minute = rng.nextInt(0, 59);
  const second = rng.nextInt(0, 59);
  
  const dt = new Date(date);
  dt.setHours(hour, minute, second, 0);
  return dt;
}

/**
 * Calculate expected daily order count with variability
 */
export function dailyOrderCount(
  baseCount: number,
  date: Date,
  rng: SeededRandom,
  pattern: 'restaurant' | 'cafe' = 'restaurant',
): number {
  const dayMultiplier = getDayVolumeMultiplier(date, pattern);
  const variability = rng.nextFloat(0.85, 1.15); // ±15% random variation
  
  return Math.round(baseCount * dayMultiplier * variability);
}

/**
 * Generate time series data points (for charts/reports)
 */
export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

/**
 * Calculate moving average for time series smoothing
 */
export function movingAverage(data: TimeSeriesPoint[], windowSize: number): TimeSeriesPoint[] {
  const result: TimeSeriesPoint[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    
    result.push({
      date: data[i].date,
      value: avg,
    });
  }
  
  return result;
}

/**
 * Format date as YYYY-MM-DD for consistent sorting/display
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Business hours check
 */
export function isBusinessHours(hour: number, businessType: 'restaurant' | 'cafe'): boolean {
  if (businessType === 'restaurant') {
    return hour >= 9 && hour <= 23;
  } else {
    return hour >= 6 && hour <= 19;
  }
}
