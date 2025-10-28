/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './reservations.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles('L2') // Front desk / host
  create(@Req() req: any, @Body() dto: CreateReservationDto): Promise<any> {
    return this.reservationsService.create(req.user.orgId, dto);
  }

  @Get()
  @Roles('L2')
  findAll(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    return this.reservationsService.findAll(req.user.orgId, from, to, status);
  }

  @Post(':id/confirm')
  @Roles('L2')
  confirm(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.confirm(req.user.orgId, id);
  }

  @Post(':id/cancel')
  @Roles('L2')
  cancel(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.cancel(req.user.orgId, id);
  }

  @Post(':id/seat')
  @Roles('L2')
  seat(@Req() req: any, @Param('id') id: string, @Body('orderId') orderId?: string): Promise<any> {
    return this.reservationsService.seat(req.user.orgId, id, orderId);
  }

  @Get('summary')
  @Roles('L3') // Manager+
  getSummary(@Req() req: any, @Query('from') from: string, @Query('to') to: string): Promise<any> {
    return this.reservationsService.getSummary(req.user.orgId, from, to);
  }
}
