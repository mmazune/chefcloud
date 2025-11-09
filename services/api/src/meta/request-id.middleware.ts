import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare module 'http' {
  interface IncomingMessage {
    requestId?: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const inbound = (req.headers['x-request-id'] || req.headers['x-requestid'] || '') as string;
    const rid = inbound && String(inbound).trim().length > 0 ? String(inbound).trim() : randomUUID();
    (req as any).requestId = rid;
    res.setHeader('X-Request-Id', rid);
    next();
  }
}
