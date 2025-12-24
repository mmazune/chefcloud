import { Controller, Post, Get, Param, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
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
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('pos/orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SkipThrottle()
export class PosController {
  constructor(private posService: PosService) {}

  /**
   * M26-S1: Get all orders for POS (open orders, today's closed, etc.)
   */
  @Get()
  @Roles('L1')
  async getOrders(
    @Query('status') status?: string,
    @User() user?: { branchId: string },
  ): Promise<unknown> {
    return this.posService.getOrders(user.branchId, status);
  }

  /**
   * M26-S1: Get single order details
   */
  @Get(':id')
  @Roles('L1')
  async getOrder(
    @Param('id') orderId: string,
    @User() user?: { branchId: string },
  ): Promise<unknown> {
    return this.posService.getOrder(orderId, user.branchId);
  }

  @Post()
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor)
  async createOrder(
    @Body() dto: CreateOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.createOrder(dto, user.userId, user.branchId);
  }

  @Post(':id/send-to-kitchen')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor)
  async sendToKitchen(
    @Param('id') orderId: string,
    @User() user: { branchId: string },
  ): Promise<unknown> {
    return this.posService.sendToKitchen(orderId, user.branchId);
  }

  @Post(':id/modify')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor)
  async modifyOrder(
    @Param('id') orderId: string,
    @Body() dto: ModifyOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.modifyOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/void')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async voidOrder(
    @Param('id') orderId: string,
    @Body() dto: VoidOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.voidOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/close')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor)
  async closeOrder(
    @Param('id') orderId: string,
    @Body() dto: CloseOrderDto,
    @User() user: { userId: string; branchId: string },
  ): Promise<unknown> {
    return this.posService.closeOrder(orderId, dto, user.userId, user.branchId);
  }

  @Post(':id/discount')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor)
  async applyDiscount(
    @Param('id') orderId: string,
    @Body() dto: ApplyDiscountDto,
    @User() user: { userId: string; branchId: string; orgId: string },
  ): Promise<unknown> {
    return this.posService.applyDiscount(orderId, dto, user.userId, user.branchId, user.orgId);
  }

  @Post(':id/post-close-void')
  @Roles('L4') // Only L4+ can void closed orders
  @UseInterceptors(IdempotencyInterceptor)
  async postCloseVoid(
    @Param('id') orderId: string,
    @Body() dto: { reason: string; managerPin?: string },
    @User() user: { userId: string; branchId: string; orgId: string },
  ): Promise<unknown> {
    return this.posService.postCloseVoid(
      orderId,
      dto.reason,
      dto.managerPin,
      user.userId,
      user.orgId,
    );
  }
}
