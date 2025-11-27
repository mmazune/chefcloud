/**
 * M16: Idempotency Interceptor
 *
 * NestJS interceptor that checks for Idempotency-Key header
 * and prevents duplicate API requests from being processed.
 *
 * Usage:
 * @UseInterceptors(IdempotencyInterceptor)
 * @Post()
 * async createOrder(@Body() dto: CreateOrderDto) { ... }
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract idempotency key from header or body
    const idempotencyKey = request.headers['idempotency-key'] || request.body?._idempotencyKey;

    // If no idempotency key provided, proceed normally
    if (!idempotencyKey) {
      return next.handle();
    }

    // Build endpoint identifier
    const endpoint = `${request.method} ${request.route?.path || request.url}`;

    // Check if key was already used
    const check = await this.idempotencyService.check(idempotencyKey, endpoint, request.body);

    if (check.isDuplicate) {
      if (check.fingerprintMismatch) {
        // Same key, different request body - reject
        this.logger.warn(`Idempotency key ${idempotencyKey} used with different body`, {
          key: idempotencyKey,
          endpoint,
        });

        throw new ConflictException({
          statusCode: 409,
          message: 'Idempotency key already used with different request body',
          conflictType: 'IDEMPOTENCY_FINGERPRINT_MISMATCH',
        });
      }

      // Same key, same body - return cached response
      this.logger.log(`Returning cached response for idempotency key ${idempotencyKey}`);

      response.status(check.existingResponse!.statusCode);
      return of(check.existingResponse!.body);
    }

    // First time seeing this key - proceed and store result
    return next.handle().pipe(
      tap(async (responseBody) => {
        // Store idempotency key with response
        await this.idempotencyService.store(
          idempotencyKey,
          endpoint,
          request.body,
          responseBody,
          response.statusCode || 200,
        );
      }),
      catchError(async (error) => {
        // Even errors should be cached (e.g., 422 validation errors should not be retried)
        const errorResponse = {
          statusCode: error.status || 500,
          message: error.message,
          error: error.name,
        };

        await this.idempotencyService.store(
          idempotencyKey,
          endpoint,
          request.body,
          errorResponse,
          error.status || 500,
        );

        throw error;
      }),
    );
  }
}
