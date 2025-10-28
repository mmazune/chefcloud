import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logRequest } from './logger';
import { metricsStore } from './ops/ops.service';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    const startTime = Date.now();

    // Attach requestId to request
    (req as any).requestId = requestId;

    // Log on response finish
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const context = {
        requestId,
        userId: (req as any).user?.id,
        deviceId: (req as any).deviceId,
        orgId: (req as any).user?.orgId,
        route: req.route?.path,
      };

      logRequest(req, res, durationMs, context);

      // Track metrics
      metricsStore.increment('requests_total');
      if (res.statusCode >= 500) {
        metricsStore.increment('errors_total');
      }
    });

    next();
  }
}
