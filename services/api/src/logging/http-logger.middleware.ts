import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { makeHttpLogger } from './http-logger.factory';

const httpLogger = makeHttpLogger();

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Attach pino-http; it adds req.log/res.log and performs logging on finish
    // Keep SSE quiet by avoiding chunk/event logging (factory handles messages)
    return (httpLogger as any)(req, res, next);
  }
}
