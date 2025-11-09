/* eslint-disable @typescript-eslint/no-explicit-any */
// E54-s1: Slow query logging middleware for Prisma

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS || '200', 10);
const SLOW_QUERY_SAMPLE = parseFloat(process.env.SLOW_QUERY_SAMPLE || '0.1');

interface SlowQueryLog {
  slowQuery: boolean;
  durationMs: number;
  model?: string;
  action?: string;
  params?: any;
  timestamp: string;
}

export function slowQueryMiddleware(logger: any): any {
  return async (params: any, next: any) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    // Sample slow queries to avoid log spam
    if (duration > SLOW_QUERY_MS && Math.random() < SLOW_QUERY_SAMPLE) {
      const logData: SlowQueryLog = {
        slowQuery: true,
        durationMs: duration,
        model: params.model,
        action: params.action,
        timestamp: new Date().toISOString(),
      };

      // Sanitize params (avoid logging sensitive data)
      if (params.args && typeof params.args === 'object') {
        const sanitized: any = {};

        // Include WHERE clause for debugging
        if (params.args.where) {
          sanitized.where = params.args.where;
        }

        // Include select/include hints
        if (params.args.select) {
          sanitized.select = Object.keys(params.args.select || {});
        }
        if (params.args.include) {
          sanitized.include = Object.keys(params.args.include || {});
        }

        // Include pagination
        if (params.args.take !== undefined) {
          sanitized.take = params.args.take;
        }
        if (params.args.skip !== undefined) {
          sanitized.skip = params.args.skip;
        }

        logData.params = sanitized;
      }

      logger.warn(logData, 'Slow query detected');
    }

    return result;
  };
}
