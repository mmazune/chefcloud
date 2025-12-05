// Simple in-memory nonce store with TTL (ms)
const seen = new Map<string, number>();

export function rememberNonce(nonce: string, ttlMs: number): boolean {
  const now = Date.now();
  const exp = seen.get(nonce);
  if (exp && exp > now) return false; // already seen + not expired => replay
  seen.set(nonce, now + ttlMs);
  // Optional GC: purge old entries occasionally
  if (seen.size > 1000) {
    for (const [k, v] of seen) if (v <= now) seen.delete(k);
  }
  return true;
}
