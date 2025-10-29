/**
 * E40-s1: Accounting Controller
 * 
 * REST endpoints for accounting operations (L4+).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountingService } from './accounting.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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

@Controller('accounting')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('vendors')
  @Roles('L4', 'L5')
  async createVendor(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      email?: string;
      phone?: string;
      defaultTerms?: 'NET7' | 'NET14' | 'NET30';
      metadata?: any;
    },
  ) {
    return this.accountingService.createVendor(req.user.orgId, body);
  }

  @Get('vendors')
  @Roles('L4', 'L5')
  async getVendors(@Request() req: RequestWithUser) {
    return this.accountingService.getVendors(req.user.orgId);
  }

  @Post('vendor-bills')
  @Roles('L4', 'L5')
  async createVendorBill(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      vendorId: string;
      number?: string;
      billDate?: string;
      dueDate: string;
      subtotal: number;
      tax?: number;
      total: number;
      memo?: string;
    },
  ) {
    return this.accountingService.createVendorBill(req.user.orgId, {
      ...body,
      billDate: body.billDate ? new Date(body.billDate) : undefined,
      dueDate: new Date(body.dueDate),
    });
  }

  @Post('vendor-bills/:billId/open')
  @Roles('L4', 'L5')
  async openVendorBill(@Param('billId') billId: string) {
    return this.accountingService.openVendorBill(billId);
  }

  @Post('vendor-payments')
  @Roles('L4', 'L5')
  async createVendorPayment(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      vendorId: string;
      billId?: string;
      amount: number;
      paidAt?: string;
      method: string;
      ref?: string;
      metadata?: any;
    },
  ) {
    return this.accountingService.createVendorPayment(req.user.orgId, {
      ...body,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
    });
  }

  @Get('ap/aging')
  @Roles('L4', 'L5')
  async getAPAging(@Request() req: RequestWithUser) {
    return this.accountingService.getAPAging(req.user.orgId);
  }

  @Get('ar/aging')
  @Roles('L4', 'L5')
  async getARAging(@Request() req: RequestWithUser) {
    return this.accountingService.getARAging(req.user.orgId);
  }

  @Get('trial-balance')
  @Roles('L4', 'L5')
  async getTrialBalance(
    @Request() req: RequestWithUser,
    @Query('asOf') asOf?: string,
  ) {
    return this.accountingService.getTrialBalance(req.user.orgId, asOf);
  }

  @Get('pnl')
  @Roles('L4', 'L5')
  async getProfitAndLoss(
    @Request() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accountingService.getProfitAndLoss(req.user.orgId, from, to);
  }

  @Get('balance-sheet')
  @Roles('L4', 'L5')
  async getBalanceSheet(
    @Request() req: RequestWithUser,
    @Query('asOf') asOf?: string,
  ) {
    return this.accountingService.getBalanceSheet(req.user.orgId, asOf);
  }
}
