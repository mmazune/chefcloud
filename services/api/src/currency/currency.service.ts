/**
 * E39-s1: Currency Service
 *
 * Handles currency lookups and conversion using exchange rates.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get organization's base currency (or default to "UGX")
   */
  async getOrgCurrency(orgId: string): Promise<string> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { baseCurrencyCode: true, currency: true },
    });

    return settings?.baseCurrencyCode || settings?.currency || 'UGX';
  }

  /**
   * Get branch currency (falls back to org base currency)
   */
  async getBranchCurrency(branchId: string): Promise<string> {
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
      select: { currencyCode: true, orgId: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    if (branch.currencyCode) {
      return branch.currencyCode;
    }

    return this.getOrgCurrency(branch.orgId);
  }

  /**
   * Convert amount from one currency to another using latest exchange rate
   * Returns converted amount as number (for simplicity)
   */
  async convert(amount: number, fromCode: string, toCode: string, asOf?: Date): Promise<number> {
    if (fromCode === toCode) {
      return amount;
    }

    // Find latest rate
    const rate = await this.prisma.client.exchangeRate.findFirst({
      where: {
        baseCode: fromCode,
        quoteCode: toCode,
        asOf: asOf ? { lte: asOf } : undefined,
      },
      orderBy: { asOf: 'desc' },
    });

    if (!rate) {
      // Try inverse rate (e.g., USD/UGX instead of UGX/USD)
      const inverseRate = await this.prisma.client.exchangeRate.findFirst({
        where: {
          baseCode: toCode,
          quoteCode: fromCode,
          asOf: asOf ? { lte: asOf } : undefined,
        },
        orderBy: { asOf: 'desc' },
      });

      if (inverseRate) {
        const rateValue = Number(inverseRate.rate);
        return amount / rateValue;
      }

      throw new NotFoundException(`No exchange rate found for ${fromCode}/${toCode}`);
    }

    const rateValue = Number(rate.rate);
    return amount * rateValue;
  }

  /**
   * Get currency metadata (symbol, decimals)
   */
  async getCurrencyInfo(code: string): Promise<any> {
    const currency = await this.prisma.client.currency.findUnique({
      where: { code },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return currency;
  }
}
