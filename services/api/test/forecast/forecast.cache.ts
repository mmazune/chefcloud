type Entry<T> = { value: T; exp: number };
const store = new Map<string, Entry<any>>();
let version = 0; // increments on compute to prove invalidation

export function now() { return Date.now(); }

export function getCache<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.exp <= now()) { store.delete(key); return undefined; }
  return hit.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, exp: now() + ttlMs });
}

export function clearCache(prefix = '') {
  for (const k of Array.from(store.keys())) {
    if (!prefix || k.startsWith(prefix)) store.delete(k);
  }
}

export function computeForecast(period: string) {
  // pretend to hit DB/engine; include a monotonic version to prove invalidation
  version += 1;
  // tiny deterministic number from YYYY-MM to look real-ish
  const num = Number(period.replace('-', '')) % 97;
  return { period, revenue: num * 1000, cogs: Math.round(num * 612.3), version };
}
