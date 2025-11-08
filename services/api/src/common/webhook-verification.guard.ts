import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { RedisService } from './redis.service';

/**
 * Webhook Signature Verification Guard (E24)
 * 
 * Ensures all incoming webhooks are authenticated with HMAC signature,
 * protected against replay attacks, and within acceptable time window.
 * 
 * Headers Required:
 * - X-Sig: HMAC-SHA256 signature (hex format)
 * - X-Ts: Timestamp in milliseconds
 * - X-Id: Unique request ID for replay protection
 * 
 * Environment Variables:
 * - WH_SECRET: Webhook secret for HMAC verification (required)
 * 
 * Security Features:
 * - HMAC signature computed as: hex(HMAC_SHA256(secret, timestamp + "." + rawBody))
 * - Constant-time comparison (timingSafeEqual) to prevent timing attacks
 * - Timestamp validation: ±5 minutes clock skew tolerance
 * - Replay protection: X-Id stored in Redis for 24 hours
 * - Raw body verification: Prevents parser manipulation attacks
 * 
 * Response Codes:
 * - 400: Missing required headers or raw body not available
 * - 401: Invalid signature or stale timestamp
 * - 409: Replay attack detected (duplicate X-Id)
 * - 500: Server misconfiguration (missing WH_SECRET)
 * 
 * @example
 * ```typescript
 * @Controller('webhooks')
 * export class WebhooksController {
 *   @Post('billing')
 *   @UseGuards(WebhookVerificationGuard)
 *   handleBillingWebhook(@Body() payload: any) {
 *     // Webhook is authenticated and verified
 *   }
 * }
 * ```
 */
@Injectable()
export class WebhookVerificationGuard implements CanActivate {
  private readonly logger = new Logger(WebhookVerificationGuard.name);
  private readonly SKEW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly REPLAY_TTL = 24 * 3600; // 24 hours in seconds

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      // Extract headers (case-insensitive)
      const sig = this.getHeader(request, 'x-sig');
      const ts = this.getHeader(request, 'x-ts');
      const id = this.getHeader(request, 'x-id');

      // Validate required headers
      if (!sig || !ts || !id) {
        this.logger.warn('Webhook missing required headers');
        throw new HttpException(
          {
            statusCode: 400,
            message: 'Missing required headers: X-Sig, X-Ts, X-Id',
            error: 'Bad Request',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate timestamp format and check clock skew
      const tsMs = Number(ts);
      if (!Number.isFinite(tsMs)) {
        this.logger.warn(`Invalid timestamp format: ${ts}`);
        throw new HttpException(
          {
            statusCode: 401,
            message: 'Invalid timestamp format',
            error: 'Unauthorized',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      const timeDiff = Math.abs(Date.now() - tsMs);
      if (timeDiff > this.SKEW_MS) {
        const skewMinutes = Math.floor(timeDiff / 60000);
        this.logger.warn(`Stale timestamp: ${skewMinutes} minutes old`);
        throw new HttpException(
          {
            statusCode: 401,
            message: `Timestamp outside valid window (±5 minutes). Clock skew: ${skewMinutes} minutes`,
            error: 'Unauthorized - Stale Request',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get webhook secret from environment
      const secret = process.env.WH_SECRET;
      if (!secret) {
        this.logger.error('WH_SECRET not configured');
        throw new HttpException(
          {
            statusCode: 500,
            message: 'Server misconfigured: webhook secret not set',
            error: 'Internal Server Error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Get raw body (must be preserved by middleware)
      const rawBody = (request as any).rawBody;
      if (rawBody === undefined) {
        this.logger.error('Raw body not available - middleware not configured');
        throw new HttpException(
          {
            statusCode: 500,
            message: 'Raw body not available. Ensure raw body middleware is configured.',
            error: 'Internal Server Error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Compute expected HMAC signature
      // Format: HMAC-SHA256(secret, timestamp + "." + rawBody)
      const payload = `${ts}.${rawBody}`;
      const expectedSig = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      let signaturesMatch = false;
      try {
        if (expectedSig.length === sig.length) {
          signaturesMatch = timingSafeEqual(
            Buffer.from(expectedSig, 'hex'),
            Buffer.from(sig, 'hex'),
          );
        }
      } catch (error) {
        this.logger.warn(`Signature comparison error: ${(error as Error).message}`);
        signaturesMatch = false;
      }

      if (!signaturesMatch) {
        this.logger.warn(`Invalid signature for request ID: ${id}`);
        throw new HttpException(
          {
            statusCode: 401,
            message: 'Invalid signature',
            error: 'Unauthorized',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Check for replay attack
      const replayKey = `wh:replay:${id}`;
      const exists = await this.redis.exists(replayKey);
      
      if (exists) {
        this.logger.warn(`Replay attack detected: ${id}`);
        throw new HttpException(
          {
            statusCode: 409,
            message: 'Replay attack detected: request ID already processed',
            error: 'Conflict',
            requestId: id,
          },
          HttpStatus.CONFLICT,
        );
      }

      // Store request ID with 24h TTL to prevent replay
      await this.redis.set(replayKey, '1', this.REPLAY_TTL);

      // Setup cleanup on connection close (optional - Redis TTL handles it)
      request.on('close', () => {
        this.logger.debug(`Connection closed for webhook ${id}`);
      });

      this.logger.log(`Webhook verified successfully: ${id}`);
      return true;

    } catch (error) {
      // Re-throw HttpExceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }

      // Log and wrap unexpected errors
      this.logger.error(`Webhook verification error: ${(error as Error).message}`);
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Webhook verification failed',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get header value (case-insensitive)
   * Checks all possible case variations
   */
  private getHeader(request: any, name: string): string | undefined {
    if (!request.headers) return undefined;
    
    // Try exact match
    if (request.headers[name]) return request.headers[name];
    
    // Try lowercase
    const lowerName = name.toLowerCase();
    if (request.headers[lowerName]) return request.headers[lowerName];
    
    // Search case-insensitively through all headers
    for (const key in request.headers) {
      if (key.toLowerCase() === lowerName) {
        return request.headers[key];
      }
    }
    
    return undefined;
  }
}
