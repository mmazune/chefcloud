/**
 * M9.5: Template Render Service
 *
 * Safe variable substitution for notification templates.
 * Prevents injection attacks through escaping.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationType } from '@chefcloud/db';

export interface TemplateVariables {
  name?: string;
  time?: string;
  date?: string;
  partySize?: number;
  branch?: string;
  depositAmount?: string;
  confirmationCode?: string;
  manageUrl?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  [key: string]: string | number | undefined;
}

export interface TemplateDto {
  type: NotificationType;
  event: string;
  subject?: string;
  body: string;
  enabled?: boolean;
  branchId?: string;
}

// Valid template variables
const VALID_VARIABLES = [
  'name',
  'time',
  'date',
  'partySize',
  'branch',
  'depositAmount',
  'confirmationCode',
  'manageUrl',
  'cancelUrl',
  'rescheduleUrl',
  'phone',
  'email',
  'notes',
  'status',
  'source',
];

// Sample data for preview
const SAMPLE_DATA: TemplateVariables = {
  name: 'John Doe',
  time: '7:00 PM',
  date: 'January 15, 2025',
  partySize: 4,
  branch: 'Downtown Restaurant',
  depositAmount: 'UGX 50,000',
  confirmationCode: 'RES-ABC123',
  manageUrl: 'https://example.com/manage/abc123',
  cancelUrl: 'https://example.com/cancel/abc123',
  rescheduleUrl: 'https://example.com/reschedule/abc123',
  phone: '+256 700 123456',
  email: 'john@example.com',
  notes: 'Window seat preferred',
  status: 'Confirmed',
  source: 'Online',
};

@Injectable()
export class TemplateRenderService {
  private readonly logger = new Logger(TemplateRenderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a notification template
   */
  async createTemplate(orgId: string, dto: TemplateDto) {
    // Validate template body
    this.validateTemplate(dto.body);
    if (dto.subject) {
      this.validateTemplate(dto.subject);
    }

    const template = await this.prisma.client.notificationTemplate.create({
      data: {
        orgId,
        branchId: dto.branchId || null,
        type: dto.type,
        event: dto.event,
        subject: dto.subject,
        body: dto.body,
        enabled: dto.enabled ?? true,
      },
    });

    this.logger.log(`Created template ${template.id} for org ${orgId}`);
    return template;
  }

  /**
   * List templates for an org
   */
  async listTemplates(orgId: string, branchId?: string) {
    const where: Record<string, unknown> = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }

    return this.prisma.client.notificationTemplate.findMany({
      where,
      orderBy: [{ event: 'asc' }, { type: 'asc' }],
    });
  }

  /**
   * Get a template by ID
   */
  async getTemplate(orgId: string, templateId: string) {
    const template = await this.prisma.client.notificationTemplate.findFirst({
      where: { id: templateId, orgId },
    });

    if (!template) {
      throw new BadRequestException('Template not found');
    }

    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(orgId: string, templateId: string, dto: Partial<TemplateDto>) {
    const existing = await this.prisma.client.notificationTemplate.findFirst({
      where: { id: templateId, orgId },
    });

    if (!existing) {
      throw new BadRequestException('Template not found');
    }

    if (dto.body) {
      this.validateTemplate(dto.body);
    }
    if (dto.subject) {
      this.validateTemplate(dto.subject);
    }

    const updated = await this.prisma.client.notificationTemplate.update({
      where: { id: templateId },
      data: {
        type: dto.type,
        event: dto.event,
        subject: dto.subject,
        body: dto.body,
        enabled: dto.enabled,
        branchId: dto.branchId,
      },
    });

    this.logger.log(`Updated template ${templateId}`);
    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(orgId: string, templateId: string) {
    const existing = await this.prisma.client.notificationTemplate.findFirst({
      where: { id: templateId, orgId },
    });

    if (!existing) {
      throw new BadRequestException('Template not found');
    }

    await this.prisma.client.notificationTemplate.delete({
      where: { id: templateId },
    });

    this.logger.log(`Deleted template ${templateId}`);
    return { deleted: true };
  }

  /**
   * Render a template with variables
   */
  render(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace all {{variable}} patterns
    const pattern = /\{\{(\w+)\}\}/g;
    result = result.replace(pattern, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
        // Leave unmatched variables as-is for debugging
        return match;
      }
      // Escape HTML entities for safety
      return this.escapeHtml(String(value));
    });

    return result;
  }

  /**
   * Preview a template with sample data
   */
  async previewTemplate(orgId: string, templateId: string) {
    const template = await this.getTemplate(orgId, templateId);

    const renderedSubject = template.subject
      ? this.render(template.subject, SAMPLE_DATA)
      : null;
    const renderedBody = this.render(template.body, SAMPLE_DATA);

    return {
      template,
      preview: {
        subject: renderedSubject,
        body: renderedBody,
      },
      sampleData: SAMPLE_DATA,
    };
  }

  /**
   * Preview with custom variables
   */
  previewWithVariables(template: string, variables: TemplateVariables): string {
    this.validateTemplate(template);
    return this.render(template, variables);
  }

  /**
   * Find best matching template for an event
   */
  async findTemplate(orgId: string, branchId: string | null, type: NotificationType, event: string) {
    // Try branch-specific first
    if (branchId) {
      const branchTemplate = await this.prisma.client.notificationTemplate.findFirst({
        where: { orgId, branchId, type, event, enabled: true },
      });
      if (branchTemplate) return branchTemplate;
    }

    // Fall back to org-level
    return this.prisma.client.notificationTemplate.findFirst({
      where: { orgId, branchId: null, type, event, enabled: true },
    });
  }

  /**
   * Validate template for security
   */
  private validateTemplate(template: string) {
    // Check for script injection attempts
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i, // onclick, onload, etc.
      /data:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(template)) {
        throw new BadRequestException('Template contains potentially unsafe content');
      }
    }

    // Extract variables and validate
    const varPattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = varPattern.exec(template)) !== null) {
      const varName = match[1];
      if (!VALID_VARIABLES.includes(varName)) {
        this.logger.warn(`Unknown template variable: ${varName}`);
        // Allow unknown variables but log warning
      }
    }
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => entities[char] || char);
  }

  /**
   * Get available variables list
   */
  getAvailableVariables() {
    return VALID_VARIABLES.map((name) => ({
      name,
      sample: SAMPLE_DATA[name],
    }));
  }
}
