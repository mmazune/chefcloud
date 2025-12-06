import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException, // M33-DEMO-S4
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DevEnvironment, ApiKeyStatus } from '@chefcloud/db';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DemoProtectionService } from '../common/demo/demo-protection.service'; // M33-DEMO-S4

export interface CreateDevApiKeyDto {
  orgId: string;
  name: string;
  description?: string;
  environment: DevEnvironment;
}

export interface DevApiKeyWithSecret {
  key: {
    id: string;
    orgId: string;
    createdByUserId: string;
    name: string;
    description: string | null;
    prefix: string;
    environment: DevEnvironment;
    status: ApiKeyStatus;
    createdAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    usageCount: number;
  };
  rawKey: string; // Only returned on creation
  warning: string;
}

/**
 * DevApiKeysService
 *
 * Manages developer API keys lifecycle:
 * - Secure key generation with bcrypt hashing
 * - Environment-scoped keys (SANDBOX vs PRODUCTION)
 * - Key verification with constant-time comparison
 * - Usage tracking and revocation
 *
 * Security:
 * - Raw keys never stored (only bcrypt hash with cost 10)
 * - Keys shown only once on creation
 * - Constant-time hash comparison prevents timing attacks
 */
@Injectable()
export class DevApiKeysService {
  constructor(
    private prisma: PrismaService,
    private demoProtection: DemoProtectionService, // M33-DEMO-S4
  ) {}

  /**
   * Generate a secure API key with environment prefix
   * Format: {prefix}{random_base62}
   * Example: cc_live_3kF9mN2pQ7wX8vY1bZ4cD5eA6fG
   */
  private generateApiKey(environment: DevEnvironment): string {
    const prefix = environment === 'PRODUCTION' ? 'cc_live_' : 'cc_test_';
    const randomBytes = crypto.randomBytes(32);
    // Base62-like encoding (alphanumeric, URL-safe)
    const base62 = randomBytes.toString('base64').replace(/[+/=]/g, '').substring(0, 32);
    return `${prefix}${base62}`;
  }

  /**
   * Hash API key using bcrypt (cost factor 10)
   * Bcrypt provides:
   * - Automatic salting
   * - Constant-time comparison
   * - Resistance to rainbow tables
   */
  private async hashKey(rawKey: string): Promise<string> {
    return bcrypt.hash(rawKey, 10);
  }

  /**
   * Verify API key using constant-time bcrypt comparison
   */
  private async verifyKey(rawKey: string, hash: string): Promise<boolean> {
    return bcrypt.compare(rawKey, hash);
  }

  /**
   * Create new API key
   *
   * Returns raw key ONCE - it will never be shown again
   * Stores only bcrypt hash in database
   * M33-DEMO-S4: Blocked for demo orgs
   */
  async createKey(dto: CreateDevApiKeyDto, createdByUserId: string): Promise<DevApiKeyWithSecret> {
    // M33-DEMO-S4: Block API key creation for demo orgs
    const org = await this.prisma.client.org.findUnique({ where: { id: dto.orgId } });
    if (this.demoProtection.isDemoWriteProtectedOrg(org)) {
      throw new ForbiddenException({
        code: this.demoProtection.getDemoProtectionErrorCode(),
        message: this.demoProtection.getDemoProtectionErrorMessage('Creating API keys'),
      });
    }

    // Generate raw key with environment prefix
    const rawKey = this.generateApiKey(dto.environment);

    // Extract prefix from raw key
    const prefix = dto.environment === 'PRODUCTION' ? 'cc_live_' : 'cc_test_';

    // Hash key for storage (bcrypt cost 10)
    const keyHash = await this.hashKey(rawKey);

    // Store key metadata + hash (never store raw key)
    const key = await this.prisma.devApiKey.create({
      data: {
        orgId: dto.orgId,
        createdByUserId,
        name: dto.name,
        description: dto.description,
        keyHash,
        prefix,
        environment: dto.environment,
        status: 'ACTIVE',
        usageCount: 0,
      },
    });

    return {
      key,
      rawKey, // Shown ONCE
      warning: 'Save this key - it will never be shown again',
    };
  }

  /**
   * Revoke API key
   * After revocation, key can no longer authenticate requests
   * M33-DEMO-S4: Blocked for demo orgs
   */
  async revokeKey(
    id: string,
    orgId: string,
  ): Promise<{ id: string; status: ApiKeyStatus; revokedAt: Date }> {
    // M33-DEMO-S4: Block API key revocation for demo orgs
    const org = await this.prisma.client.org.findUnique({ where: { id: orgId } });
    if (this.demoProtection.isDemoWriteProtectedOrg(org)) {
      throw new ForbiddenException({
        code: this.demoProtection.getDemoProtectionErrorCode(),
        message: this.demoProtection.getDemoProtectionErrorMessage('Revoking API keys'),
      });
    }

    const key = await this.prisma.devApiKey.findUnique({
      where: { id },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    if (key.orgId !== orgId) {
      throw new UnauthorizedException('Cannot revoke key from different org');
    }

    if (key.status === 'REVOKED') {
      throw new BadRequestException('API key already revoked');
    }

    const updated = await this.prisma.devApiKey.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      revokedAt: updated.revokedAt!,
    };
  }

  /**
   * List API keys for an organization
   * Returns metadata only (never raw keys)
   */
  async listKeys(orgId: string) {
    return this.prisma.devApiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        prefix: true,
        environment: true,
        status: true,
        createdAt: true,
        revokedAt: true,
        lastUsedAt: true,
        usageCount: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get single API key details
   * Returns metadata only (never raw key)
   */
  async getKey(id: string, orgId: string) {
    const key = await this.prisma.devApiKey.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    if (key.orgId !== orgId) {
      throw new UnauthorizedException('Cannot access key from different org');
    }

    return key;
  }

  /**
   * Verify API key for authentication
   * Returns key details if valid and active, null otherwise
   *
   * Used by API key authentication guard
   */
  async verifyKeyForAuth(rawKey: string) {
    // Extract prefix to identify environment
    const prefix = rawKey.substring(0, 8); // "cc_live_" or "cc_test_"

    if (!prefix.startsWith('cc_')) {
      return null;
    }

    // Hash the provided key
    // Note: bcrypt.compare will handle the hash comparison internally
    // We need to find keys by prefix and check each one
    const keys = await this.prisma.devApiKey.findMany({
      where: {
        prefix,
        status: 'ACTIVE',
      },
    });

    // Try to match hash with constant-time comparison
    for (const key of keys) {
      const isValid = await this.verifyKey(rawKey, key.keyHash);
      if (isValid) {
        return key;
      }
    }

    return null;
  }

  /**
   * Record API key usage
   * Updates lastUsedAt and increments usageCount
   *
   * Called after successful authentication
   */
  async recordUsage(keyId: string): Promise<void> {
    await this.prisma.devApiKey.update({
      where: { id: keyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get usage metrics for a key
   * Returns basic stats (can be expanded for detailed analytics)
   */
  async getKeyMetrics(id: string, orgId: string) {
    const key = await this.getKey(id, orgId);

    return {
      keyId: key.id,
      name: key.name,
      environment: key.environment,
      status: key.status,
      totalRequests: key.usageCount,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      daysActive: key.revokedAt
        ? Math.floor((key.revokedAt.getTime() - key.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - key.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }
}
