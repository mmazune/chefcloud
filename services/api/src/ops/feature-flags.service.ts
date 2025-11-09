import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash } from 'crypto';

interface FlagContext {
  orgId?: string;
  branchId?: string;
  role?: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate if a feature flag is enabled for a given context.
   * Checks: active, scopes (role/branch), rolloutPct via deterministic hash.
   */
  async get(key: string, context: FlagContext): Promise<boolean> {
    const flag = await this.prisma.client.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) return false; // Flag doesn't exist → OFF
    if (!flag.active) return false; // Flag explicitly disabled

    // Check scopes (if defined)
    if (flag.scopes) {
      const scopes = flag.scopes as { roles?: string[]; branches?: string[] };

      if (scopes.roles && context.role) {
        if (!scopes.roles.includes(context.role)) return false;
      }

      if (scopes.branches && context.branchId) {
        if (!scopes.branches.includes(context.branchId)) return false;
      }
    }

    // Rollout percentage check (deterministic hash)
    if (flag.rolloutPct < 100) {
      const contextKey = `${key}:${context.orgId || ''}:${context.branchId || ''}`;
      const hash = createHash('sha256').update(contextKey).digest('hex');
      const hashNum = parseInt(hash.substring(0, 8), 16);
      const bucket = hashNum % 100;

      if (bucket >= flag.rolloutPct) return false;
    }

    return true;
  }

  /**
   * Instant kill-switch: set active=false and rolloutPct=0.
   */
  async kill(key: string, userId?: string): Promise<void> {
    const flag = await this.prisma.client.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    // Audit before change
    await this.prisma.client.flagAudit.create({
      data: {
        flagKey: key,
        userId,
        action: 'KILL',
        before: flag,
        after: { active: false, rolloutPct: 0 },
      },
    });

    // Kill the flag
    await this.prisma.client.featureFlag.update({
      where: { key },
      data: {
        active: false,
        rolloutPct: 0,
        updatedById: userId,
      },
    });
  }

  /**
   * Create or update a feature flag.
   */
  async upsert(
    key: string,
    data: {
      orgId?: string;
      description?: string;
      active?: boolean;
      rolloutPct?: number;
      scopes?: { roles?: string[]; branches?: string[] };
    },
    userId?: string,
  ): Promise<any> {
    const existing = await this.prisma.client.featureFlag.findUnique({
      where: { key },
    });

    const action = existing ? 'UPDATE' : 'CREATE';
    const updateData = {
      orgId: data.orgId,
      description: data.description,
      active: data.active ?? false,
      rolloutPct: data.rolloutPct ?? 0,
      scopes: data.scopes,
      ...(existing ? { updatedById: userId } : { createdById: userId }),
    };

    const flag = await this.prisma.client.featureFlag.upsert({
      where: { key },
      create: { key, ...updateData },
      update: updateData,
    });

    // Audit
    await this.prisma.client.flagAudit.create({
      data: {
        flagKey: key,
        userId,
        action,
        before: existing || undefined,
        after: flag,
      },
    });

    return flag;
  }

  /**
   * Toggle a flag (active ↔ inactive).
   */
  async toggle(key: string, userId?: string): Promise<any> {
    const flag = await this.prisma.client.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    const newActive = !flag.active;

    await this.prisma.client.flagAudit.create({
      data: {
        flagKey: key,
        userId,
        action: 'TOGGLE',
        before: flag,
        after: { ...flag, active: newActive },
      },
    });

    return this.prisma.client.featureFlag.update({
      where: { key },
      data: {
        active: newActive,
        updatedById: userId,
      },
    });
  }

  /**
   * Get all flags.
   */
  async findAll(orgId?: string): Promise<any[]> {
    return this.prisma.client.featureFlag.findMany({
      where: orgId ? { orgId } : {},
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Get a single flag by key.
   */
  async findOne(key: string): Promise<any> {
    const flag = await this.prisma.client.featureFlag.findUnique({
      where: { key },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    return flag;
  }

  /**
   * Get audit trail for a flag.
   */
  async getAudit(key: string): Promise<any[]> {
    return this.prisma.client.flagAudit.findMany({
      where: { flagKey: key },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }
}
