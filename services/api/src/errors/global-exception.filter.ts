import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StandardErrorBody, toErrorCode } from './error-codes';
import { compactValidationErrors } from './validation.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly includeStacks = process.env.ERROR_INCLUDE_STACKS === '1',
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId =
      (req as any).requestId ||
      (req.headers['x-request-id'] as string | undefined);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus?.() ?? status;
      const resp = exception.getResponse?.() as any;
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        message = resp.message || message;
        // Handle class-validator shape (Nest default)
        if (
          resp.message &&
          Array.isArray(resp.message) &&
          exception instanceof BadRequestException
        ) {
          // Nest sometimes places validation messages array in resp.message; but we prefer structured constraints.
          // If validation errors exist in resp.response, try to compress.
          if (Array.isArray((resp as any).message) && !(resp as any).errors) {
            details = { ...(details || {}), validation: (resp as any).message };
          }
        }
        // Some pipes attach errors in response
        if (resp.errors && Array.isArray(resp.errors)) {
          details = { ...(details || {}), validation: resp.errors };
        }
      } else {
        message = exception.message || message;
      }
    } else if (
      exception &&
      typeof exception === 'object' &&
      'message' in exception
    ) {
      message = (exception as any).message || message;
    }

    // Support class-validator explicit array on BadRequestException (ValidationPipe)
    // If the exception has a 'response' with 'message' array of ValidationError, normalize:
    if (exception instanceof BadRequestException) {
      const resp = exception.getResponse?.() as any;
      // Many apps attach 'message' as string[] or ValidationError[]; try to normalize if ValidationError[]
      if (
        resp &&
        Array.isArray(resp.message) &&
        resp.message[0]?.constraints
      ) {
        details = {
          ...(details || {}),
          validation: compactValidationErrors(resp.message),
        };
      }
    }

    const body: StandardErrorBody = {
      status: 'error',
      code: toErrorCode(status),
      message: typeof message === 'string' ? message : 'Request failed',
      requestId,
    };

    if (details) body.details = details;

    // Optional stack in dev if requested
    if (
      this.includeStacks &&
      exception &&
      typeof exception === 'object' &&
      'stack' in exception
    ) {
      body.details = {
        ...(body.details || {}),
        stack: String((exception as any).stack),
      };
    }

    // Always echo X-Request-Id
    if (requestId) res.setHeader('X-Request-Id', requestId);

    res.status(status).json(body);
  }
}
