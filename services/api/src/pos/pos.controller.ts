import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PosService } from './pos.service';
import {
  CreateOrderDto,
  ModifyOrderDto,
  VoidOrderDto,
  CloseOrderDto,
  ApplyDiscountDto,
} from './pos.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../me/user.decorator';

@Controller('pos/orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PosController {
  constructor(private posService: PosService) {}

  @Post()
  @Roles('L1')
  async createOrder(
    @Body() dto: CreateOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.createOrder(dto, user.userId, user.branchId);
  }

  @Post(':id/send-to-kitchen')
  @Roles('L1')
  async sendToKitchen(
    @Param('id') orderId: string,
    @User() user: { branchId: string },
  ): Promise<unknown> {
    return this.posService.sendToKitchen(orderId, user.branchId);
  }

  @Post(':id/modify')
  @Roles('L1')
  async modifyOrder(
    @Param('id') orderId: string,
    @Body() dto: ModifyOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.modifyOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/void')
  @Roles('L2')
  async voidOrder(
    @Param('id') orderId: string,
    @Body() dto: VoidOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.voidOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/close')
  @Roles('L1')
  async closeOrder(
    @Param('id') orderId: string,
    @Body() dto: CloseOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.closeOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/discount')
  @Roles('L2')
  async applyDiscount(
    @Param('id') orderId: string,
    @Body() dto: ApplyDiscountDto,
    @User() user: { userId: string; branchId: string; orgId: string },
  ): Promise<unknown> {
    return this.posService.applyDiscount(orderId, dto, user.userId, user.branchId, user.orgId);
  }
}
