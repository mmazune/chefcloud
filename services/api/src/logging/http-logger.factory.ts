import pino from 'pino';
import pinoHttp, { Options as PinoHttpOptions } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers.set-cookie',
    'req.headers.x-sig',
    'req.headers.x-ts',
    'req.headers.x-id',
    'req.body.password',
    'req.body.token',
    'req.body.secret',
    'req.body.key',
  ],
  remove: true,
};

export function makeBaseLogger() {
  const level = process.env.LOG_LEVEL || 'info';
  const isPretty =
    process.env.PRETTY_LOGS === '1' && process.env.NODE_ENV !== 'production';
  // Use transport only in dev to avoid perf hit in prod
  return pino({
    level,
    redact,
    ...(isPretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }
      : {}),
  });
}

export function makeHttpLogger() {
  const base = makeBaseLogger();
  const options: PinoHttpOptions = {
    logger: base,
    quietReqLogger: false,
    genReqId(req: IncomingMessage, _res: ServerResponse) {
      const inbound =
        (req.headers['x-request-id'] || req.headers['x-requestid']) as
          | string
          | undefined;
      const rid =
        inbound && String(inbound).trim().length > 0
          ? String(inbound).trim()
          : (req as any).requestId || randomUUID();
      (req as any).requestId = rid;
      return rid;
    },
    customProps(req: IncomingMessage, _res: ServerResponse) {
      return {
        requestId: (req as any).requestId,
        userId: (req as any).user?.id || (req as any).user?.sub || undefined,
      };
    },
    customLogLevel(req: IncomingMessage, res: ServerResponse, err?: Error) {
      if (err) return 'error';
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      // Silence health/metrics if env toggles set
      const url = (req as any).originalUrl || req.url || '';
      if (
        process.env.LOG_SILENCE_HEALTH === '1' &&
        url.startsWith('/healthz')
      )
        return 'silent';
      if (
        process.env.LOG_SILENCE_METRICS === '1' &&
        url.startsWith('/metrics')
      )
        return 'silent';
      return 'info';
    },
    customSuccessMessage(req: IncomingMessage, res: ServerResponse) {
      // Short single-line summary
      return `${req.method} ${(req as any).originalUrl || req.url} -> ${res.statusCode}`;
    },
    serializers: {
      // Keep request small but useful
      req(req: any) {
        const url = req.originalUrl || req.url;
        const ip = req.ip || req.socket?.remoteAddress;
        const method = req.method;
        const requestId = req.id || req.requestId;
        const userId = req.user?.id || req.user?.sub;
        const isWebhook = String(url || '').startsWith('/webhooks/');
        const body = isWebhook
          ? 'omitted'
          : req.raw?.body || req.body || undefined;
        return { requestId, userId, method, url, ip, body };
      },
      res(res: any) {
        const statusCode = res.statusCode;
        const contentLength = res.getHeader && res.getHeader('content-length');
        return { statusCode, contentLength };
      },
    },
    customReceivedMessage(req: IncomingMessage, _res: ServerResponse) {
      // Entry log line
      const url = (req as any).originalUrl || req.url;
      // Avoid spamming SSE event stream lines; log connect/close only
      if (String(url).startsWith('/stream/kpis')) return `SSE OPEN ${url}`;
      return `REQ ${req.method} ${url}`;
    },
    customErrorMessage(_req: IncomingMessage, res: ServerResponse, err: Error) {
      return `ERR ${res.statusCode} ${err.name}: ${err.message}`;
    },
  };
  return pinoHttp(options);
}
