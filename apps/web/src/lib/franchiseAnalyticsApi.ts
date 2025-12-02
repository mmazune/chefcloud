/**
 * Franchise analytics API helper for E22-FRANCHISE-FE-S1/S3
 * Provides typed fetch functions for budgets, variance, and forecast endpoints
 */

import {
  FranchiseBudgetDto,
  FranchiseBudgetVarianceResponseDto,
  FranchiseForecastResponseDto,
  FranchiseOverviewResponseDto,
} from '@/types/franchise';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DateParams {
  year: number;
  month: number;
  [key: string]: string | number | string[] | undefined;
}

/**
 * E22-FRANCHISE-FE-S3: Extended buildQuery to support branchIds array
 */
function buildQuery(params: Record<string, string | number | string[] | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
    } else {
      search.append(key, String(value));
    }
  });
  return search.toString();
}

export async function fetchFranchiseBudgets(
  params: DateParams,
): Promise<FranchiseBudgetDto[]> {
  const qs = buildQuery(params);
  const res = await fetch(`${API_URL}/franchise/budgets?${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load budgets');
  return res.json();
}

export async function fetchFranchiseBudgetVariance(
  params: DateParams,
): Promise<FranchiseBudgetVarianceResponseDto> {
  const qs = buildQuery(params);
  const res = await fetch(`${API_URL}/franchise/budgets/variance?${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load budget variance');
  return res.json();
}

export async function fetchFranchiseForecast(
  params: DateParams & { lookbackMonths?: number },
): Promise<FranchiseForecastResponseDto> {
  const qs = buildQuery(params);
  const res = await fetch(`${API_URL}/franchise/forecast?${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load forecast');
  return res.json();
}

/**
 * E22-FRANCHISE-FE-S3: Fetch franchise overview for branch-level KPIs
 */
export async function fetchFranchiseOverview(params: {
  year: number;
  month: number;
}): Promise<FranchiseOverviewResponseDto> {
  const qs = buildQuery(params);
  const res = await fetch(`${API_URL}/franchise/overview?${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load franchise overview');
  return res.json();
}
