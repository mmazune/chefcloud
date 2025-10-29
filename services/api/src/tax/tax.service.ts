/**
 * E39-s1: Tax Service
 * 
 * Handles tax calculation based on org tax matrix (inclusive/exclusive),
 * service charge, and rounding rules.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface TaxRule {
  code?: string;
  rate: number;
  inclusive?: boolean;
}

interface TaxResult {
  taxAmount: number;
  net: number; // Pre-tax amount
  gross: number; // Total including tax
}

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get tax matrix from org settings
   */
  async getTaxMatrix(orgId: string): Promise<any> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { taxMatrix: true },
    });

    return settings?.taxMatrix || { defaultTax: { code: 'VAT_STD', rate: 0.18, inclusive: true } };
  }

  /**
   * Resolve tax rule for an order item
   * Looks up taxCode from MenuItem metadata, then finds rule in taxMatrix
   */
  async resolveLineTax(
    orgId: string,
    itemId: string,
  ): Promise<TaxRule> {
    const taxMatrix = await this.getTaxMatrix(orgId);

    // Try to get tax code from menu item metadata
    const menuItem = await this.prisma.client.menuItem.findUnique({
      where: { id: itemId },
      select: { metadata: true },
    });

    let taxCode = 'defaultTax';

    // Check item metadata for tax code
    if (menuItem?.metadata && typeof menuItem.metadata === 'object') {
      const meta = menuItem.metadata as any;
      if (meta.taxCode) {
        taxCode = meta.taxCode;
      }
    }

    // Lookup rule in tax matrix
    const rule = taxMatrix[taxCode] || taxMatrix.defaultTax;

    return {
      code: rule.code || taxCode,
      rate: rule.rate || 0.18,
      inclusive: rule.inclusive !== undefined ? rule.inclusive : true,
    };
  }

  /**
   * Calculate tax for a line item
   * Returns {taxAmount, net, gross}
   */
  calculateTax(grossOrNet: number, rule: TaxRule): TaxResult {
    if (rule.inclusive) {
      // Tax is included in the gross amount
      // gross = net * (1 + rate)
      // net = gross / (1 + rate)
      const net = grossOrNet / (1 + rule.rate);
      const taxAmount = grossOrNet - net;
      return {
        taxAmount: Math.round(taxAmount * 100) / 100,
        net: Math.round(net * 100) / 100,
        gross: grossOrNet,
      };
    } else {
      // Tax is added to net amount
      // gross = net * (1 + rate)
      const net = grossOrNet;
      const taxAmount = net * rule.rate;
      const gross = net + taxAmount;
      return {
        taxAmount: Math.round(taxAmount * 100) / 100,
        net,
        gross: Math.round(gross * 100) / 100,
      };
    }
  }

  /**
   * Calculate service charge
   */
  async calculateServiceCharge(
    orgId: string,
    subtotal: number,
  ): Promise<{ amount: number; inclusive: boolean }> {
    const taxMatrix = await this.getTaxMatrix(orgId);

    if (!taxMatrix.serviceCharge) {
      return { amount: 0, inclusive: false };
    }

    const scRule = taxMatrix.serviceCharge;
    const rate = scRule.rate || 0;
    const inclusive = scRule.inclusive || false;

    const amount = subtotal * rate;

    return {
      amount: Math.round(amount * 100) / 100,
      inclusive,
    };
  }

  /**
   * Apply rounding rules (e.g., cash rounding to nearest 50 UGX)
   */
  async applyRounding(orgId: string, amount: number, currencyCode: string): Promise<number> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { rounding: true },
    });

    if (!settings?.rounding || typeof settings.rounding !== 'object') {
      return amount;
    }

    const roundingRules = settings.rounding as any;
    const cashRounding = roundingRules.cashRounding;

    // Only apply cash rounding for currencies with 0 decimals (like UGX)
    if (currencyCode === 'UGX' && cashRounding === 'NEAREST_50') {
      return Math.round(amount / 50) * 50;
    }

    if (cashRounding === 'NEAREST_100') {
      return Math.round(amount / 100) * 100;
    }

    return Math.round(amount * 100) / 100;
  }
}
