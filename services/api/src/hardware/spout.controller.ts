/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Get, Body, Query, Headers, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SpoutService } from './spout.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class IngestEventDto {
  deviceId!: string;
  pulses!: number;
  occurredAt!: string;
  raw?: any;
}

class CreateDeviceDto {
  name!: string;
  vendor!: string;
  branchId!: string;
}

class CalibrateDto {
  deviceId!: string;
  inventoryItemId!: string;
  mlPerPulse!: number;
}

@Controller('hardware/spout')
export class SpoutController {
  constructor(private spoutService: SpoutService) {}

  @Post('ingest')
  async ingestEvent(@Headers('x-spout-signature') signature: string | undefined, @Body() dto: IngestEventDto): Promise<any> {
    const occurredAt = new Date(dto.occurredAt);

    return this.spoutService.ingestEvent(
      dto.deviceId,
      dto.pulses,
      occurredAt,
      dto.raw,
      signature,
    );
  }

  @Post('devices')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async createDevice(@Req() req: any, @Body() dto: CreateDeviceDto): Promise<any> {
    return this.spoutService.createDevice(
      req.user.orgId,
      dto.branchId,
      dto.name,
      dto.vendor,
    );
  }

  @Post('calibrate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async calibrate(@Body() dto: CalibrateDto): Promise<any> {
    return this.spoutService.calibrate(
      dto.deviceId,
      dto.inventoryItemId,
      dto.mlPerPulse,
    );
  }

  @Get('events')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('L4')
  async getEvents(
    @Query('deviceId') deviceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any> {
    return this.spoutService.getEvents(
      deviceId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
