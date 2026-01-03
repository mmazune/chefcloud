/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistEntryDto, DropWaitlistDto } from '../reservations/reservations.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('waitlist')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Roles('L2') // Front desk / host
  @UseInterceptors(IdempotencyInterceptor)
  create(@Req() req: any, @Body() dto: CreateWaitlistEntryDto): Promise<any> {
    return this.waitlistService.create(req.user.orgId, dto, req.user.userId);
  }

  @Get()
  @Roles('L2')
  findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    return this.waitlistService.findAll(req.user.orgId, branchId, status);
  }

  @Get('stats')
  @Roles('L2')
  getStats(@Req() req: any, @Query('branchId') branchId?: string): Promise<any> {
    return this.waitlistService.getStats(req.user.orgId, branchId);
  }

  @Get(':id')
  @Roles('L2')
  findOne(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.waitlistService.findOne(req.user.orgId, id);
  }

  @Post(':id/seat')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  seat(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.waitlistService.seat(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/drop')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  drop(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto?: DropWaitlistDto,
  ): Promise<any> {
    return this.waitlistService.drop(req.user.orgId, id, dto, req.user.userId);
  }
}
