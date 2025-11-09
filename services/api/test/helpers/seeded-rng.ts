/**
 * Seeded Random Number Generator for deterministic tests
 * Uses Mulberry32 algorithm - simple, fast, good distribution
 */
export function makeSeededRandom(seed = 123456789) {
  let s = seed >>> 0;
  return function random() {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
