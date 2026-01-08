/**
 * M13.1: Menu Foundation Service
 * 
 * Comprehensive menu management including:
 * - Categories CRUD with org scoping
 * - Items CRUD with SKU uniqueness
 * - Modifier groups and options
 * - Availability evaluation
 * - CSV exports with stable ordering
 */
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseService } from '../common/base.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
  AttachModifierGroupDto,
} from './menu.dto';
import { createHash } from 'crypto';

@Injectable()
export class MenuService extends BaseService {
  constructor(private prisma: PrismaService) {
    super();
  }

  // ===== Categories =====

  async createCategory(dto: CreateCategoryDto, orgId: string, branchId: string) {
    // Auto-assign sortOrder if not provided
    const maxSortOrder = await this.prisma.client.category.aggregate({
      where: { orgId, branchId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.client.category.create({
      data: {
        orgId,
        branchId,
        name: dto.name,
        description: dto.description,
        parentCategoryId: dto.parentCategoryId,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getCategories(orgId: string, branchId?: string) {
    return this.prisma.client.category.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        parentCategory: { select: { id: true, name: true } },
        _count: { select: { menuItems: true } },
      },
    });
  }

  async getCategory(id: string, orgId: string): Promise<unknown> {
    const category = await this.prisma.client.category.findFirst({
      where: { id, orgId },
      include: {
        parentCategory: { select: { id: true, name: true } },
        menuItems: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          take: 10,
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, orgId: string) {
    const existing = await this.prisma.client.category.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.client.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        parentCategoryId: dto.parentCategoryId,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  // ===== Menu Items =====

  async createMenuItem(dto: CreateMenuItemDto, orgId: string, branchId: string): Promise<unknown> {
    // Validate SKU uniqueness per org
    if (dto.sku) {
      const existingSku = await this.prisma.client.menuItem.findFirst({
        where: { orgId, sku: dto.sku },
      });
      if (existingSku) {
        throw new BadRequestException(`SKU "${dto.sku}" already exists in this organization`);
      }
    }

    // Auto-assign sortOrder if not provided
    const maxSortOrder = await this.prisma.client.menuItem.aggregate({
      where: { orgId, branchId, categoryId: dto.categoryId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.client.menuItem.create({
      data: {
        orgId,
        branchId,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        categoryId: dto.categoryId,
        itemType: dto.itemType,
        station: dto.station,
        price: dto.price,
        basePriceCents: dto.basePriceCents,
        taxCategoryId: dto.taxCategoryId,
        isAvailable: dto.isAvailable ?? true,
        isActive: dto.isActive ?? true,
        trackInventory: dto.trackInventory ?? false,
        sortOrder,
        metadata: dto.metadata as object | undefined,
      },
      include: {
        category: true,
        taxCategory: true,
      },
    });
  }

  async getMenuItems(orgId: string, branchId?: string, categoryId?: string, activeOnly = true): Promise<unknown> {
    return this.prisma.client.menuItem.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        ...(categoryId && { categoryId }),
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        taxCategory: { select: { id: true, name: true, rate: true } },
      },
    });
  }

  async getMenuItem(id: string, orgId: string): Promise<unknown> {
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id, orgId },
      include: {
        category: true,
        taxCategory: true,
        modifierGroups: {
          orderBy: [{ sortOrder: 'asc' }],
          include: {
            group: {
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return item;
  }

  async updateMenuItem(id: string, dto: UpdateMenuItemDto, orgId: string): Promise<unknown> {
    const existing = await this.prisma.client.menuItem.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Menu item not found');
    }

    // Validate SKU uniqueness if changed
    if (dto.sku && dto.sku !== existing.sku) {
      const existingSku = await this.prisma.client.menuItem.findFirst({
        where: { orgId, sku: dto.sku, NOT: { id } },
      });
      if (existingSku) {
        throw new BadRequestException(`SKU "${dto.sku}" already exists in this organization`);
      }
    }

    return this.prisma.client.menuItem.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        categoryId: dto.categoryId,
        itemType: dto.itemType,
        station: dto.station,
        price: dto.price,
        basePriceCents: dto.basePriceCents,
        taxCategoryId: dto.taxCategoryId,
        isAvailable: dto.isAvailable,
        isActive: dto.isActive,
        trackInventory: dto.trackInventory,
        sortOrder: dto.sortOrder,
        metadata: dto.metadata as object | undefined,
      },
      include: {
        category: true,
        taxCategory: true,
      },
    });
  }

  // ===== Modifier Groups =====

  async createModifierGroup(dto: CreateModifierGroupDto, orgId: string): Promise<unknown> {
    // Validate min/max constraints
    if (dto.max > 0 && dto.min > dto.max) {
      throw new BadRequestException('min cannot be greater than max');
    }

    // Auto-assign sortOrder
    const maxSortOrder = await this.prisma.client.modifierGroup.aggregate({
      where: { orgId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.client.modifierGroup.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        selectionType: dto.selectionType ?? 'SINGLE',
        min: dto.min ?? 0,
        max: dto.max ?? 0,
        required: dto.required ?? false,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  async getModifierGroups(orgId: string, activeOnly = true): Promise<unknown> {
    return this.prisma.client.modifierGroup.findMany({
      where: {
        orgId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        options: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        _count: { select: { menuItems: true } },
      },
    });
  }

  async getModifierGroup(id: string, orgId: string): Promise<unknown> {
    const group = await this.prisma.client.modifierGroup.findFirst({
      where: { id, orgId },
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        menuItems: {
          include: {
            item: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    return group;
  }

  async updateModifierGroup(id: string, dto: UpdateModifierGroupDto, orgId: string): Promise<unknown> {
    const existing = await this.prisma.client.modifierGroup.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Modifier group not found');
    }

    // Validate min/max constraints
    const newMin = dto.min ?? existing.min;
    const newMax = dto.max ?? existing.max;
    if (newMax > 0 && newMin > newMax) {
      throw new BadRequestException('min cannot be greater than max');
    }

    return this.prisma.client.modifierGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        selectionType: dto.selectionType,
        min: dto.min,
        max: dto.max,
        required: dto.required,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  // ===== Modifier Options =====

  async createModifierOption(dto: CreateModifierOptionDto, orgId: string): Promise<unknown> {
    // Validate group exists and belongs to org
    const group = await this.prisma.client.modifierGroup.findFirst({
      where: { id: dto.groupId, orgId },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    // Auto-assign sortOrder
    const maxSortOrder = await this.prisma.client.modifierOption.aggregate({
      where: { groupId: dto.groupId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.client.modifierOption.create({
      data: {
        groupId: dto.groupId,
        name: dto.name,
        priceDelta: dto.priceDelta ?? 0,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateModifierOption(id: string, dto: UpdateModifierOptionDto, orgId: string): Promise<unknown> {
    const existing = await this.prisma.client.modifierOption.findFirst({
      where: { id, group: { orgId } },
    });

    if (!existing) {
      throw new NotFoundException('Modifier option not found');
    }

    return this.prisma.client.modifierOption.update({
      where: { id },
      data: {
        name: dto.name,
        priceDelta: dto.priceDelta,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  // ===== Attach Modifier Groups to Items =====

  async attachModifierGroup(itemId: string, dto: AttachModifierGroupDto, orgId: string): Promise<unknown> {
    // Validate item exists
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id: itemId, orgId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    // Validate group exists
    const group = await this.prisma.client.modifierGroup.findFirst({
      where: { id: dto.groupId, orgId },
    });
    if (!group) {
      throw new NotFoundException('Modifier group not found');
    }

    // Check for existing attachment
    const existing = await this.prisma.client.menuItemOnGroup.findUnique({
      where: {
        itemId_groupId: { itemId, groupId: dto.groupId },
      },
    });
    if (existing) {
      throw new ConflictException('Modifier group is already attached to this item');
    }

    // Auto-assign sortOrder
    const maxSortOrder = await this.prisma.client.menuItemOnGroup.aggregate({
      where: { itemId },
      _max: { sortOrder: true },
    });
    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.client.menuItemOnGroup.create({
      data: {
        itemId,
        groupId: dto.groupId,
        sortOrder,
      },
      include: {
        group: {
          include: {
            options: { orderBy: [{ sortOrder: 'asc' }] },
          },
        },
      },
    });
  }

  async detachModifierGroup(itemId: string, groupId: string, orgId: string) {
    // Validate item exists
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id: itemId, orgId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.client.menuItemOnGroup.deleteMany({
      where: { itemId, groupId },
    });
  }

  // ===== Availability Rules =====

  async createAvailabilityRule(dto: CreateAvailabilityRuleDto, orgId: string) {
    // Validate time format
    this.validateTimeFormat(dto.startTime);
    this.validateTimeFormat(dto.endTime);

    // Validate days of week
    if (dto.daysOfWeek) {
      for (const day of dto.daysOfWeek) {
        if (day < 0 || day > 6) {
          throw new BadRequestException('daysOfWeek must be 0-6 (Sun-Sat)');
        }
      }
    }

    return this.prisma.client.menuAvailabilityRule.create({
      data: {
        orgId,
        branchId: dto.branchId,
        targetType: dto.targetType,
        categoryId: dto.targetType === 'CATEGORY' ? dto.targetId : undefined,
        itemId: dto.targetType === 'ITEM' ? dto.targetId : undefined,
        daysOfWeek: dto.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
        startTime: dto.startTime ?? '00:00',
        endTime: dto.endTime ?? '23:59',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getAvailabilityRules(orgId: string, branchId?: string) {
    return this.prisma.client.menuAvailabilityRule.findMany({
      where: {
        orgId,
        ...(branchId && { OR: [{ branchId }, { branchId: null }] }),
      },
      orderBy: [{ targetType: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateAvailabilityRule(id: string, dto: UpdateAvailabilityRuleDto, orgId: string) {
    const existing = await this.prisma.client.menuAvailabilityRule.findFirst({
      where: { id, orgId },
    });

    if (!existing) {
      throw new NotFoundException('Availability rule not found');
    }

    // Validate time format if provided
    if (dto.startTime) this.validateTimeFormat(dto.startTime);
    if (dto.endTime) this.validateTimeFormat(dto.endTime);

    // Validate days of week if provided
    if (dto.daysOfWeek) {
      for (const day of dto.daysOfWeek) {
        if (day < 0 || day > 6) {
          throw new BadRequestException('daysOfWeek must be 0-6 (Sun-Sat)');
        }
      }
    }

    return this.prisma.client.menuAvailabilityRule.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        daysOfWeek: dto.daysOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        isActive: dto.isActive,
      },
    });
  }

  private validateTimeFormat(time?: string) {
    if (!time) return;
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!regex.test(time)) {
      throw new BadRequestException(`Invalid time format: ${time}. Expected HH:MM`);
    }
  }

  // ===== Availability Evaluation =====

  async isAvailable(itemId: string, branchId: string, atIso?: string): Promise<boolean> {
    const at = atIso ? new Date(atIso) : new Date();
    
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id: itemId, branchId },
      include: { category: true },
    });

    if (!item || !item.isActive || !item.isAvailable) {
      return false;
    }

    // Get branch timezone (default to Africa/Kampala)
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { timezone: true, orgId: true },
    });

    const timezone = branch?.timezone ?? 'Africa/Kampala';
    const orgId = branch?.orgId;

    if (!orgId) return false;

    // Get applicable rules
    const rules = await this.prisma.client.menuAvailabilityRule.findMany({
      where: {
        orgId,
        isActive: true,
        AND: [
          {
            OR: [
              { branchId },
              { branchId: null },
            ],
          },
          {
            OR: [
              { targetType: 'ITEM', itemId: itemId },
              ...(item.categoryId ? [{ targetType: 'CATEGORY' as const, categoryId: item.categoryId }] : []),
            ],
          },
        ],
      },
    });

    // If no rules, item is available (default)
    if (rules.length === 0) {
      return true;
    }

    // Item rules override category rules
    const itemRules = rules.filter(r => r.targetType === 'ITEM');
    const categoryRules = rules.filter(r => r.targetType === 'CATEGORY');

    // Use item rules if present, otherwise category rules
    const applicableRules = itemRules.length > 0 ? itemRules : categoryRules;

    // Branch-specific rules override org-wide rules
    const branchRules = applicableRules.filter(r => r.branchId === branchId);
    const orgRules = applicableRules.filter(r => r.branchId === null);
    const finalRules = branchRules.length > 0 ? branchRules : orgRules;

    // Check if current time matches any rule
    return this.checkRulesMatch(finalRules, at, timezone);
  }

  private checkRulesMatch(rules: { daysOfWeek: number[]; startTime: string; endTime: string }[], at: Date, _timezone: string): boolean {
    // Simple implementation - for production, use date-fns-tz
    const dayOfWeek = at.getDay();
    const currentTime = at.toTimeString().slice(0, 5); // HH:MM

    for (const rule of rules) {
      if (!rule.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      if (currentTime >= rule.startTime && currentTime <= rule.endTime) {
        return true;
      }
    }

    return false;
  }

  async getAvailableItems(orgId: string, branchId: string, atIso?: string) {
    const items = await this.prisma.client.menuItem.findMany({
      where: {
        orgId,
        branchId,
        isActive: true,
        isAvailable: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    // Filter by availability rules
    const availableItems = [];
    for (const item of items) {
      const isAvail = await this.isAvailable(item.id, branchId, atIso);
      if (isAvail) {
        availableItems.push(item);
      }
    }

    return availableItems;
  }

  // ===== CSV Exports =====

  async exportItemsCsv(orgId: string, branchId?: string): Promise<{ content: string; hash: string }> {
    const items = await this.prisma.client.menuItem.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    const BOM = '\uFEFF';
    const headers = ['ID', 'Name', 'SKU', 'Category', 'Branch', 'Price', 'Available', 'Active', 'Sort Order'];
    const rows = items.map(item => [
      item.id,
      this.escapeCSV(item.name),
      this.escapeCSV(item.sku ?? ''),
      this.escapeCSV(item.category?.name ?? ''),
      this.escapeCSV(item.branch.name),
      item.price.toString(),
      item.isAvailable ? 'Yes' : 'No',
      item.isActive ? 'Yes' : 'No',
      item.sortOrder.toString(),
    ]);

    const content = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const hash = this.computeHash(content);

    return { content, hash };
  }

  async exportModifiersCsv(orgId: string): Promise<{ content: string; hash: string }> {
    const groups = await this.prisma.client.modifierGroup.findMany({
      where: { orgId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        options: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const BOM = '\uFEFF';
    const headers = ['Group ID', 'Group Name', 'Selection Type', 'Min', 'Max', 'Required', 'Option ID', 'Option Name', 'Price Delta', 'Active'];
    const rows: string[][] = [];

    for (const group of groups) {
      if (group.options.length === 0) {
        rows.push([
          group.id,
          this.escapeCSV(group.name),
          group.selectionType,
          group.min.toString(),
          group.max.toString(),
          group.required ? 'Yes' : 'No',
          '',
          '',
          '',
          group.isActive ? 'Yes' : 'No',
        ]);
      } else {
        for (const option of group.options) {
          rows.push([
            group.id,
            this.escapeCSV(group.name),
            group.selectionType,
            group.min.toString(),
            group.max.toString(),
            group.required ? 'Yes' : 'No',
            option.id,
            this.escapeCSV(option.name),
            option.priceDelta.toString(),
            option.isActive ? 'Yes' : 'No',
          ]);
        }
      }
    }

    const content = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const hash = this.computeHash(content);

    return { content, hash };
  }

  private escapeCSV(value: string): string {
    // CSV injection prevention
    if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
      value = "'" + value;
    }
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private computeHash(content: string): string {
    // Normalize to LF for consistent hashing across platforms
    const normalized = content.replace(/\r\n/g, '\n');
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
}
