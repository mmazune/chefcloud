/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PurchasingService } from './purchasing.service';
import { CreatePODto, ReceivePODto } from './purchasing.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('purchasing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PurchasingController {
  constructor(private purchasingService: PurchasingService) {}

  @Post('po')
  @Roles('L4')
  async createPO(@Req() req: any, @Body() dto: CreatePODto): Promise<any> {
    return this.purchasingService.createPO(req.user.orgId, req.user.branchId, dto);
  }

  @Post('po/:id/place')
  @Roles('L4')
  async placePO(@Param('id') poId: string): Promise<any> {
    return this.purchasingService.placePO(poId);
  }

  @Post('po/:id/receive')
  @Roles('L3')
  async receivePO(@Req() req: any, @Param('id') poId: string, @Body() dto: ReceivePODto): Promise<any> {
    return this.purchasingService.receivePO(poId, dto, req.user.orgId, req.user.branchId);
  }
}
