/**
 * M9.5: Webhook Service
 *
 * Manages outbound webhook endpoints and event emission.
 * Handles CRUD for webhook configurations per org/branch.
 */
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes, createHmac } from 'crypto';

export interface WebhookEndpointDto {
  url: string;
  eventTypes: string[];
  enabled?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  branchId?: string;
}

export interface WebhookEvent {
  type: string;
  orgId: string;
  branchId?: string;
  payload: Record<string, unknown>;
}

// Valid webhook event types
export const WEBHOOK_EVENT_TYPES = [
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'reservation.no_show',
  'reservation.seated',
  'reservation.completed',
  'waitlist.added',
  'waitlist.promoted',
  'waitlist.dropped',
  'deposit.required',
  'deposit.paid',
  'deposit.refunded',
  'deposit.forfeited',
  'deposit.applied',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a webhook endpoint
   */
  async createEndpoint(orgId: string, dto: WebhookEndpointDto) {
    // Validate URL
    this.validateUrl(dto.url);

    // Validate event types
    this.validateEventTypes(dto.eventTypes);

    // Generate secret
    const secret = randomBytes(32).toString('base64url');

    const endpoint = await this.prisma.client.webhookEndpoint.create({
      data: {
        orgId,
        branchId: dto.branchId || null,
        url: dto.url,
        secret,
        eventTypes: dto.eventTypes,
        enabled: dto.enabled ?? true,
        maxRetries: dto.maxRetries ?? 3,
        timeoutMs: dto.timeoutMs ?? 5000,
      },
    });

    this.logger.log(`Created webhook endpoint ${endpoint.id} for org ${orgId}`);

    return {
      ...endpoint,
      // Return secret only on creation
      secret,
    };
  }

  /**
   * List webhook endpoints for an org
   */
  async listEndpoints(orgId: string, branchId?: string) {
    const where: Record<string, unknown> = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.client.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        eventTypes: true,
        enabled: true,
        maxRetries: true,
        timeoutMs: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        // Note: secret is not returned in list
      },
    });
  }

  /**
   * Get a single endpoint
   */
  async getEndpoint(orgId: string, endpointId: string) {
    const endpoint = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    });

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return {
      ...endpoint,
      secret: undefined, // Never return secret
    };
  }

  /**
   * Update a webhook endpoint
   */
  async updateEndpoint(orgId: string, endpointId: string, dto: Partial<WebhookEndpointDto>) {
    const existing = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    if (dto.url) {
      this.validateUrl(dto.url);
    }

    if (dto.eventTypes) {
      this.validateEventTypes(dto.eventTypes);
    }

    const updated = await this.prisma.client.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        url: dto.url,
        eventTypes: dto.eventTypes,
        enabled: dto.enabled,
        maxRetries: dto.maxRetries,
        timeoutMs: dto.timeoutMs,
        branchId: dto.branchId,
      },
    });

    this.logger.log(`Updated webhook endpoint ${endpointId}`);
    return { ...updated, secret: undefined };
  }

  /**
   * Delete a webhook endpoint
   */
  async deleteEndpoint(orgId: string, endpointId: string) {
    const existing = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    await this.prisma.client.webhookEndpoint.delete({
      where: { id: endpointId },
    });

    this.logger.log(`Deleted webhook endpoint ${endpointId}`);
    return { deleted: true };
  }

  /**
   * Rotate the secret for an endpoint
   */
  async rotateSecret(orgId: string, endpointId: string) {
    const existing = await this.prisma.client.webhookEndpoint.findFirst({
      where: { id: endpointId, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const newSecret = randomBytes(32).toString('base64url');

    await this.prisma.client.webhookEndpoint.update({
      where: { id: endpointId },
      data: { secret: newSecret },
    });

    this.logger.log(`Rotated secret for webhook endpoint ${endpointId}`);
    return { secret: newSecret };
  }

  /**
   * Emit a webhook event - creates outbox records for all matching endpoints
   */
  async emitEvent(event: WebhookEvent): Promise<string[]> {
    const { type, orgId, branchId, payload } = event;

    // Find all matching endpoints
    const endpoints = await this.prisma.client.webhookEndpoint.findMany({
      where: {
        orgId,
        enabled: true,
        eventTypes: { has: type },
        OR: [
          { branchId: null }, // Org-level endpoints
          { branchId: branchId || undefined }, // Branch-specific
        ],
      },
    });

    if (endpoints.length === 0) {
      this.logger.debug(`No webhook endpoints for event ${type} in org ${orgId}`);
      return [];
    }

    // Generate unique event ID
    const eventId = `evt_${randomBytes(16).toString('base64url')}`;

    // Create outbox records for each endpoint
    const deliveryIds: string[] = [];

    for (const endpoint of endpoints) {
      const delivery = await this.prisma.client.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          eventType: type,
          eventId: `${eventId}_${endpoint.id}`, // Unique per endpoint
          payload: payload as object,
          status: 'PENDING',
        },
      });
      deliveryIds.push(delivery.id);
    }

    this.logger.log(`Emitted event ${type} to ${deliveryIds.length} endpoints`);
    return deliveryIds;
  }

  /**
   * Get pending deliveries for processing
   */
  async getPendingDeliveries(limit = 100): Promise<Array<{
    id: string;
    endpointId: string;
    eventType: string;
    eventId: string;
    payload: unknown;
    status: string;
    attempts: number;
    lastAttemptAt: Date | null;
    responseCode: number | null;
    responseBody: string | null;
    createdAt: Date;
    updatedAt: Date;
    endpoint: {
      id: string;
      url: string;
      secret: string;
      maxRetries: number;
      timeoutMs: number;
    };
  }>> {
    const results = await this.prisma.client.webhookDelivery.findMany({
      where: {
        status: { in: ['PENDING', 'ATTEMPTED'] },
      },
      include: {
        endpoint: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return results as Array<{
      id: string;
      endpointId: string;
      eventType: string;
      eventId: string;
      payload: unknown;
      status: string;
      attempts: number;
      lastAttemptAt: Date | null;
      responseCode: number | null;
      responseBody: string | null;
      createdAt: Date;
      updatedAt: Date;
      endpoint: {
        id: string;
        url: string;
        secret: string;
        maxRetries: number;
        timeoutMs: number;
      };
    }>;
  }

  /**
   * Generate HMAC signature for payload
   */
  generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Validate URL (basic SSRF prevention)
   */
  private validateUrl(url: string) {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
      }

      // Basic SSRF prevention - block obvious private ranges
      const hostname = parsed.hostname.toLowerCase();
      const blockedPatterns = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.', // Link-local
        '10.', // Private class A
        '192.168.', // Private class C
      ];

      for (const pattern of blockedPatterns) {
        if (hostname.startsWith(pattern) || hostname === pattern) {
          throw new BadRequestException('Webhook URL cannot point to private/local addresses');
        }
      }

      // Block 172.16-31.x.x (Private class B)
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
        throw new BadRequestException('Webhook URL cannot point to private addresses');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid webhook URL');
    }
  }

  /**
   * Validate event types
   */
  private validateEventTypes(types: string[]) {
    if (!types || types.length === 0) {
      throw new BadRequestException('At least one event type is required');
    }

    for (const type of types) {
      if (!WEBHOOK_EVENT_TYPES.includes(type as WebhookEventType)) {
        throw new BadRequestException(`Invalid event type: ${type}`);
      }
    }
  }
}
