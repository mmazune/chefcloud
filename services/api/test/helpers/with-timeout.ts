/**
 * Timeout Helper - Enforce hard timeouts on promises to prevent infinite hangs
 *
 * Usage:
 *   const result = await withTimeout(someAsyncOperation(), {
 *     label: 'database query',
 *     ms: 5000,
 *     onTimeoutInfo: () => ({ lastState: 'connecting' })
 *   });
 */

export interface WithTimeoutOptions {
  /**
   * Human-readable label for the operation (used in error message)
   */
  label: string;

  /**
   * Timeout in milliseconds
   */
  ms: number;

  /**
   * Optional function to gather debug info when timeout occurs
   * This allows including current state in the error message
   */
  onTimeoutInfo?: () => Record<string, any>;
}

export class TimeoutError extends Error {
  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
    public readonly debugInfo?: Record<string, any>,
  ) {
    const debugStr = debugInfo ? `\nDebug Info: ${JSON.stringify(debugInfo, null, 2)}` : '';

    super(
      `Operation "${label}" timed out after ${timeoutMs}ms${debugStr}\n` +
        `\nPossible causes:\n` +
        `1. Infinite wait loop without timeout\n` +
        `2. Deadlock or resource contention\n` +
        `3. Missing background worker/service\n` +
        `4. Slow query or missing database index\n` +
        `\nRecommendation: Add trace checkpoints (E2E_TRACE=1) to identify where it hangs.`,
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout that throws TimeoutError if exceeded
 *
 * @param promise - The promise to wrap
 * @param options - Timeout configuration
 * @returns Result of the promise if it completes in time
 * @throws TimeoutError if timeout is exceeded
 *
 * @example
 * ```typescript
 * // Simple timeout
 * const data = await withTimeout(fetchData(), {
 *   label: 'fetch user data',
 *   ms: 5000,
 * });
 *
 * // With debug info
 * let lastResponse: any = null;
 * const data = await withTimeout(pollUntilReady(), {
 *   label: 'poll for readiness',
 *   ms: 10000,
 *   onTimeoutInfo: () => ({ lastResponse }),
 * });
 * ```
 */
export async function withTimeout<T>(promise: Promise<T>, options: WithTimeoutOptions): Promise<T> {
  const { label, ms, onTimeoutInfo } = options;

  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const debugInfo = onTimeoutInfo?.();
      reject(new TimeoutError(label, ms, debugInfo));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Create a timeout-wrapped version of an async function
 *
 * @param fn - Async function to wrap
 * @param defaultOptions - Default timeout options (can be overridden per call)
 * @returns Wrapped function with timeout
 *
 * @example
 * ```typescript
 * const fetchWithTimeout = withTimeoutFn(fetchData, {
 *   label: 'fetch data',
 *   ms: 5000,
 * });
 *
 * const data = await fetchWithTimeout();
 * ```
 */
export function withTimeoutFn<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  defaultOptions: WithTimeoutOptions,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return withTimeout(fn(...args), defaultOptions);
  };
}
