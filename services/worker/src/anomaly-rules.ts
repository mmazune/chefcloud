/**
 * Anomaly detection rules for anti-theft analytics
 */

export interface AnomalyRule {
  type: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  detect: (context: any) => boolean;
  buildDetails: (context: any) => any;
}

export const LATE_VOID_THRESHOLD_MIN = parseInt(process.env.LATE_VOID_MIN || '5', 10);

export const NO_DRINKS_RULE: AnomalyRule = {
  type: 'NO_DRINKS',
  severity: 'INFO',
  detect: (order: any) => {
    if (!order.orderItems || order.orderItems.length === 0) return false;
    // Check if order has any DRINK category items
    // Category names like "Drinks", "Beverages", "Drink", etc.
    const hasDrinks = order.orderItems.some(
      (item: any) =>
        item.menuItem?.category?.name?.toLowerCase().includes('drink') ||
        item.menuItem?.category?.name?.toLowerCase().includes('beverage'),
    );
    return !hasDrinks;
  },
  buildDetails: (order: any) => ({
    orderNumber: order.orderNumber,
    itemCount: order.orderItems?.length || 0,
    total: Number(order.total),
  }),
};

export const LATE_VOID_RULE: AnomalyRule = {
  type: 'LATE_VOID',
  severity: 'WARN',
  detect: (order: any) => {
    if (order.status !== 'VOIDED') return false;
    const createdAt = new Date(order.createdAt).getTime();
    const updatedAt = new Date(order.updatedAt).getTime();
    const minutesSinceCreated = (updatedAt - createdAt) / (1000 * 60);
    return minutesSinceCreated >= LATE_VOID_THRESHOLD_MIN;
  },
  buildDetails: (order: any) => {
    const createdAt = new Date(order.createdAt).getTime();
    const updatedAt = new Date(order.updatedAt).getTime();
    const minutesSinceCreated = Math.round((updatedAt - createdAt) / (1000 * 60));
    return {
      orderNumber: order.orderNumber,
      total: Number(order.total),
      minutesSinceCreated,
      voidedAt: order.updatedAt,
    };
  },
};

export const HEAVY_DISCOUNT_RULE: AnomalyRule = {
  type: 'HEAVY_DISCOUNT',
  severity: 'WARN',
  detect: (context: { discount: any; threshold: number }) => {
    return Number(context.discount.value) >= context.threshold;
  },
  buildDetails: (context: { discount: any; order: any }) => ({
    orderNumber: context.order.orderNumber,
    discountType: context.discount.type,
    discountValue: Number(context.discount.value),
    orderTotal: Number(context.order.total),
  }),
};

export function detectAnomalies(order: any, rules: AnomalyRule[]) {
  const detected: Array<{ rule: AnomalyRule; details: any }> = [];

  for (const rule of rules) {
    if (rule.detect(order)) {
      detected.push({
        rule,
        details: rule.buildDetails(order),
      });
    }
  }

  return detected;
}
