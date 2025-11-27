/**
 * M27-S1: Offline Queue for POS
 * 
 * Simple client-side queue for POS mutations when offline.
 * Stores requests in localStorage and replays them when back online.
 */

export type QueuedRequest = {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey: string;
  createdAt: number;
};

const STORAGE_KEY = 'chefcloud_pos_offline_queue_v1';

/**
 * Load queue from localStorage
 * Safe for SSR - returns empty array if window is undefined
 */
export function loadQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load offline queue:', error);
    return [];
  }
}

/**
 * Save queue to localStorage
 */
export function saveQueue(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save offline queue:', error);
  }
}

/**
 * Add a request to the queue
 */
export function enqueue(
  request: Omit<QueuedRequest, 'id' | 'createdAt'>
): QueuedRequest[] {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const createdAt = Date.now();

  const newRequest: QueuedRequest = {
    ...request,
    id,
    createdAt,
  };

  const queue = loadQueue();
  queue.push(newRequest);
  saveQueue(queue);

  return queue;
}

/**
 * Clear entire queue
 */
export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Remove a specific request from queue by ID
 */
export function removeById(id: string): QueuedRequest[] {
  const queue = loadQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveQueue(filtered);
  return filtered;
}
