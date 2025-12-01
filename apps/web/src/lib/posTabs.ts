/**
 * M26-EXT3: POS Tabs Helper Functions
 * 
 * Utilities for managing tab-based orders including identification,
 * display name generation, age calculation, and sorting.
 */

import type { PosOrderTabInfo } from '../types/pos';

/**
 * Checks if an order is tab-eligible (DINE_IN or BAR service types)
 */
export function isTabOrder(serviceType: string | undefined | null): boolean {
  if (!serviceType) return false;
  return serviceType === 'DINE_IN' || serviceType === 'BAR';
}

/**
 * Builds display name for a tab, prioritizing custom name over table label
 * Returns fallback if neither is available
 * 
 * Examples:
 * - Custom name: "John – Bar" → "John – Bar"
 * - Table only: null, "Table 5" → "Table 5"
 * - Neither: null, null → "Unnamed Tab"
 */
export function buildTabDisplayName(
  tabName: string | null | undefined,
  tableLabel: string | null | undefined
): string {
  if (tabName) return tabName;
  if (tableLabel) return tableLabel;
  return 'Unnamed Tab';
}

/**
 * Calculates age of a tab in minutes from now
 * Returns 0 if timestamp is invalid or future
 */
export function calculateTabAgeMinutes(createdAt: string): number {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  
  if (isNaN(created) || created > now) return 0;
  
  const ageMs = now - created;
  return Math.floor(ageMs / 60000);
}

/**
 * Formats tab age for display
 * 
 * Examples:
 * - 0-59 mins: "5m"
 * - 60-119 mins: "1h 15m"
 * - 120+ mins: "2h 30m"
 */
export function formatTabAge(ageMinutes: number): string {
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }
  
  const hours = Math.floor(ageMinutes / 60);
  const mins = ageMinutes % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Sorts tabs by age (oldest first)
 * Used for default tab list ordering
 */
export function sortTabsByAge(tabs: PosOrderTabInfo[]): PosOrderTabInfo[] {
  return [...tabs].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime; // older (smaller timestamp) first
  });
}

/**
 * Filters tabs by search query (case-insensitive)
 * Searches in: tabName, tableLabel, orderId
 * 
 * Empty query returns all tabs
 */
export function filterTabsBySearch(
  tabs: PosOrderTabInfo[],
  query: string
): PosOrderTabInfo[] {
  if (!query.trim()) return tabs;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return tabs.filter((tab) => {
    const displayName = buildTabDisplayName(tab.tabName, tab.tableLabel).toLowerCase();
    const orderId = tab.orderId.toLowerCase();
    
    return displayName.includes(lowerQuery) || orderId.includes(lowerQuery);
  });
}
