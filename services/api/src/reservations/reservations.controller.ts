/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ReservationsService } from './reservations.service';
import { PolicyService } from './policy.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { NotificationService } from './notification.service';
import { AutomationService } from './automation.service';
import { HostOpsService } from './host-ops.service';
import { ReportingService } from './reporting.service';
import {
  CreateReservationDto,
  UpdateReservationDto,
  CancelReservationDto,
  NoShowReservationDto,
  SeatReservationDto,
  AssignTablesDto,
  UpsertPolicyDto,
  RequireDepositDto,
  PayDepositDto,
  RefundDepositDto,
  ApplyDepositDto,
  CalendarQueryDto,
  NotificationQueryDto,
} from './reservations.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly policyService: PolicyService,
    private readonly depositService: DepositAccountingService,
    private readonly notificationService: NotificationService,
    private readonly automationService: AutomationService,
    private readonly hostOpsService: HostOpsService,
    private readonly reportingService: ReportingService,
  ) { }

  @Post()
  @Roles('L2') // Front desk / host
  @UseInterceptors(IdempotencyInterceptor)
  create(@Req() req: any, @Body() dto: CreateReservationDto): Promise<any> {
    return this.reservationsService.create(req.user.orgId, dto, req.user.userId);
  }

  @Get()
  @Roles('L2')
  findAll(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    return this.reservationsService.findAll(req.user.orgId, from, to, status, branchId);
  }

  @Get('availability')
  @Roles('L2')
  getAvailability(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
    @Query('partySize') partySize?: string,
    @Query('floorPlanId') floorPlanId?: string,
  ): Promise<any> {
    return this.reservationsService.getAvailability(req.user.orgId, {
      branchId,
      startAt,
      endAt,
      partySize: partySize ? parseInt(partySize, 10) : undefined,
      floorPlanId,
    });
  }

  @Get('summary')
  @Roles('L3') // Manager+
  getSummary(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    return this.reservationsService.getSummary(req.user.orgId, from, to, branchId);
  }

  @Get(':id')
  @Roles('L2')
  findOne(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.findOne(req.user.orgId, id);
  }

  @Patch(':id')
  @Roles('L2')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ): Promise<any> {
    return this.reservationsService.update(req.user.orgId, id, dto, req.user.userId);
  }

  @Post(':id/confirm')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  confirm(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.confirm(req.user.orgId, id);
  }

  @Post(':id/cancel')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  cancel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto?: CancelReservationDto,
  ): Promise<any> {
    return this.reservationsService.cancel(req.user.orgId, id, dto, req.user.userId);
  }

  @Post(':id/seat')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  seat(@Req() req: any, @Param('id') id: string, @Body() dto?: SeatReservationDto): Promise<any> {
    return this.reservationsService.seat(req.user.orgId, id, dto?.orderId);
  }

  @Post(':id/complete')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  complete(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.complete(req.user.orgId, id);
  }

  @Post(':id/no-show')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  noShow(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto?: NoShowReservationDto,
  ): Promise<any> {
    return this.reservationsService.noShow(req.user.orgId, id, dto, req.user.userId);
  }

  @Post(':id/assign-tables')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  assignTables(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignTablesDto,
  ): Promise<any> {
    return this.reservationsService.assignTables(req.user.orgId, id, dto.tableIds, req.user.userId);
  }

  // ===== M9.2: Policy Endpoints =====

  @Get('policies')
  @Roles('L2')
  getPolicy(@Req() req: any, @Query('branchId') branchId: string): Promise<any> {
    return this.policyService.getPolicy(req.user.orgId, branchId);
  }

  @Put('policies')
  @Roles('L3') // Manager+ only
  @UseInterceptors(IdempotencyInterceptor)
  upsertPolicy(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Body() dto: UpsertPolicyDto,
  ): Promise<any> {
    return this.policyService.upsertPolicy(req.user.orgId, branchId, dto);
  }

  // ===== M9.2: Deposit Endpoints =====

  @Get(':id/deposit')
  @Roles('L1') // Read-only for all
  getDeposit(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.depositService.getDeposit(req.user.orgId, id);
  }

  @Post(':id/deposit/require')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  requireDeposit(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RequireDepositDto,
  ): Promise<any> {
    return this.depositService.requireDeposit({
      orgId: req.user.orgId,
      reservationId: id,
      amount: dto.amount,
      createdById: req.user.userId,
    });
  }

  @Post(':id/deposit/pay')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async payDeposit(
    @Req() req: any,
    @Param('id') reservationId: string,
    @Body() dto: PayDepositDto,
  ): Promise<any> {
    // Find deposit for this reservation
    const deposit = await this.depositService.getDeposit(req.user.orgId, reservationId);
    if (!deposit) {
      throw new Error('Deposit not found for this reservation');
    }
    const result = await this.depositService.payDeposit({
      orgId: req.user.orgId,
      depositId: (deposit as { id: string }).id,
      paymentMethod: dto.paymentMethod,
      paidById: req.user.userId,
    });

    // Log notification
    await this.notificationService.send({
      orgId: req.user.orgId,
      reservationId,
      type: 'IN_APP',
      event: 'DEPOSIT_PAID',
      payload: { amount: (deposit as { amount: number }).amount },
    });

    return result;
  }

  @Post(':id/deposit/refund')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async refundDeposit(
    @Req() req: any,
    @Param('id') reservationId: string,
    @Body() dto: RefundDepositDto,
  ): Promise<any> {
    const deposit = await this.depositService.getDeposit(req.user.orgId, reservationId);
    if (!deposit) {
      throw new Error('Deposit not found for this reservation');
    }
    const result = await this.depositService.refundDeposit({
      orgId: req.user.orgId,
      depositId: (deposit as { id: string }).id,
      reason: dto.reason,
      refundedById: req.user.userId,
    });

    // Log notification
    await this.notificationService.send({
      orgId: req.user.orgId,
      reservationId,
      type: 'IN_APP',
      event: 'DEPOSIT_REFUNDED',
      payload: { reason: dto.reason },
    });

    return result;
  }

  @Post(':id/deposit/apply')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async applyDeposit(
    @Req() req: any,
    @Param('id') reservationId: string,
    @Body() dto: ApplyDepositDto,
  ): Promise<any> {
    const deposit = await this.depositService.getDeposit(req.user.orgId, reservationId);
    if (!deposit) {
      throw new Error('Deposit not found for this reservation');
    }
    const result = await this.depositService.applyDeposit({
      orgId: req.user.orgId,
      depositId: (deposit as { id: string }).id,
      appliedById: req.user.userId,
    });

    // Log notification
    await this.notificationService.send({
      orgId: req.user.orgId,
      reservationId,
      type: 'IN_APP',
      event: 'DEPOSIT_APPLIED',
      payload: { orderId: dto.orderId },
    });

    return result;
  }

  // ===== M9.2: Calendar/Timeline =====

  @Get('calendar')
  @Roles('L1')
  async getCalendar(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('date') date: string,
  ): Promise<any> {
    return this.reservationsService.getCalendar(req.user.orgId, branchId, date);
  }

  // ===== M9.2: Notification Audit =====

  @Get('notifications')
  @Roles('L2')
  getNotifications(
    @Req() req: any,
    @Query() query: NotificationQueryDto,
  ): Promise<any> {
    return this.notificationService.findLogs(req.user.orgId, {
      branchId: query.branchId,
      from: query.from,
      to: query.to,
      event: query.event,
    });
  }

  // ===== M9.3: Host Operations =====

  @Get('today-board')
  @Roles('L2') // Host/Manager
  async getTodayBoard(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('includeWaitlist') includeWaitlist?: string,
  ): Promise<any> {
    return this.hostOpsService.getTodayBoard(req.user.orgId, {
      branchId,
      status: status ? status.split(',') : undefined,
      includeWaitlist: includeWaitlist !== 'false',
    });
  }

  @Get('upcoming')
  @Roles('L2')
  async getUpcoming(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('hoursAhead') hoursAhead?: string,
  ): Promise<any> {
    return this.hostOpsService.getUpcoming(
      req.user.orgId,
      branchId,
      hoursAhead ? parseInt(hoursAhead, 10) : 2,
    );
  }

  @Get('table-statuses')
  @Roles('L2')
  async getTableStatuses(
    @Req() req: any,
    @Query('branchId') branchId: string,
  ): Promise<any> {
    return this.hostOpsService.getTableStatuses(req.user.orgId, branchId);
  }

  @Get('calendar-refresh-key')
  @Roles('L1')
  async getCalendarRefreshKey(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('date') date: string,
  ): Promise<any> {
    const key = await this.hostOpsService.getCalendarRefreshKey(
      req.user.orgId,
      branchId,
      date,
    );
    return { key };
  }

  // ===== M9.3: Automation =====

  @Post(':id/no-show-with-grace')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async noShowWithGrace(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<any> {
    return this.automationService.handleNoShowWithGrace(
      req.user.orgId,
      id,
      req.user.userId,
    );
  }

  @Get('check-capacity')
  @Roles('L2')
  async checkCapacity(
    @Req() req: any,
    @Query('branchId') branchId: string,
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
    @Query('partySize') partySize: string,
  ): Promise<any> {
    if (!branchId || !startAt || !endAt || !partySize) {
      throw new BadRequestException('branchId, startAt, endAt, partySize are required');
    }
    return this.automationService.checkCapacity(
      branchId,
      new Date(startAt),
      new Date(endAt),
      parseInt(partySize, 10),
    );
  }

  @Get('automation-logs')
  @Roles('L3') // Manager+ only
  async getAutomationLogs(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    return this.automationService.getAutomationLogs(req.user.orgId, {
      branchId,
      entityType,
      entityId,
      action,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('trigger-waitlist-promotion')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async triggerWaitlistPromotion(
    @Req() req: any,
    @Query('branchId') branchId: string,
  ): Promise<any> {
    const reservationId = await this.automationService.tryAutoPromoteWaitlist(branchId);
    return { promoted: !!reservationId, reservationId };
  }

  // ===== M9.4: Reporting Endpoints =====

  /**
   * Get reservation KPI summary
   * AC-06: Reports summary returns expected KPI keys
   * AC-08: RBAC enforced (L4+ for reports)
   */
  @Get('reports/summary')
  @Roles('L4') // Manager/Owner/Accountant only
  async getReportSummary(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    if (!from || !to) {
      throw new BadRequestException('from and to date parameters are required');
    }
    return this.reportingService.getSummary(req.user.orgId, { from, to, branchId });
  }

  /**
   * Export reservations as CSV
   * AC-07: Export returns valid CSV with headers
   * AC-08: RBAC enforced (L4+ for reports)
   */
  @Get('reports/export')
  @Roles('L4') // Manager/Owner/Accountant only
  async exportReservations(
    @Req() req: any,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<void> {
    if (!from || !to) {
      throw new BadRequestException('from and to date parameters are required');
    }

    const csv = await this.reportingService.exportCSV(req.user.orgId, { from, to, branchId });

    const filename = `reservations_${from}_to_${to}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  /**
   * Get detailed deposit report
   */
  @Get('reports/deposits')
  @Roles('L4')
  async getDepositReport(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ): Promise<any> {
    if (!from || !to) {
      throw new BadRequestException('from and to date parameters are required');
    }
    return this.reportingService.getDepositReport(req.user.orgId, { from, to, branchId });
  }
}
