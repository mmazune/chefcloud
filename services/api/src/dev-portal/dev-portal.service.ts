import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

@Injectable()
export class DevPortalService {
  constructor(private prisma: PrismaService) {}

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
   * List all developer API keys
   */
  async listKeys() {
    // @ts-expect-error - developerApiKey model will be added to Prisma schema in future PR
    return this.prisma.developerApiKey.findMany({});
  }

  /**
   * Create new developer API key
   */
  async createKey(label: string, plan: 'free' | 'pro' = 'free') {
    // @ts-expect-error - developerApiKey model will be added to Prisma schema in future PR
    return this.prisma.developerApiKey.create({ data: { label, plan } });
  }

  /**
   * Revoke API key (soft delete)
   */
  async revokeKey(id: string) {
    // @ts-expect-error - developerApiKey model will be added to Prisma schema in future PR
    return this.prisma.developerApiKey.update({
      where: { id },
      data: { active: false },
    });
  }

  /**
   * Handle webhook event and verify HMAC signature
   */
  handleWebhook(body: any, sig?: string) {
    const secret = process.env.WH_SECRET || '';
    const raw = JSON.stringify(body ?? {});
    const ok = !!sig && this.verifySignature(raw, secret, sig);
    if (!ok) {
      return { ok: false, reason: sig ? 'bad_signature' : 'missing_signature' };
    }
    return { ok: true, type: body?.type ?? 'dev.event', id: body?.id ?? 'evt' };
  }

  /**
   * Verify HMAC signature (timing-safe)
   */
  private verifySignature(bodyRaw: string, secret: string, sigHex: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(bodyRaw, 'utf8')
      .digest('hex');
    
    if (expected.length !== sigHex.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sigHex)
    );
  }
}
