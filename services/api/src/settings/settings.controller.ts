/**
 * E39-s1: Settings Controller
 * 
 * Admin APIs (L5) for managing currency, tax matrix, and rounding settings.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    orgId: string;
    role: string;
    id: string;
    branchId?: string;
  };
}

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /settings/currency - Get base currency
   */
  @Get('currency')
  @Roles('L5')
  async getCurrency(@Request() req: RequestWithUser): Promise<any> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: req.user.orgId },
      select: { baseCurrencyCode: true, currency: true },
    });

    return {
      baseCurrencyCode: settings?.baseCurrencyCode || settings?.currency || 'UGX',
    };
  }

  /**
   * PUT /settings/currency - Set base currency
   */
  @Put('currency')
  @Roles('L5')
  async setCurrency(
    @Request() req: RequestWithUser,
    @Body() body: { baseCurrencyCode: string },
  ): Promise<any> {
    const updated = await this.prisma.client.orgSettings.update({
      where: { orgId: req.user.orgId },
      data: { baseCurrencyCode: body.baseCurrencyCode },
    });

    return {
      baseCurrencyCode: updated.baseCurrencyCode,
    };
  }

  /**
   * GET /settings/tax-matrix - Get tax matrix
   */
  @Get('tax-matrix')
  @Roles('L5')
  async getTaxMatrix(@Request() req: RequestWithUser): Promise<any> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: req.user.orgId },
      select: { taxMatrix: true },
    });

    return settings?.taxMatrix || { defaultTax: { code: 'VAT_STD', rate: 0.18, inclusive: true } };
  }

  /**
   * PUT /settings/tax-matrix - Update tax matrix
   */
  @Put('tax-matrix')
  @Roles('L5')
  async setTaxMatrix(
    @Request() req: RequestWithUser,
    @Body() body: any,
  ): Promise<any> {
    // Basic validation: ensure defaultTax exists
    if (!body.defaultTax || typeof body.defaultTax.rate !== 'number') {
      throw new Error('taxMatrix must have defaultTax with rate');
    }

    const updated = await this.prisma.client.orgSettings.update({
      where: { orgId: req.user.orgId },
      data: { taxMatrix: body },
    });

    return updated.taxMatrix;
  }

  /**
   * GET /settings/rounding - Get rounding rules
   */
  @Get('rounding')
  @Roles('L5')
  async getRounding(@Request() req: RequestWithUser): Promise<any> {
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId: req.user.orgId },
      select: { rounding: true },
    });

    return settings?.rounding || { cashRounding: 'NEAREST_50', taxRounding: 'HALF_UP' };
  }

  /**
   * PUT /settings/rounding - Set rounding rules
   */
  @Put('rounding')
  @Roles('L5')
  async setRounding(
    @Request() req: RequestWithUser,
    @Body() body: any,
  ): Promise<any> {
    const updated = await this.prisma.client.orgSettings.update({
      where: { orgId: req.user.orgId },
      data: { rounding: body },
    });

    return updated.rounding;
  }

  /**
   * POST /settings/exchange-rate - Manually set exchange rate (L5 only)
   */
  @Post('exchange-rate')
  @Roles('L5')
  async setExchangeRate(
    @Body() body: { baseCode: string; quoteCode: string; rate: number },
  ): Promise<any> {
    // Validate currencies exist
    const baseCurr = await this.prisma.client.currency.findUnique({
      where: { code: body.baseCode },
    });
    const quoteCurr = await this.prisma.client.currency.findUnique({
      where: { code: body.quoteCode },
    });

    if (!baseCurr || !quoteCurr) {
      throw new Error('Invalid currency code');
    }

    // Create new rate
    const rate = await this.prisma.client.exchangeRate.create({
      data: {
        baseCode: body.baseCode,
        quoteCode: body.quoteCode,
        rate: body.rate,
        source: 'MANUAL',
        asOf: new Date(),
      },
    });

    return rate;
  }
}
