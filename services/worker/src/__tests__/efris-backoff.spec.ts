import { calculateBackoffDelay } from '../efris-client';

describe('EFRIS Backoff Logic', () => {
  it('should calculate correct backoff delays', () => {
    // Attempt 1: 5 minutes
    expect(calculateBackoffDelay(1)).toBe(5 * 60 * 1000);

    // Attempt 2: 15 minutes
    expect(calculateBackoffDelay(2)).toBe(15 * 60 * 1000);

    // Attempt 3: 45 minutes
    expect(calculateBackoffDelay(3)).toBe(45 * 60 * 1000);

    // Attempt 4: 2 hours
    expect(calculateBackoffDelay(4)).toBe(2 * 60 * 60 * 1000);

    // Attempt 5: 6 hours
    expect(calculateBackoffDelay(5)).toBe(6 * 60 * 60 * 1000);

    // Beyond max attempts, should use last delay
    expect(calculateBackoffDelay(6)).toBe(6 * 60 * 60 * 1000);
    expect(calculateBackoffDelay(10)).toBe(6 * 60 * 60 * 1000);
  });

  it('should follow exponential backoff pattern', () => {
    const delays = [1, 2, 3, 4, 5].map(calculateBackoffDelay);

    // Each delay should be greater than the previous (exponential)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('should cap at 5 attempts with max 6-hour delay', () => {
    const maxDelay = calculateBackoffDelay(5);
    const beyondMax = calculateBackoffDelay(100);

    expect(maxDelay).toBe(6 * 60 * 60 * 1000);
    expect(beyondMax).toBe(maxDelay);
  });
});
