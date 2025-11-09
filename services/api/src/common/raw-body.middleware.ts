import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Raw Body Middleware for Webhook Verification
 *
 * Captures the raw request body before JSON parsing to enable
 * HMAC signature verification. The raw body is stored on req.rawBody
 * and is preserved alongside the parsed JSON body.
 *
 * This middleware should be applied BEFORE body parsers.
 *
 * @example
 * In main.ts:
 * ```typescript
 * app.use(json({
 *   verify: (req: any, res, buf) => {
 *     req.rawBody = buf.toString('utf8');
 *   }
 * }));
 * ```
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RawBodyMiddleware.name);

  use(req: Request & { rawBody?: string }, _res: Response, next: NextFunction) {
    if (req.headers['content-type']?.includes('application/json')) {
      let data = '';

      req.on('data', (chunk: Buffer) => {
        data += chunk.toString('utf8');
      });

      req.on('end', () => {
        (req as any).rawBody = data;
        this.logger.debug(`Raw body captured: ${data.length} bytes`);
      });
    }

    next();
  }
}

/**
 * Helper function to configure raw body capture in NestJS
 * Use this in main.ts with express.json()
 */
export function getRawBodyConfig() {
  return {
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf.toString('utf8');
    },
  };
}
