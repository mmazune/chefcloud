/**
 * M16: Idempotency Service
 * 
 * Prevents duplicate API requests by storing and checking idempotency keys.
 * Used for safe write operations during network retries and offline sync.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingResponse?: {
    statusCode: number;
    body: any;
  };
  fingerprintMismatch?: boolean;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if idempotency key was already used
   * Returns existing response if key exists and fingerprint matches
   */
  async check(
    key: string,
    endpoint: string,
    requestBody: any,
  ): Promise<IdempotencyCheckResult> {
    // Calculate request fingerprint
    const requestHash = this.hashRequest(requestBody);

    // Look up existing key
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!existing) {
      // No duplicate - proceed with operation
      return { isDuplicate: false };
    }

    // Check if fingerprint matches
    if (existing.requestHash !== requestHash) {
      this.logger.warn(
        `Idempotency key ${key} used with different request body`,
        {
          key,
          endpoint,
          existingHash: existing.requestHash,
          newHash: requestHash,
        },
      );

      return {
        isDuplicate: true,
        fingerprintMismatch: true,
      };
    }

    // Fingerprint matches - return cached response
    this.logger.log(`Idempotency key ${key} found - returning cached response`, {
      key,
      endpoint,
      statusCode: existing.statusCode,
    });

    return {
      isDuplicate: true,
      existingResponse: {
        statusCode: existing.statusCode,
        body: existing.responseBody,
      },
    };
  }

  /**
   * Store idempotency key with response
   * TTL: 24 hours (auto-expires)
   */
  async store(
    key: string,
    endpoint: string,
    requestBody: any,
    responseBody: any,
    statusCode: number,
  ): Promise<void> {
    const requestHash = this.hashRequest(requestBody);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          endpoint,
          requestHash,
          responseBody,
          statusCode,
          expiresAt,
        },
      });

      this.logger.log(`Stored idempotency key ${key}`, { key, endpoint });
    } catch (error: any) {
      // Ignore duplicate key errors (race condition where two requests stored same key)
      if (error?.code !== 'P2002') {
        // P2002 = unique constraint violation
        this.logger.error(`Failed to store idempotency key ${key}`, error);
      }
    }
  }

  /**
   * Clean up expired keys (run daily via cron)
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired idempotency keys`);
    return result.count;
  }

  /**
   * Hash request body for fingerprint comparison
   * Uses SHA256 for consistent hashing
   */
  private hashRequest(requestBody: any): string {
    // Normalize request body (sort keys, remove whitespace)
    const normalized = JSON.stringify(requestBody, Object.keys(requestBody).sort());
    
    return createHash('sha256')
      .update(normalized)
      .digest('hex');
  }
}
