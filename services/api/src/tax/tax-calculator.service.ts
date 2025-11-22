/**
 * M17-s3: Tax Calculator Service (Orchestration Layer)
 *
 * Provides canonical tax calculations for all business domains.
 * Orchestrates TaxService, CurrencyService, and rounding logic.
 */

import { Injectable } from '@nestjs/common';
import { TaxService } from './tax.service';
import { CurrencyService } from '../currency/currency.service';

export interface OrderItemInput {
  itemId: string;
  price: number;
  quantity: number;
}

export interface OrderItemTotals {
  itemId: string;
  quantity: number;
  unitPrice: number;
  net: number;
  tax: number;
  gross: number;
  taxRule: {
    code: string;
    rate: number;
    inclusive: boolean;
  };
}

export interface OrderTotals {
  items: OrderItemTotals[];
  subtotal: {
    net: number;
    tax: number;
    gross: number;
  };
  serviceCharge: {
    amount: number;
    inclusive: boolean;
  };
  discount: number;
  total: {
    net: number;
    tax: number;
    gross: number;
  };
  rounding: number;
  finalTotal: number;
}

export interface EventBookingTotals {
  deposit: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  taxRate: number;
  taxInclusive: boolean;
}

@Injectable()
export class TaxCalculatorService {
  constructor(
    private readonly taxService: TaxService,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Calculate order totals with item-level tax breakdown
   * 
   * This is the canonical method for POS orders - replaces inline tax calculation.
   * 
   * @param params - Order calculation parameters
   * @returns Comprehensive order totals with net/tax/gross breakdown
   */
  async calculateOrderTotals(params: {
    orgId: string;
    branchId: string;
    items: OrderItemInput[];
    discountAmount?: number;
  }): Promise<OrderTotals> {
    const itemsWithTax: OrderItemTotals[] = [];
    let subtotalNet = 0;
    let subtotalTax = 0;

    // Calculate tax for each line item
    for (const item of params.items) {
      // Resolve tax rule (uses TaxService.resolveLineTax)
      const taxRule = await this.taxService.resolveLineTax(params.orgId, item.itemId);

      // Calculate line total
      const lineGrossOrNet = item.price * item.quantity;

      // Calculate tax for line (uses TaxService.calculateTax)
      const lineTax = this.taxService.calculateTax(lineGrossOrNet, taxRule);

      itemsWithTax.push({
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.price,
        net: lineTax.net,
        tax: lineTax.taxAmount,
        gross: lineTax.gross,
        taxRule: {
          code: taxRule.code || 'VAT_STD',
          rate: taxRule.rate,
          inclusive: taxRule.inclusive || true,
        },
      });

      subtotalNet += lineTax.net;
      subtotalTax += lineTax.taxAmount;
    }

    const subtotalGross = subtotalNet + subtotalTax;

    // Apply discount (on subtotal before service charge)
    const discount = params.discountAmount || 0;

    // Calculate service charge (on net subtotal after discount)
    const serviceCharge = await this.taxService.calculateServiceCharge(
      params.orgId,
      subtotalNet - discount,
    );

    // Final totals
    const totalNet = subtotalNet - discount;
    const totalTax = subtotalTax;
    const totalGross = totalNet + totalTax + serviceCharge.amount;

    // Apply cash rounding
    const branchCurrency = await this.currencyService.getBranchCurrency(params.branchId);
    const finalTotal = await this.taxService.applyRounding(
      params.orgId,
      totalGross,
      branchCurrency,
    );

    const rounding = finalTotal - totalGross;

    return {
      items: itemsWithTax,
      subtotal: {
        net: Math.round(subtotalNet * 100) / 100,
        tax: Math.round(subtotalTax * 100) / 100,
        gross: Math.round(subtotalGross * 100) / 100,
      },
      serviceCharge,
      discount: Math.round(discount * 100) / 100,
      total: {
        net: Math.round(totalNet * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        gross: Math.round(totalGross * 100) / 100,
      },
      rounding: Math.round(rounding * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    };
  }

  /**
   * Calculate event booking deposit totals with tax breakdown
   * 
   * Used by events/bookings module when creating EventBooking records.
   * 
   * @param params - Event booking calculation parameters
   * @returns Tax breakdown for deposit (net/tax/gross)
   */
  async calculateEventBookingTotals(params: {
    orgId: string;
    deposit: number;
    taxCode?: string;
  }): Promise<EventBookingTotals> {
    // Get tax matrix
    const taxMatrix = await this.taxService.getTaxMatrix(params.orgId);

    // Resolve tax rule (use events tax or defaultTax)
    const taxCode = params.taxCode || 'events';
    const taxRule = taxMatrix[taxCode] || taxMatrix.defaultTax || {
      code: 'VAT_STD',
      rate: 0.18,
      inclusive: true,
    };

    // Calculate tax
    const taxCalc = this.taxService.calculateTax(params.deposit, taxRule);

    return {
      deposit: params.deposit,
      netAmount: Math.round(taxCalc.net * 100) / 100,
      taxAmount: Math.round(taxCalc.taxAmount * 100) / 100,
      grossAmount: Math.round(taxCalc.gross * 100) / 100,
      taxRate: taxRule.rate,
      taxInclusive: taxRule.inclusive !== undefined ? taxRule.inclusive : true,
    };
  }

  /**
   * Calculate single item tax (simple utility)
   * 
   * @param params - Item calculation parameters
   * @returns Tax breakdown for single item
   */
  async calculateItemTax(params: {
    orgId: string;
    itemId: string;
    price: number;
    quantity: number;
  }): Promise<{
    net: number;
    tax: number;
    gross: number;
    taxRule: { code: string; rate: number; inclusive: boolean };
  }> {
    // Resolve tax rule
    const taxRule = await this.taxService.resolveLineTax(params.orgId, params.itemId);

    // Calculate tax
    const lineTotal = params.price * params.quantity;
    const taxCalc = this.taxService.calculateTax(lineTotal, taxRule);

    return {
      net: Math.round(taxCalc.net * 100) / 100,
      tax: Math.round(taxCalc.taxAmount * 100) / 100,
      gross: Math.round(taxCalc.gross * 100) / 100,
      taxRule: {
        code: taxRule.code || 'VAT_STD',
        rate: taxRule.rate,
        inclusive: taxRule.inclusive || true,
      },
    };
  }
}
