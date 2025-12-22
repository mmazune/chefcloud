/**
 * Inventory Movement Generator Utilities
 * 
 * Core helpers for generating deterministic inventory operations:
 * - Purchases/GRNs with stock batches
 * - Sales-driven consumption using recipes
 * - Wastage and adjustments
 * - Stock reconciliation
 */

import { SeededRandom } from './seededRng';

/**
 * Supplier definitions for deterministic assignment
 */
export interface Supplier {
  name: string;
  contact: string;
  leadTimeDays: number;
  categories: string[]; // Which inventory categories this supplier provides
}

export const TAPAS_SUPPLIERS: Supplier[] = [
  {
    name: 'Fresh Meats Uganda Ltd',
    contact: 'meats@supplier.ug',
    leadTimeDays: 2,
    categories: ['Meats', 'Pork', 'Chicken', 'Seafood'],
  },
  {
    name: 'Garden Fresh Produce',
    contact: 'produce@supplier.ug',
    leadTimeDays: 1,
    categories: ['Vegetables', 'Fruits'],
  },
  {
    name: 'Kampala Liquor Distributors',
    contact: 'sales@liquor.ug',
    leadTimeDays: 3,
    categories: ['Beer', 'Spirits', 'Wine'],
  },
  {
    name: 'Dairy & Bakery Supplies',
    contact: 'orders@dairy.ug',
    leadTimeDays: 1,
    categories: ['Dairy', 'Baking'],
  },
  {
    name: 'General Food Imports',
    contact: 'import@foodimports.ug',
    leadTimeDays: 7,
    categories: ['Oils', 'Sauces', 'Spices', 'Canned Goods', 'Soft Drinks'],
  },
];

export const CAFESSERIE_SUPPLIERS: Supplier[] = [
  {
    name: 'Uganda Coffee Roasters',
    contact: 'wholesale@coffeeroasters.ug',
    leadTimeDays: 3,
    categories: ['Coffee'],
  },
  {
    name: 'Fresh Dairy Co-op',
    contact: 'orders@freshdairy.ug',
    leadTimeDays: 1,
    categories: ['Dairy', 'Milk'],
  },
  {
    name: 'Kampala Bakery Supplies',
    contact: 'sales@bakerysupply.ug',
    leadTimeDays: 1,
    categories: ['Baking', 'Bakery', 'Pastries'],
  },
  {
    name: 'Garden Fresh Produce',
    contact: 'produce@supplier.ug',
    leadTimeDays: 1,
    categories: ['Vegetables', 'Fruits'],
  },
  {
    name: 'Packaging Solutions Ltd',
    contact: 'orders@packaging.ug',
    leadTimeDays: 5,
    categories: ['Packaging', 'Disposables'],
  },
];

/**
 * Inventory item with consumption tracking
 */
export interface InventoryItemWithConsumption {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  reorderQty: number;
  initialStock: number;
  isPerishable: boolean; // For wastage calculation
  turnoverSpeed: 'fast' | 'medium' | 'slow'; // For purchase frequency
}

/**
 * Determine if item is perishable based on category
 */
export function isPerishable(category: string): boolean {
  const perishableCategories = [
    'Meats',
    'Pork',
    'Chicken',
    'Seafood',
    'Dairy',
    'Vegetables',
    'Fruits',
    'Bakery',
    'Baking', // Some baking items like bread
  ];
  return perishableCategories.includes(category);
}

/**
 * Determine turnover speed based on category and reorder qty
 */
export function getTurnoverSpeed(
  category: string,
  reorderQty: number,
): 'fast' | 'medium' | 'slow' {
  // Fast movers: high-volume beverages, staples
  const fastCategories = ['Beer', 'Soft Drinks', 'Coffee', 'Milk', 'Vegetables'];
  if (fastCategories.includes(category) || reorderQty >= 15) {
    return 'fast';
  }

  // Slow movers: premium items, specialty items
  const slowCategories = ['Wine', 'Premium Spirits', 'Spices'];
  if (slowCategories.includes(category) || reorderQty <= 3) {
    return 'slow';
  }

  return 'medium';
}

/**
 * Generate deterministic batch number
 */
export function generateBatchNumber(
  date: Date,
  itemSku: string,
  sequence: number,
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const skuShort = itemSku.replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return `SEED-${dateStr}-${skuShort}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate deterministic GRN number
 */
export function generateGRNumber(
  date: Date,
  branchId: string,
  sequence: number,
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const branchCode = branchId.slice(-4).toUpperCase();
  return `GRN-${branchCode}-${dateStr}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Calculate purchase quantity needed based on consumption forecast
 * Ensures stock doesn't go negative
 */
export function calculatePurchaseQuantity(
  item: InventoryItemWithConsumption,
  currentStock: number,
  projectedConsumption: number, // Expected consumption over lead time + safety period
  rng: SeededRandom,
): number {
  // Safety stock: cover lead time + 3 extra days
  const safetyDays = item.turnoverSpeed === 'fast' ? 5 : 3;
  const safetyStock = projectedConsumption * (safetyDays / 7); // Convert weekly to days

  // Reorder point: consumption during lead time + safety stock
  const reorderPoint = Math.max(
    item.reorderLevel,
    (projectedConsumption * item.reorderQty) / 7 + safetyStock,
  );

  // If stock is above reorder point, no purchase needed
  if (currentStock >= reorderPoint) {
    return 0;
  }

  // Purchase enough to reach target stock level
  const targetStock = item.reorderQty * 1.2; // 20% buffer
  const purchaseQty = Math.max(
    item.reorderQty,
    targetStock - currentStock + projectedConsumption,
  );

  // Add small deterministic variance (±5%)
  const variance = rng.nextFloat(0.95, 1.05);
  return Math.round(purchaseQty * variance * 100) / 100;
}

/**
 * Apply small inflationary cost drift over time (0-3% over 6 months)
 */
export function applyInflation(
  baseCost: number,
  date: Date,
  startDate: Date,
  rng: SeededRandom,
): number {
  const daysElapsed = Math.floor(
    (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const maxDays = 180; // 6 months

  // Linear inflation: 0-3% over maxDays
  const maxInflation = 0.03;
  const inflationRate = (daysElapsed / maxDays) * maxInflation;

  // Add small deterministic noise (±0.5%)
  const noise = rng.nextFloat(-0.005, 0.005);

  return Math.round(baseCost * (1 + inflationRate + noise) * 100) / 100;
}

/**
 * Calculate wastage quantity (deterministic)
 * Perishables: 2-6% monthly shrinkage
 * Non-perishables: 0.5-1.5% monthly shrinkage (bar shrinkage, breakage)
 */
export function calculateWastage(
  item: InventoryItemWithConsumption,
  monthlyConsumption: number,
  rng: SeededRandom,
): number {
  if (monthlyConsumption === 0) return 0;

  const wastageRate = item.isPerishable
    ? rng.nextFloat(0.02, 0.06) // 2-6% for perishables
    : rng.nextFloat(0.005, 0.015); // 0.5-1.5% for others

  return Math.round(monthlyConsumption * wastageRate * 100) / 100;
}

/**
 * Stock reconciliation adjustment (±small correction)
 */
export function generateStocktakeAdjustment(
  item: InventoryItemWithConsumption,
  currentStock: number,
  rng: SeededRandom,
): { deltaQty: number; reason: string } | null {
  // Only adjust 10-20 items per stocktake
  if (!rng.chance(0.15)) return null;

  // Small variance: ±2-8% of current stock
  const maxVariance = currentStock * 0.08;
  const deltaQty =
    rng.nextFloat(-maxVariance, maxVariance) * (rng.chance(0.5) ? 1 : -1);

  // Round to 2 decimals
  const roundedDelta = Math.round(deltaQty * 100) / 100;

  if (Math.abs(roundedDelta) < 0.01) return null;

  const reason =
    roundedDelta > 0
      ? rng.pick(['Stocktake surplus', 'Found in back room', 'Recount correction'])
      : rng.pick([
          'Stocktake shortfall',
          'Unrecorded usage',
          'Counting error correction',
        ]);

  return { deltaQty: roundedDelta, reason };
}

/**
 * Generate deterministic purchase schedule dates
 */
export function generatePurchaseDates(
  startDate: Date,
  endDate: Date,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  dayOfWeek: number = 2, // Tuesday by default
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  // Find first occurrence of dayOfWeek on or after startDate
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  const intervalDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + intervalDays);
  }

  return dates;
}

/**
 * FIFO consumption: decrement oldest batches first
 */
export interface BatchConsumption {
  batchId: string;
  qtyConsumed: number;
  cost: number;
}

export function consumeFromBatches(
  batches: Array<{ id: string; remainingQty: number; unitCost: number; receivedAt: Date }>,
  qtyToConsume: number,
): BatchConsumption[] {
  const consumptions: BatchConsumption[] = [];

  // Sort by receivedAt (oldest first - FIFO)
  const sortedBatches = [...batches].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );

  let remaining = qtyToConsume;

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;
    if (batch.remainingQty <= 0) continue;

    const consumed = Math.min(batch.remainingQty, remaining);
    consumptions.push({
      batchId: batch.id,
      qtyConsumed: consumed,
      cost: consumed * batch.unitCost,
    });

    remaining -= consumed;
  }

  return consumptions;
}
