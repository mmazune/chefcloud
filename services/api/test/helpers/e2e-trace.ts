/**
 * E2E Trace Helper - Opt-in execution checkpoints for debugging hangs
 * 
 * Enable with: E2E_TRACE=1
 * 
 * Usage:
 *   trace('starting database connection');
 *   await traceSpan('seed data', async () => { ... });
 */

const TRACE_ENABLED = process.env.E2E_TRACE === '1';

/**
 * Log a timestamped trace checkpoint (only when E2E_TRACE=1)
 * 
 * @param message - Checkpoint description
 * @param data - Optional additional data to log
 */
export function trace(message: string, data?: any): void {
  if (!TRACE_ENABLED) return;
  
  const timestamp = new Date().toISOString();
  const elapsed = process.uptime().toFixed(2);
  
  console.log(`[E2E TRACE ${timestamp}] [+${elapsed}s] ${message}`);
  if (data) {
    console.log(`  Data:`, JSON.stringify(data, null, 2));
  }
}

/**
 * Execute a function with start/end trace logging
 * 
 * @param name - Name of the operation
 * @param fn - Async function to execute
 * @returns Result of the function
 */
export async function traceSpan<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!TRACE_ENABLED) {
    return fn();
  }
  
  const start = Date.now();
  trace(`START: ${name}`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    trace(`END: ${name} (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    trace(`ERROR: ${name} (${duration}ms)`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Wrap a synchronous function with trace logging
 * 
 * @param name - Name of the operation
 * @param fn - Synchronous function to execute
 * @returns Result of the function
 */
export function traceSync<T>(name: string, fn: () => T): T {
  if (!TRACE_ENABLED) {
    return fn();
  }
  
  const start = Date.now();
  trace(`START: ${name}`);
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    trace(`END: ${name} (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    trace(`ERROR: ${name} (${duration}ms)`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
