/**
 * Order Generator
 * 
 * Deterministic order and payment generation for demo seeding.
 * Creates realistic transaction patterns with proper foreign key references.
 */

import { PrismaClient, PaymentMethod } from '@prisma/client';
import { SeededRandom } from './seededRng';
import { randomDatetime } from './timeSeries';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
}

export interface GenerateOrderParams {
  branchId: string;
  userId: string;
  orderDate: Date;
  rng: SeededRandom;
  businessType: 'restaurant' | 'cafe';
  menuItems: MenuItem[];
  paymentMethodWeights?: { CASH: number; CARD: number; MOMO: number };
  avgItemsPerOrder?: number;
  topSellerIds?: string[]; // IDs of popular items (higher weight)
  shouldVoid?: boolean; // Force void (for anomalies)
  shouldRefund?: boolean; // Force refund
}

export interface GeneratedOrder {
  orderNumber: string;
  createdAt: Date;
  items: Array<{
    menuItemId: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    status: string;
  }>;
  refunds?: Array<{
    amount: number;
    reason: string;
    status: string;
  }>;
  metadata?: any;
}

/**
 * Generate deterministic order number based on branch, date, and sequence
 */
export function generateOrderNumber(
  branchId: string,
  date: Date,
  sequence: number,
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const branchPrefix = branchId.slice(-3).toUpperCase();
  return `${branchPrefix}-${dateStr}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Select menu items for order using weighted selection
 */
function selectOrderItems(
  rng: SeededRandom,
  menuItems: MenuItem[],
  avgItems: number,
  topSellerIds?: string[],
): Array<{ item: MenuItem; quantity: number }> {
  const itemCount = Math.max(1, Math.round(rng.nextFloat(1, avgItems * 1.5)));
  const selected: Array<{ item: MenuItem; quantity: number }> = [];
  
  // Create weights: top sellers get 3x weight, others get 1x
  const weights = menuItems.map(item => 
    topSellerIds && topSellerIds.includes(item.id) ? 3 : 1
  );
  
  for (let i = 0; i < itemCount; i++) {
    const item = rng.weightedPick(menuItems, weights);
    
    // Check if item already selected
    const existing = selected.find(s => s.item.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      const quantity = rng.chance(0.15) ? rng.nextInt(2, 3) : 1; // 15% chance of 2-3 items
      selected.push({ item, quantity });
    }
  }
  
  return selected;
}

/**
 * Calculate order totals with VAT
 */
function calculateTotals(items: Array<{ price: number; quantity: number }>, vatRate: number = 0.18) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * vatRate;
  const total = subtotal + tax;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Generate payment method based on weights
 */
function selectPaymentMethod(
  rng: SeededRandom,
  weights: { CASH: number; CARD: number; MOMO: number },
): PaymentMethod {
  const methods: PaymentMethod[] = ['CASH', 'CARD', 'MOMO'];
  const weightArray = [weights.CASH, weights.CARD, weights.MOMO];
  return rng.weightedPick(methods, weightArray);
}

/**
 * Generate a single order with items and payments
 */
export function generateOrder(params: GenerateOrderParams): GeneratedOrder {
  const {
    branchId,
    userId,
    orderDate,
    rng,
    businessType,
    menuItems,
    paymentMethodWeights = { CASH: 40, CARD: 25, MOMO: 35 },
    avgItemsPerOrder = 3,
    topSellerIds,
    shouldVoid = false,
    shouldRefund = false,
  } = params;
  
  // Generate order time within business hours
  const createdAt = randomDatetime(orderDate, rng, businessType);
  
  // Select items
  const selectedItems = selectOrderItems(rng, menuItems, avgItemsPerOrder, topSellerIds);
  
  // Build order items
  const items = selectedItems.map(({ item, quantity }) => ({
    menuItemId: item.id,
    quantity,
    price: item.price,
    subtotal: item.price * quantity,
  }));
  
  // Calculate totals
  const { subtotal, tax, total } = calculateTotals(items, 0.18);
  
  // Determine status
  let status = 'CLOSED';
  let metadata: any = undefined;
  
  if (shouldVoid) {
    status = 'VOIDED';
    metadata = { voidReason: 'Customer cancelled' };
  }
  
  // Generate payment
  const paymentMethod = selectPaymentMethod(rng, paymentMethodWeights);
  const payments = [{
    method: paymentMethod,
    amount: total,
    status: 'completed',
  }];
  
  // Generate refund if requested (1-2% of orders)
  const refunds: Array<{ amount: number; reason: string; status: string }> = [];
  if (shouldRefund && status !== 'VOIDED') {
    const refundAmount = rng.chance(0.5) ? total : total * rng.nextFloat(0.3, 0.7);
    refunds.push({
      amount: Math.round(refundAmount * 100) / 100,
      reason: rng.pick(['Customer complaint', 'Item unavailable', 'Wrong order']),
      status: 'COMPLETED',
    });
  }
  
  return {
    orderNumber: '', // Set by caller with sequence
    createdAt,
    items,
    subtotal,
    tax,
    total,
    status,
    payments,
    refunds: refunds.length > 0 ? refunds : undefined,
    metadata,
  };
}

/**
 * Batch generate orders for a single day
 */
export function generateDailyOrders(
  branchId: string,
  userId: string,
  orderDate: Date,
  orderCount: number,
  rng: SeededRandom,
  businessType: 'restaurant' | 'cafe',
  menuItems: MenuItem[],
  paymentMethodWeights?: { CASH: number; CARD: number; MOMO: number },
  topSellerIds?: string[],
): GeneratedOrder[] {
  const orders: GeneratedOrder[] = [];
  
  for (let i = 0; i < orderCount; i++) {
    // Deterministic void/refund selection (1-2%)
    const shouldVoid = rng.chance(0.01);
    const shouldRefund = !shouldVoid && rng.chance(0.015);
    
    const order = generateOrder({
      branchId,
      userId,
      orderDate,
      rng,
      businessType,
      menuItems,
      paymentMethodWeights,
      avgItemsPerOrder: businessType === 'restaurant' ? 3.5 : 2.5,
      topSellerIds,
      shouldVoid,
      shouldRefund,
    });
    
    // Set order number with sequence
    order.orderNumber = generateOrderNumber(branchId, orderDate, i + 1);
    
    orders.push(order);
  }
  
  // Sort by created time
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  return orders;
}

/**
 * Insert generated orders into database
 */
export async function insertOrders(
  prisma: PrismaClient,
  orders: GeneratedOrder[],
  branchId: string,
  userId: string,
): Promise<{ orderCount: number; itemCount: number; paymentCount: number; refundCount: number }> {
  let orderCount = 0;
  let itemCount = 0;
  let paymentCount = 0;
  let refundCount = 0;
  
  for (const orderData of orders) {
    // Create order
    const order = await prisma.order.create({
      data: {
        branchId,
        userId,
        orderNumber: orderData.orderNumber,
        status: orderData.status as any,
        serviceType: 'DINE_IN',
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        discount: 0,
        total: orderData.total,
        createdAt: orderData.createdAt,
        updatedAt: orderData.createdAt,
        metadata: orderData.metadata,
        anomalyFlags: [],
      },
    });
    orderCount++;
    
    // Create order items
    for (const itemData of orderData.items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: itemData.menuItemId,
          quantity: itemData.quantity,
          price: itemData.price,
          subtotal: itemData.subtotal,
          createdAt: orderData.createdAt,
          updatedAt: orderData.createdAt,
        },
      });
      itemCount++;
    }
    
    // Create payments
    for (const paymentData of orderData.payments) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: paymentData.method,
          amount: paymentData.amount,
          status: paymentData.status,
          createdAt: orderData.createdAt,
          updatedAt: orderData.createdAt,
        },
      });
      paymentCount++;
    }
    
    // Create refunds if any
    if (orderData.refunds && orderData.refunds.length > 0) {
      // Get first payment to link refund
      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id },
      });
      
      if (payment) {
        for (const refundData of orderData.refunds) {
          await prisma.refund.create({
            data: {
              orderId: order.id,
              paymentId: payment.id,
              provider: payment.method,
              amount: refundData.amount,
              reason: refundData.reason,
              status: refundData.status,
              createdById: userId,
              createdAt: orderData.createdAt,
              updatedAt: orderData.createdAt,
            },
          });
          refundCount++;
        }
      }
    }
  }
  
  return { orderCount, itemCount, paymentCount, refundCount };
}
