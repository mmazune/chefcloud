import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as argon2 from 'argon2';
import { DevUsageSummaryDto } from './dto/dev-usage.dto';
import { subHours } from 'date-fns';
import { DevPortalKeyRepo } from './ports/devportal.port';
import { verifySignature } from '../shared/security/hmac';

@Injectable()
export class DevPortalService {
  constructor(
    private prisma: PrismaService,
    private readonly keyRepo: DevPortalKeyRepo,
  ) {}

  async createOrg(data: {
    ownerEmail: string;
    orgName: string;
    planCode: string;
  }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: data.planCode },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid or inactive plan');
    }

    // Create org
    const org = await this.prisma.org.create({
      data: {
        name: data.orgName,
        slug: data.orgName.toLowerCase().replace(/\s+/g, '-'),
      },
    });

    // Create org settings
    await this.prisma.orgSettings.create({
      data: {
        orgId: org.id,
      },
    });

    // Create main branch
    const branch = await this.prisma.branch.create({
      data: {
        orgId: org.id,
        name: 'Main Branch',
        address: 'TBD',
        timezone: 'Africa/Kampala',
      },
    });

    // Create owner user
    const hashedPassword = await argon2.hash('ChangeMe#123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const owner = await this.prisma.user.create({
      data: {
        email: data.ownerEmail,
        passwordHash: hashedPassword,
        firstName: 'Owner',
        lastName: 'Account',
        roleLevel: 'L5',
        orgId: org.id,
        branchId: branch.id,
      },
    });

    // Create subscription (ACTIVE, renews in 30 days)
    const nextRenewalAt = new Date();
    nextRenewalAt.setDate(nextRenewalAt.getDate() + 30);

    const subscription = await this.prisma.orgSubscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: 'ACTIVE',
        nextRenewalAt,
      },
    });

    // Log event
    await this.prisma.subscriptionEvent.create({
      data: {
        orgId: org.id,
        type: 'RENEWED',
        meta: { planCode: plan.code, initial: true },
      },
    });

    return {
      org,
      owner: { id: owner.id, email: owner.email },
      subscription,
    };
  }

  async listSubscriptions() {
    return this.prisma.orgSubscription.findMany({
      include: {
        org: { select: { id: true, name: true, slug: true } },
        plan: { select: { code: true, name: true } },
      },
      orderBy: { nextRenewalAt: 'asc' },
    });
  }

  async upsertPlan(data: {
    code: string;
    name: string;
    priceUGX: number;
    features: Record<string, unknown>;
    isActive?: boolean;
  }): Promise<Record<string, unknown>> {
    return this.prisma.subscriptionPlan.upsert({
      where: { code: data.code },
      create: {
        code: data.code,
        name: data.name,
        priceUGX: data.priceUGX,
        features: data.features as Record<string, never>,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        priceUGX: data.priceUGX,
        features: data.features as Record<string, never>,
        isActive: data.isActive ?? true,
      },
    }) as unknown as Record<string, unknown>;
  }

  async manageDevAdmin(
    action: 'add' | 'remove',
    email: string,
    isSuper = false,
  ): Promise<Record<string, unknown>> {
    if (action === 'add') {
      return this.prisma.devAdmin.upsert({
        where: { email },
        create: { email, isSuper },
        update: { isSuper },
      });
    }

    if (action === 'remove') {
      const devAdmin = await this.prisma.devAdmin.findUnique({
        where: { email },
      });

      if (devAdmin?.isSuper) {
        const superCount = await this.prisma.devAdmin.count({
          where: { isSuper: true },
        });

        if (superCount <= 2) {
          throw new BadRequestException(
            'Cannot remove super dev: minimum 2 required',
          );
        }
      }

      return this.prisma.devAdmin.delete({ where: { email } });
    }

    throw new BadRequestException('Invalid action');
  }

  /**
   * Helper for time range resolution
   */
  private resolveRange(range: '24h' | '7d') {
    const to = new Date();
    const from = range === '24h' ? subHours(to, 24) : subHours(to, 24 * 7);
    return { from, to };
  }

  /**
   * Get API usage summary for a developer account
   * 
   * NOTE: This is a v1 implementation with mock data.
   * In production, this would query an ApiRequestLog table or metrics service.
   * 
   * @param orgId - Organization ID (developer account)
   * @param range - Time range ('24h' or '7d')
   */
  async getUsageSummaryForOrg(
    orgId: string,
    range: '24h' | '7d' = '24h',
  ): Promise<DevUsageSummaryDto> {
    const { from, to } = this.resolveRange(range);

    // TODO: Replace with actual metrics query when ApiRequestLog table exists
    // Example query structure:
    // const rows = await this.prisma.apiRequestLog.groupBy({
    //   by: ['keyId', 'keyLabel', 'environment'],
    //   _count: { _all: true },
    //   _sum: { isError: true },
    //   where: {
    //     orgId,
    //     timestamp: { gte: from, lt: to },
    //   },
    // });

    // For now, generate mock data based on actual API keys in the system
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });

    // Generate mock usage data
    const mockData = this.generateMockUsageData(apiKeys, range);

    // Calculate aggregates
    let totalRequests = 0;
    let totalErrors = 0;
    let sandboxRequests = 0;
    let productionRequests = 0;

    const topKeys = mockData.keys.map((k) => {
      totalRequests += k.requestCount;
      totalErrors += k.errorCount;

      if (k.environment === 'SANDBOX') {
        sandboxRequests += k.requestCount;
      } else {
        productionRequests += k.requestCount;
      }

      return {
        keyId: k.keyId,
        label: k.label,
        environment: k.environment as 'SANDBOX' | 'PRODUCTION',
        requestCount: k.requestCount,
        errorCount: k.errorCount,
      };
    });

    // Sort by request count descending, limit to 10
    topKeys.sort((a, b) => b.requestCount - a.requestCount);
    const top10 = topKeys.slice(0, 10);

    const errorRatePercent =
      totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      range,
      totalRequests,
      totalErrors,
      errorRatePercent,
      sandboxRequests,
      productionRequests,
      timeseries: mockData.timeseries,
      topKeys: top10,
    };
  }

  /**
   * Generate mock usage data for demonstration
   * In production, this would be replaced with actual database queries
   */
  private generateMockUsageData(
    apiKeys: Array<{ id: string; name: string }>,
    range: '24h' | '7d',
  ) {
    // Generate timeseries (hourly buckets for 24h, 4-hour buckets for 7d)
    const bucketCount = range === '24h' ? 24 : 42; // 7 days * 6 (4-hour buckets)
    const bucketSizeHours = range === '24h' ? 1 : 4;
    const now = new Date();

    const timeseries = Array.from({ length: bucketCount }, (_, i) => {
      const bucketTime = subHours(now, (bucketCount - 1 - i) * bucketSizeHours);
      // Generate realistic-looking traffic with some variance
      const baseRequests = Math.floor(Math.random() * 50) + 10;
      const baseErrors = Math.floor(baseRequests * (Math.random() * 0.05)); // 0-5% error rate

      return {
        timestamp: bucketTime.toISOString(),
        requestCount: baseRequests,
        errorCount: baseErrors,
      };
    });

    // Generate per-key mock data
    const keys = apiKeys.length > 0
      ? apiKeys.map((key, idx) => ({
          keyId: key.id,
          label: key.name,
          environment: idx % 2 === 0 ? 'SANDBOX' : 'PRODUCTION',
          requestCount: Math.floor(Math.random() * 500) + 50,
          errorCount: Math.floor(Math.random() * 20),
        }))
      : [
          // Default mock keys if none exist
          {
            keyId: 'mock_key_1',
            label: 'Integration Test Key',
            environment: 'SANDBOX',
            requestCount: 342,
            errorCount: 8,
          },
          {
            keyId: 'mock_key_2',
            label: 'Production App',
            environment: 'PRODUCTION',
            requestCount: 1024,
            errorCount: 12,
          },
        ];

    return { timeseries, keys };
  }
}
