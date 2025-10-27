import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString } from 'class-validator';
import { DeviceService } from './device.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../me/user.decorator';

class RegisterDeviceDto {
  @IsString()
  name!: string;

  @IsString()
  branchId!: string;
}

@Controller('devices')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  @Post('register')
  @Roles('L4') // Manager or above
  async register(@Body() dto: RegisterDeviceDto, @User() user: { orgId: string }) {
    return this.deviceService.registerDevice(dto.name, dto.branchId, user.orgId);
  }
}
