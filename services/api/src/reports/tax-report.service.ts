/**
 * M17-s6: Tax Report Service
 *
 * Provides tax reporting for accountants and tax authorities.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface TaxSummary {
  period: {
    startDate: Date;
    endDate: Date;
  };
  currency: string;
  taxCollected: {
    [taxCode: string]: number;
    total: number;
  };
  taxPaid: {
    VAT_INPUT: number;
    total: number;
  };
  netTaxLiability: number;
  taxRemitted?: number;
  taxBalance?: number;
}

export interface TaxByCategory {
  categories: Array<{
    name: string;
    taxCode: string;
    taxRate: number;
    netSales: number;
    taxCollected: number;
    grossSales: number;
  }>;
  totals: {
    netSales: number;
    taxCollected: number;
    grossSales: number;
  };
}

@Injectable()
export class TaxReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get tax summary report for a period
   * Aggregates tax collected from sales and tax paid on purchases
   */
  async getTaxSummary(params: {
    orgId: string;
    branchId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<TaxSummary> {
    // Get org currency (TODO: Add currency field to Org model)
    const currency = 'UGX';

    // Query closed orders in period
    const orderWhere: any = {
      branch: { orgId: params.orgId },
      status: 'CLOSED',
      closedAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.branchId) {
      orderWhere.branchId = params.branchId;
    }

    const orders = await this.prisma.client.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        tax: true,
        metadata: true,
      },
    });

    // Aggregate tax by code
    const taxCollected: { [key: string]: number } = {};

    for (const order of orders) {
      const breakdown =
        order.metadata && typeof order.metadata === 'object'
          ? (order.metadata as any).taxBreakdown
          : null;

      if (breakdown?.items) {
        // M17+ orders (detailed breakdown)
        for (const item of breakdown.items) {
          const taxCode = item.taxRule?.code || 'VAT_STD';
          taxCollected[taxCode] = (taxCollected[taxCode] || 0) + (item.tax || 0);
        }
      } else {
        // Legacy orders (aggregate tax only)
        taxCollected['VAT_STD'] = (taxCollected['VAT_STD'] || 0) + Number(order.tax || 0);
      }
    }

    const totalTaxCollected = Object.values(taxCollected).reduce((sum, val) => sum + val, 0);

    // Query vendor bills for input VAT (tax paid)
    const billWhere: any = {
      orgId: params.orgId,
      status: 'POSTED',
      billDate: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.branchId) {
      billWhere.branchId = params.branchId;
    }

    const bills = await this.prisma.client.vendorBill.findMany({
      where: billWhere,
      select: {
        tax: true,
      },
    });

    const taxPaid = bills.reduce((sum, bill) => sum + Number(bill.tax || 0), 0);

    const netTaxLiability = totalTaxCollected - taxPaid;

    return {
      period: {
        startDate: params.startDate,
        endDate: params.endDate,
      },
      currency,
      taxCollected: {
        ...taxCollected,
        total: totalTaxCollected,
      },
      taxPaid: {
        VAT_INPUT: taxPaid,
        total: taxPaid,
      },
      netTaxLiability,
    };
  }

  /**
   * Get tax breakdown by category
   * Groups sales by menu item category and calculates tax per category
   */
  async getTaxByCategory(params: {
    orgId: string;
    branchId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<TaxByCategory> {
    // Query closed orders with items
    const orderWhere: any = {
      branch: { orgId: params.orgId },
      status: 'CLOSED',
      closedAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.branchId) {
      orderWhere.branchId = params.branchId;
    }

    const orders = await this.prisma.client.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        metadata: true,
        orderItems: {
          select: {
            quantity: true,
            price: true,
            subtotal: true,
            menuItem: {
              select: {
                id: true,
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Aggregate by category
    const categoryMap = new Map<
      string,
      {
        name: string;
        taxCode: string;
        taxRate: number;
        netSales: number;
        taxCollected: number;
        grossSales: number;
      }
    >();

    for (const order of orders) {
      const breakdown =
        order.metadata && typeof order.metadata === 'object'
          ? (order.metadata as any).taxBreakdown
          : null;

      if (breakdown?.items) {
        // M17+ orders with detailed breakdown
        for (const breakdownItem of breakdown.items) {
          const orderItem = order.orderItems.find((oi) => oi.menuItem.id === breakdownItem.itemId);
          const categoryName = orderItem?.menuItem?.category?.name || 'Uncategorized';

          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
              name: categoryName,
              taxCode: breakdownItem.taxRule?.code || 'VAT_STD',
              taxRate: breakdownItem.taxRule?.rate || 0.18,
              netSales: 0,
              taxCollected: 0,
              grossSales: 0,
            });
          }

          const cat = categoryMap.get(categoryName)!;
          cat.netSales += breakdownItem.net || 0;
          cat.taxCollected += breakdownItem.tax || 0;
          cat.grossSales += breakdownItem.gross || 0;
        }
      } else {
        // Legacy orders - use category from order items
        for (const orderItem of order.orderItems) {
          const categoryName = orderItem.menuItem?.category?.name || 'Uncategorized';
          const itemSubtotal = Number(orderItem.subtotal || 0);

          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
              name: categoryName,
              taxCode: 'VAT_STD',
              taxRate: 0.18,
              netSales: 0,
              taxCollected: 0,
              grossSales: 0,
            });
          }

          const cat = categoryMap.get(categoryName)!;
          // Estimate net (assume 18% inclusive tax for legacy)
          const estimatedNet = itemSubtotal / 1.18;
          const estimatedTax = itemSubtotal - estimatedNet;
          cat.netSales += estimatedNet;
          cat.taxCollected += estimatedTax;
          cat.grossSales += itemSubtotal;
        }
      }
    }

    const categories = Array.from(categoryMap.values());

    const totals = categories.reduce(
      (acc, cat) => ({
        netSales: acc.netSales + cat.netSales,
        taxCollected: acc.taxCollected + cat.taxCollected,
        grossSales: acc.grossSales + cat.grossSales,
      }),
      { netSales: 0, taxCollected: 0, grossSales: 0 },
    );

    return {
      categories: categories.map((cat) => ({
        ...cat,
        netSales: Math.round(cat.netSales * 100) / 100,
        taxCollected: Math.round(cat.taxCollected * 100) / 100,
        grossSales: Math.round(cat.grossSales * 100) / 100,
      })),
      totals: {
        netSales: Math.round(totals.netSales * 100) / 100,
        taxCollected: Math.round(totals.taxCollected * 100) / 100,
        grossSales: Math.round(totals.grossSales * 100) / 100,
      },
    };
  }
}
