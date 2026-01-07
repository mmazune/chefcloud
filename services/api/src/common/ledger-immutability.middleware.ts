/**
 * M11.15: Ledger Immutability Middleware
 *
 * Enforces append-only semantics on financial ledger models.
 * These models MUST NOT be updated or deleted once created:
 * - InventoryLedgerEntry
 * - InventoryCostLayer
 * - LotLedgerAllocation
 *
 * Error Code: LEDGER_IMMUTABLE
 * HTTP Status: 403 Forbidden
 */

import { Prisma } from '@chefcloud/db';
import { Logger } from '@nestjs/common';

/**
 * Models protected by immutability middleware.
 * These are financial audit trails that must never be modified.
 */
const IMMUTABLE_MODELS = new Set([
  'InventoryLedgerEntry',
  'InventoryCostLayer',
  'LotLedgerAllocation',
]);

/**
 * Actions blocked for immutable models.
 * Only update/delete are blocked; read and create are allowed.
 */
const BLOCKED_ACTIONS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert', // Upsert can perform updates
]);

/**
 * Custom error for ledger immutability violations.
 */
export class LedgerImmutabilityError extends Error {
  public readonly code = 'LEDGER_IMMUTABLE';
  public readonly statusCode = 403;

  constructor(model: string, action: string) {
    super(
      `Immutability violation: ${action} on ${model} is forbidden. ` +
        `Ledger entries are append-only and cannot be modified or deleted.`,
    );
    this.name = 'LedgerImmutabilityError';
  }
}

/**
 * Create Prisma middleware that enforces ledger immutability.
 *
 * @param logger Logger instance for audit trail
 * @returns Prisma middleware function
 *
 * @example
 * ```typescript
 * // In PrismaService.onModuleInit:
 * prisma.$use(ledgerImmutabilityMiddleware(this.logger));
 * ```
 */
export function ledgerImmutabilityMiddleware(
  logger: Logger,
): Prisma.Middleware {
  return async (params, next) => {
    // Only check for protected models
    if (!params.model || !IMMUTABLE_MODELS.has(params.model)) {
      return next(params);
    }

    // Check if action is blocked
    if (BLOCKED_ACTIONS.has(params.action)) {
      logger.error(
        `LEDGER_IMMUTABLE: Blocked ${params.action} on ${params.model}`,
        {
          model: params.model,
          action: params.action,
          args: JSON.stringify(params.args).substring(0, 200),
        },
      );

      throw new LedgerImmutabilityError(params.model, params.action);
    }

    // Allow read and create operations
    return next(params);
  };
}

/**
 * Utility to check if an error is a LedgerImmutabilityError.
 */
export function isLedgerImmutabilityError(
  error: unknown,
): error is LedgerImmutabilityError {
  return (
    error instanceof LedgerImmutabilityError ||
    (error instanceof Error && (error as any).code === 'LEDGER_IMMUTABLE')
  );
}
