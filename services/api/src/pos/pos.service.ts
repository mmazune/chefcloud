/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto, ModifyOrderDto, VoidOrderDto, CloseOrderDto, ApplyDiscountDto } from './pos.dto';
import { AuthHelpers } from '../auth/auth.helpers';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createOrder(dto: CreateOrderDto, userId: string, branchId: string): Promise<any> {
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

    // Create order with items
    const order: any = await this.prisma.client.order.create({
      data: {
        branchId,
        userId,
        orderNumber,
        tableId: dto.tableId,
        serviceType: dto.serviceType || 'DINE_IN',
        subtotal,
        tax,
        total,
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
      await this.prisma.client.kdsTicket.create({
        data: {
          orderId: order.id,
          station: station as any,
          status: 'QUEUED',
        },
      });
    }

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

  async modifyOrder(orderId: string, dto: ModifyOrderDto, userId: string, branchId: string): Promise<any> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, branchId },
    });

    if (!order) throw new BadRequestException('Order not found');

    // For simplicity, just add new items
    const menuItemIds = dto.items.map((item) => item.menuItemId);
    const menuItems = await this.prisma.client.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: { taxCategory: true },
    });

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

    let additionalSubtotal = 0;
    let additionalTax = 0;

    const newOrderItems = dto.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new BadRequestException(`Menu item ${item.menuItemId} not found`);

      const itemPrice = Number(menuItem.price);
      const itemSubtotal = itemPrice * item.qty;
      additionalSubtotal += itemSubtotal;

      const itemTax = menuItem.taxCategory
        ? (itemSubtotal * Number(menuItem.taxCategory.rate)) / 100
        : 0;
      additionalTax += itemTax;

      return {
        menuItemId: item.menuItemId,
        quantity: item.qty,
        price: menuItem.price,
        subtotal: itemSubtotal,
        metadata: item.modifiers ? { modifiers: item.modifiers } : undefined,
      } as any;
    });

    const updatedOrder = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        subtotal: { increment: additionalSubtotal },
        tax: { increment: additionalTax },
        total: { increment: additionalSubtotal + additionalTax },
        orderItems: {
          create: newOrderItems,
        },
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
        metadata: { addedItems: dto.items.length },
      },
    });

    return updatedOrder;
  }

  async voidOrder(orderId: string, dto: VoidOrderDto, userId: string, branchId: string): Promise<any> {
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

    return voidedOrder;
  }

  async closeOrder(orderId: string, dto: CloseOrderDto, userId: string, branchId: string): Promise<any> {
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

    for (const orderItem of order.orderItems) {
      const menuItem = orderItem.menuItem;
      const quantity = orderItem.quantity;

      // Get modifiers from metadata
      const modifierIds = orderItem.metadata
        ? ((orderItem.metadata as any).modifiers || []).map((m: any) => m.modifierOptionId)
        : [];

      for (const recipeIngredient of menuItem.recipeIngredients) {
        // If recipe ingredient is for a modifier, only consume if that modifier was selected
        if (recipeIngredient.modifierOptionId && !modifierIds.includes(recipeIngredient.modifierOptionId)) {
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
        for (const batch of batches) {
          if (remaining <= 0) break;

          const consumeQty = Math.min(remaining, Number(batch.remainingQty));
          await this.prisma.client.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: { decrement: consumeQty } },
          });

          remaining -= consumeQty;
        }

        // If couldn't fulfill, flag anomaly
        if (remaining > 0) {
          anomalyFlags.push(`NEGATIVE_STOCK:${recipeIngredient.item.sku}`);
        }
      }
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
}
