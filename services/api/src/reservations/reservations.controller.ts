/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  UpdateReservationDto,
  CancelReservationDto,
  NoShowReservationDto,
  SeatReservationDto,
  AssignTablesDto,
} from './reservations.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

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
}
