import pino from 'pino';
import { Request, Response } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    service: 'chefcloud-api',
    env: process.env.NODE_ENV || 'development',
  },
});

// In-memory ring buffer for recent logs (for diagnostics)
export class LogRingBuffer {
  private buffer: Array<{ timestamp: Date; level: string; message: string; context?: any }> = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  push(level: string, message: string, context?: any) {
    this.buffer.push({
      timestamp: new Date(),
      level,
      message,
      context,
    });

    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getLast(count: number) {
    return this.buffer.slice(-count);
  }

  clear() {
    this.buffer = [];
  }
}

export const logBuffer = new LogRingBuffer(1000);

// Wrap logger to also push to ring buffer
const originalLogger = {
  info: logger.info.bind(logger),
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  debug: logger.debug.bind(logger),
};

logger.info = (obj: any, msg?: string, ...args: any[]) => {
  if (typeof obj === 'string') {
    logBuffer.push('info', obj);
    return originalLogger.info(obj, msg as any, ...args);
  }
  logBuffer.push('info', msg || '', obj);
  return originalLogger.info(obj, msg as any, ...args);
};

logger.error = (obj: any, msg?: string, ...args: any[]) => {
  if (typeof obj === 'string') {
    logBuffer.push('error', obj);
    return originalLogger.error(obj, msg as any, ...args);
  }
  logBuffer.push('error', msg || '', obj);
  return originalLogger.error(obj, msg as any, ...args);
};

logger.warn = (obj: any, msg?: string, ...args: any[]) => {
  if (typeof obj === 'string') {
    logBuffer.push('warn', obj);
    return originalLogger.warn(obj, msg as any, ...args);
  }
  logBuffer.push('warn', msg || '', obj);
  return originalLogger.warn(obj, msg as any, ...args);
};

export interface RequestContext {
  requestId?: string;
  userId?: string;
  deviceId?: string;
  orgId?: string;
  route?: string;
}

export function logRequest(
  req: Request,
  res: Response,
  durationMs: number,
  context: RequestContext = {},
) {
  logger.info({
    type: 'http_request',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    durationMs,
    ...context,
  });
}
