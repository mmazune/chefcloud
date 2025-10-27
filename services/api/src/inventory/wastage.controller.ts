/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WastageService } from './wastage.service';
import { CreateWastageDto } from './wastage.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventory/wastage')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WastageController {
  constructor(private wastageService: WastageService) {}

  @Post()
  @Roles('L3')
  async recordWastage(@Req() req: any, @Body() dto: CreateWastageDto): Promise<any> {
    return this.wastageService.recordWastage(
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
      dto,
    );
  }
}
