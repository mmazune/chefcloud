/**
 * M13.4 / M13.5: POS Payments Controller
 *
 * Endpoints for payment lifecycle:
 * - Create payment for order (with partial payment + tips support)
 * - Capture authorized payment
 * - Void payment (L4+)
 * - Refund payment (L4+)
 * - Payment summary (M13.5)
 * - Z-Report (M13.5)
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { IdempotencyInterceptor } from '../../common/idempotency.interceptor';
import { PosPaymentsService, CreatePaymentDto, RefundPaymentDto } from '../services/pos-payments.service';
import { PosReceiptsService } from '../services/pos-receipts.service';
import { PosCashSessionsService, OpenCashSessionDto, CloseCashSessionDto } from '../services/pos-cash-sessions.service';
import { PosZReportService } from '../services/pos-zreport.service';

@ApiTags('POS Payments')
@ApiBearerAuth()
@Controller('pos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PosPaymentsController {
  constructor(
    private paymentsService: PosPaymentsService,
    private receiptsService: PosReceiptsService,
    private cashSessionsService: PosCashSessionsService,
    private zReportService: PosZReportService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Payment Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a payment for an order
   */
  @Post('orders/:id/payments')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create payment for order' })
  async createPayment(
    @Param('id') orderId: string,
    @Body() dto: CreatePaymentDto,
    @Request() req: { user: { userId: string; orgId: string; branchId: string } },
  ) {
    return this.paymentsService.createPayment(
      orderId,
      dto,
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
    );
  }

  /**
   * Get payments for an order
   */
  @Get('orders/:id/payments')
  @Roles('L1')
  @ApiOperation({ summary: 'Get payments for order' })
  async getOrderPayments(
    @Param('id') orderId: string,
    @Request() req: { user: { orgId: string; branchId: string } },
  ) {
    return this.paymentsService.getOrderPayments(
      orderId,
      req.user.orgId,
      req.user.branchId,
    );
  }

  /**
   * M13.5: Get payment summary for an order
   */
  @Get('orders/:id/payment-summary')
  @Roles('L1')
  @ApiOperation({ summary: 'Get payment summary for order (dueCents, paidCents, tips)' })
  async getPaymentSummary(
    @Param('id') orderId: string,
    @Request() req: { user: { orgId: string; branchId: string } },
  ) {
    return this.paymentsService.getPaymentSummary(
      orderId,
      req.user.orgId,
      req.user.branchId,
    );
  }

  /**
   * Get a specific payment
   */
  @Get('payments/:id')
  @Roles('L1')
  @ApiOperation({ summary: 'Get payment by ID' })
  async getPayment(
    @Param('id') paymentId: string,
    @Request() req: { user: { orgId: string; branchId: string } },
  ) {
    return this.paymentsService.getPayment(
      paymentId,
      req.user.orgId,
      req.user.branchId,
    );
  }

  /**
   * Capture an authorized payment
   */
  @Post('payments/:id/capture')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Capture authorized payment' })
  async capturePayment(
    @Param('id') paymentId: string,
    @Request() req: { user: { userId: string; orgId: string; branchId: string } },
  ) {
    return this.paymentsService.capturePayment(
      paymentId,
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
    );
  }

  /**
   * Void a pending/authorized payment (L4+ only)
   */
  @Post('payments/:id/void')
  @Roles('L4')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Void payment (L4+ only)' })
  async voidPayment(
    @Param('id') paymentId: string,
    @Body() dto: { reason: string },
    @Request() req: { user: { userId: string; orgId: string; branchId: string } },
  ) {
    return this.paymentsService.voidPayment(
      paymentId,
      dto.reason,
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
    );
  }

  /**
   * Refund a captured payment (L4+ only)
   */
  @Post('payments/:id/refund')
  @Roles('L4')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Refund payment (L4+ only)' })
  async refundPayment(
    @Param('id') paymentId: string,
    @Body() dto: RefundPaymentDto,
    @Request() req: { user: { userId: string; orgId: string; branchId: string } },
  ) {
    return this.paymentsService.refundPayment(
      paymentId,
      dto,
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Receipt Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Issue a receipt for a paid order
   */
  @Post('orders/:id/receipt')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Issue receipt for paid order' })
  async issueReceipt(
    @Param('id') orderId: string,
    @Request() req: { user: { userId: string; orgId: string; branchId: string } },
  ) {
    return this.receiptsService.issueReceipt(
      orderId,
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
    );
  }

  /**
   * Get receipt by ID
   */
  @Get('receipts/:id')
  @Roles('L1')
  @ApiOperation({ summary: 'Get receipt by ID' })
  async getReceipt(
    @Param('id') receiptId: string,
    @Request() req: { user: { orgId: string } },
  ) {
    return this.receiptsService.getReceipt(receiptId, req.user.orgId);
  }

  /**
   * Export receipts as CSV
   */
  @Get('export/receipts.csv')
  @Roles('L4')
  @ApiOperation({ summary: 'Export receipts CSV (L4+)' })
  async exportReceipts(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: { user: { orgId: string } },
    @Res() res?: Response,
  ) {
    const { csv, hash } = await this.receiptsService.exportReceiptsCsv(
      req!.user.orgId,
      branchId,
      from,
      to,
    );

    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', 'attachment; filename="receipts.csv"');
    res?.setHeader('X-Nimbus-Export-Hash', hash);
    res?.send(csv);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cash Session Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open a new cash session (L3+)
   */
  @Post('cash-sessions/open')
  @Roles('L3')
  @ApiOperation({ summary: 'Open cash session (L3+)' })
  async openCashSession(
    @Body() dto: OpenCashSessionDto,
    @Request() req: { user: { userId: string; orgId: string } },
  ) {
    return this.cashSessionsService.openSession(dto, req.user.orgId, req.user.userId);
  }

  /**
   * Close a cash session (L3+)
   */
  @Post('cash-sessions/:id/close')
  @Roles('L3')
  @ApiOperation({ summary: 'Close cash session (L3+)' })
  async closeCashSession(
    @Param('id') sessionId: string,
    @Body() dto: CloseCashSessionDto,
    @Request() req: { user: { userId: string; orgId: string } },
  ) {
    return this.cashSessionsService.closeSession(
      sessionId,
      dto,
      req.user.orgId,
      req.user.userId,
    );
  }

  /**
   * List cash sessions
   */
  @Get('cash-sessions')
  @Roles('L2')
  @ApiOperation({ summary: 'List cash sessions' })
  async listCashSessions(
    @Query('branchId') branchId?: string,
    @Query('status') status?: 'OPEN' | 'CLOSED',
    @Request() req?: { user: { orgId: string } },
  ) {
    return this.cashSessionsService.listSessions(req!.user.orgId, branchId, status);
  }

  /**
   * Get cash session by ID
   */
  @Get('cash-sessions/:id')
  @Roles('L2')
  @ApiOperation({ summary: 'Get cash session by ID' })
  async getCashSession(
    @Param('id') sessionId: string,
    @Request() req: { user: { orgId: string } },
  ) {
    return this.cashSessionsService.getSession(sessionId, req.user.orgId);
  }

  /**
   * Export cash sessions as CSV
   */
  @Get('export/cash-sessions.csv')
  @Roles('L4')
  @ApiOperation({ summary: 'Export cash sessions CSV (L4+)' })
  async exportCashSessions(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: { user: { orgId: string } },
    @Res() res?: Response,
  ) {
    const { csv, hash } = await this.cashSessionsService.exportSessionsCsv(
      req!.user.orgId,
      branchId,
      from,
      to,
    );

    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', 'attachment; filename="cash-sessions.csv"');
    res?.setHeader('X-Nimbus-Export-Hash', hash);
    res?.send(csv);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Z-Report Endpoints (M13.5)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get Z-Report (End-of-Day Report)
   */
  @Get('reports/z')
  @Roles('L4')
  @ApiOperation({ summary: 'Get Z-Report for a date (L4+)' })
  async getZReport(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
  ) {
    if (!branchId || !date) {
      throw new Error('branchId and date query parameters are required');
    }
    return this.zReportService.generateZReport(branchId, req.user.orgId, date);
  }

  /**
   * Export Z-Report as CSV
   */
  @Get('export/z-report.csv')
  @Roles('L4')
  @ApiOperation({ summary: 'Export Z-Report CSV (L4+)' })
  async exportZReport(
    @Query('branchId') branchId: string,
    @Query('date') date: string,
    @Request() req: { user: { orgId: string } },
    @Res() res: Response,
  ) {
    if (!branchId || !date) {
      throw new Error('branchId and date query parameters are required');
    }
    const { csv, hash, filename } = await this.zReportService.generateZReportCsv(
      branchId,
      req.user.orgId,
      date,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Nimbus-Export-Hash', hash);
    res.send(csv);
  }
}
