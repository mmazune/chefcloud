import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

export interface CreateWebhookSubscriptionDto {
  orgId: string;
  url: string;
  eventTypes: string[];
  name?: string;
}

/**
 * WebhookSubscriptionsService
 * 
 * Manages webhook subscription lifecycle:
 * - Create subscriptions with auto-generated HMAC secrets
 * - Enable/disable subscriptions
 * - List subscriptions per org
 * - Regenerate secrets for rotation
 */
@Injectable()
export class WebhookSubscriptionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate cryptographically secure HMAC secret
   * Format: whsec_{32_random_hex_chars}
   */
  private generateSecret(): string {
    const randomBytes = crypto.randomBytes(32);
    return `whsec_${randomBytes.toString('hex')}`;
  }

  /**
   * Validate webhook URL
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
    } catch (error) {
      throw new BadRequestException(`Invalid webhook URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate event types
   * Event types should match: {domain}.{action}
   */
  private validateEventTypes(eventTypes: string[]): void {
    if (!eventTypes || eventTypes.length === 0) {
      throw new BadRequestException('At least one event type must be specified');
    }

    const validPattern = /^[a-z_]+\.[a-z_]+$/;
    for (const eventType of eventTypes) {
      if (!validPattern.test(eventType)) {
        throw new BadRequestException(
          `Invalid event type format: ${eventType}. Expected format: {domain}.{action} (e.g., order.created)`,
        );
      }
    }
  }

  /**
   * Create webhook subscription
   * Returns subscription with secret (shown once)
   */
  async createSubscription(
    dto: CreateWebhookSubscriptionDto,
    createdByUserId: string,
  ) {
    // Validate inputs
    this.validateUrl(dto.url);
    this.validateEventTypes(dto.eventTypes);

    // Generate HMAC secret
    const secret = this.generateSecret();

    // Create subscription
    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        orgId: dto.orgId,
        createdByUserId,
        url: dto.url,
        eventTypes: dto.eventTypes,
        secret, // Store raw secret (needed for HMAC signing)
        status: 'ACTIVE',
      },
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

    return {
      ...subscription,
      warning: 'Save this secret - you will need it to verify webhook signatures',
    };
  }

  /**
   * List webhook subscriptions for an org
   */
  async listSubscriptions(orgId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    });
  }

  /**
   * Get single webhook subscription
   */
  async getSubscription(id: string, orgId: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
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
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    if (subscription.orgId !== orgId) {
      throw new UnauthorizedException('Cannot access subscription from different org');
    }

    return subscription;
  }

  /**
   * Disable webhook subscription
   * Stops sending webhooks to this URL
   */
  async disableSubscription(id: string, orgId: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    if (subscription.orgId !== orgId) {
      throw new UnauthorizedException('Cannot disable subscription from different org');
    }

    if (subscription.status === 'DISABLED') {
      throw new BadRequestException('Subscription already disabled');
    }

    return this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        status: 'DISABLED',
        disabledAt: new Date(),
      },
    });
  }

  /**
   * Re-enable webhook subscription
   */
  async enableSubscription(id: string, orgId: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    if (subscription.orgId !== orgId) {
      throw new UnauthorizedException('Cannot enable subscription from different org');
    }

    if (subscription.status === 'ACTIVE') {
      throw new BadRequestException('Subscription already active');
    }

    return this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        disabledAt: null,
      },
    });
  }

  /**
   * Regenerate webhook secret
   * Used for secret rotation
   */
  async regenerateSecret(id: string, orgId: string) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    if (subscription.orgId !== orgId) {
      throw new UnauthorizedException('Cannot regenerate secret for subscription from different org');
    }

    const newSecret = this.generateSecret();

    const updated = await this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        secret: newSecret,
      },
    });

    return {
      ...updated,
      warning: 'Secret regenerated - update your webhook endpoint to use the new secret',
    };
  }

  /**
   * Update webhook subscription URL or event types
   */
  async updateSubscription(
    id: string,
    orgId: string,
    updates: { url?: string; eventTypes?: string[] },
  ) {
    const subscription = await this.prisma.webhookSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    if (subscription.orgId !== orgId) {
      throw new UnauthorizedException('Cannot update subscription from different org');
    }

    // Validate updates
    if (updates.url) {
      this.validateUrl(updates.url);
    }
    if (updates.eventTypes) {
      this.validateEventTypes(updates.eventTypes);
    }

    return this.prisma.webhookSubscription.update({
      where: { id },
      data: updates,
    });
  }
}
