import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MenuService } from '../menu/menu.service';

@Injectable()
export class PosMenuService {
  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  /**
   * M13.2: Get available menu items for POS ordering
   * Returns categories with items, each item includes its modifier groups
   */
  async getAvailableMenuForPOS(orgId: string, branchId: string, atIso?: string): Promise<unknown> {
    // Get available items using M13.1 availability logic
    const availableItems = await this.menuService.getAvailableItems(orgId, branchId, atIso);

    // Get modifier groups for each item
    const itemIds = availableItems.map(i => i.id);
    
    const itemsWithModifiers = await this.prisma.client.menuItem.findMany({
      where: {
        id: { in: itemIds },
      },
      include: {
        category: { select: { id: true, name: true, sortOrder: true } },
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
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    // Group items by category
    const categoriesMap = new Map<string, {
      id: string;
      name: string;
      sortOrder: number;
      items: unknown[];
    }>();

    for (const item of itemsWithModifiers) {
      const catId = item.category?.id ?? 'uncategorized';
      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, {
          id: catId,
          name: item.category?.name ?? 'Uncategorized',
          sortOrder: item.category?.sortOrder ?? 999,
          items: [],
        });
      }

      // Transform modifiers for POS UI
      const modifiers = item.modifierGroups.map(mg => ({
        groupId: mg.group.id,
        groupName: mg.group.name,
        selectionType: mg.group.selectionType,
        min: mg.group.min,
        max: mg.group.max,
        required: mg.group.required,
        options: mg.group.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
        })),
      }));

      categoriesMap.get(catId)!.items.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        price: Number(item.price),
        description: item.description,
        modifiers,
      });
    }

    // Convert to sorted array
    const categories = Array.from(categoriesMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      categories,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * M13.2: Validate modifier selection against group constraints
   * Returns validation result with error details if invalid
   */
  validateModifierSelection(
    modifiers: { groupId: string; optionId: string }[],
    itemModifierGroups: {
      groupId: string;
      groupName: string;
      selectionType: string;
      min: number;
      max: number;
      required: boolean;
      options: { id: string; name: string; priceDelta: number }[];
    }[],
  ): { valid: boolean; error?: { code: string; message: string; details?: unknown } } {
    // Group selections by groupId
    const selectionsByGroup = new Map<string, string[]>();
    for (const mod of modifiers) {
      if (!selectionsByGroup.has(mod.groupId)) {
        selectionsByGroup.set(mod.groupId, []);
      }
      selectionsByGroup.get(mod.groupId)!.push(mod.optionId);
    }

    for (const group of itemModifierGroups) {
      const selectedOptions = selectionsByGroup.get(group.groupId) ?? [];
      const validOptionIds = new Set(group.options.map(o => o.id));

      // Check for invalid option IDs
      for (const optId of selectedOptions) {
        if (!validOptionIds.has(optId)) {
          return {
            valid: false,
            error: {
              code: 'INVALID_MODIFIER_OPTION',
              message: `Option ${optId} is not valid for group ${group.groupName}`,
              details: { groupId: group.groupId, optionId: optId },
            },
          };
        }
      }

      // Check required
      if (group.required && selectedOptions.length === 0) {
        return {
          valid: false,
          error: {
            code: 'INVALID_MODIFIER_SELECTION',
            message: `Modifier group "${group.groupName}" is required`,
            details: { groupId: group.groupId, required: true, selected: 0 },
          },
        };
      }

      // Check min
      if (selectedOptions.length < group.min && selectedOptions.length > 0) {
        return {
          valid: false,
          error: {
            code: 'INVALID_MODIFIER_SELECTION',
            message: `Modifier group "${group.groupName}" requires at least ${group.min} selection(s), got ${selectedOptions.length}`,
            details: { groupId: group.groupId, min: group.min, selected: selectedOptions.length },
          },
        };
      }

      // Check max (0 means unlimited)
      if (group.max > 0 && selectedOptions.length > group.max) {
        return {
          valid: false,
          error: {
            code: 'INVALID_MODIFIER_SELECTION',
            message: `Modifier group "${group.groupName}" allows at most ${group.max} selection(s), got ${selectedOptions.length}`,
            details: { groupId: group.groupId, max: group.max, selected: selectedOptions.length },
          },
        };
      }

      // SINGLE selection type means max 1
      if (group.selectionType === 'SINGLE' && selectedOptions.length > 1) {
        return {
          valid: false,
          error: {
            code: 'INVALID_MODIFIER_SELECTION',
            message: `Modifier group "${group.groupName}" is single-select but got ${selectedOptions.length} selections`,
            details: { groupId: group.groupId, selectionType: 'SINGLE', selected: selectedOptions.length },
          },
        };
      }
    }

    // Check for selections on non-existent groups
    for (const groupId of selectionsByGroup.keys()) {
      if (!itemModifierGroups.find(g => g.groupId === groupId)) {
        return {
          valid: false,
          error: {
            code: 'INVALID_MODIFIER_SELECTION',
            message: `Unknown modifier group: ${groupId}`,
            details: { groupId },
          },
        };
      }
    }

    return { valid: true };
  }

  /**
   * M13.2: Calculate pricing snapshot for an order item
   */
  calculatePricingSnapshot(
    itemPrice: number,
    quantity: number,
    selectedModifiers: { groupId: string; optionId: string }[],
    modifierGroups: {
      groupId: string;
      options: { id: string; name: string; priceDelta: number }[];
    }[],
  ): {
    basePriceCents: number;
    modifierTotalCents: number;
    unitPriceCents: number;
    lineTotalCents: number;
    modifiersSnapshot: { groupId: string; optionId: string; name: string; priceDelta: number }[];
  } {
    const basePriceCents = Math.round(itemPrice * 100);
    
    let modifierTotalCents = 0;
    const modifiersSnapshot: { groupId: string; optionId: string; name: string; priceDelta: number }[] = [];

    for (const sel of selectedModifiers) {
      const group = modifierGroups.find(g => g.groupId === sel.groupId);
      if (!group) continue;
      
      const option = group.options.find(o => o.id === sel.optionId);
      if (!option) continue;

      const deltaCents = Math.round(option.priceDelta * 100);
      modifierTotalCents += deltaCents;
      modifiersSnapshot.push({
        groupId: sel.groupId,
        optionId: sel.optionId,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }

    const unitPriceCents = basePriceCents + modifierTotalCents;
    const lineTotalCents = unitPriceCents * quantity;

    return {
      basePriceCents,
      modifierTotalCents,
      unitPriceCents,
      lineTotalCents,
      modifiersSnapshot,
    };
  }

  /**
   * M13.2: Get item with modifiers for order validation
   */
  async getItemWithModifiers(itemId: string, orgId: string, branchId: string): Promise<{
    id: string;
    name: string;
    price: number;
    isActive: boolean;
    isAvailable: boolean;
    branchId: string;
    modifierGroups: {
      groupId: string;
      groupName: string;
      selectionType: string;
      min: number;
      max: number;
      required: boolean;
      options: { id: string; name: string; priceDelta: number }[];
    }[];
  } | null> {
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id: itemId, orgId },
      include: {
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

    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      price: Number(item.price),
      isActive: item.isActive,
      isAvailable: item.isAvailable,
      branchId: item.branchId,
      modifierGroups: item.modifierGroups.map(mg => ({
        groupId: mg.group.id,
        groupName: mg.group.name,
        selectionType: mg.group.selectionType,
        min: mg.group.min,
        max: mg.group.max,
        required: mg.group.required,
        options: mg.group.options.map(opt => ({
          id: opt.id,
          name: opt.name,
          priceDelta: Number(opt.priceDelta),
        })),
      })),
    };
  }

  /**
   * M13.2: Export orders to CSV with SHA-256 hash
   */
  async exportOrdersCsv(
    orgId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{ content: string; hash: string }> {
    const where: any = {};
    
    // Get branches for this org
    const branches = await this.prisma.client.branch.findMany({
      where: { orgId },
      select: { id: true },
    });
    const branchIds = branches.map(b => b.id);
    
    if (branchId) {
      if (!branchIds.includes(branchId)) {
        throw new Error('Branch does not belong to organization');
      }
      where.branchId = branchId;
    } else {
      where.branchId = { in: branchIds };
    }

    if (startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };
    }

    const orders: any[] = await this.prisma.client.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        branch: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        orderItems: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
    });

    const BOM = '\uFEFF';
    const headers = [
      'Order ID',
      'Order Number',
      'Branch',
      'Created By',
      'Status',
      'Service Type',
      'Subtotal',
      'Tax',
      'Total',
      'Items Count',
      'Item Names',
      'Created At',
    ];

    const rows = orders.map(order => [
      order.id,
      order.orderNumber,
      this.escapeCSV(order.branch?.name ?? ''),
      this.escapeCSV(`${order.user?.firstName ?? ''} ${order.user?.lastName ?? ''}`.trim()),
      order.status,
      order.serviceType ?? '',
      Number(order.subtotal).toFixed(2),
      Number(order.tax).toFixed(2),
      Number(order.total).toFixed(2),
      order.orderItems.length.toString(),
      this.escapeCSV(order.orderItems.map(i => i.menuItem?.name ?? 'Unknown').join('; ')),
      order.createdAt.toISOString(),
    ]);

    const content = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const hash = this.computeHash(content);

    return { content, hash };
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private computeHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
