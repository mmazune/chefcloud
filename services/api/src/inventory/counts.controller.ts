/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CountsService } from './counts.service';
import { BeginStockCountDto, SubmitStockCountDto } from './inventory.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventory/counts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CountsController {
  constructor(private countsService: CountsService) {}

  @Post('begin')
  @Roles('L3')
  async beginCount(@Req() req: any, @Body() dto: BeginStockCountDto): Promise<any> {
    return this.countsService.beginCount(
      req.user.orgId,
      req.user.branchId,
      req.user.userId,
      dto.notes,
    );
  }

  @Patch(':id/submit')
  @Roles('L3')
  async submitCount(
    @Param('id') id: string,
    @Body() dto: SubmitStockCountDto,
  ): Promise<any> {
    return this.countsService.submitCount(id, dto.lines, dto.notes);
  }

  @Get('current')
  @Roles('L3')
  async getCurrentCount(@Req() req: any): Promise<any> {
    return this.countsService.getCurrentCount(req.user.branchId);
  }
}
