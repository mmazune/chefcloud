/**
 * EFRIS client for worker to call API endpoints
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export interface EfrisPushResult {
  status: string;
  message?: string;
}

export async function pushToEfris(orderId: string): Promise<EfrisPushResult> {
  const response = await fetch(`${API_BASE_URL}/fiscal/push/${orderId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`EFRIS push failed: ${response.statusText}`);
  }

  return response.json() as Promise<EfrisPushResult>;
}

export function calculateBackoffDelay(attemptNumber: number): number {
  // Exponential backoff: 5min, 15min, 45min, 2h, 6h
  const delays = [
    5 * 60 * 1000, // 5 minutes
    15 * 60 * 1000, // 15 minutes
    45 * 60 * 1000, // 45 minutes
    2 * 60 * 60 * 1000, // 2 hours
    6 * 60 * 60 * 1000, // 6 hours
  ];

  return delays[Math.min(attemptNumber - 1, delays.length - 1)];
}

export {};
