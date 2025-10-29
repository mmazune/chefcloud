/**
 * E40-s1: Accounting Core - Posting Map
 * 
 * Maps operational transactions to GL accounts.
 * Minimal UGX-friendly Chart of Accounts.
 */

export const ACCOUNT_CASH = '1000';
export const ACCOUNT_BANK = '1010';
export const ACCOUNT_AR = '1100';
export const ACCOUNT_INVENTORY = '1200';
export const ACCOUNT_AP = '2000';
export const ACCOUNT_EQUITY = '3000';
export const ACCOUNT_SALES = '4000';
export const ACCOUNT_SERVICE = '4100';
export const ACCOUNT_COGS = '5000';
export const ACCOUNT_EXPENSES = '6000';
export const ACCOUNT_UTILITIES = '6100';

/**
 * Get account ID by code for a given organization.
 */
export function getAccountMapping(accountCode: string): string {
  return accountCode;
}
