import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CashService } from './cash.service';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    orgId: string;
    role: string;
    id: string;
    branchId?: string;
  };
}

@Controller('cash')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CashController {
  constructor(private cashService: CashService) {}

  @Post('till/open')
  @Roles('L2', 'L3', 'L4', 'L5')
  async openTillSession(
    @Body()
    dto: {
      branchId: string;
      drawerId: string;
      openingFloat: number;
      shiftId?: string;
    },
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.cashService.openTillSession(
      req.user.orgId,
      dto.branchId,
      dto.drawerId,
      dto.openingFloat,
      req.user.id,
      dto.shiftId,
    );
  }

  @Patch('till/:id/close')
  @Roles('L2', 'L3', 'L4', 'L5')
  async closeTillSession(
    @Param('id') tillSessionId: string,
    @Body() dto: { closingCount: number },
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.cashService.closeTillSession(
      tillSessionId,
      req.user.orgId,
      dto.closingCount,
      req.user.id,
    );
  }

  @Post('movements')
  @Roles('L2', 'L3', 'L4', 'L5')
  async createCashMovement(
    @Body()
    dto: {
      branchId: string;
      tillSessionId: string;
      type: 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP' | 'PICKUP';
      amount: number;
      reason?: string;
    },
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.cashService.createCashMovement(
      req.user.orgId,
      dto.branchId,
      dto.tillSessionId,
      dto.type,
      dto.amount,
      dto.reason,
      req.user.id,
      req.user.role,
    );
  }

  @Get('till/current')
  @Roles('L2', 'L3', 'L4', 'L5')
  async getCurrentTillSession(
    @Query('branchId') branchId: string,
    @Query('drawerId') drawerId: string | undefined,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.cashService.getCurrentTillSession(req.user.orgId, branchId, drawerId);
  }

  @Get('till/sessions')
  @Roles('L3', 'L4', 'L5')
  async getTillSessions(
    @Query('branchId') branchId: string,
    @Query('startDate') startDate: string | undefined,
    @Query('endDate') endDate: string | undefined,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    return this.cashService.getTillSessions(
      req.user.orgId,
      branchId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
