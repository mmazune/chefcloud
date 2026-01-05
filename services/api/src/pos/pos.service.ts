/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateOrderDto,
  ModifyOrderDto,
  VoidOrderDto,
  CloseOrderDto,
  ApplyDiscountDto,
} from './pos.dto';
import { AuthHelpers } from '../auth/auth.helpers';
import { EfrisService } from '../efris/efris.service';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';
import { CostingService } from '../inventory/costing.service';
import { PostingService } from '../accounting/posting.service';
import { PromotionsService } from '../promotions/promotions.service';
import { KpisService } from '../kpis/kpis.service';
import { StockMovementsService, StockMovementType } from '../inventory/stock-movements.service';
import { InventoryDepletionService } from '../inventory/inventory-depletion.service';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private prisma: PrismaService,
    private efrisService: EfrisService,
    private configService: ConfigService,
    private eventBus: EventBusService,
    private costingService: CostingService,
    private postingService: PostingService,
    private stockMovementsService: StockMovementsService,
    @Optional() private promotionsService?: PromotionsService,
    @Optional() private kpisService?: KpisService,
    @Optional() private depletionService?: InventoryDepletionService,
  ) {}

  private markKpisDirty(orgId: string, branchId?: string) {
    try {
      this.kpisService?.markDirty(orgId, branchId);
    } catch {
      // Best-effort, no throw
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createOrder(
    dto: CreateOrderDto,
    userId: string,
    branchId: string,
    clientOrderId?: string,
  ): Promise<any> {
    // Check if client-provided orderId already exists
    if (clientOrderId) {
      const existing = await this.prisma.client.order.findUnique({
        where: { id: clientOrderId },
      });

      if (existing) {
        return existing;
      }
    }

    // Fetch menu items with tax info
    const menuItemIds = dto.items.map((item) => item.menuItemId);
    const menuItems = await this.prisma.client.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { taxCategory: true },
    });

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

    // Calculate subtotal and tax
    let subtotal = 0;
    let tax = 0;

    const orderItemsData = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new BadRequestException(`Menu item ${item.menuItemId} not found`);

      const itemPrice = Number(menuItem.price);
      const itemSubtotal = itemPrice * item.qty;
      subtotal += itemSubtotal;

      const itemTax = menuItem.taxCategory
        ? (itemSubtotal * Number(menuItem.taxCategory.rate)) / 100
        : 0;
      tax += itemTax;

      return {
        menuItemId: item.menuItemId,
        quantity: item.qty,
        price: menuItem.price,
        subtotal: itemSubtotal,
        metadata: item.modifiers ? { modifiers: item.modifiers } : undefined,
      } as any;
    });

    const total = subtotal + tax;

    // Generate order number
    const orderCount = await this.prisma.client.order.count({ where: { branchId } });
    const orderNumber = `ORD-${Date.now()}-${orderCount + 1}`;

    // E42-s2: Check for active event booking with check-in and prepaid credit
    let prepaidCreditId: string | undefined;
    if (dto.tableId) {
      const activeBooking = await this.prisma.client.eventBooking.findFirst({
        where: {
          eventTable: { tableId: dto.tableId },
          status: 'CONFIRMED',
          checkedInAt: { not: null },
          event: {
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() },
          },
        },
        include: {
          credits: {
            where: {
              consumed: { lt: this.prisma.client.prepaidCredit.fields.amount },
            },
          },
        },
      });

      if (activeBooking?.credits?.[0]) {
        prepaidCreditId = activeBooking.credits[0].id;
      }
    }

    // Create order with items
    const order: any = await this.prisma.client.order.create({
      data: {
        id: clientOrderId, // Use client-provided ID if available
        branchId,
        userId,
        orderNumber,
        tableId: dto.tableId,
        serviceType: dto.serviceType || 'DINE_IN',
        subtotal,
        tax,
        total,
        metadata: prepaidCreditId ? { prepaidCreditId } : undefined, // E42-s2: Attach credit
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Create KDS tickets per station
    const stationMap = new Map<string, string[]>();
    for (const orderItem of order.orderItems) {
      const station = orderItem.menuItem.station;
      if (!stationMap.has(station)) {
        stationMap.set(station, []);
      }
      stationMap.get(station)!.push(orderItem.id);
    }

    for (const [station] of stationMap) {
      const ticket = await this.prisma.client.kdsTicket.create({
        data: {
          orderId: order.id,
          station: station as any,
          status: 'QUEUED',
        },
      });

      // Publish KDS event
      this.eventBus.publish('kds', {
        ticketId: ticket.id,
        orderId: order.id,
        station,
        status: 'QUEUED',
        at: new Date().toISOString(),
      });
    }

    // Mark KPIs dirty
    const orgId = (await this.prisma.client.branch.findUnique({ where: { id: branchId } }))?.orgId;
    if (orgId) this.markKpisDirty(orgId, branchId);

    return order;
  }

  async sendToKitchen(orderId: string, branchId: string): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
      include: { orderItems: { include: { menuItem: true } } },
    });

    if (!order) throw new BadRequestException('Order not found');

    // Check for DRINK items
    const hasDrinks = order.orderItems.some((item) => item.menuItem.itemType === 'DRINK');
    const anomalyFlags = hasDrinks ? [] : ['NO_DRINKS'];

    return this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        status: 'SENT',
        anomalyFlags,
      },
    });
  }

  async modifyOrder(
    orderId: string,
    dto: ModifyOrderDto,
    userId: string,
    branchId: string,
  ): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
      include: { orderItems: true },
    });

    if (!order) throw new BadRequestException('Order not found');

    // M26-S3/S4: State validation - only allow modifications in editable states
    const editableStates = ['NEW', 'SENT', 'IN_PROGRESS'];
    if (!editableStates.includes(order.status)) {
      throw new BadRequestException(
        `Cannot modify order in status ${order.status}. Only NEW, SENT, or IN_PROGRESS orders can be modified.`,
      );
    }

    let subtotalAdjustment = 0;
    let taxAdjustment = 0;

    // M26-S3/S4: Handle updateItems (quantity changes, notes updates, removals)
    if (dto.updateItems && dto.updateItems.length > 0) {
      for (const updateItem of dto.updateItems) {
        const existingItem = order.orderItems.find((oi) => oi.id === updateItem.orderItemId);
        if (!existingItem) {
          throw new BadRequestException(`Order item ${updateItem.orderItemId} not found`);
        }

        // Fetch menu item for tax calculation
        const menuItem = await this.prisma.client.menuItem.findUnique({
          where: { id: existingItem.menuItemId },
          include: { taxCategory: true },
        });

        if (!menuItem) {
          throw new BadRequestException(`Menu item ${existingItem.menuItemId} not found`);
        }

        const oldSubtotal = Number(existingItem.subtotal);
        const unitPrice = Number(existingItem.price);
        const taxRate = menuItem.taxCategory ? Number(menuItem.taxCategory.rate) / 100 : 0;
        const oldTax = oldSubtotal * taxRate;

        let shouldDelete = false;
        const updateData: any = {};

        // Handle quantity updates
        if (typeof updateItem.quantity === 'number') {
          if (updateItem.quantity <= 0) {
            shouldDelete = true;
          } else {
            const newSubtotal = unitPrice * updateItem.quantity;
            const newTax = newSubtotal * taxRate;

            updateData.quantity = updateItem.quantity;
            updateData.subtotal = newSubtotal;

            subtotalAdjustment += newSubtotal - oldSubtotal;
            taxAdjustment += newTax - oldTax;
          }
        }

        // M26-S4: Handle notes updates
        if (typeof updateItem.notes === 'string') {
          updateData.notes = updateItem.notes.trim() || null;
        }

        if (shouldDelete) {
          // Remove item completely
          await this.prisma.client.orderItem.delete({
            where: { id: existingItem.id },
          });
          subtotalAdjustment -= oldSubtotal;
          taxAdjustment -= oldTax;
        } else if (Object.keys(updateData).length > 0) {
          // Update item
          await this.prisma.client.orderItem.update({
            where: { id: existingItem.id },
            data: updateData,
          });
        }
      }
    }

    // M26-S2: Handle adding new items
    let additionalSubtotal = 0;
    let additionalTax = 0;
    const newOrderItems: any[] = [];

    if (dto.items && dto.items.length > 0) {
      const menuItemIds = dto.items.map((item) => item.menuItemId);
      const menuItems = await this.prisma.client.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        include: { taxCategory: true },
      });

      const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

      for (const item of dto.items) {
        const menuItem = menuItemMap.get(item.menuItemId);
        if (!menuItem) throw new BadRequestException(`Menu item ${item.menuItemId} not found`);

        const itemPrice = Number(menuItem.price);
        const itemSubtotal = itemPrice * item.qty;
        additionalSubtotal += itemSubtotal;

        const itemTax = menuItem.taxCategory
          ? (itemSubtotal * Number(menuItem.taxCategory.rate)) / 100
          : 0;
        additionalTax += itemTax;

        newOrderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.qty,
          price: menuItem.price,
          subtotal: itemSubtotal,
          notes: item.notes?.trim() || null,
          metadata: item.modifiers ? { modifiers: item.modifiers } : undefined,
        });
      }
    }

    // Update order totals atomically
    const updatedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        subtotal: Number(order.subtotal) + subtotalAdjustment + additionalSubtotal,
        tax: Number(order.tax) + taxAdjustment + additionalTax,
        total: Number(order.total) + subtotalAdjustment + taxAdjustment + additionalSubtotal + additionalTax,
        orderItems: newOrderItems.length > 0 ? {
          create: newOrderItems,
        } : undefined,
      },
      include: {
        orderItems: true,
      },
    });

    // Audit log
    await this.prisma.client.auditEvent.create({
      data: {
        branchId,
        userId,
        action: 'order.modified',
        resource: 'orders',
        resourceId: orderId,
        metadata: {
          addedItems: dto.items?.length || 0,
          updatedItems: dto.updateItems?.length || 0,
        },
      },
    });

    return updatedOrder;
  }

  async voidOrder(
    orderId: string,
    dto: VoidOrderDto,
    userId: string,
    branchId: string,
  ): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
    });

    if (!order) throw new BadRequestException('Order not found');

    // Check if manager PIN required (threshold = 50000)
    const VOID_THRESHOLD = 50000;
    if (Number(order.total) > VOID_THRESHOLD) {
      if (!dto.managerPin) {
        throw new UnauthorizedException('Manager PIN required for high-value void');
      }

      // Find a manager with PIN
      const managers = await this.prisma.client.user.findMany({
        where: {
          branchId,
          roleLevel: { in: ['L4', 'L5'] },
          pinHash: { not: null },
        },
      });

      let pinValid = false;
      for (const manager of managers) {
        if (manager.pinHash) {
          const isValid = await AuthHelpers.verifyPin(manager.pinHash, dto.managerPin);
          if (isValid) {
            pinValid = true;
            break;
          }
        }
      }

      if (!pinValid) {
        throw new UnauthorizedException('Invalid manager PIN');
      }
    }

    const voidedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: { status: 'VOIDED' },
    });

    // Audit log
    await this.prisma.client.auditEvent.create({
      data: {
        branchId,
        userId,
        action: 'order.voided',
        resource: 'orders',
        resourceId: orderId,
        metadata: { total: Number(order.total), managerPinUsed: !!dto.managerPin },
      },
    });

    // Mark KPIs dirty
    const orgId = (await this.prisma.client.branch.findUnique({ where: { id: branchId } }))?.orgId;
    if (orgId) this.markKpisDirty(orgId, branchId);

    return voidedOrder;
  }

  async closeOrder(
    orderId: string,
    dto: CloseOrderDto,
    userId: string,
    branchId: string,
  ): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                recipeIngredients: {
                  include: {
                    item: true,
                    modifierOption: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) throw new BadRequestException('Order not found');

    // FIFO consumption: for each order item, consume ingredients
    const anomalyFlags: string[] = [];
    const stockMovements: any[] = []; // M3: Collect movements for batch creation

    // Get current shift if available (for movement tracking)
    const currentShift = await this.prisma.client.shift.findFirst({
      where: {
        branchId,
        closedAt: null,
      },
      select: { id: true, orgId: true },
    });

    for (const orderItem of order.orderItems) {
      const menuItem = orderItem.menuItem;
      const quantity = orderItem.quantity;

      // Get modifiers from metadata
      const modifierIds = orderItem.metadata
        ? ((orderItem.metadata as any).modifiers || []).map((m: any) => m.modifierOptionId)
        : [];

      for (const recipeIngredient of menuItem.recipeIngredients) {
        // If recipe ingredient is for a modifier, only consume if that modifier was selected
        if (
          recipeIngredient.modifierOptionId &&
          !modifierIds.includes(recipeIngredient.modifierOptionId)
        ) {
          continue;
        }

        const qtyNeeded = Number(recipeIngredient.qtyPerUnit) * quantity;

        // Consume from stock batches (FIFO)
        const batches = await this.prisma.client.stockBatch.findMany({
          where: {
            branchId,
            itemId: recipeIngredient.itemId,
            remainingQty: { gt: 0 },
          },
          orderBy: { receivedAt: 'asc' },
        });

        let remaining = qtyNeeded;
        let totalCost = 0;

        for (const batch of batches) {
          if (remaining <= 0) break;

          const consumeQty = Math.min(remaining, Number(batch.remainingQty));
          const costForThisBatch = consumeQty * Number(batch.unitCost);

          await this.prisma.client.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: { decrement: consumeQty } },
          });

          // M3: Track stock movement for this consumption
          stockMovements.push({
            orgId: currentShift?.orgId || '',
            branchId,
            itemId: recipeIngredient.itemId,
            type: StockMovementType.SALE,
            qty: consumeQty,
            cost: costForThisBatch,
            orderId,
            shiftId: currentShift?.id,
            batchId: batch.id,
            metadata: {
              menuItemId: menuItem.id,
              menuItemName: menuItem.name,
              orderItemId: orderItem.id,
              orderNumber: order.orderNumber,
            },
          });

          totalCost += costForThisBatch;
          remaining -= consumeQty;
        }

        // If couldn't fulfill, flag anomaly
        if (remaining > 0) {
          anomalyFlags.push(`NEGATIVE_STOCK:${recipeIngredient.item.sku}`);
        }
      }
    }

    // Calculate costing for each order item
    for (const orderItem of order.orderItems) {
      const modifiers = orderItem.metadata
        ? ((orderItem.metadata as any).modifiers || []).map((m: any) => ({
            id: m.modifierOptionId,
            selected: true,
          }))
        : [];

      const modifiersPrice = orderItem.metadata
        ? ((orderItem.metadata as any).modifiers || []).reduce(
            (sum: number, m: any) => sum + (m.price || 0),
            0,
          )
        : 0;

      const costing = await this.costingService.calculateItemCosting({
        menuItemId: orderItem.menuItemId,
        quantity: orderItem.quantity,
        unitPrice: Number(orderItem.price),
        modifiersPrice,
        discount: 0, // Individual item discount not tracked here
        modifiers,
      });

      // Update order item with costing fields
      await this.prisma.client.orderItem.update({
        where: { id: orderItem.id },
        data: {
          costUnit: costing.costUnit,
          costTotal: costing.costTotal,
          marginTotal: costing.marginTotal,
          marginPct: costing.marginPct,
        },
      });
    }

    // E37: Apply promotions if available
    let totalDiscountFromPromotions = 0;
    const promotionMetadata: any[] = [];

    if (this.promotionsService) {
      try {
        // Get orgId from branch (need to fetch it)
        const branch = await this.prisma.client.branch.findUnique({
          where: { id: branchId },
          select: { orgId: true },
        });

        if (!branch) throw new Error('Branch not found');

        // Get coupon code from order metadata
        const couponCode = (order.metadata as any)?.couponCode;

        // Fetch active approved promotions for this org
        const promotions = await this.prisma.client.promotion.findMany({
          where: {
            orgId: branch.orgId,
            active: true,
            approvedById: { not: null }, // Must be approved
          },
          include: { effects: true },
          orderBy: { priority: 'desc' },
        });

        const applicablePromotions: any[] = [];

        // Evaluate each promotion
        for (const promotion of promotions) {
          const context = {
            branchId,
            items: order.orderItems.map((oi: any) => ({
              menuItemId: oi.menuItemId,
              category: oi.menuItem.categoryId,
            })),
            timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
            couponCode,
          };

          const applies = await this.promotionsService.evaluatePromotion(promotion, context);
          if (applies) {
            applicablePromotions.push(promotion);
            if (promotion.exclusive) {
              // If exclusive, stop after first match (already sorted by priority)
              break;
            }
          }
        }

        // Apply promotions to order items (cap at 1 promotion per line for phase 1)
        for (const promotion of applicablePromotions) {
          for (const effect of promotion.effects) {
            if (effect.type === 'PERCENT_OFF' || effect.type === 'HAPPY_HOUR') {
              const discountPct = Number(effect.value) / 100;

              for (const orderItem of order.orderItems) {
                // Check if item matches scope
                const scope = promotion.scope as any;
                const itemMatches =
                  !scope ||
                  !scope.items ||
                  scope.items.length === 0 ||
                  scope.items.includes(orderItem.menuItemId);

                const categoryMatches =
                  !scope ||
                  !scope.categories ||
                  scope.categories.length === 0 ||
                  scope.categories.includes(orderItem.menuItem.categoryId);

                if (itemMatches && categoryMatches) {
                  const itemTotal = Number(orderItem.price) * orderItem.quantity;
                  const discountAmount = itemTotal * discountPct;

                  totalDiscountFromPromotions += discountAmount;

                  promotionMetadata.push({
                    orderItemId: orderItem.id,
                    promotionId: promotion.id,
                    promotionName: promotion.name,
                    effect: effect.type,
                    valueApplied: discountAmount,
                  });
                }
              }
            } else if (effect.type === 'FIXED_OFF') {
              // Fixed discount applied to total (phase 1: simple split)
              const discountAmount = Number(effect.value);
              totalDiscountFromPromotions += discountAmount;

              promotionMetadata.push({
                promotionId: promotion.id,
                promotionName: promotion.name,
                effect: effect.type,
                valueApplied: discountAmount,
              });
            }
          }
        }
      } catch (err) {
        console.error('Promotion evaluation error:', err);
        // Best-effort: continue without promotions
      }
    }

    // Update order with promotion metadata
    if (promotionMetadata.length > 0) {
      await this.prisma.client.order.update({
        where: { id: orderId },
        data: {
          metadata: {
            ...(order.metadata as object),
            promotionsApplied: promotionMetadata,
          },
          discount: totalDiscountFromPromotions,
        },
      });
    }

    // Create payment stub
    await this.prisma.client.payment.create({
      data: {
        orderId,
        amount: dto.amount,
        method: 'CASH',
        status: 'completed',
      },
    });

    const closedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        status: 'CLOSED',
        anomalyFlags: anomalyFlags.length > 0 ? anomalyFlags : undefined,
      },
    });

    // Audit log for ingredient consumption
    if (anomalyFlags.length > 0) {
      await this.prisma.client.auditEvent.create({
        data: {
          branchId,
          userId,
          action: 'order.closed.stock_anomaly',
          resource: 'orders',
          resourceId: orderId,
          metadata: { anomalyFlags },
        },
      });
    }

    // Regular audit log
    await this.prisma.client.auditEvent.create({
      data: {
        branchId,
        userId,
        action: 'order.closed',
        resource: 'orders',
        resourceId: orderId,
        metadata: { paymentAmount: dto.amount },
      },
    });

    // M3: Create stock movements for ingredient consumption
    if (stockMovements.length > 0) {
      try {
        await this.stockMovementsService.createMovements(stockMovements);
      } catch (err) {
        console.error('Failed to create stock movements:', err);
        // Best-effort: continue even if movement creation fails
      }
    }

    // Fire-and-forget EFRIS push
    this.efrisService.push(orderId).catch(() => {
      // Silently ignore errors (will be retried by worker)
    });

    // E40-s1: Post to GL (fire-and-forget, idempotent)
    this.postingService.postSale(orderId, userId).catch((err) => {
      this.prisma.client.auditEvent.create({
        data: {
          branchId,
          userId,
          action: 'order.gl_posting.failed',
          resource: 'orders',
          resourceId: orderId,
          metadata: { error: err.message },
        },
      });
    });

    this.postingService.postCOGS(orderId, userId).catch((err) => {
      this.prisma.client.auditEvent.create({
        data: {
          branchId,
          userId,
          action: 'order.gl_cogs.failed',
          resource: 'orders',
          resourceId: orderId,
          metadata: { error: err.message },
        },
      });
    });

    // M11.4: Inventory ledger depletion (fire-and-forget, idempotent)
    if (this.depletionService && orgId) {
      this.depletionService.depleteForOrder(orgId, orderId, branchId, userId).catch((err) => {
        this.logger.error(`Ledger depletion failed for order ${orderId}: ${err.message}`);
        // Depletion service already creates audit log on failure
      });
    }

    // Mark KPIs dirty
    const orgId = (await this.prisma.client.branch.findUnique({ where: { id: branchId } }))?.orgId;
    if (orgId) this.markKpisDirty(orgId, branchId);

    return closedOrder;
  }

  async applyDiscount(
    orderId: string,
    dto: ApplyDiscountDto,
    userId: string,
    branchId: string,
    orgId: string,
  ): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
    });

    if (!order) throw new BadRequestException('Order not found');

    // Calculate discount amount
    let discountAmount = 0;
    if (dto.type === 'percentage') {
      discountAmount = (Number(order.subtotal) * dto.value) / 100;
    } else {
      discountAmount = dto.value;
    }

    // Get approval threshold from org settings
    const orgSettings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
    });

    const threshold = orgSettings?.discountApprovalThreshold || 5000;
    let approvedById: string | undefined;

    // Check if approval required
    if (discountAmount > Number(threshold)) {
      if (!dto.managerPin) {
        throw new UnauthorizedException('Manager PIN required for large discount');
      }

      // Find manager with PIN
      const managers = await this.prisma.client.user.findMany({
        where: {
          branchId,
          roleLevel: { in: ['L4', 'L5'] },
          pinHash: { not: null },
        },
      });

      let validManager: any = null;
      for (const manager of managers) {
        if (manager.pinHash) {
          const isValid = await AuthHelpers.verifyPin(manager.pinHash, dto.managerPin);
          if (isValid) {
            validManager = manager;
            break;
          }
        }
      }

      if (!validManager) {
        throw new UnauthorizedException('Invalid manager PIN');
      }

      approvedById = validManager.id;
    }

    // Create discount record
    await this.prisma.client.discount.create({
      data: {
        orgId,
        orderId,
        createdById: userId,
        type: dto.type,
        value: dto.value,
        approvedById,
      },
    });

    // Update order totals
    const newTotal = Number(order.total) - discountAmount;

    const updatedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        discount: discountAmount,
        total: newTotal,
      },
      include: {
        discounts: true,
      },
    });

    return updatedOrder;
  }

  async postCloseVoid(
    orderId: string,
    reason: string,
    managerPin: string | undefined,
    userId: string,
    orgId: string,
  ): Promise<any> {
    const windowMin = parseInt(this.configService.get<string>('POST_CLOSE_WINDOW_MIN') || '15', 10);

    // Fetch order
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        branch: { select: { orgId: true } },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.branch.orgId !== orgId) {
      throw new ForbiddenException('Order does not belong to your organization');
    }

    if (order.status !== 'CLOSED') {
      throw new BadRequestException('Order must be CLOSED to perform post-close void');
    }

    // Check time window
    const now = new Date();
    const closeTime = order.updatedAt; // Assuming updatedAt reflects close time
    const elapsedMin = (now.getTime() - closeTime.getTime()) / (1000 * 60);

    if (elapsedMin > windowMin) {
      throw new BadRequestException(
        `Post-close void window expired. Only ${windowMin} minutes allowed since close.`,
      );
    }

    // Verify manager PIN (L4+)
    if (!managerPin) {
      throw new BadRequestException('Manager PIN required for post-close void');
    }

    const manager = await this.prisma.client.user.findFirst({
      where: {
        orgId,
        roleLevel: { in: ['L4', 'L5'] },
        pinHash: { not: null },
      },
    });

    if (!manager || !manager.pinHash) {
      throw new UnauthorizedException('No L4+ manager found');
    }

    const pinValid = await AuthHelpers.verifyPin(managerPin, manager.pinHash);
    if (!pinValid) {
      throw new UnauthorizedException('Invalid manager PIN');
    }

    // Create audit event
    await this.prisma.client.auditEvent.create({
      data: {
        branchId: order.branchId,
        userId,
        action: 'POST_CLOSE_VOID',
        resource: 'orders',
        resourceId: orderId,
        metadata: {
          reason,
          voidedBy: manager.id,
          originalTotal: order.total,
        },
      },
    });

    // Mark order as voided in metadata
    const updatedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        metadata: {
          ...(typeof order.metadata === 'object' && order.metadata !== null ? order.metadata : {}),
          voidedPostClose: true,
          voidReason: reason,
          voidedAt: new Date().toISOString(),
          voidedBy: manager.id,
        },
      },
    });

    return updatedOrder;
  }

  /**
   * M26-S1: Get orders for POS interface
   * If status param provided, filter by that status
   * Otherwise return orders from today (open, closed, voided)
   */
  async getOrders(branchId: string, status?: string): Promise<any[]> {
    const where: any = { branchId };

    if (status === 'OPEN') {
      where.status = { notIn: ['CLOSED', 'VOIDED'] };
    } else if (status) {
      where.status = status;
    } else {
      // Default: today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.createdAt = { gte: today };
    }

    const orders = await this.prisma.client.order.findMany({
      where,
      include: {
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
      id: order.id,
      tableName: order.table?.label || null,
      tabName: order.serviceType === 'TAKEAWAY' ? 'Takeaway' : null,
      status: order.status,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
    }));
  }

  /**
   * M26-S1: Get single order with full details
   */
  async getOrder(orderId: string, branchId: string): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
      include: {
        table: true,
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const items = order.orderItems.map((item) => ({
      id: item.id,
      name: item.menuItem?.name || 'Unknown',
      quantity: item.quantity,
      unitPrice: Number(item.price),
      total: Number(item.subtotal),
    }));

    const payments = order.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
    }));

    return {
      id: order.id,
      tableName: order.table?.label || null,
      tabName: order.serviceType === 'TAKEAWAY' ? 'Takeaway' : null,
      status: order.status,
      items,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      payments,
    };
  }
}
